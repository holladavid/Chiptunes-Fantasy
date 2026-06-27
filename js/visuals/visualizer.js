// === js/visuals/visualizer.js ===
// =========================================================
// HIGH-PERFORMANCE RETROWAVE VISUALIZER MODULE
// Optimized Phosphor Trail, Clean Copperbars & Fullscreen Clamping
// =========================================================

export function initVisuals(stateGetters, callbacks) {
    const canvas = document.getElementById('demo-canvas');
    if (!canvas) {
        console.warn('[VISUALIZER] Canvas-Element #demo-canvas nicht gefunden.');
        return;
    }

    const ctx = canvas.getContext('2d', { alpha: false }); 
    
    let historyLength = canvas.width;
    let oscHistory = new Float32Array(historyLength).fill(NaN);
    let oscIndex = 0;

    function resizeCanvas() {
        const clientWidth = canvas.clientWidth;
        const clientHeight = canvas.clientHeight;
        
        // --- RETRO-RESOLUTION CLAMPING ---
        // Um ein "Schmelzen" der GPU auf 4K/Retina-Displays zu verhindern und
        // die Frequenz-Geschwindigkeit des Oszilloskops auf allen Bildschirmen
        // absolut einheitlich zu halten, deckeln wir die maximale interne 
        // Renderbreite auf 1280px (720p). Das heraufskalierte CSS-Bild erzeugt
        // einen herrlich authentischen Röhren-Unschärfe-Look!
        const maxResolutionWidth = 1280;
        let scale = 1.0;
        
        if (clientWidth > maxResolutionWidth) {
            scale = maxResolutionWidth / clientWidth;
        }
        
        const newWidth = Math.floor(clientWidth * scale);
        const newHeight = Math.floor(clientHeight * scale);
        
        if (canvas.width !== newWidth || canvas.height !== newHeight) {
            const oldHistory = oscHistory;
            const oldLen = oldHistory ? oldHistory.length : 0;
            
            canvas.width = newWidth; 
            canvas.height = newHeight;
            historyLength = canvas.width;
            
            oscHistory = new Float32Array(historyLength).fill(NaN);
            
            if (oldLen > 0) {
                const copyLen = Math.min(oldLen, historyLength);
                for (let i = 0; i < copyLen; i++) {
                    const oldVal = oldHistory[(oscIndex - copyLen + i + oldLen) % oldLen];
                    oscHistory[i] = oldVal;
                }
                oscIndex = copyLen % historyLength;
            }
        }
    }
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    const startTime = performance.now();
    let hudCounter = 0; 

    const barCount = 48; 
    const peaks = new Array(barCount).fill(0); 

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
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.38)'; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const isAmiga = document.body.classList.contains('theme-amiga');
        const isAtari = document.body.classList.contains('theme-atari');
        const lineColor = isAtari ? '#55ff55' : isAmiga ? '#ff8800' : '#6c5eb5';
        
        drawReticle();

        const channelVolumes = stateGetters.getChannelVolumes ? stateGetters.getChannelVolumes() : [0, 0, 0, 0];
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

        const currentOscValue = stateGetters.getCurrentOscValue();
        const trackData = stateGetters.getTrackData();
        const trackLength = trackData ? (trackData.length || 0) : 0;
        
        oscHistory[oscIndex] = (trackLength === 0) ? 0 : currentOscValue;
        oscIndex = (oscIndex + 1) % historyLength; 

        ctx.beginPath();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = lineColor;
        
        ctx.shadowColor = lineColor;
        ctx.shadowBlur = 10;

        let isFirstPoint = true;
        for (let x = 0; x < historyLength; x++) {
            const actualIndex = (oscIndex + x) % historyLength; 
            const val = oscHistory[actualIndex];
            
            if (!isNaN(val)) {
                const y = (canvas.height / 2) - (val * (canvas.height * 0.42)); 
                if (isFirstPoint) {
                    ctx.moveTo(x, y);
                    isFirstPoint = false;
                } else {
                    ctx.lineTo(x, y);
                }
            }
        }
        
        if (!isFirstPoint) {
            ctx.stroke();
        }
        ctx.shadowBlur = 0; 

        const activeAnalyser = stateGetters.getAnalyserNode();
        const isPlaying = stateGetters.getIsPlaying();
        const audioCtx = stateGetters.getAudioContext();

        if (activeAnalyser && isPlaying && audioCtx) {
            const bufferLength = activeAnalyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            activeAnalyser.getByteFrequencyData(dataArray);
            
            const barWidth = (canvas.width / barCount) - 2;
            let x = 0;
            
            const hzPerBin = audioCtx.sampleRate / activeAnalyser.fftSize;
            const minBin = Math.max(1, Math.floor(50 / hzPerBin)); 
            const maxBin = Math.floor(12000 / hzPerBin); 
            let lastEndBin = minBin;
            
            for (let i = 0; i < barCount; i++) {
                const startBin = lastEndBin;
                let endBin = Math.floor(minBin * Math.pow(maxBin / minBin, (i + 1) / barCount));
                if (endBin <= startBin) endBin = startBin + 1;
                lastEndBin = endBin;
                
                let sum = 0;
                for (let b = startBin; b < endBin; b++) sum += dataArray[b];
                const avg = sum / (endBin - startBin);
                
                const heightBoost = 1.0 + (i / barCount) * 0.6;
                const barHeight = ((avg * heightBoost) / 255.0) * (canvas.height * 0.38);
                
                if (barHeight > peaks[i]) peaks[i] = barHeight; 
                else { peaks[i] -= 1.2; if (peaks[i] < 0) peaks[i] = 0; }
                
                ctx.fillStyle = lineColor; 
                ctx.globalAlpha = 0.6;
                ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
                
                if (peaks[i] > 2) {
                    ctx.globalAlpha = 1.0; 
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(x, canvas.height - peaks[i] - 3, barWidth, 2);
                }
                x += barWidth + 2;
            }
            ctx.globalAlpha = 1.0;
        }

        hudCounter++;
        callbacks.updateTimelineUI();
        if (hudCounter % 4 === 0) callbacks.updateChipHUD();
        requestAnimationFrame(draw);
    }
    
    draw();
}