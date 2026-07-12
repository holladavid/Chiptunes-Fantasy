// === js/visuals/scroller.js ===
// =========================================================
// RETRO DOUBLE-SINE TEXT SCROLLER MODULE
// High-performance canvas rendering with 50Hz aesthetics
// Retina-Ready & Soft-Reset Change Protection
// =========================================================

export function initScroller(getScrollerText, getEcoMode) {
    const canvas = document.getElementById('scroller-canvas');
    if (!canvas) {
        console.warn('[SCROLLER] Canvas-Element #scroller-canvas nicht gefunden.');
        return;
    }
    
    const ctx = canvas.getContext('2d', { alpha: false });
    let dpr = window.devicePixelRatio || 1;

    function resizeCanvas() {
        dpr = window.devicePixelRatio || 1;
        canvas.width = canvas.clientWidth * dpr; 
        canvas.height = canvas.clientHeight * dpr;
        canvas.style.width = `${canvas.clientWidth}px`;
        canvas.style.height = `${canvas.clientHeight}px`;
        ctx.scale(dpr, dpr);
        ctx.imageSmoothingEnabled = false;
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    let offset = 0;          
    const speed = 2.5; 
    let lastText = ""; // Cache für Textwechsel-Überwachung
    
    const baseGreets = " +++ AT LAST, THE ULTIMATE HTML5 MUSIC DISK IS COMPLETE +++ CODE & DSP MAGIK RUNNING AT A SOLID 50 HZ VBLANK +++ DEEP CHIP EMULATION VIA AUDIOWORKLETS +++ NO MP3, NO BULLSHIT, JUST PURE MATHEMATICS +++ GREETS FLY OUT TO ALL THE PIXEL PUSHERS, CYCLE CRUNCHERS AND WAVEFORM WIZARDS OUT THERE +++ TO EVERYONE WHO STILL KEEPS THE SPIRIT OF THE 8-BIT AND 16-BIT ERA ALIVE +++ TO THE TRUE LOVERS OF DEMOSCENE ART AND CHIPTUNE MAGIC +++ LET THE ANALOG FILTERS BURN +++ WRAP AROUND +++ ";
    
    function draw() {
        if (getEcoMode()) {
            requestAnimationFrame(draw);
            return; 
        }

        const cssWidth = canvas.width / dpr;
        const cssHeight = canvas.height / dpr;

        // Frame leeren
        ctx.fillStyle = '#000000'; 
        ctx.fillRect(0, 0, cssWidth, cssHeight);
        
        const isAmiga = document.body.classList.contains('theme-amiga');
        const isAtari = document.body.classList.contains('theme-atari');
        
        ctx.fillStyle = isAtari ? '#55ff55' : isAmiga ? '#ff8800' : '#6c5eb5';
        ctx.font = isAmiga || isAtari ? "32px 'VT323', monospace" : "24px 'Press Start 2P', monospace";
        ctx.textBaseline = "middle";
        
        ctx.shadowColor = '#000000';
        ctx.shadowOffsetX = isAmiga || isAtari ? 2 : 3; 
        ctx.shadowOffsetY = isAmiga || isAtari ? 2 : 3;
        ctx.shadowBlur = 0; 

        // =========================================================
        // AUTOMATISCHER SCROLL-RESET BEI TRACKWECHSEL
        // Verhindert das unschöne "Springen" der Buchstaben
        // =========================================================
        const currentText = getScrollerText() || "";
        if (currentText !== lastText) {
            offset = 0; // Setzt den Scroll-Zeiger weich auf Start zurück
            lastText = currentText;
        }

        const fontMetricOffset = (isAmiga || isAtari) ? -(cssHeight * 0.08) : 0;
        const fullText = currentText + baseGreets;
        const charWidth = ctx.measureText("A").width;
        let startX = cssWidth - offset;
        
        for (let i = 0; i < fullText.length; i++) {
            let x = startX + (i * charWidth);
            
            if (x > -50 && x < cssWidth + 50) {
                let wave1 = Math.sin((x * 0.01) + (offset * 0.04)) * (cssHeight * 0.16);
                let wave2 = Math.cos((x * 0.02) + (offset * 0.07)) * (cssHeight * 0.06);
                
                ctx.fillText(fullText[i], x, (cssHeight / 2) + wave1 + wave2 + fontMetricOffset);
            }
        }
        
        offset = (offset + speed) > (charWidth * fullText.length + cssWidth) ? 0 : offset + speed;
        requestAnimationFrame(draw);
    }
    
    draw();
}