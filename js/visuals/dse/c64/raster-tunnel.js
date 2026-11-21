// === js/visuals/dse/c64/raster-tunnel.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: C64 RASTER TUNNEL (BACKGROUND)
// VIC-II Intro-Rastertunnel mit Fluchtpunkt auf (w/2, horizon - 1):
// aspect-korrigierte Rahmen von nah nach fern, SID-Wasserfall lv[32]
// nur bei Ringeintritt, Climax-Split, 6er Pulsring-Pool & Wipe-Familien.
// =========================================================

import {
    C64_PALETTE,
    rgbToHex,
    bayerFadeCells
} from '../../utils/hardware-constraints.js';

const HEX = Object.freeze(C64_PALETTE.map(([r, g, b]) => rgbToHex(r, g, b)));

// Luminanz-Rampen aus §3
const RAMP = Object.freeze({
    BLUE: Object.freeze([0, 6, 14, 3, 1]),
    PURPLE: Object.freeze([0, 6, 4, 10, 1]),
    GREEN: Object.freeze([0, 11, 5, 13, 1]),
    FIRE: Object.freeze([0, 9, 2, 8, 7, 1])
});

const FAM = Object.freeze([RAMP.BLUE, RAMP.PURPLE, RAMP.GREEN, RAMP.FIRE]);

function buildPingPong(len) {
    const out = [];
    for (let i = 0; i < len; i++) out.push(i);
    for (let i = len - 2; i >= 1; i--) out.push(i);
    return Object.freeze(out);
}

// Basis-Farbmarsch ohne Top-Weiß (reserviert für lv, Split & Pulsringe -> Kontrast vor Floor & Strobe-Schutz)
const PP_BASE = Object.freeze(FAM.map(r => buildPingPong(r.length - 1)));

const T_IN = 1.5;
const T_OUT = 1.5;
const WIPE_DURATION = 0.6;
const HARD_COOLDOWN = 0.25;
const PULSE_POOL_SIZE = 6;
const PULSE_SPEED = 2.2;

const FALLBACK_TENSION = Object.freeze({
    starting: 0.25,
    playing: 0.30,
    buildup: 0.65,
    climax: 1.0,
    afterglow: 0.20,
    stopping: 0.20
});

function clamp01(v) {
    if (!Number.isFinite(v)) return 0;
    return v < 0 ? 0 : (v > 1 ? 1 : v);
}

function lerp(a, b, k) {
    return a + (b - a) * k;
}

function smoothstep(edge0, edge1, x) {
    const u = clamp01((x - edge0) / (edge1 - edge0));
    return u * u * (3 - 2 * u);
}

function fr(ctx, x, y, w, h, bufW, bufH) {
    let x0 = Math.round(x);
    let y0 = Math.round(y);
    let x1 = Math.round(x + w);
    let y1 = Math.round(y + h);
    if (x0 < 0) x0 = 0;
    if (y0 < 0) y0 = 0;
    if (x1 > bufW) x1 = bufW;
    if (y1 > bufH) y1 = bufH;
    const cw = x1 - x0;
    const ch = y1 - y0;
    if (cw > 0 && ch > 0) {
        ctx.fillRect(x0, y0, cw, ch);
    }
}

function drawHollowRect(ctx, rx, ry, rw, rh, tk, outerHex, innerHex, drawInnerBlack, bufW, bufH) {
    if (rw <= 0 || rh <= 0 || tk <= 0) return;
    const tEff = Math.min(tk, Math.floor(rw * 0.5), Math.floor(rh * 0.5));
    if (tEff <= 0) {
        ctx.fillStyle = outerHex;
        fr(ctx, rx, ry, rw, rh, bufW, bufH);
        return;
    }

    ctx.fillStyle = outerHex;
    // Oben & Unten
    fr(ctx, rx, ry, rw, tEff, bufW, bufH);
    fr(ctx, rx, ry + rh - tEff, rw, tEff, bufW, bufH);
    // Links & Rechts (ohne Ecken doppelt zu malen)
    const innerH = rh - tEff * 2;
    if (innerH > 0) {
        fr(ctx, rx, ry + tEff, tEff, innerH, bufW, bufH);
        fr(ctx, rx + rw - tEff, ry + tEff, tEff, innerH, bufW, bufH);
    }

    // 1 px innere schwarze Kontur für klaren Kontrast
    if (drawInnerBlack) {
        const ix = rx + tEff;
        const iy = ry + tEff;
        const iw = rw - tEff * 2;
        const ih = rh - tEff * 2;
        if (iw >= 4 && ih >= 4) {
            ctx.fillStyle = innerHex;
            fr(ctx, ix, iy, iw, 1, bufW, bufH);
            fr(ctx, ix, iy + ih - 1, iw, 1, bufW, bufH);
            if (ih > 2) {
                fr(ctx, ix, iy + 1, 1, ih - 2, bufW, bufH);
                fr(ctx, ix + iw - 1, iy + 1, 1, ih - 2, bufW, bufH);
            }
        }
    }
}

