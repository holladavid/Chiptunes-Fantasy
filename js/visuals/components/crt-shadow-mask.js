const VERTEX_SHADER_SOURCE = `
attribute vec2 a_position;
varying vec2 v_uv;

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_uv = a_position * 0.5 + 0.5;
}
`;

const FRAGMENT_SHADER_SOURCE = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

varying vec2 v_uv;
uniform sampler2D u_source;
uniform vec2 u_cssSize;
uniform vec2 u_texelSize;

// Dezente Röhrenglas-Krümmung (Barrel Distortion), klein genug,
// um keine UI-/Skalenränder am unteren Rand abzuschneiden.
vec2 curveUV(vec2 uv) {
    vec2 centered = uv * 2.0 - 1.0;
    vec2 offset = centered.yx * centered.yx * vec2(0.014, 0.018);
    centered += centered * offset;
    return centered * 0.5 + 0.5;
}

// Formt ein einzelnes Schlitz-/Lochmasken-Phosphorelement mit Black-Matrix-Steg
float phosphorAperture(vec2 cellPos, float centerX) {
    vec2 delta = vec2((cellPos.x - centerX) / 0.145, (cellPos.y - 0.5) / 0.36);
    float distSq = dot(delta, delta);
    return 1.0 - smoothstep(0.42, 1.05, distSq);
}

// Analoge Video-Bandbreite + radiale Dreistrahl-Konvergenzdrift an den Röhrenrändern
vec3 sampleCrtBeam(vec2 uv, vec2 radialVec) {
    float dx = u_texelSize.x;
    float dy = u_texelSize.y;

    // Radiale Konvergenzabweichung (Rot/Blau driften zu den Ecken minimal auseinander)
    vec2 convOffset = radialVec * u_texelSize * 1.15;

    // 3-Tap horizontaler Gauß-Tiefpass (simuliert ~10 MHz analoge Videobandbreite,
    // verhindert Subpixel-Auslöschung bei 1px dünnen vertikalen Oszilloskop-Flanken)
    vec3 center = texture2D(u_source, uv).rgb;
    vec3 left   = texture2D(u_source, uv - vec2(dx, 0.0)).rgb;
    vec3 right  = texture2D(u_source, uv + vec2(dx, 0.0)).rgb;
    vec3 up     = texture2D(u_source, uv + vec2(0.0, dy)).rgb;
    vec3 down   = texture2D(u_source, uv - vec2(0.0, dy)).rgb;

    // Farbspezifischer Konvergenz-Shift auf R und B
    float rConv = texture2D(u_source, uv + convOffset).r;
    float bConv = texture2D(u_source, uv - convOffset).b;
    vec3 convergedCenter = vec3(
        mix(center.r, rConv, 0.65),
        center.g,
        mix(center.b, bConv, 0.65)
    );

    // Mischung aus scharfem Elektronenstrahl und lokaler Glas-Halation (Streulicht)
    vec3 horizontalBeam = convergedCenter * 0.62 + (left + right) * 0.19;
    vec3 glassScatter   = (left + right + up + down) * 0.25;
    return mix(horizontalBeam, glassScatter, 0.14);
}

