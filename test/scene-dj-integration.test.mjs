import test from 'node:test';
import assert from 'node:assert/strict';

import { SceneDJ } from '../js/visuals/scene-dj.js';
import { dseRegistry } from '../js/visuals/dse/registry.js';

function withSeededRandom(seed, fn) {
    const origRandom = Math.random;
    let state = seed >>> 0;
    Math.random = () => {
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        return (state >>> 0) / 0x100000000;
    };
    try {
        return fn();
    } finally {
        Math.random = origRandom;
    }
}

function createFakeContext(canvas) {
    const ctx = {
        canvas,
        globalAlpha: 1.0,
        imageSmoothingEnabled: false,
        fillStyle: '#000000',
        strokeStyle: '#000000',
        lineWidth: 1,
        font: '10px monospace',
        textAlign: 'left',
        textBaseline: 'top',
        shadowBlur: 0,
        shadowColor: 'transparent',
        globalCompositeOperation: 'source-over',
        clearRect(x, y, w, h) {
            assert.ok(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(w) && Number.isFinite(h));
        },
        fillRect(x, y, w, h) {
            assert.ok(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(w) && Number.isFinite(h));
        },
        strokeRect(x, y, w, h) {
            assert.ok(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(w) && Number.isFinite(h));
        },
        drawImage(src, ...args) {
            assert.ok(src && src.width > 0 && src.height > 0, 'drawImage source must have positive dimensions');
            for (const v of args) {
                assert.ok(Number.isFinite(v), 'drawImage arguments must be finite');
            }
        },
        createPattern() { return {}; },
        createLinearGradient() { return { addColorStop() {} }; },
        createRadialGradient() { return { addColorStop() {} }; },
        createImageData(w, h) {
            const safeW = Math.max(1, Math.floor(w));
            const safeH = Math.max(1, Math.floor(h));
            return { width: safeW, height: safeH, data: new Uint8ClampedArray(safeW * safeH * 4) };
        },
        getImageData(x, y, w, h) {
            const safeW = Math.max(1, Math.floor(w));
            const safeH = Math.max(1, Math.floor(h));
            return { width: safeW, height: safeH, data: new Uint8ClampedArray(safeW * safeH * 4) };
        },
        putImageData() {},
        beginPath() {},
        closePath() {},
        moveTo() {},
        lineTo() {},
        arc() {},
        ellipse() {},
        rect() {},
        quadraticCurveTo() {},
        bezierCurveTo() {},
        fill() {},
        stroke() {},
        clip() {},
        save() {},
        restore() {},
        translate() {},
        rotate() {},
        scale() {},
        transform() {},
        setTransform() {},
        resetTransform() {},
        setLineDash() {},
        fillText() {},
        strokeText() {},
        measureText(text) { return { width: String(text || '').length * 8 }; }
    };
    return ctx;
}

function createFakeCanvas() {
    const canvas = {
        width: 0,
        height: 0,
        getContext() {
            return canvas._ctx;
        }
    };
    canvas._ctx = createFakeContext(canvas);
    return canvas;
}

function withNodeCanvasDom(fn) {
    const hadDocument = Object.prototype.hasOwnProperty.call(globalThis, 'document');
    const origDocument = globalThis.document;
    if (typeof globalThis.document === 'undefined') {
        globalThis.document = {
            createElement(tag) {
                if (tag === 'canvas') return createFakeCanvas();
                return {};
            }
        };
    }
    try {
        return fn();
    } finally {
        if (hadDocument) {
            globalThis.document = origDocument;
        } else {
            delete globalThis.document;
        }
    }
}

function createPopulatedDJ() {
    const dj = new SceneDJ({ createCanvas: createFakeCanvas });
    for (const entry of dseRegistry) {
        const instance = new entry.Class();
        instance.metadata = { ...entry.metadata };
        dj.registerDSE(instance);
    }
    return dj;
}

