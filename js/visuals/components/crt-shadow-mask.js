// === js/visuals/components/crt-shadow-mask.js ===
//
// CRT-Schattenmaske für Röhrenmonitore der Heimcomputer-Ära (C64, Amiga, Atari ST).
// Post-Processing eines 2D-Quell-Canvas in WebGL 1 (ein Haupt-Pass, optional ein kleiner Glow-Pass).
//
// Nutzung (rückwärtskompatibel zur bisherigen Signatur):
//   const crt = new CrtShadowMask(sourceCanvas, maskCanvas, ok => document.body.classList.toggle('crt-css', !ok));
//   const crt = new CrtShadowMask(src, mask, onAvailability, { preset: 'composite', maskType: 'delta', pitch: 4 });
//   crt.render();                           // einmal pro Frame, nachdem das Quell-Canvas fertig gezeichnet ist
//   crt.setOptions({ quality: 'medium' });  // zur Laufzeit; crt.dispose() gibt die GPU-Ressourcen frei
//
// Pipeline (alles in linearem Licht; Gamma 2.0 = x*x bzw. sqrt, billig und exakt umkehrbar):
//   1. Röhrenkrümmung (Barrel) + kantenglatte Begrenzung der sichtbaren Röhrenfläche
//   2. Strahl: horizontale Videobandbreite (2 Bilinear-Taps = 3-Tap-Gauß) je Farbkanal,
//      radiale R/B-Konvergenzdrift als echte Verschiebung (kein Überblenden mehr)
//   3. Halation (Streulicht in der Frontscheibe): weicher Glow aus einem Low-Res-Pass (4:1-Box
//      in einen FBO, im Hauptpass bilinear abgetastet) statt Ring-Taps -> keine Echo-Konturen
//   4. Strahlstrom-Energie -> Spot-Blooming: Maske und Zeilenlücken laufen bei Weißglut zu
//   5. Phosphor-Maske pixelgenau in Geräte-Pixeln, auf ganze Pixel gerastet, analytisch
//      geglättet und auf Mittelwert 1 normiert (Slot / Delta-Triaden / Aperture Grille)
//   6. Scanlines, Vignette (cos^4), Glasschimmer + Grundpegel, Dithering, zurück nach Gamma
//
// Tonwert: Die Maske ist energieerhaltend, die Helligkeit bleibt also wie im Quell-Canvas. Den
// dunkleren, kontrastreicheren Look der Vorversion trifft { contrast: 1.5 } annähernd (<= 0,05).
// Kosten (Texturzugriffe/Pixel): low 4 | medium 6 | high 6 + 5 Glow + ~0,25 für den Low-Res-Pass.
// Braucht highp im Fragment-Shader; fehlt das (oder WebGL), greift der CSS-Fallback über den Callback.

const MASK_TYPES = Object.freeze({ slot: 0, delta: 1, grille: 2 });
const QUALITY_LEVELS = Object.freeze({ low: 0, medium: 1, high: 2 });

// Phosphor-Geometrie je Maskentyp: Füllgrad relativ zum Raster und mittlere Deckung pro
// Farbkanal. Die Deckung normiert die Maske auf Mittelwert 1 (Gesamthelligkeit bleibt erhalten).
const MASK_SHAPES = Object.freeze({
    // Staggered Slot-Triaden: Schlitze in Reihen, jede Reihe um eine halbe Triade versetzt
    slot: { fillX: 0.72, fillY: 0.80, coverage: (fx, fy) => fx * fy / 3 },
    // Lochmaske: runde Punkte auf echtem Hex-Gitter, Farbe = Dreiecks-Triade
    delta: { fillX: 0.84, fillY: 0.84, coverage: fx => (2 * Math.PI / (3 * Math.sqrt(3))) * fx * fx / 4 },
    // Aperture Grille (Trinitron-Art): durchgehende vertikale Streifen
    grille: { fillX: 0.88, fillY: 1.0, coverage: fx => fx / 3 }
});

// Bei Weißglut überstrahlt der Elektronenfleck die Maskenstege und füllt die Zeilenlücken:
// verbleibende Tiefe relativ zur Tiefe bei schwachem Strahlstrom.
const MASK_DEPTH_AT_FULL_BEAM = 0.17;
const SCAN_DEPTH_AT_FULL_BEAM = 0.18;
// Linearer Grundpegel (Umgebungslicht auf der Scheibe) und Amplitude des Glasschimmers.
const GLASS_BLACK_LEVEL = 0.00004;
const GLASS_SHEEN_LEVEL = 0.00010;

