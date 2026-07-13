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

// NEU: Statisches, prä-allozierte Null-Array zur Vermeidung von Heap-Garbages bei Inaktivität
const zeroVolumes = new Float32Array(4);
const idleRegs = new Uint8Array(32);
idleRegs[7] = 0xFF; // Schaltet alle Mixer-LED-Gatter des YM2149 im Idle-Modus ab

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

    // Horcht auf den physischen Power-Cycle und flusht den RAM
    window.addEventListener('hardware-power-cycle', () => {
        wireSiliconDJ();
        const sys = document.body.classList.contains('theme-atari') ? 'atari' : (document.body.classList.contains('theme-amiga') ? 'amiga' : 'c64');
        dss.forceSystemChange(sys);
        dss.resize(canvas.width, canvas.height); // Skalierung für neue DSEs wiederherstellen
    });

    // =========================================================
    // AUTO-REGISTER ALL DEMO-SCENE-ELEMENTS WITH METADATA CONTRACT
    // =========================================================
    dseRegistry.forEach(entry => {
        try {
            const effectInstance = new entry.Class();
            // Dem Renderer seine konsolidierten Metadaten anhängen
            effectInstance.metadata = entry.metadata; 
            dss.registerDSE(effectInstance);
        } catch (err) {
            console.error(`[SCENE-DJ] Failed to register DSE: ${entry.Class.name}`, err);
        }
    });

    // Core UI (Vom DJ unabhängig)
    const fft = new FftAnalyzer();
    const osc = new Oscilloscope(canvas.width, canvas.height);
    const glitch = new CrtGlitch(); // NEU: Instanziiert den Glitcher

    // --- INTERACTIVE GIMMICK STATE & TOGGLE ---
    let showGimmick = false;
    const logo = document.getElementById('brand-logo');
    if (logo) {
        logo.addEventListener('click', () => {
            showGimmick = !showGimmick;
            if (!showGimmick) osc.clear();
            
            // NEU: Klassenzuweisung für den systemgetreuen Glow
            logo.classList.toggle('demo-mode-active', showGimmick);
            
            logo.style.filter = 'brightness(2.0)';
            setTimeout(() => logo.style.filter = '', 100);
        });
    }

    function resizeCanvas() {
        const clientWidth = canvas.clientWidth;
        const clientHeight = canvas.clientHeight;
        const maxResolutionWidth = 1280;
        let scale = 1.0;
        
        if (clientWidth > maxResolutionWidth) {
            scale = maxResolutionWidth / clientWidth;
        }
        
        const newWidth = Math.floor(clientWidth * scale);
        const newHeight = Math.floor(clientHeight * scale);
        
        if (canvas.width !== newWidth || canvas.height !== newHeight) {
            canvas.width = newWidth; 
            canvas.height = newHeight;
            osc.resize(newWidth, newHeight); 
            dss.resize(newWidth, newHeight); // Resize ans DSE-Ökosystem leiten
        }
    }
    
    // Initialer Resize (Nachdem dss deklariert wurde!)
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    const startTime = performance.now();
    let hudCounter = 0; 

    function drawReticle() {
        const w = canvas.width;
        const h = canvas.height;
        const midY = h / 2;
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, midY);
        ctx.lineTo(w, midY);
        ctx.stroke();
        
        const divisions = 10;
        const stepX = w / divisions;
        ctx.beginPath();
        for (let i = 1; i < divisions; i++) {
            ctx.moveTo(i * stepX, 0);
            ctx.lineTo(i * stepX, h);
        }
        ctx.stroke();
        ctx.setLineDash([]); 
    }

    let lastDrawTime = performance.now(); // NEU: Außerhalb von draw() definieren!

    function draw() {
        if (stateGetters.getEcoMode()) {
            callbacks.updateTimelineUI(); 
            requestAnimationFrame(draw);
            return; 
        }

        const now = performance.now();
        const t = (now - startTime) * 0.001; 
        let dt = (now - lastDrawTime) * 0.001;
        if (dt > 0.1) dt = 0.016; // FPS-Drop Protection
        lastDrawTime = now;        
        ctx.fillStyle = '#000000'; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const isAmiga = document.body.classList.contains('theme-amiga');
        const isAtari = document.body.classList.contains('theme-atari');
        const isC64 = document.body.classList.contains('theme-c64');
        const lineColor = isAtari ? '#55ff55' : isAmiga ? '#ff8800' : '#6c5eb5';
        
        const currentSystem = isAtari ? 'atari' : (isAmiga ? 'amiga' : 'c64');
        if (dss.currentSystem !== currentSystem) {
            dss.forceSystemChange(currentSystem);
        }

        // =========================================================
        // REAL-TIME REGISTER INTEGRATION
        // Speist das Register-Frame & die Systemzeit in das Die-Layout
        // =========================================================
        const isPlaying = stateGetters.getIsPlaying();
        const channelVolumes = (isPlaying && stateGetters.getChannelVolumes) 
            ? stateGetters.getChannelVolumes() 
            : zeroVolumes;

        // GFX FIX: Wenn pausiert, übergeben wir das "stromlose" idleRegs Array
        let currentRegs = idleRegs;
        if (isPlaying && stateGetters.getCurrentChipRegs) {
            const r = stateGetters.getCurrentChipRegs();
            if (r) currentRegs = r;
        }

        const activeSilicon = document.getElementById('living-silicon-container');
        if (activeSilicon && window.siliconVisualizerInstance) {
            window.siliconVisualizerInstance.update(channelVolumes, currentRegs, t);
        }

         // NEU: Session ID aus der App-Logik abfragen
        const sessionId = stateGetters.getPlaybackSessionId ? stateGetters.getPlaybackSessionId() : 0;
        // TrackData und Metadata abholen
        const trackData = stateGetters.getTrackData();
        const trackMetadata = trackData ? trackData.metadata : null;

        // NEU: Register abrufen
        const chipRegs = (isPlaying && stateGetters.getCurrentChipRegs) ? stateGetters.getCurrentChipRegs() : null;

        // --- RENDER ROUTING ---
        if (showGimmick) {
            // NEU: chipRegs am Ende des Aufrufs anfügen!
            dss.render(ctx, canvas.width, canvas.height, t, channelVolumes, isPlaying, sessionId, trackMetadata, chipRegs);
        } else {
            drawReticle(); 
            osc.render(ctx, canvas.width, canvas.height, stateGetters, lineColor);
            fft.render(ctx, canvas.width, canvas.height, stateGetters, lineColor);
        }

        // NEU: Globaler Hardware-Glitch post-processing Pass
        glitch.render(ctx, canvas.width, canvas.height, dt);

        hudCounter++;
        callbacks.updateTimelineUI();
        if (hudCounter % 4 === 0) callbacks.updateChipHUD();
        requestAnimationFrame(draw);
    }
    
    draw();
}