export class C64RasterTunnel {
    constructor() {
        this.name = 'C64 Raster Tunnel';

        this.lastT = null;
        this.lastState = 'idle';
        this.stateAge = 0;
        this.simT = 0;
        this.ten = 0.30;

        // Tunnel-Scrollposition & Farbmarsch
        this.S = 0;
        this.shift = 0;
        this.bendDir = 1;
        this.bendDirTarget = 1;
        this.beatDir = 1;

        // Beat- & Cooldown-Zustand (-1 verhindert Verlust von beatCount === 0)
        this.lastBeatCount = -1;
        this.hardCooldown = 0;
        this.nextRingLvBoost = 0;

        // SID-Wasserfall: 32 Ring-Pegel, nur bei Ringeintritt geschrieben
        this.lv = new Uint8Array(32);
        this.lastFarR = null;

        // Familien & Wipe (Start: BLUE)
        this.fam = 0;
        this.savedFam = 0;
        this.wipeFrom = 0;
        this.wipeTo = 0;
        this.wipeActive = false;
        this.wipeElapsed = 0;

        // Fester Pulsring-Pool (6 Einträge)
        this.pulses = Array.from({ length: PULSE_POOL_SIZE }, () => ({
            active: false,
            d: 0,
            stageFromTop: 1 // 1 = Top (L-1), 2 = L-2, 3 = L-3
        }));
    }

    _startWipe(nextFam) {
        const target = ((nextFam % 4) + 4) % 4;
        const current = this.wipeActive ? this.wipeTo : this.fam;
        if (target === current && !this.wipeActive) return;
        this.wipeFrom = current;
        this.wipeTo = target;
        this.wipeElapsed = 0;
        this.wipeActive = true;
    }

    _spawnPulse(d, stageFromTop, pulseMax) {
        if (pulseMax <= 0 || d <= 0) return;
        let activeCount = 0;
        let freeSlot = -1;
        let nearestIdx = 0;
        let minD = Infinity;

        for (let i = 0; i < PULSE_POOL_SIZE; i++) {
            const p = this.pulses[i];
            if (p.active) {
                activeCount++;
                if (p.d < minD) {
                    minD = p.d;
                    nearestIdx = i;
                }
            } else if (freeSlot === -1) {
                freeSlot = i;
            }
        }

        const targetIdx = (activeCount < pulseMax && freeSlot !== -1) ? freeSlot : nearestIdx;
        const slot = this.pulses[targetIdx];
        slot.active = true;
        slot.d = d;
        slot.stageFromTop = stageFromTop;
    }

    resize() {
        // Aspect-Verhältnis wird dynamisch aus (w, h) berechnet;
        // S, lv[], Pulsringe & Familien-Wipe bleiben beim Resize erhalten.
    }