const DEFAULT_OPTIONS = Object.freeze({
    quality: 'high',            // 'low' | 'medium' (ohne Halation) | 'high' (mit Low-Res-Glow-Pass)
    maskType: 'slot',           // 'slot' | 'delta' | 'grille'
    pitch: 3,                   // Triadenbreite in CSS-px (rastet auf ganze Geräte-px: Slot/Grille x3, Delta x6)
    maskStrength: 1,            // 0 = keine Maske, 1 = volle Tiefe bei schwachem Strahlstrom
    blackMatrix: 0.3,           // Transmission der Black-Matrix-Stege (0 = tiefschwarz)
    scanlineStrength: 0.3,      // Tiefe der Zeilenlücken bei schwachem Strahlstrom
    scanlineRows: 1,            // Maskenzeilen pro Scanline (2 ~ authentischer für 15-kHz-Monitore)
    beamBlur: 0.25,             // horizontale Strahlbreite in CSS-px (0 = aus)
    halation: 0.1,              // Anteil Streulicht der Frontscheibe (lineare Energie, nur 'high')
    convergence: 0.5,           // R/B-Drift in den Ecken, CSS-px
    curvature: Object.freeze([0.014, 0.018]), // Barrel-Verzeichnung x/y
    cornerRadius: 0.012,        // Eckenrundung relativ zur kürzeren Kante
    vignette: 0.28,             // Helligkeitsverlust in den Ecken (0..0.9)
    glass: 1,                   // Stärke von Grundgrau + Glasschimmer
    contrast: 1.15,             // Kennlinie des Strahlstroms (1 = linear)
    brightness: 1,
    dither: true,               // +-0,5 LSB gegen Banding in den dunklen Glow-Verläufen
    allowSoftwareGL: false      // true: auch auf Software-Renderern laufen (nur beim Erzeugen wirksam)
});

// Look-Vorschläge: unterscheiden sich im Signalpfad, nicht in der Maskengeometrie.
const PRESETS = Object.freeze({
    // 15-kHz-RGB-Monitore (z. B. Amiga 1084, Atari SC1224): scharfes Signal
    rgb: { beamBlur: 0.3, halation: 0.12, convergence: 0.8 },
    // C64 an Composite/S-Video oder Fernseher: weicher Strahl, mehr Streulicht
    composite: { beamBlur: 0.7, halation: 0.22, convergence: 1.2, scanlineStrength: 0.36 },
    // Aperture-Grille-Monitor (Trinitron-Art)
    grille: { maskType: 'grille', beamBlur: 0.3, halation: 0.16, convergence: 0.5, scanlineStrength: 0.22 }
});

const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const clampNumber = (value, min, max, fallback) =>
    Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

function resolveOptions(user) {
    const merged = { ...DEFAULT_OPTIONS, ...(has(PRESETS, user.preset) ? PRESETS[user.preset] : null), ...user };
    const curvature = Array.isArray(merged.curvature) ? merged.curvature : [merged.curvature, merged.curvature];
    return {
        quality: has(QUALITY_LEVELS, merged.quality) ? merged.quality : DEFAULT_OPTIONS.quality,
        maskType: has(MASK_TYPES, merged.maskType) ? merged.maskType : DEFAULT_OPTIONS.maskType,
        pitch: clampNumber(merged.pitch, 1, 16, DEFAULT_OPTIONS.pitch),
        maskStrength: clampNumber(merged.maskStrength, 0, 1.5, DEFAULT_OPTIONS.maskStrength),
        blackMatrix: clampNumber(merged.blackMatrix, 0, 1, DEFAULT_OPTIONS.blackMatrix),
        scanlineStrength: clampNumber(merged.scanlineStrength, 0, 1, DEFAULT_OPTIONS.scanlineStrength),
        scanlineRows: Math.round(clampNumber(merged.scanlineRows, 1, 8, DEFAULT_OPTIONS.scanlineRows)),
        beamBlur: clampNumber(merged.beamBlur, 0, 2, DEFAULT_OPTIONS.beamBlur),
        halation: clampNumber(merged.halation, 0, 1, DEFAULT_OPTIONS.halation),
        convergence: clampNumber(merged.convergence, 0, 8, DEFAULT_OPTIONS.convergence),
        curvature: [
            clampNumber(curvature[0], 0, 0.2, DEFAULT_OPTIONS.curvature[0]),
            clampNumber(curvature[1], 0, 0.2, DEFAULT_OPTIONS.curvature[1])
        ],
        cornerRadius: clampNumber(merged.cornerRadius, 0, 0.25, DEFAULT_OPTIONS.cornerRadius),
        vignette: clampNumber(merged.vignette, 0, 0.9, DEFAULT_OPTIONS.vignette),
        glass: clampNumber(merged.glass, 0, 4, DEFAULT_OPTIONS.glass),
        contrast: clampNumber(merged.contrast, 0.5, 2, DEFAULT_OPTIONS.contrast),
        brightness: clampNumber(merged.brightness, 0, 4, DEFAULT_OPTIONS.brightness),
        dither: merged.dither !== false,
        allowSoftwareGL: merged.allowSoftwareGL === true
    };
}

