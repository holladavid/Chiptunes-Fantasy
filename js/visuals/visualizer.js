// === js/visuals/visualizer.js ===
// =========================================================
// HIGH-PERFORMANCE RETROWAVE VISUALIZER MODULE
// Modulare DJ-Orchestrierung & Core UI Trennung (v1.2.0)
// =========================================================

import { SceneDJ } from './scene-dj.js';
import { dseRegistry } from './dse/registry.js';
import { FftAnalyzer } from './components/fft-analyzer.js';
import { Oscilloscope } from './components/oscilloscope.js';
import { LivingSilicon } from '../ui/living-silicon.js';
import { CrtGlitch } from './components/crt-glitch.js';
import { CrtShadowMask } from './components/crt-shadow-mask.js';
import { displaySettings, toCrtMaskOptions } from './display-settings.js';

// NEU: Statisches, prä-allozierte Null-Array zur Vermeidung von Heap-Garbages bei Inaktivität
const zeroVolumes = new Float32Array(4);
const idleRegs = new Uint8Array(32);
idleRegs[7] = 0xFF; // Schaltet alle Mixer-LED-Gatter des YM2149 im Idle-Modus ab

function getActiveSystemFromDOM() {
    if (document.body.classList.contains('theme-atari')) return 'atari';
    if (document.body.classList.contains('theme-amiga')) return 'amiga';
    return 'c64';
}