    render(ctx, width, height, t, state, stateTime, metrics) {
        const safeT = Number.isFinite(t) ? t : (this.lastT !== null ? this.lastT : 0);
        if (
            !ctx ||
            !Number.isFinite(width) ||
            !Number.isFinite(height) ||
            width <= 0 ||
            height <= 0 ||
            !Number.isFinite(width / height)
        ) {
            this.lastT = safeT;
            return;
        }

        const w = Math.floor(width);
        const h = Math.floor(height);
        if (w <= 0 || h <= 0) {
            this.lastT = safeT;
            return;
        }

        if (state === 'idle') {
            this.lastT = safeT;
            this.lastState = 'idle';
            this.stateAge = 0;
            return;
        }

        let dt = this.lastT === null ? 0.02 : (safeT - this.lastT);
        this.lastT = safeT;
        if (!Number.isFinite(dt) || dt < 0) {
            dt = 0.02;
        } else if (dt > 0.1) {
            dt = 0.1;
        }

        const prevState = this.lastState;
        if (prevState !== state) {
            this.lastState = state;
            this.stateAge = 0;
            if (state === 'afterglow') {
                if (prevState === 'idle' || prevState === 'starting') {
                    this.fam = 0;
                    this.wipeTo = 0;
                    this.wipeActive = false;
                } else {
                    this.savedFam = this.wipeActive ? this.wipeTo : this.fam;
                    this._startWipe(0);
                }
            } else if (prevState === 'afterglow' && state !== 'stopping') {
                this._startWipe(this.savedFam);
            }
        } else {
            this.stateAge += dt;
        }

        // Sichtbarkeit auf dem Background-Layer (abgeglichen mit StageManager 1.5 s)
        const effectiveStateTime = Number.isFinite(stateTime) ? stateTime : this.stateAge;
        let vis = 1.0;
        if (state === 'starting') {
            vis = clamp01((effectiveStateTime + 0.06) / T_IN);
        } else if (state === 'stopping') {
            vis = 1.0 - clamp01(effectiveStateTime / T_OUT);
            if (vis <= 0.001) {
                return;
            }
        }

        // Asymmetrische Tension-Glättung (§2)
        const targetTenBase = clamp01(metrics?.tensionPct ?? FALLBACK_TENSION[state] ?? 0.2);
        let targetTen = targetTenBase;
        if (state === 'afterglow') targetTen = Math.min(targetTen, 0.30);
        if (state === 'starting' || state === 'stopping') targetTen = Math.min(targetTen, 0.25);
        const tau = targetTen > this.ten ? 0.30 : 0.90;
        this.ten += (targetTen - this.ten) * (1 - Math.exp(-dt / tau));

        // Defensive Beat-Auswertung (§2)
        const rawImpulse = metrics?.beatImpulse?.[0];
        const rawBeat = metrics?.beat?.[0];
        const impulse = clamp01(Number.isFinite(rawImpulse) ? rawImpulse : rawBeat);

        const count = Number.isFinite(metrics?.beatCount)
            ? Math.floor(metrics.beatCount)
            : (this.lastBeatCount + 1);
        const onBeat = metrics?.beatStarted === true && count !== this.lastBeatCount;
        const rawStrength = Number.isFinite(metrics?.beatStrength) ? metrics.beatStrength : 1;
        const level = !onBeat ? 0 : ([1, 2, 3].includes(metrics?.beatLevel)
            ? metrics.beatLevel
            : (rawStrength < 1 / 3 ? 1 : (rawStrength < 2 / 3 ? 2 : 3)));
        if (onBeat) {
            this.lastBeatCount = count;
            this.beatDir = (count & 1) ? 1 : -1;
        }

        this.hardCooldown = Math.max(0, this.hardCooldown - dt);

        if (this.wipeActive) {
            this.wipeElapsed += dt;
            if (this.wipeElapsed >= WIPE_DURATION) {
                this.wipeActive = false;
                this.fam = this.wipeTo;
            }
        }

        // Tunnel-Parameter
        const isAfterglow = state === 'afterglow';
        const N = Math.round(lerp(20, 32, smoothstep(0.2, 0.8, this.ten)));
        const pulseMax = isAfterglow ? 1 : (this.ten < 0.35 ? 2 : (this.ten < 0.70 ? 4 : 6));
        let Sdot = lerp(0.8, 4.2, this.ten);
        if (isAfterglow) Sdot *= 0.3;
        const SdotEff = Sdot * (1 + 1.2 * impulse);

        let bend = lerp(0.15, 1.0, this.ten);
        if (isAfterglow) bend = Math.min(bend, 0.20);

        // Diskrete Beat-Reaktionen (§5.1)
        if (onBeat) {
            if (isAfterglow) {
                if (level === 1) {
                    this.shift += 1;
                    this._spawnPulse(N, 3, pulseMax);
                }
            } else {
                if (level === 1) {
                    this.shift += 1;
                    this._spawnPulse(N, 3, pulseMax); // L-3
                } else if (level === 2) {
                    this.shift += 1;
                    this._spawnPulse(N, 2, pulseMax); // L-2
                    this.nextRingLvBoost = 1;
                } else if (level === 3) {
                    this.shift += 2;
                    if (this.hardCooldown <= 0) {
                        this.hardCooldown = HARD_COOLDOWN;
                        // Beide Pulsringe innerhalb (0, N] damit sie am Beat-Frame sofort sichtbar sind
                        this._spawnPulse(Math.max(0.5, N - 0.5), 1, pulseMax);
                        this._spawnPulse(N, 1, pulseMax);
                    }
                }

                if (count > 0 && state !== 'stopping') {
                    if (count % 4 === 0) {
                        const nextFam = ((this.wipeActive ? this.wipeTo : this.fam) + 1) % 4;
                        this._startWipe(nextFam);
                        this.savedFam = nextFam;
                    }
                    if (count % 8 === 0) {
                        this.bendDirTarget = -this.bendDirTarget;
                    }
                }
            }
        }

        // Zeit- & Scrollfortschritt
        this.S += SdotEff * dt;
        this.simT += dt * (isAfterglow ? 0.30 : 1.0);
        this.bendDir += (this.bendDirTarget - this.bendDir) * (1 - Math.exp(-dt / 0.14));

        // lv[] nur beim Eintritt eines neuen Rings am fernen Ende aktualisieren
        const farR = Math.floor(this.S + N);
        if (this.lastFarR === null) {
            this.lastFarR = farR;
        } else if (farR > this.lastFarR) {
            if (!isAfterglow) {
                for (let nr = this.lastFarR + 1; nr <= farR; nr++) {
                    const chIdx = nr % 3;
                    const rawCh = metrics?.smooth?.[chIdx];
                    const chVal = clamp01(Number.isFinite(rawCh) ? rawCh : 0);
                    const val = Math.min(3, Math.round(chVal * 2) + this.nextRingLvBoost);
                    this.lv[nr & 31] = val;
                    this.nextRingLvBoost = 0;
                }
            }
            this.lastFarR = farR;
        } else if (farR < this.lastFarR) {
            this.lastFarR = farR;
        }

        // Aktive Pulsringe fortschalten
        for (let i = 0; i < PULSE_POOL_SIZE; i++) {
            const p = this.pulses[i];
            if (!p.active) continue;
            p.d -= PULSE_SPEED * dt;
            if (p.d < 0.15) {
                p.active = false;
            }
        }

        // ---------------------------------------------------------
        // Darstellung (von nah nach fern, harte Begrenzung)
        // ---------------------------------------------------------
        // 1. Gesamtfläche in Index 0
        ctx.fillStyle = HEX[0];
        fr(ctx, 0, 0, w, h, w, h);

        const horizon = Math.floor(h * 0.55);
        const minDim = Math.min(w, h);
        const swayX = 0.05 * w * bend * Math.sin(0.31 * this.simT) + this.beatDir * 0.02 * w * impulse;
        const swayY = 0.02 * h * bend * Math.sin(0.23 * this.simT) - 0.03 * h * impulse;
        const vpx = w * 0.5 + swayX;
        const vpy = (horizon - 1) + swayY;
        const A = 0.05 * minDim * bend;

        const wipeProgress = this.wipeActive ? clamp01(this.wipeElapsed / WIPE_DURATION) : 1.0;
        const climaxSplit = !isAfterglow && (this.ten > 0.70 || state === 'climax');
        const splitX = Math.max(0, Math.min(w, Math.round(vpx)));
        const minVisibleD = (state === 'starting' || state === 'stopping')
            ? (1.0 - vis) * 0.8 * N
            : 0.0;

        // 2. Tunnelringe r mit 0 < d <= N, gezeichnet von nah (d klein) nach fern (d groß)
        const rMin = Math.floor(this.S + 1e-9) + 1;
        const rMax = Math.floor(this.S + N);

        for (let r = rMin; r <= rMax; r++) {
            const d = r - this.S;
            if (d <= 0 || d > N) continue;
            if (d < minVisibleD) continue;

            const sc = 1.0 / (0.35 + 0.55 * d);
            const hw = 0.5 * w * sc;
            const hh = 0.5 * h * sc;
            const cx = vpx + A * sc * Math.sin(0.55 * r + 0.9 * this.simT) * this.bendDir;
            const cy = vpy + A * sc * 0.6 * Math.cos(0.43 * r + 0.7 * this.simT);

            const rx0 = Math.round(cx - hw);
            const ry0 = Math.round(cy - hh);
            const rx1 = Math.round(cx + hw);
            const ry1 = Math.round(cy + hh);
            const rw = rx1 - rx0;
            const rh = ry1 - ry0;
            if (rw <= 0 || rh <= 0) continue;

            // Im Afterglow strikt ausschließlich BLUE-Indizes verwenden
            const q = clamp01(d / N);
            const activeFam = isAfterglow
                ? 0
                : ((this.wipeActive && q > wipeProgress) ? this.wipeFrom : this.fam);
            const ramp = FAM[activeFam];
            const L = ramp.length;

            if (d > 0.75 * N) {
                // Nebelzone: nur Stufen 0 und 1
                ctx.fillStyle = HEX[ramp[r & 1]];
                fr(ctx, rx0, ry0, rw, rh, w, h);
                continue;
            }

            const pp = PP_BASE[activeFam];
            const ppIdx = ((r + this.shift) % pp.length + pp.length) % pp.length;
            const cIdx = Math.min(L - 1, pp[ppIdx] + this.lv[r & 31]);

            if (climaxSplit && splitX > rx0 && splitX < rx1) {
                const rightIdx = Math.min(L - 1, cIdx + 2);
                ctx.fillStyle = HEX[ramp[cIdx]];
                fr(ctx, rx0, ry0, splitX - rx0, rh, w, h);
                ctx.fillStyle = HEX[ramp[rightIdx]];
                fr(ctx, splitX, ry0, rx1 - splitX, rh, w, h);
            } else {
                const finalIdx = (climaxSplit && rx0 >= splitX) ? Math.min(L - 1, cIdx + 2) : cIdx;
                ctx.fillStyle = HEX[ramp[finalIdx]];
                fr(ctx, rx0, ry0, rw, rh, w, h);
            }
        }

        // 3. Pulsringe (Pool 6)
        const basePulseTk = 1 + Math.round(impulse);
        let drawnPulses = 0;

        for (let i = 0; i < PULSE_POOL_SIZE; i++) {
            const p = this.pulses[i];
            if (!p.active) continue;
            const d = p.d;
            if (d <= 0 || d > N) continue;
            if (d < minVisibleD) continue;

            const rFloat = d + this.S;
            const sc = 1.0 / (0.35 + 0.55 * d);
            const hw = 0.5 * w * sc;
            const hh = 0.5 * h * sc;
            const cx = vpx + A * sc * Math.sin(0.55 * rFloat + 0.9 * this.simT) * this.bendDir;
            const cy = vpy + A * sc * 0.6 * Math.cos(0.43 * rFloat + 0.7 * this.simT);

            const rx0 = Math.round(cx - hw);
            const ry0 = Math.round(cy - hh);
            const rx1 = Math.round(cx + hw);
            const ry1 = Math.round(cy + hh);
            const rw = rx1 - rx0;
            const rh = ry1 - ry0;
            if (rw <= 2 || rh <= 2) continue;

            const q = clamp01(d / N);
            const activeFam = isAfterglow
                ? 0
                : ((this.wipeActive && q > wipeProgress) ? this.wipeFrom : this.fam);
            const ramp = FAM[activeFam];
            const L = ramp.length;
            const colorIdx = Math.max(1, L - p.stageFromTop);
            const tk = (state === 'climax' && p.stageFromTop === 1)
                ? Math.max(2, basePulseTk)
                : basePulseTk;

            // Halte Gesamt-fillRect-Budget sicher <= 100
            const drawInner = rw >= 20 && rh >= 14 && drawnPulses < 5;
            drawHollowRect(ctx, rx0, ry0, rw, rh, tk, HEX[ramp[colorIdx]], HEX[0], drawInner, w, h);
            drawnPulses++;
        }

        // 4. Vollbild-Bayer-Fade am Ende von starting/stopping
        if (vis < 1.0) {
            bayerFadeCells(ctx, 0, 0, w, h, vis, 2, HEX[0]);
        }
    }
}