test('SceneDJ end-to-end integration traverses states, viewports, and systems with real dseRegistry', () => {
    withNodeCanvasDom(() => withSeededRandom(0x13579BDF, () => {
        const dj = createPopulatedDJ();
        const hostCanvas = createFakeCanvas();
        const hostCtx = hostCanvas.getContext('2d');
        const dt = 1 / 60;
        let t = 0;

        // 1. Idle-Phase (gestoppt)
        dj.forceSystemChange('c64');
        const silentVols = Float32Array.from([0, 0, 0, 0]);
        const c64Regs = new Uint8Array(32);

        for (let i = 0; i < 10; i++) {
            t += dt;
            dj.render(hostCtx, 1280, 720, t, silentVols, false, 0, null, c64Regs);
        }
        assert.equal(dj.tension.macroState, 'idle');
        assert.equal(dj.retroCanvas.width, 355);
        assert.equal(dj.retroCanvas.height, 200);

        // 2. C64-Session: playing -> buildup -> climax -> afterglow -> playing
        const seenStates = new Set();
        let sawPresenter = false;
        let presenterRemoved = false;
        const c64Vols = Float32Array.from([0.9, 0.85, 0.88, 0.0]);
        const track1 = { title: 'Integration SID', artist: 'SceneDJ', system: 'c64' };

        for (let frame = 0; frame < 2000; frame++) {
            t += dt;
            if (frame % 12 === 0) {
                c64Regs[0] = 0xE8;
                c64Regs[1] = 0x03;
                c64Regs[4] = 0x11;
                c64Regs[11] = 0x81;
                c64Regs[18] = ((frame / 12) & 1) ? 0x21 : 0x41;
                c64Regs[22] = ((frame / 12) & 1) ? 0xC0 : 0x20;
            } else if (frame % 12 === 2) {
                c64Regs[4] = 0x10;
                c64Regs[11] = 0x80;
                c64Regs[18] = 0x20;
            }

            dj.render(hostCtx, 1280, 720, t, c64Vols, true, 1, track1, c64Regs);
            seenStates.add(dj.tension.macroState);

            const hasPresenter = dj.stage.activeDSEs.some(d => d.metadata.lifecycle === 'oneshot');
            if (hasPresenter) sawPresenter = true;
            else if (sawPresenter) presenterRemoved = true;

            const hasVisibleOrTransitioning =
                dj.stage.activeDSEs.some(d => !d.metadata.isVoid) ||
                dj.setlist.queuedTransitions.size > 0;
            assert.equal(hasVisibleOrTransitioning, true, `Blackout detected on C64 frame ${frame}`);

            for (const active of dj.stage.activeDSEs) {
                assert.ok(
                    active.metadata.systems.includes('c64') || active.metadata.systems.includes('all'),
                    `Foreign DSE ${active.metadata.name} active on C64`
                );
            }
        }

        assert.ok(seenStates.has('playing'), 'Must observe playing state');
        assert.ok(seenStates.has('buildup'), 'Must observe buildup state');
        assert.ok(seenStates.has('climax'), 'Must observe climax state');
        assert.ok(seenStates.has('afterglow'), 'Must observe afterglow state');
        assert.equal(sawPresenter, true, 'TrackPresenter must activate on track start');
        assert.equal(presenterRemoved, true, 'TrackPresenter must leave activeDSEs after oneshot lifetime');

        // 3. Responsive Viewports / Rotation + Null-Groessen-Schutz
        const viewports = [
            { w: 390, h: 844, expectedW: 92, expectedH: 200 },
            { w: 2560, h: 1080, expectedW: 474, expectedH: 200 },
            { w: 320, h: 568, expectedW: 112, expectedH: 200 },
            { w: 1280, h: 720, expectedW: 355, expectedH: 200 }
        ];
        for (const vp of viewports) {
            t += dt;
            dj.resize(vp.w, vp.h);
            dj.render(hostCtx, vp.w, vp.h, t, c64Vols, true, 1, track1, c64Regs);
            assert.equal(dj.retroCanvas.width, vp.expectedW);
            assert.equal(dj.retroCanvas.height, vp.expectedH);
        }
        dj.resize(0, 720);
        dj.render(hostCtx, 0, 720, t + dt, c64Vols, true, 1, track1, c64Regs);
        dj.render(hostCtx, 1280, 720, Number.NaN, c64Vols, true, 1, track1, c64Regs);

        // 4. Systemwechsel auf Amiga (256p)
        dj.forceSystemChange('amiga');
        const amigaRegs = new Uint8Array(32);
        const amigaVols = Float32Array.from([0.85, 0.7, 0.8, 0.75]);
        const track2 = { title: 'Integration MOD', artist: 'Paula', system: 'amiga' };

        for (let frame = 0; frame < 240; frame++) {
            t += dt;
            if (frame % 15 === 0) {
                amigaRegs[0] = 0x08;
                amigaRegs[1] = 0x00;
                amigaRegs[4] = 0x01;
                amigaRegs[5] = 0x90;
                amigaRegs[6] = 64;
            } else if (frame % 15 === 2) {
                amigaRegs[0] = 0x10;
                amigaRegs[6] = 16;
            }
            dj.render(hostCtx, 1280, 720, t, amigaVols, true, 2, track2, amigaRegs);
            assert.equal(dj.retroCanvas.width, 455);
            assert.equal(dj.retroCanvas.height, 256);
            for (const active of dj.stage.activeDSEs) {
                assert.ok(
                    active.metadata.systems.includes('amiga') || active.metadata.systems.includes('all'),
                    `Foreign DSE ${active.metadata.name} active on Amiga`
                );
            }
        }

        // 5. Systemwechsel auf Atari ST (200p)
        dj.forceSystemChange('atari');
        const atariRegs = new Uint8Array(32);
        atariRegs[7] = 0xFF;
        atariRegs[13] = 255;
        const atariVols = Float32Array.from([0.8, 0.75, 0.85, 0.0]);
        const track3 = { title: 'Integration YM', artist: 'Shifter', system: 'atari' };

        for (let frame = 0; frame < 240; frame++) {
            t += dt;
            if (frame % 15 === 0) {
                atariRegs[0] = 60;
                atariRegs[8] = 14;
            } else if (frame % 15 === 3) {
                atariRegs[0] = 100;
                atariRegs[8] = 2;
            }
            dj.render(hostCtx, 1280, 720, t, atariVols, true, 3, track3, atariRegs);
            assert.equal(dj.retroCanvas.width, 355);
            assert.equal(dj.retroCanvas.height, 200);
            for (const active of dj.stage.activeDSEs) {
                assert.ok(
                    active.metadata.systems.includes('atari') || active.metadata.systems.includes('all'),
                    `Foreign DSE ${active.metadata.name} active on Atari`
                );
            }
        }
        assert.ok(dj.tension.freshness > 0, 'Atari YM channel novelty must contribute freshness');

        // 6. Track-Stop -> sauberes Abklingen in idle
        for (let frame = 0; frame < 180; frame++) {
            t += dt;
            dj.render(hostCtx, 1280, 720, t, silentVols, false, 3, track3, null);
        }
        assert.equal(dj.tension.macroState, 'idle');
    }));
});