export function initVisuals(stateGetters, callbacks) {
    const canvas = document.getElementById('demo-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });

    // =========================================================
    // INITIALISIERUNG SCENE-DJ (Hardware Rebootable)
    // =========================================================
    let dss = null;

    function wireSiliconDJ() {
        dss = new SceneDJ();
        dseRegistry.forEach(entry => {
            try {
                const effectInstance = new entry.Class();
                effectInstance.metadata = entry.metadata;
                dss.registerDSE(effectInstance);
            } catch (err) {
                console.error(`[SCENE-DJ] Failed to register DSE: ${entry.Class.name}`, err);
            }
        });
    }

    wireSiliconDJ(); // Kaltstart beim Boot

    let currentCrtSystem = getActiveSystemFromDOM();

    // Core UI (Vom DJ unabhängig)
    const fft = new FftAnalyzer();
    const osc = new Oscilloscope(canvas.width, canvas.height, displaySettings.getEffectiveOsc());
    const glitch = new CrtGlitch(); // NEU: Instanziiert den Glitcher
    const visualZone = document.getElementById('visual-zone');
    let isCrtWebglAvailable = false;
    const syncCrtMaskVisibility = (effectiveCrt = displaySettings.getEffectiveCrt(currentCrtSystem)) => {
        visualZone?.classList.toggle('crt-mask-active', isCrtWebglAvailable && effectiveCrt.quality !== 'off');
    };

    displaySettings.setCrtAvailable(false);
    const crtMask = new CrtShadowMask(
        canvas,
        document.getElementById('crt-mask-canvas'),
        isAvailable => {
            isCrtWebglAvailable = isAvailable;
            displaySettings.setCrtAvailable(isAvailable);
            syncCrtMaskVisibility();
        },
        toCrtMaskOptions(displaySettings.getEffectiveCrt(currentCrtSystem))
    );

    const applyCrtOptions = (system = getActiveSystemFromDOM()) => {
        currentCrtSystem = system;
        const effectiveCrt = displaySettings.getEffectiveCrt(system);
        crtMask.setOptions(toCrtMaskOptions(effectiveCrt));
        syncCrtMaskVisibility(effectiveCrt);
    };

    const applyOscOptions = () => {
        osc.setOptions(displaySettings.getEffectiveOsc());
    };

    displaySettings.subscribe((_state, meta) => {
        if (meta.reason === 'availability') return;
        if (meta.reason === 'osc') {
            applyOscOptions();
        } else if (meta.reason === 'crt') {
            applyCrtOptions(getActiveSystemFromDOM());
        } else {
            applyOscOptions();
            applyCrtOptions(getActiveSystemFromDOM());
        }
    });

    // Horcht auf den physischen Power-Cycle und flusht den RAM
    window.addEventListener('hardware-power-cycle', () => {
        wireSiliconDJ();
        const sys = getActiveSystemFromDOM();
        dss.forceSystemChange(sys);
        if (sys !== currentCrtSystem) {
            currentCrtSystem = sys;
            if (displaySettings.getState().crtPreset === 'auto') {
                applyCrtOptions(sys);
            }
        }
        if (canvas.width > 0 && canvas.height > 0) {
            dss.resize(canvas.width, canvas.height); // Skalierung für neue DSEs wiederherstellen
        }
    });

    // --- INTERACTIVE GIMMICK STATE & TOGGLE ---
    let showGimmick = false;
    const logo = document.getElementById('brand-logo');
    if (logo) {
        let logoIdleTimer = null;

        const revealLogoAndRestartTimer = () => {
            clearTimeout(logoIdleTimer);
            logo.classList.remove('logo-idle');

            if (showGimmick) {
                logoIdleTimer = setTimeout(() => {
                    if (showGimmick) logo.classList.add('logo-idle');
                }, 10000);
            }
        };

        logo.addEventListener('click', () => {
            showGimmick = !showGimmick;
            if (!showGimmick) osc.clear();

            // NEU: Klassenzuweisung für den systemgetreuen Glow
            logo.classList.toggle('demo-mode-active', showGimmick);
            logo.setAttribute('aria-pressed', String(showGimmick));
            revealLogoAndRestartTimer();

            logo.style.filter = 'brightness(2.0)';
            setTimeout(() => logo.style.filter = '', 100);
        });

        visualZone?.addEventListener('pointermove', revealLogoAndRestartTimer);
        visualZone?.addEventListener('pointerdown', revealLogoAndRestartTimer);
        visualZone?.addEventListener('pointerup', revealLogoAndRestartTimer);
    }

    function resizeCanvas() {
        const clientWidth = canvas.clientWidth;
        const clientHeight = canvas.clientHeight;
        if (clientWidth <= 0 || clientHeight <= 0) {
            if (canvas.width !== 0 || canvas.height !== 0) {
                canvas.width = 0;
                canvas.height = 0;
            }
            return;
        }

        // Native HiDPI-Skalierung (gedeckelt auf 1..2x und max. 1920px Breite)
        const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);
        const targetWidth = Math.round(clientWidth * dpr);
        const targetHeight = Math.round(clientHeight * dpr);
        const maxResolutionWidth = 1920;
        let scale = 1.0;

        if (targetWidth > maxResolutionWidth) {
            scale = maxResolutionWidth / targetWidth;
        }

        const newWidth = Math.max(1, Math.floor(targetWidth * scale));
        const newHeight = Math.max(1, Math.floor(targetHeight * scale));

        if (canvas.width !== newWidth || canvas.height !== newHeight) {
            canvas.width = newWidth;
            canvas.height = newHeight;
            osc.resize(newWidth, newHeight);
            dss.resize(newWidth, newHeight); // Resize ans DSE-Ökosystem leiten
            crtMask.resize(newWidth, newHeight);
        }
    }

    // Initialer Resize (Nachdem dss deklariert wurde!)
    resizeCanvas();
    if (typeof ResizeObserver === 'function') {
        const resizeObserver = new ResizeObserver(resizeCanvas);
        resizeObserver.observe(canvas);
    }
    window.addEventListener('resize', resizeCanvas);
    document.addEventListener('fullscreenchange', resizeCanvas);
    document.addEventListener('webkitfullscreenchange', resizeCanvas);

    const startTime = performance.now();
    let hudCounter = 0;
    let lastDrawTime = performance.now();

    function draw() {
        if (stateGetters.getEcoMode()) {
            callbacks.updateTimelineUI();
            requestAnimationFrame(draw);
            return;
        }

        const now = performance.now();

        // A hidden or not-yet-laid-out canvas has no drawable surface. Skip the
        // complete frame before any offscreen canvas can reach drawImage at 0px.
        if (canvas.width === 0 || canvas.height === 0) {
            requestAnimationFrame(draw);
            return;
        }

        const t = (now - startTime) * 0.001;
        let dt = (now - lastDrawTime) * 0.001;
        if (!Number.isFinite(dt) || dt < 0 || dt > 0.1) dt = 0.016; // FPS-Drop & Clock-Skew Protection
        lastDrawTime = now;

        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const currentSystem = getActiveSystemFromDOM();
        const lineColor = currentSystem === 'atari' ? '#55ff55' : currentSystem === 'amiga' ? '#ff8800' : '#6c5eb5';

        if (dss.currentSystem !== currentSystem) {
            dss.forceSystemChange(currentSystem);
        }
        if (currentSystem !== currentCrtSystem) {
            currentCrtSystem = currentSystem;
            if (displaySettings.getState().crtPreset === 'auto') {
                applyCrtOptions(currentSystem);
            }
        }

        // =========================================================
        // 1. AUDIO & REGISTER DATEN ABGREIFEN
        // =========================================================
        const isPlaying = stateGetters.getIsPlaying();
        const channelVolumes = (isPlaying && stateGetters.getChannelVolumes)
            ? stateGetters.getChannelVolumes()
            : zeroVolumes;

        // FIX: Variable konsequent "chipRegs" nennen
        let chipRegs = idleRegs;
        if (isPlaying && stateGetters.getCurrentChipRegs) {
            const r = stateGetters.getCurrentChipRegs();
            if (r) chipRegs = r;
        }

        // =========================================================
        // 2. LIVING SILICON UPDATE (Hardware Labor Monitor)
        // =========================================================
        const activeSilicon = document.getElementById('living-silicon-container');
        if (activeSilicon && window.siliconVisualizerInstance && !document.body.classList.contains('archive-expanded')) {
            const sidBusRate = stateGetters.getSidRegisterWriteRate ? stateGetters.getSidRegisterWriteRate() : 0;
            window.siliconVisualizerInstance.update(channelVolumes, chipRegs, t, sidBusRate);
        }

        // =========================================================
        // 3. METADATEN FÜR DEN SCENE-DJ (Track Presenter)
        // =========================================================
        const sessionId = stateGetters.getPlaybackSessionId ? stateGetters.getPlaybackSessionId() : 0;
        const trkData = stateGetters.getTrackData ? stateGetters.getTrackData() : null;
        const trackMetadata = trkData ? trkData.metadata : null;

        // =========================================================
        // 4. CANVAS RENDER ROUTING
        // =========================================================
        if (showGimmick) {
            // FIX: chipRegs als 9. Argument an den SceneDJ übergeben!
            dss.render(ctx, canvas.width, canvas.height, t, channelVolumes, isPlaying, sessionId, trackMetadata, chipRegs);
        } else {
            osc.render(ctx, canvas.width, canvas.height, stateGetters, lineColor, dt);
            fft.render(ctx, canvas.width, canvas.height, stateGetters, lineColor, dt, currentSystem);
        }

        // =========================================================
        // 5. POST-PROCESSING (CRT Glitch)
        // =========================================================
        if (typeof glitch !== 'undefined' && glitch) {
            glitch.render(ctx, canvas.width, canvas.height, dt);
        }
        crtMask.render();

        hudCounter++;
        callbacks.updateTimelineUI();
        if (hudCounter % 4 === 0) callbacks.updateChipHUD();

        requestAnimationFrame(draw);
    }

    draw();
}