void main() {
    vec2 uv = curveUV(v_uv);

    // Sanfte Abschattung außerhalb der gewölbten Röhrengeometrie
    vec2 edgeDist = smoothstep(vec2(0.0), vec2(0.006), uv) *
                    smoothstep(vec2(0.0), vec2(0.006), vec2(1.0) - uv);
    float tubeBounds = edgeDist.x * edgeDist.y;

    vec2 centered = (uv - 0.5) * 2.0;
    float radialDistSq = dot(centered, centered);

    // 1. Analoge Signalabtastung inkl. Konvergenz und Bandbreiten-Glättung
    vec3 signal = sampleCrtBeam(clamp(uv, 0.0, 1.0), centered * radialDistSq * 0.5);

    // Wahrgenommene Strahlstrom-Luminanz (steuert das Aufblühen von Maske & Scanlines)
    float luma = dot(signal, vec3(0.299, 0.587, 0.114));
    float maxChannel = max(signal.r, max(signal.g, signal.b));
    float beamEnergy = clamp(max(luma, maxChannel * 0.85), 0.0, 1.0);
    float beamBloom = smoothstep(0.28, 0.98, beamEnergy);

    // 2. Versetzte Black-Matrix Schlitz-/Lochmaske (Staggered Slot-Dot Triad)
    vec2 screenPosition = uv * u_cssSize;
    float cellSize = 3.0;
    float row = floor(screenPosition.y / cellSize);
    vec2 cellPosition = vec2(
        fract(screenPosition.x / cellSize + mod(row, 2.0) * 0.5),
        fract(screenPosition.y / cellSize)
    );

    vec3 phosphor = vec3(
        phosphorAperture(cellPosition, 1.0 / 6.0),
        phosphorAperture(cellPosition, 0.5),
        phosphorAperture(cellPosition, 5.0 / 6.0)
    );

    // Bei schwachem Strahlstrom klare RGB-Trennung durch dunkle Black-Matrix;
    // bei hohem Strahlstrom (Weißglut) überstrahlt der Elektronenfleck die Stege.
    vec3 maskGain = mix(
        vec3(0.46) + phosphor * 0.96,
        vec3(0.92) + phosphor * 0.24,
        beamBloom
    );

    // 3. Dynamische Scanlines (weiten sich bei hoher Helligkeit vertikal auf)
    float scanWave = 0.5 + 0.5 * cos(screenPosition.y * 3.14159265);
    float scanDepth = mix(0.22, 0.04, beamBloom);
    float scanline = 1.0 - scanDepth * (1.0 - scanWave);

    // 4. Leichte Phosphor-Nachbar-Anregung (Cross-Bleed) & Gamma-Punch
    vec3 color = signal * maskGain * scanline;
    color += signal * beamBloom * 0.12;

    // 5. Dezenter diagonaler Röhrenglas-Schimmer (Ambient Glass Reflection) & Grundgrau
    float glassSheen = (1.0 - radialDistSq * 0.35) *
                       smoothstep(-0.8, 0.9, (1.0 - uv.y) * 0.65 - uv.x * 0.35) * 0.012;
    color += vec3(glassSheen);

    // 6. Natürlicher cos^4-Randabfall (Vignette) der gewölbten Frontscheibe
    float cornerDistance = length((uv - 0.5) * u_cssSize) / (0.5 * length(u_cssSize));
    float vignette = 1.0 - 0.28 * smoothstep(0.48, 1.05, cornerDistance);

    gl_FragColor = vec4(clamp(color * vignette * tubeBounds, 0.0, 1.0), 1.0);
}
`;

const QUAD_VERTICES = new Float32Array([
    -1, -1,
     1, -1,
    -1,  1,
    -1,  1,
     1, -1,
     1,  1
]);

export class CrtShadowMask {
    constructor(sourceCanvas, maskCanvas, onAvailabilityChange = () => {}) {
        this.sourceCanvas = sourceCanvas;
        this.canvas = maskCanvas;
        this.onAvailabilityChange = onAvailabilityChange;
        this.isReady = false;
        this.gl = null;

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
            powerPreference: 'low-power'
        });
        if (!gl) {
            console.warn('[CRT MASK] WebGL is unavailable; using the CSS fallback.');
            return;
        }

        this.gl = gl;
        if (!this.initialize(gl)) return;

        this.isReady = true;
        this.onAvailabilityChange(true);

        maskCanvas.addEventListener('webglcontextlost', event => {
            event.preventDefault();
            this.isReady = false;
            this.onAvailabilityChange(false);
            console.warn('[CRT MASK] WebGL context was lost; using the CSS fallback.');
        });

        maskCanvas.addEventListener('webglcontextrestored', () => {
            if (this.initialize(this.gl)) {
                this.isReady = true;
                this.onAvailabilityChange(true);
            }
        });
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

    initialize(gl) {
        const vertexShader = this.compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
        if (!vertexShader) return false;
        const fragmentShader = this.compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
        if (!fragmentShader) {
            gl.deleteShader(vertexShader);
            return false;
        }

        const program = gl.createProgram();
        if (!program) {
            console.error('[CRT MASK] Failed to create a WebGL program.');
            gl.deleteShader(vertexShader);
            gl.deleteShader(fragmentShader);
            return false;
        }
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('[CRT MASK] Shader linking failed:', gl.getProgramInfoLog(program));
            gl.deleteProgram(program);
            return false;
        }

        const buffer = gl.createBuffer();
        const texture = gl.createTexture();
        const positionLocation = gl.getAttribLocation(program, 'a_position');
        const sourceLocation = gl.getUniformLocation(program, 'u_source');
        const sizeLocation = gl.getUniformLocation(program, 'u_cssSize');
        const texelLocation = gl.getUniformLocation(program, 'u_texelSize');
        if (
            !buffer ||
            !texture ||
            positionLocation < 0 ||
            sourceLocation === null ||
            sizeLocation === null ||
            texelLocation === null
        ) {
            console.error('[CRT MASK] Failed to initialize WebGL resources.');
            gl.deleteBuffer(buffer);
            gl.deleteTexture(texture);
            gl.deleteProgram(program);
            return false;
        }

        this.program = program;
        this.buffer = buffer;
        this.texture = texture;
        this.positionLocation = positionLocation;
        this.sourceLocation = sourceLocation;
        this.sizeLocation = sizeLocation;
        this.texelLocation = texelLocation;
        this.textureWidth = 0;
        this.textureHeight = 0;

        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTICES, gl.STATIC_DRAW);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        // Bilineare Texturfilterung ermöglicht subpixelgenaue Röhrenwölbung,
        // radiale Konvergenzdrift und analoge horizontale Strahl-Glättung.
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.useProgram(program);
        gl.uniform1i(sourceLocation, 0);
        gl.disable(gl.BLEND);
        gl.disable(gl.DEPTH_TEST);
        return true;
    }

    resize(width, height) {
        if (!this.isReady) return;
        if (this.canvas.width !== width) this.canvas.width = width;
        if (this.canvas.height !== height) this.canvas.height = height;
    }

    render() {
        if (!this.isReady) return;
        const width = this.sourceCanvas.width;
        const height = this.sourceCanvas.height;
        const cssWidth = this.sourceCanvas.clientWidth;
        const cssHeight = this.sourceCanvas.clientHeight;
        if (width <= 0 || height <= 0 || cssWidth <= 0 || cssHeight <= 0) return;

        this.resize(width, height);
        const gl = this.gl;
        gl.viewport(0, 0, width, height);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        if (this.textureWidth !== width || this.textureHeight !== height) {
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.sourceCanvas);
            this.textureWidth = width;
            this.textureHeight = height;
        } else {
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.sourceCanvas);
        }
        gl.useProgram(this.program);
        gl.uniform2f(this.sizeLocation, cssWidth, cssHeight);
        gl.uniform2f(this.texelLocation, 1.0 / width, 1.0 / height);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.enableVertexAttribArray(this.positionLocation);
        gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
}