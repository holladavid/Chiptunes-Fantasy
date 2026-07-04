// === js/visuals/visualizer.js ===
// =========================================================
// HIGH-PERFORMANCE RETROWAVE VISUALIZER MODULE
// Modulare DJ-Orchestrierung & Core UI Trennung (v1.2.0)
// =========================================================

import { SceneDJ } from './scene-dj.js';
import { dseRegistry } from './dse/registry.js';
import { FftAnalyzer } from './components/fft-analyzer.js';
import { Oscilloscope } from './components/oscilloscope.js';

export function initVisuals(stateGetters, callbacks) {
    const canvas = document.getElementById('demo-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false }); 

    let showGimmick = false;
    const logo = document.getElementById('brand-logo');
    if (logo) {
        logo.addEventListener('click', () => {
            showGimmick = !showGimmick;
            if (!showGimmick) osc.clear();
            logo.style.filter = 'brightness(2.0)';
            setTimeout(() => logo.style.filter = '', 100);
        });
    }

    // =========================================================
    // INITIALISIERUNG SCENE-DJ & DSE AUTO-REGISTRATION
    // =========================================================
    const dss = new SceneDJ();
    
    dseRegistry.forEach(DseClass => {
        try {
            const effectInstance = new DseClass();
            dss.registerDSE(effectInstance);
        } catch (err) {
            console.error(`[SCENE-DJ] Failed to register DSE: ${DseClass.name}`, err);
        }
    });

    // Core UI (Vom DJ unabhängig)
    const fft = new FftAnalyzer();
    const osc = new Oscilloscope(canvas.width, canvas.height);

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

    function draw() {
        if (stateGetters.getEcoMode()) {
            callbacks.updateTimelineUI(); 
            requestAnimationFrame(draw);
            return; 
        }

        const t = (performance.now() - startTime) * 0.001; 
        
        ctx.fillStyle = '#000000'; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const isAmiga = document.body.classList.contains('theme-amiga');
        const isAtari = document.body.classList.contains('theme-atari');
        const isC64 = document.body.classList.contains('theme-c64');
        const lineColor = isAtari ? '#55ff55' : isAmiga ? '#ff8800' : '#6c5eb5';
        
        // DSS System-Sync (Meldet dem DJ, wenn der Tab gewechselt wurde)
        const currentSystem = isAtari ? 'atari' : (isAmiga ? 'amiga' : 'c64');
        if (dss.currentSystem !== currentSystem) {
            dss.forceSystemChange(currentSystem);
        }

        const channelVolumes = stateGetters.getChannelVolumes ? stateGetters.getChannelVolumes() : [0, 0, 0, 0];

        // --- RENDER ROUTING ---
        if (showGimmick) {
            // Scene-DJ übergibt an DSEs
            dss.render(ctx, canvas.width, canvas.height, t, channelVolumes);
        } else {
            // Core UI Modus (Lab-Scope)
            drawReticle(); 
            osc.render(ctx, canvas.width, canvas.height, stateGetters, lineColor);
            fft.render(ctx, canvas.width, canvas.height, stateGetters, lineColor);
        }

        hudCounter++;
        callbacks.updateTimelineUI();
        if (hudCounter % 4 === 0) callbacks.updateChipHUD();
        requestAnimationFrame(draw);
    }
    
    draw();
}