// Vollbild-Dreieck statt Quad: keine Diagonalnaht, kein doppelt schattiertes Pixelpaar.
// Die Pixelkoordinate kommt als highp-Varying aus dem Vertex-Shader: gl_FragCoord ist in
// GLSL ES 1.00 nur mediump spezifiziert und kann auf Mobil-GPUs ab ~1000 px zu grob werden.
const VERTEX_SHADER_SOURCE = `
attribute vec2 a_position;
uniform vec2 u_resolution;
varying vec2 v_px;

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_px = (a_position * 0.5 + 0.5) * u_resolution;   // Geräte-Pixel, Ursprung unten links
}
`;

const FRAGMENT_SHADER_BODY = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

varying vec2 v_px;

uniform sampler2D u_source;
uniform sampler2D u_glow;     // Low-Res-Kopie der Quelle (nur QUALITY 2), Ablage als sqrt()
uniform vec2  u_resolution;   // Geräte-Pixel
uniform vec2  u_texel;        // 1 / u_resolution
uniform vec2  u_glowStep;     // Tap-Abstand im Glow-Raster (UV)
uniform vec4  u_mask;         // x: Triadenbreite W [px]  y: Zeilenhöhe H [px]  z: Reihenversatz [px]  w: Typ (0 slot, 1 delta, 2 grille)
uniform vec4  u_phos;         // x: Füllgrad X  y: Füllgrad Y  z: Transmission der Stege  w: mittlere Transmission (Normierung)
uniform vec4  u_dyn;          // x: Masken-Tiefe  y: Faktor bei Vollstrahl  z: Scanline-Tiefe  w: Faktor bei Vollstrahl
uniform vec2  u_scan;         // x: Zeilenabstand der Scanlines [px]  y: Phase (Peak bei fract(y/Pitch + Phase) = 0.5)
uniform vec4  u_beam;         // x: horizontale Strahlbreite [px]  y: Halation  z: Konvergenz [px]  w: Kontrast
uniform vec4  u_geo;          // xy: Krümmung  z: Eckenradius [px]  w: Vignetten-Koeffizient
uniform vec4  u_tone;         // x: Helligkeit  y: Grundpegel  z: Glasschimmer  w: Dithering an/aus

// Gamma 2.0 -> linear. Billiger als pow(), exakt umkehrbar mit sqrt().
vec3 fetch(vec2 uv) {
    vec3 c = texture2D(u_source, uv).rgb;
    return c * c;
}

#if QUALITY >= 2
vec3 glowFetch(vec2 uv) {
    vec3 c = texture2D(u_glow, uv).rgb;
    return c * c;
}
#endif

// Exakte Flächendeckung eines 1-px-Boxfilters über einem Streifen der Halbbreite hw
// (d = Abstand zur Streifenmitte). Kein Aliasing, auch bei Streifen < 1 px.
vec3 boxCover(vec3 d, float hw) {
    return clamp(vec3(hw + 0.5) - abs(d), 0.0, min(1.0, 2.0 * hw));
}
float boxCover1(float d, float hw) {
    return clamp(hw + 0.5 - abs(d), 0.0, min(1.0, 2.0 * hw));
}

// Staggered Slot-Maske: RGB-Schlitze, jede Reihe um u_mask.z versetzt.
vec3 slotMask(vec2 p) {
    float W = u_mask.x;
    float H = u_mask.y;
    float row = floor(p.y / H);
    float yIn = p.y - (row + 0.5) * H;
    float xs  = p.x + mod(row, 2.0) * u_mask.z;
    float sw  = W / 3.0;
    vec3 dx = (fract((xs - sw * vec3(0.5, 1.5, 2.5)) / W + 0.5) - 0.5) * W;
    return boxCover(dx, 0.5 * u_phos.x * sw) * boxCover1(yIn, 0.5 * u_phos.y * H);
}

// Aperture Grille: durchgehende vertikale RGB-Streifen.
vec3 grilleMask(vec2 p) {
    float W  = u_mask.x;
    float sw = W / 3.0;
    vec3 dx = (fract((p.x - sw * vec3(0.5, 1.5, 2.5)) / W + 0.5) - 0.5) * W;
    return boxCover(dx, 0.5 * u_phos.x * sw);
}

