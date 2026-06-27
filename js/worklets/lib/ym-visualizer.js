// === js/worklets/lib/ym-visualizer.js ===
// =========================================================
// YM2149 VISUALIZER I/O DISPATCHER
// Shared zero-allocation copy-mode visualizer buffer for all ST cores
// =========================================================

export class YMVisualizer {
    constructor(port) {
        this.port = port;
        this.visualView = new Float32Array(40);
        this.visCounter = 0;
        this.wasAudible = false;
    }

    update(isPlaying, currentFrame, currentVisualValue, regs, volA, volB, volC) {
        this.visCounter++;
        if (this.visCounter % 4 === 0) {
            let isAudible = Math.abs(currentVisualValue) > 0.001;
            if (isAudible || this.wasAudible) {
                const view = this.visualView;
                view[0] = 2; // System Flag: 2 = Atari ST
                view[1] = isPlaying ? 1 : 0;
                view[2] = currentFrame;
                view[3] = currentVisualValue;

                // Die 16 Hardware-Register befüllen
                for (let r = 0; r < 16; r++) {
                    view[4 + r] = regs[r];
                }

                // Kanallautstärken für die Rasterbars (Index 34-36)
                view[34] = volA;
                view[35] = volB;
                view[36] = volC;
                view[37] = 0.0; // Ungenutzt für ST

                this.port.postMessage(view);
            }
            this.wasAudible = isAudible;
        }
    }
}