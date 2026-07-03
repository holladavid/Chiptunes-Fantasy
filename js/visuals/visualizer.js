// === js/visuals/visualizer.js ===
// =========================================================
// HIGH-PERFORMANCE RETROWAVE VISUALIZER MODULE
// Modular Component Orchestration & Low-Latency Timing
// =========================================================

import { C64Starfield } from './gimmicks/starfield-c64.js';
import { AmigaCube } from './gimmicks/cube-amiga.js';
import { AtariBobs } from './gimmicks/bobs-atari.js';
import { FftAnalyzer } from './components/fft-analyzer.js';
import { Oscilloscope } from './components/oscilloscope.js';
import { Copperbars } from './gimmicks/copperbars.js';

export function initVisuals(stateGetters, callbacks) {
    const canvas = document.getElementById('demo-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false }); 

    // --- INTERACTIVE GIMMICK STATE & TOGGLE ---
    let showGimmick = false;
    const logo = document.getElementById('brand-logo');
    if (logo) {
        logo.addEventListener('click', () => {
            showGimmick = !showGimmick;
            if (!showGimmick) {
                osc.clear(); // Oszilloskop-Datenpuffer beim Umschalten leeren
            }
            logo.style.filter = 'brightness(2.0)';
            setTimeout(() => logo.style.filter = '', 100);
        });
    }

    // Instanziierung aller gekapselten GFX- und DSP-Komponenten
    const starfield = new C64Starfield();
    const cube = new AmigaCube();
    const bobs = new AtariBobs();
    const fft = new FftAnalyzer();
    const osc = new Oscilloscope(canvas.width, canvas.height);
    const coppers = new Copperbars();

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
            osc.resize(newWidth, newHeight); // Oszilloskop-Datenpuffer anpassen
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
        
        // GFX FIX: Hard 50Hz CRT Clear (Keine Glow-Spur / Motion Blur mehr)
        ctx.fillStyle = '#000000'; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const isAmiga = document.body.classList.contains('theme-amiga');
        const isAtari = document.body.classList.contains('theme-atari');
        const isC64 = document.body.classList.contains('theme-c64');
        const lineColor = isAtari ? '#55ff55' : isAmiga ? '#ff8800' : '#6c5eb5';
        
        // Rasterlinien ebenfalls ausblenden, wenn das Gimmick läuft!
        if (!showGimmick) {
            drawReticle(); 
        }

        const channelVolumes = stateGetters.getChannelVolumes ? stateGetters.getChannelVolumes() : [0, 0, 0, 0];
        let totalVol = 0;
        for (let i=0; i<4; i++) totalVol += channelVolumes[i] || 0;
        const avgVol = totalVol / 4.0;

        // --- 1. EASTER EGG INJECTION ---
        if (showGimmick) {
            if (isC64) {
                // C64: Sternenfeld ganz im Hintergrund, Rasterbars davor!
                starfield.render(ctx, canvas.width, canvas.height, t, avgVol);
                coppers.render(ctx, canvas.width, canvas.height, t, channelVolumes);
            } else {
                // Amiga/Atari ST: Rasterbars ganz hinten im Hintergrund, 
                // die Vektorgrafiken (Cube / Bobs) davor im Vordergrund!
                coppers.render(ctx, canvas.width, canvas.height, t, channelVolumes);
                
                if (isAmiga) {
                    cube.render(ctx, canvas.width, canvas.height, t, channelVolumes[0] || 0);
                } else if (isAtari) {
                    bobs.render(ctx, canvas.width, canvas.height, t, avgVol);
                }
            }
        }
        
        // --- 3. STANDARD CHANNELS (Nur aktiv wenn Gimmick aus) ---
        if (!showGimmick) {
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