// Lochmaske: runde Phosphorpunkte auf einem echten Hex-Gitter. Nächster Gitterpunkt aus zwei
// ineinandergeschobenen Rechteckrastern; die Farbe folgt aus der Halbschritt-Spalte xi
// (benachbarte Punkte unterscheiden sich immer, jedes Dreieck ist eine RGB-Triade).
vec3 deltaMask(vec2 p) {
    float a = u_mask.x * 0.57735027;                  // Punktabstand a = W / sqrt(3)
    vec2  q = p / a;
    const vec2 s = vec2(1.0, 1.7320508);
    vec4 hc = floor(vec4(q, q - vec2(0.5, 0.8660254)) / s.xyxy) + 0.5;
    vec4 h  = vec4(q - hc.xy * s, q - (hc.zw + 0.5) * s);
    bool useA = dot(h.xy, h.xy) < dot(h.zw, h.zw);
    vec2  o   = useA ? h.xy : h.zw;
    float xi  = useA ? 2.0 * hc.x : 2.0 * hc.z + 1.0;
    float c   = mod(xi, 3.0);
    float cov = clamp(0.5 * u_phos.x * a + 0.5 - length(o) * a, 0.0, 1.0);
    return cov * vec3(step(c, 0.5), step(0.5, c) * step(c, 1.5), step(1.5, c));
}

void main() {
    vec2 p  = vec2(v_px.x, u_resolution.y - v_px.y);  // Geräte-Pixel, Ursprung oben links
    vec2 uv = p * u_texel;

    // 1. Röhrenkrümmung + Begrenzung der sichtbaren Fläche (1 px kantenglatt)
    vec2 c = uv * 2.0 - 1.0;
    c += c * (c.yx * c.yx) * u_geo.xy;
    vec2 w = c * 0.5 + 0.5;

    vec2 hs = 0.5 * u_resolution;
    vec2 q  = c * hs;
    vec2 dq = abs(q) - (hs - u_geo.z);
    float sd = length(max(dq, 0.0)) + min(max(dq.x, dq.y), 0.0) - u_geo.z;
    float inside = clamp(0.5 - sd, 0.0, 1.0);

    // 2. Strahl: Bandbreite + Konvergenz. Jeder Kanal wird an seiner eigenen Position abgetastet.
    // Kernel [a, 1-2a, a] == zwei Bilinear-Taps bei +-2a mit Gewicht 0,5: u_beam.x ist der Offset 2a.
    vec2 hb   = vec2(u_beam.x * u_texel.x, 0.0);
    vec2 conv = c * dot(c, c) * 0.5 * u_beam.z * u_texel;
#if QUALITY >= 1
    vec3 beam = vec3(
        0.5 * (fetch(w + conv - hb).r + fetch(w + conv + hb).r),
        0.5 * (fetch(w - hb).g        + fetch(w + hb).g),
        0.5 * (fetch(w - conv - hb).b + fetch(w - conv + hb).b));
#else
    vec3 beam = vec3(
        fetch(w + conv).r,
        0.5 * (fetch(w - hb).g + fetch(w + hb).g),
        fetch(w - conv).b);
#endif

    // 3. Halation: Streulicht in der Frontscheibe, energieerhaltend gemischt. Das Glow-Raster ist
    //    schon eine 4:1-Boxfilter-Kopie; Bilinear-Abtastung + 5 Taps ergeben einen glatten Halo
    //    ohne die Echo-Konturen, die weit gestreute Einzel-Taps bei dünnen Linien erzeugen.
    vec3 lin = beam;
#if QUALITY >= 2
    if (u_beam.y > 0.0) {
        vec3 glow = 0.28 * glowFetch(w) + 0.18 * (
            glowFetch(w + u_glowStep) + glowFetch(w - u_glowStep) +
            glowFetch(w + vec2(u_glowStep.x, -u_glowStep.y)) +
            glowFetch(w + vec2(-u_glowStep.x, u_glowStep.y)));
        lin = mix(beam, glow, u_beam.y);
    }
#endif

    // 4. Strahlstrom-Energie (wahrnehmungsnah, daher in Gamma-Einheiten) steuert das Blooming
    float luma  = dot(lin, vec3(0.299, 0.587, 0.114));
    float peak  = max(lin.r, max(lin.g, lin.b));
    float bloom = smoothstep(0.28, 0.98, max(sqrt(luma), 0.85 * sqrt(peak)));

    // 5. Phosphor-Maske: Pixelposition, nicht gekrümmte UV -> kein Schwimmen, kein Moiré
    vec3 cov;
    if (u_mask.w < 0.5)      cov = slotMask(p);
    else if (u_mask.w < 1.5) cov = deltaMask(p);
    else                     cov = grilleMask(p);
    vec3 maskGain = (u_phos.z + (1.0 - u_phos.z) * cov) / u_phos.w;
    float maskDepth = u_dyn.x * mix(1.0, u_dyn.y, bloom);
    vec3 gain = max(mix(vec3(1.0), maskGain, maskDepth), 0.0);

    // 6. Scanlines: Raised-Cosine, phasengleich zur Zeilenmitte, mittelwertnormiert
    float wave = 0.5 - 0.5 * cos(6.2831853 * fract(p.y / u_scan.x + u_scan.y));
    float scanDepth = u_dyn.z * mix(1.0, u_dyn.w, bloom);
    float scan = (1.0 - scanDepth * (1.0 - wave)) / (1.0 - 0.5 * scanDepth);

    lin *= gain * scan * u_tone.x;
    lin = pow(max(lin, vec3(0.0)), vec3(u_beam.w));

    // 7. Vignette (cos^4-Randabfall), Röhrenrand, Glasschimmer + Grundpegel (additiv, linear)
    float r2  = dot(q, q) / dot(hs, hs);              // 0 in der Mitte, 1 in den Ecken
    float vig = 1.0 / (1.0 + u_geo.w * r2);
    vig *= vig;
    float sheen = (1.0 - 0.35 * dot(c, c)) * smoothstep(-0.8, 0.9, 0.65 * w.y - 0.35 * w.x);
    lin = (lin * vig + u_tone.y + u_tone.z * sheen) * inside;

    vec3 color = sqrt(clamp(lin, 0.0, 1.0));
    if (u_tone.w > 0.5) {
        // Interleaved Gradient Noise (Jimenez), +-0,5 LSB gegen Banding in dunklen Verläufen
        float n = fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
        color += (n - 0.5) / 255.0;
    }
    gl_FragColor = vec4(color, 1.0);
}
`;

// Low-Res-Pass der Halation: 4:1-Boxfilter in linearem Licht. Vier Bilinear-Taps im Abstand
// eines Viertel Ziel-Texels decken den ganzen Block ab. Ablage als sqrt() (Gamma), damit die
// dunklen Ausläufer des Halos in 8 Bit nicht bandieren. Zeile 0 = Bildoberkante (wie die Quelle).
const GLOW_FRAGMENT_SHADER_SOURCE = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

varying vec2 v_px;
uniform sampler2D u_source;
uniform vec2 u_resolution;    // Größe des Glow-Ziels [px]

void main() {
    vec2 uv = v_px / u_resolution;
    vec2 s  = 0.25 / u_resolution;
    vec3 a = texture2D(u_source, uv + vec2( s.x,  s.y)).rgb;
    vec3 b = texture2D(u_source, uv + vec2(-s.x,  s.y)).rgb;
    vec3 c = texture2D(u_source, uv + vec2( s.x, -s.y)).rgb;
    vec3 d = texture2D(u_source, uv + vec2(-s.x, -s.y)).rgb;
    gl_FragColor = vec4(sqrt(0.25 * (a * a + b * b + c * c + d * d)), 1.0);
}
`;