test('SceneDJ operates stably without audio/beats and delivers deferred presenter when playback begins', () => {
    withNodeCanvasDom(() => withSeededRandom(0x2468ACE0, () => {
        const dj = createPopulatedDJ();
        const hostCanvas = createFakeCanvas();
        const hostCtx = hostCanvas.getContext('2d');
        const zeroVols = Float32Array.from([0, 0, 0, 0]);
        const dt = 1 / 60;
        let t = 0;

        dj.forceSystemChange('c64');

        // sessionId wechselt bereits, waehrend isPlaying noch false ist (z.B. async Audio-Start)
        const track = { title: 'Silent Start', artist: 'Ambient', system: 'c64' };
        for (let i = 0; i < 5; i++) {
            t += dt;
            dj.render(hostCtx, 1280, 720, t, zeroVols, false, 10, track, null);
        }
        assert.equal(dj.stage.activeDSEs.some(d => d.metadata.lifecycle === 'oneshot'), false);

        // Mit Spielbeginn startet der gepufferte Presenter sofort und Swaps laufen ohne Beats weiter
        let presenterActivated = false;
        for (let frame = 0; frame < 1200; frame++) {
            t += dt;
            dj.render(hostCtx, 1280, 720, t, zeroVols, true, 10, track, null);
            if (dj.stage.activeDSEs.some(d => d.metadata.lifecycle === 'oneshot')) {
                presenterActivated = true;
            }
            const hasVisibleOrTransitioning =
                dj.stage.activeDSEs.some(d => !d.metadata.isVoid) ||
                dj.setlist.queuedTransitions.size > 0;
            assert.equal(hasVisibleOrTransitioning, true);
        }

        assert.equal(presenterActivated, true);
        assert.equal(dj.tension.macroState, 'playing');
        assert.equal(dj.monitor.dynamics.beatCount, 0);
    }));
});