// === js/visuals/visualizer.js ===
// =========================================================
// HIGH-PERFORMANCE RETROWAVE VISUALIZER MODULE
// Optimized Phosphor Trail, Clean Copperbars & Modular Component Orchestration
// =========================================================

import { C64Starfield } from './gimmicks/starfield-c64.js';
import { AmigaCube } from './gimmicks/cube-amiga.js';
import { AtariBobs } from './gimmicks/bobs-atari.js';
import { FftAnalyzer } from './components/fft-analyzer.js';
import { Oscilloscope } from './components/oscilloscope.js';

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
                osc.clear(); // Sauberes Leeren des Oszilloskops bei Deaktivierung
            }
            logo.style.filter = 'brightness(2.0)';
            setTimeout(() => logo.style.filter = '', 100);
        });
    }

    // Instanziierung aller gekapselten DSP- und Visual-Komponenten
    const starfield = new C64Starfield();
    const cube = new AmigaCube();
    const bobs = new AtariBobs();
    const fft = new FftAnalyzer();
    const osc = new Oscilloscope(canvas.width);

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
            osc.resize(newWidth); // Oszilloskop-Datenpuffer anpassen
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

    function drawCopperbar(y, height, volume, colorStart, colorEnd) {
        if (volume <= 0.01) return;
        const w = canvas.width;
        
        const grad = ctx.createLinearGradient(0, y, 0, y + height);
        grad.addColorStop(0.0, '#000000');
        grad.addColorStop(0.18, colorStart);
        grad.addColorStop(0.5, '#ffffff'); 
        grad.addColorStop(0.82, colorEnd);
        grad.addColorStop(1.0, '#000000');
        
        ctx.fillStyle = grad;
        ctx.fillRect(0, y, w, height);
    }

    function draw() {
        if (stateGetters.getEcoMode()) {
            callbacks.updateTimelineUI(); 
            requestAnimationFrame(draw);
            return; 
        }

        const t = (performance.now() - startTime) * 0.001; 
        
        // Background Phosphor Trail
        ctx.fillStyle = 'rgba(0, 0, 0, 0.38)'; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const isAmiga = document.body.classList.contains('theme-amiga');
        const isAtari = document.body.classList.contains('theme-atari');
        const isC64 = document.body.classList.contains('theme-c64');
        const lineColor = isAtari ? '#55ff55' : isAmiga ? '#ff8800' : '#6c5eb5';
        
        drawReticle();

        const channelVolumes = stateGetters.getChannelVolumes ? stateGetters.getChannelVolumes() : [0, 0, 0, 0];
        let totalVol = 0;
        for (let i=0; i<4; i++) totalVol += channelVolumes[i] || 0;
        const avgVol = totalVol / 4.0;

        // --- EASTER EGG INJECTION ---
        if (showGimmick) {
            if (isC64) starfield.render(ctx, canvas.width, canvas.height, t, avgVol);
            else if (isAmiga) cube.render(ctx, canvas.width, canvas.height, t, channelVolumes[0] || 0);
            else if (isAtari) bobs.render(ctx, canvas.width, canvas.height, t, avgVol);
        }

        // Copperbars
        const numBars = isAmiga ? 4 : 3;
        const pals = [
            isAtari ? ['#003300', '#00aa00'] : isAmiga ? ['#000066', '#0055ff'] : ['#201a60', '#6c5eb5'],
            isAtari ? ['#333300', '#aaaa00'] : isAmiga ? ['#663300', '#ff8800'] : ['#660033', '#ff00aa'],
            isAtari ? ['#003333', '#00aaaa'] : isAmiga ? ['#330066', '#aa00ff'] : ['#333333', '#aaaaaa'],
            isAmiga ? ['#111111', '#888888'] : []
        ];

        const sinTimes = [1.3, 1.9, 1.6, 2.2];
        const sinOffsets = [0.0, 2.0, 4.0, 1.5];
        const baseThickness = [18, 14, 12, 10]; 
        const heightWeights = [0.28, 0.33, 0.22, 0.25];

        ctx.globalCompositeOperation = "screen"; 
        for (let c = 0; c < numBars; c++) {
            let vol = channelVolumes[c] || 0;
            let punch = vol * 28; 
            
            let yCenter = (canvas.height / 2) + Math.sin(t * sinTimes[c] + sinOffsets[c]) * (canvas.height * heightWeights[c]);
            drawCopperbar(yCenter - (baseThickness[c] + punch)/2, (baseThickness[c] + punch), vol, pals[c][0], pals[c][1]);
        }
        ctx.globalCompositeOperation = "source-over";

        // --- RENDER STANDARD CHANNELS (Nur aktiv wenn Gimmick aus) ---
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