const GLOW_DIVISOR = 4;     // Glow-Raster = Quelle / 4
const GLOW_TAP_SPACING = 1.6; // Tap-Abstand in Glow-Texeln (bei DPR >= 2 proportional größer)

const buildFragmentSource = quality => `#define QUALITY ${quality}\n${FRAGMENT_SHADER_BODY}`;

const UNIFORM_NAMES = [
    'u_source', 'u_glow', 'u_resolution', 'u_texel', 'u_glowStep', 'u_mask', 'u_phos',
    'u_dyn', 'u_scan', 'u_beam', 'u_geo', 'u_tone'
];

const TRIANGLE_VERTICES = new Float32Array([-1, -1, 3, -1, -1, 3]);

export class CrtShadowMask {
    constructor(sourceCanvas, maskCanvas, onAvailabilityChange = () => {}, options = {}) {
        this.sourceCanvas = sourceCanvas;
        this.canvas = maskCanvas;
        this.onAvailabilityChange = onAvailabilityChange;
        this.isReady = false;
        this.gl = null;
        this.program = null;
        this.buffer = null;
        this.texture = null;
        this.glow = null;
        this.uniforms = {};
        this.uniformsDirty = true;
        this.userOptions = { ...options };
        this.options = resolveOptions(this.userOptions);

        if (!sourceCanvas || !maskCanvas) {
            console.warn('[CRT MASK] Source or output canvas is missing; using the CSS fallback.');
            return;
        }

        const gl = maskCanvas.getContext('webgl', {
            alpha: false,
            antialias: false,
            depth: false,
            stencil: false,
            preserveDrawingBuffer: false,
            powerPreference: 'low-power',
            // Ein Vollbild-Shader auf einem Software-Rasterizer wäre ruckelig: lieber CSS-Fallback.
            failIfMajorPerformanceCaveat: !this.options.allowSoftwareGL
        });
        if (!gl) {
            console.warn('[CRT MASK] Hardware-accelerated WebGL is unavailable; using the CSS fallback.');
            return;
        }

        this.gl = gl;
        if (!this.initialize(gl)) return;

        this.isReady = true;
        this.onAvailabilityChange(true);

        this.handleContextLost = event => {
            event.preventDefault();
            this.isReady = false;
            // Ressourcen gehören zum toten Kontext: nur vergessen, nicht löschen.
            this.program = this.buffer = this.texture = this.glow = null;
            this.onAvailabilityChange(false);
            console.warn('[CRT MASK] WebGL context was lost; using the CSS fallback.');
        };
        this.handleContextRestored = () => {
            if (this.initialize(this.gl)) {
                this.isReady = true;
                this.onAvailabilityChange(true);
            }
        };
        maskCanvas.addEventListener('webglcontextlost', this.handleContextLost);
        maskCanvas.addEventListener('webglcontextrestored', this.handleContextRestored);
    }

