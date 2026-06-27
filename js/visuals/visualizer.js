// === js/visuals/visualizer.js ===
// =========================================================
// HIGH-PERFORMANCE RETROWAVE VISUALIZER MODULE
// Dynamic 3/4 Channel-Coupled Copperbars & Spectrum Analyzer
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
        const newWidth = canvas.clientWidth;
        const newHeight = canvas.clientHeight;
        
        if (canvas.width !== newWidth) {
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
        } else {
            canvas.height = newHeight; 
        }
    }
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    const startTime = performance.now();
    let hudCounter = 0; 

    const activeAnalyser = stateGetters.getAnalyserNode();
    const bufferLength = activeAnalyser ? activeAnalyser.frequencyBinCount : 512;
    const dataArray = new Uint8Array(bufferLength);
    const barCount = 48; 
    const peaks = new Array(barCount).fill(0); 

    function drawCopperBar(yCenter, thickness, color1, color2) {
        const grad = ctx.createLinearGradient(0, yCenter - thickness, 0, yCenter + thickness);
        grad.addColorStop(0, `rgba(0,0,0,0)`); 
        grad.addColorStop(0.2, color1);
        grad.addColorStop(0.5, `rgba(255,255,255,1)`); 
        grad.addColorStop(0.8, color2);
        grad.addColorStop(1, `rgba(0,0,0,0)`);
        ctx.fillStyle = grad; 
        ctx.fillRect(0, yCenter - thickness, canvas.width, thickness * 2);
    }

    function draw() {
        if (stateGetters.getEcoMode()) {
            callbacks.updateTimelineUI(); 
            requestAnimationFrame(draw);
            return; 
        }

        const t = (performance.now() - startTime) * 0.001; 
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const isAmiga = document.body.classList.contains('theme-amiga');
        const isAtari = document.body.classList.contains('theme-atari');
        
        const pal1 = isAtari ? ['#005500', '#00aa00'] : isAmiga ? ['#0000aa', '#0055ff'] : ['#352879', '#6c5eb5'];
        const pal2 = isAtari ? ['#555500', '#aaaa00'] : isAmiga ? ['#aa5500', '#ff8800'] : ['#aa0055', '#ff00aa'];
        const pal3 = isAtari ? ['#005555', '#00aaaa'] : isAmiga ? ['#5500aa', '#aa00ff'] : ['#555555', '#aaaaaa'];
        const lineColor = isAtari ? '#55ff55' : isAmiga ? '#ff8800' : '#6c5eb5';

        // === DOPPELTE KANALKOPPLUNG FÜR COPPERBARS ===
        const channelVolumes = stateGetters.getChannelVolumes ? stateGetters.getChannelVolumes() : [0, 0, 0, 0];
        const numBars = isAmiga ? 4 : 3;

        const pals = [
            isAtari ? ['#005500', '#00aa00'] : isAmiga ? ['#0000aa', '#0055ff'] : ['#352879', '#6c5eb5'],
            isAtari ? ['#555500', '#aaaa00'] : isAmiga ? ['#aa5500', '#ff8800'] : ['#aa0055', '#ff00aa'],
            isAtari ? ['#005555', '#00aaaa'] : isAmiga ? ['#5500aa', '#aa00ff'] : ['#555555', '#aaaaaa'],
            isAmiga ? ['#555555', '#ffffff'] : []
        ];

        const sinTimes = [1.2, 1.8, 1.5, 2.1];
        const sinOffsets = [0.0, 2.0, 4.0, 1.5];
        
        // === FEINERE, FILIGRANERE BASISDICKEN FÜR REINERE OPTIK ===
        const baseThickness = [14, 10, 8, 6]; 
        const heightWeights = [0.3, 0.35, 0.25, 0.28];

        ctx.globalCompositeOperation = "screen"; 
        for (let c = 0; c < numBars; c++) {
            let vol = channelVolumes[c] || 0;
            
            // Reduzierter Punch (Ausschlag) verhindert das unschöne Verschmelzen der Linien
            let punch = vol * 18; 
            
            let yCenter = (canvas.height / 2) + Math.sin(t * sinTimes[c] + sinOffsets[c]) * (canvas.height * heightWeights[c]);
            drawCopperBar(yCenter, baseThickness[c] + punch, pals[c][0], pals[c][1]);
        }
        ctx.globalCompositeOperation = "source-over";

        // --- DAS OSZILLOSKOP ---
        const currentOscValue = stateGetters.getCurrentOscValue();
        const trackData = stateGetters.getTrackData();
        const trackLength = trackData ? (trackData.length || 0) : 0;
        
        oscHistory[oscIndex] = (trackLength === 0) ? NaN : currentOscValue;
        oscIndex = (oscIndex + 1) % historyLength; 
        
        ctx.beginPath();
        ctx.strokeStyle = lineColor;
        
        let isFirstPoint = true;
        for (let x = 0; x < historyLength; x++) {
            const actualIndex = (oscIndex + x) % historyLength; 
            const val = oscHistory[actualIndex];
            
            if (!isNaN(val)) {
                const y = (canvas.height / 2) - (val * (canvas.height * 0.4)); 
                if (isFirstPoint) {
                    ctx.moveTo(x, y);
                    isFirstPoint = false;
                } else {
                    ctx.lineTo(x, y);
                }
            }
        }
        
        if (!isFirstPoint) {
            ctx.lineWidth = 6; ctx.globalAlpha = 0.3; ctx.stroke();
            ctx.lineWidth = 2; ctx.globalAlpha = 1.0; ctx.stroke();
        }

        // --- SPECTRUM ANALYZER ---
        const activeAnalyser = stateGetters.getAnalyserNode();
        const isPlaying = stateGetters.getIsPlaying();
        const audioCtx = stateGetters.getAudioContext();

        if (activeAnalyser && isPlaying && audioCtx) {
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
                
                const heightBoost = 1.0 + (i / barCount) * 0.5;
                const barHeight = ((avg * heightBoost) / 255.0) * (canvas.height * 0.4);
                
                if (barHeight > peaks[i]) peaks[i] = barHeight; 
                else { peaks[i] -= 1.5; if (peaks[i] < 0) peaks[i] = 0; }
                
                ctx.fillStyle = lineColor; 
                ctx.globalAlpha = 0.7;
                ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
                
                if (peaks[i] > 2) {
                    ctx.globalAlpha = 1.0; 
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(x, canvas.height - peaks[i] - 4, barWidth, 2);
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