    // Optionen zur Laufzeit ändern; nur 'quality' erzwingt ein Neukompilieren des Shaders.
    setOptions(options = {}) {
        const previousQuality = this.options.quality;
        this.userOptions = { ...this.userOptions, ...options };
        this.options = resolveOptions(this.userOptions);
        this.uniformsDirty = true;
        if (this.gl && this.isReady && this.options.quality !== previousQuality) {
            if (!this.initialize(this.gl)) this.fail('Shader rebuild failed');
        }
    }

    // Gibt GPU-Ressourcen frei (löst onAvailabilityChange bewusst nicht aus).
    dispose() {
        if (this.canvas) {
            this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
            this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);
        }
        if (this.gl && !this.gl.isContextLost()) this.releaseResources(this.gl);
        this.isReady = false;
        this.gl = null;
    }

    fail(reason) {
        if (!this.isReady) return;
        this.isReady = false;
        console.warn(`[CRT MASK] ${reason}; using the CSS fallback.`);
        this.onAvailabilityChange(false);
    }

    releaseResources(gl) {
        if (this.program) gl.deleteProgram(this.program);
        if (this.buffer) gl.deleteBuffer(this.buffer);
        if (this.texture) gl.deleteTexture(this.texture);
        if (this.glow) {
            gl.deleteProgram(this.glow.program);
            gl.deleteFramebuffer(this.glow.framebuffer);
            gl.deleteTexture(this.glow.texture);
        }
        this.program = this.buffer = this.texture = this.glow = null;
    }

    compileShader(gl, type, source) {
        const shader = gl.createShader(type);
        if (!shader) {
            console.error('[CRT MASK] Failed to create a WebGL shader.');
            return null;
        }

        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('[CRT MASK] Shader compilation failed:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    // Vertex- + Fragment-Shader zu einem Programm binden; a_position liegt immer auf Slot 0,
    // damit beide Programme dasselbe Vertex-Attribut-Setup teilen.
    createProgram(gl, fragmentSource) {
        const vertexShader = this.compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
        if (!vertexShader) return null;
        const fragmentShader = this.compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
        if (!fragmentShader) {
            gl.deleteShader(vertexShader);
            return null;
        }

        const program = gl.createProgram();
        if (!program) {
            console.error('[CRT MASK] Failed to create a WebGL program.');
            gl.deleteShader(vertexShader);
            gl.deleteShader(fragmentShader);
            return null;
        }
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.bindAttribLocation(program, 0, 'a_position');
        gl.linkProgram(program);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('[CRT MASK] Shader linking failed:', gl.getProgramInfoLog(program));
            gl.deleteProgram(program);
            return null;
        }
        return program;
    }

    // Low-Res-Pass samt FBO für die Halation. Gibt null zurück, wenn die Grafikkarte das
    // nicht kann; der Aufrufer fällt dann auf Qualität 'medium' (ohne Halation) zurück.
    createGlow(gl) {
        const program = this.createProgram(gl, GLOW_FRAGMENT_SHADER_SOURCE);
        if (!program) return null;
        const texture = gl.createTexture();
        const framebuffer = gl.createFramebuffer();
        if (!texture || !framebuffer) {
            gl.deleteTexture(texture);
            gl.deleteFramebuffer(framebuffer);
            gl.deleteProgram(program);
            return null;
        }

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 4, 4, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.activeTexture(gl.TEXTURE0);
        if (!complete) {
            console.warn('[CRT MASK] Render-to-texture is unavailable; halation disabled.');
            gl.deleteTexture(texture);
            gl.deleteFramebuffer(framebuffer);
            gl.deleteProgram(program);
            return null;
        }

        return {
            program,
            texture,
            framebuffer,
            resolutionLocation: gl.getUniformLocation(program, 'u_resolution'),
            sourceLocation: gl.getUniformLocation(program, 'u_source'),
            width: 0,
            height: 0
        };
    }

    initialize(gl) {
        // Maske und Konvergenz brauchen highp (sonst zerfällt das Raster ab ~1000 px).
        const precision = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
        if (!precision || precision.precision === 0) {
            console.warn('[CRT MASK] highp float is unavailable in fragment shaders; using the CSS fallback.');
            return false;
        }

        this.releaseResources(gl);

        let quality = QUALITY_LEVELS[this.options.quality];
        if (quality >= 2) {
            this.glow = this.createGlow(gl);
            if (!this.glow) quality = 1;
        }

        const program = this.createProgram(gl, buildFragmentSource(quality));
        if (!program) {
            this.releaseResources(gl);
            return false;
        }

        const buffer = gl.createBuffer();
        const texture = gl.createTexture();
        const sourceLocation = gl.getUniformLocation(program, 'u_source');
        if (!buffer || !texture || sourceLocation === null) {
            console.error('[CRT MASK] Failed to initialize WebGL resources.');
            gl.deleteBuffer(buffer);
            gl.deleteTexture(texture);
            gl.deleteProgram(program);
            this.releaseResources(gl);
            return false;
        }

        this.program = program;
        this.buffer = buffer;
        this.texture = texture;
        // Vom Compiler wegoptimierte Uniforms liefern null; gl.uniform*(null, ...) ist ein No-op.
        this.uniforms = {};
        for (const name of UNIFORM_NAMES) this.uniforms[name] = gl.getUniformLocation(program, name);
        this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        this.textureWidth = 0;
        this.textureHeight = 0;
        this.viewportWidth = 0;
        this.viewportHeight = 0;
        this.uniformCssWidth = 0;
        this.uniformCssHeight = 0;
        this.uniformsDirty = true;

        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, TRIANGLE_VERTICES, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        // Bilineare Filterung: subpixelgenaue Krümmung, Konvergenzdrift und Strahlglättung.
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        // Kein Flip beim Upload (der Shader rechnet mit Ursprung oben links). Halbtransparente
        // Canvas-Pixel werden vormultipliziert, also wie auf schwarzem Grund zusammengesetzt.
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
        gl.uniform1i(sourceLocation, 0);
        gl.uniform1i(this.uniforms.u_glow, 1);
        if (this.glow) {
            gl.useProgram(this.glow.program);
            gl.uniform1i(this.glow.sourceLocation, 0);
            gl.useProgram(program);
        }
        gl.disable(gl.BLEND);
        gl.disable(gl.DEPTH_TEST);
        return true;
    }

    // Raster, Pegel und Strahlparameter für die aktuelle Größe an die GPU geben.
    applyUniforms(width, height, scale) {
        const gl = this.gl;
        const u = this.uniforms;
        const o = this.options;
        const shape = MASK_SHAPES[o.maskType];

        // Alles Raster in ganzen Geräte-Pixeln: Triade = Vielfaches von 3 (ein Phosphor = n px),
        // Reihenversatz ganzzahlig. So bleibt die Maske bei jedem DPR moiré-frei und scharf.
        // Delta-Triaden rasten auf Vielfache von 6: der Reihenabstand W/2 bleibt ganzzahlig.
        const step = o.maskType === 'delta' ? 6 : 3;
        const triad = Math.max(step, Math.round(o.pitch * scale / step) * step);
        const rowPitch = triad;
        const stagger = Math.floor(triad / 2);
        const scanPitch = rowPitch * o.scanlineRows;
        // Phase der Zeilenwelle: Slot-Reihen sitzen mittig in der Scanline; die Delta-Punktreihen
        // (bei 0,5 W und 1,0 W) liegen symmetrisch zu einem Peak bei 0,75 W, also alle gleich hell.
        const scanPeak = o.maskType === 'delta' ? 0.75 * triad : 0.5 * scanPitch;
        const scanPhase = 0.5 - scanPeak / scanPitch;
        const meanTransmission = o.blackMatrix + (1 - o.blackMatrix) * shape.coverage(shape.fillX, shape.fillY);

        gl.uniform2f(u.u_resolution, width, height);
        gl.uniform2f(u.u_texel, 1 / width, 1 / height);
        if (this.glow) {
            const spacing = GLOW_TAP_SPACING * Math.max(1, scale / 2);
            gl.uniform2f(
                u.u_glowStep,
                spacing / Math.ceil(width / GLOW_DIVISOR),
                spacing / Math.ceil(height / GLOW_DIVISOR)
            );
        }
        gl.uniform4f(u.u_mask, triad, rowPitch, stagger, MASK_TYPES[o.maskType]);
        gl.uniform4f(u.u_phos, shape.fillX, shape.fillY, o.blackMatrix, meanTransmission);
        gl.uniform4f(u.u_dyn, o.maskStrength, MASK_DEPTH_AT_FULL_BEAM, o.scanlineStrength, SCAN_DEPTH_AT_FULL_BEAM);
        gl.uniform2f(u.u_scan, scanPitch, scanPhase);
        gl.uniform4f(u.u_beam, Math.min(1, o.beamBlur * scale), o.halation, o.convergence * scale, o.contrast);
        gl.uniform4f(
            u.u_geo,
            o.curvature[0], o.curvature[1],
            o.cornerRadius * Math.min(width, height),
            1 / Math.sqrt(1 - o.vignette) - 1   // 1/(1+k)^2 = 1 - Eckenverlust
        );
        gl.uniform4f(
            u.u_tone,
            o.brightness, GLASS_BLACK_LEVEL * o.glass, GLASS_SHEEN_LEVEL * o.glass, o.dither ? 1 : 0
        );
    }

    // Quelle -> Low-Res-Glow-Textur (eigener FBO-Pass); danach wieder Hauptprogramm + Bildschirm.
    renderGlow(width, height) {
        const gl = this.gl;
        const glow = this.glow;
        const glowWidth = Math.ceil(width / GLOW_DIVISOR);
        const glowHeight = Math.ceil(height / GLOW_DIVISOR);

        gl.useProgram(glow.program);
        if (glow.width !== glowWidth || glow.height !== glowHeight) {
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, glow.texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, glowWidth, glowHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            gl.activeTexture(gl.TEXTURE0);
            gl.uniform2f(glow.resolutionLocation, glowWidth, glowHeight);
            glow.width = glowWidth;
            glow.height = glowHeight;
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, glow.framebuffer);
        gl.viewport(0, 0, glowWidth, glowHeight);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, width, height);
        gl.useProgram(this.program);
    }

    resize(width, height) {
        if (!this.isReady) return;
        if (this.canvas.width !== width) this.canvas.width = width;
        if (this.canvas.height !== height) this.canvas.height = height;
    }

    render() {
        if (!this.isReady) return;
        const source = this.sourceCanvas;
        const width = source.width;
        const height = source.height;
        const cssWidth = source.clientWidth;
        const cssHeight = source.clientHeight;
        if (width <= 0 || height <= 0 || cssWidth <= 0 || cssHeight <= 0) return;
        if (width > this.maxTextureSize || height > this.maxTextureSize) {
            this.fail(`Source canvas ${width}x${height} exceeds MAX_TEXTURE_SIZE ${this.maxTextureSize}`);
            return;
        }

        this.resize(width, height);
        const gl = this.gl;

        let dirty = this.uniformsDirty;
        if (this.viewportWidth !== width || this.viewportHeight !== height) {
            this.viewportWidth = width;
            this.viewportHeight = height;
            gl.viewport(0, 0, width, height);
            dirty = true;
        }
        if (this.uniformCssWidth !== cssWidth || this.uniformCssHeight !== cssHeight) {
            this.uniformCssWidth = cssWidth;
            this.uniformCssHeight = cssHeight;
            dirty = true;
        }
        if (dirty) {
            this.applyUniforms(width, height, width / cssWidth);
            this.uniformsDirty = false;
        }

        try {
            // Einheit 0 gehört der Quelle (Einheit 1 dem Glow): nach renderGlow() zurücksetzen.
            gl.activeTexture(gl.TEXTURE0);
            if (this.textureWidth !== width || this.textureHeight !== height) {
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
                this.textureWidth = width;
                this.textureHeight = height;
            } else {
                gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, source);
            }
        } catch (error) {
            // z. B. SecurityError bei "tainted" Canvas
            this.fail(`Texture upload failed (${error && error.name})`);
            return;
        }

        if (this.glow) this.renderGlow(width, height);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
}

CrtShadowMask.PRESETS = PRESETS;
CrtShadowMask.DEFAULT_OPTIONS = DEFAULT_OPTIONS;
