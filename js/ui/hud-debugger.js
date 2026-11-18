// === js/ui/hud-debugger.js ===
// =========================================================
// HIGH-PERFORMANCE REGISTER HUD & ANALYZER MODULE
// Dynamic Layouts, Cached DOM/Canvas & Symmetrical Amiga LEDs
// =========================================================

const NOISE_LUT_HZ = [
    125000, 125000,  62500,  41667,  31250,  25000,  20833,  17857,
     15625,  13889,  12500,  11364,  10417,   9615,   8929,   8333,
      7813,   7353,   6944,   6579,   6250,   5952,   5682,   5435,
      5208,   5000,   4808,   4630,   4464,   4310,   4167,   4032
];

const YM_ENV_SHAPES = {
    0: '\\___', 4: '/___', 8: '\\\\\\\\', 9: '\\___', 10: '\\/\\/',
    11: '\\---', 12: '////', 13: '/---', 14: '/\\/\\', 15: '/___'
};

let cachedSystem = null;
let hudDom = null;

const HIST_LEN = 60;
const pitchHistA = new Float32Array(HIST_LEN);
const pitchHistB = new Float32Array(HIST_LEN);
const pitchHistC = new Float32Array(HIST_LEN);
const pitchHistD = new Float32Array(HIST_LEN);
let histIdx = 0;

function resetHistories() {
    pitchHistA.fill(0);
    pitchHistB.fill(0);
    pitchHistC.fill(0);
    pitchHistD.fill(0);
    histIdx = 0;
}

export function resetHUD() {
    resetHistories();
    cachedSystem = null;
    hudDom = null;
}

function setText(el, text) {
    if (!el || el._hudText === text) return;
    el._hudText = text;
    el.textContent = text;
}

function setBarWidth(el, pct) {
    if (!el) return;
    const clamped = Math.max(0, Math.min(100, Math.round(pct * 2) / 2));
    if (el._hudWidth === clamped) return;
    el._hudWidth = clamped;
    el.style.width = `${clamped}%`;
}

function setLed(el, active) {
    if (!el) return;
    const flag = active ? 1 : 0;
    if (el._hudLed === flag) return;
    el._hudLed = flag;
    el.className = flag ? 'hud-led on' : 'hud-led';
}

function getChartRef(id) {
    const canvas = document.getElementById(id);
    if (!canvas) return null;
    return { canvas, ctx: canvas.getContext('2d') };
}

function drawSparkline(chart, historyArr, headIdx, color) {
    if (!chart?.ctx) return;
    const { canvas, ctx } = chart;
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;

    let maxVal = 10;
    let minVal = 99999;
    for (let i = 0; i < HIST_LEN; i++) {
        const v = historyArr[i];
        if (v > maxVal) maxVal = v;
        if (v > 0 && v < minVal) minVal = v;
    }
    if (minVal === 99999) minVal = 0;
    const range = Math.max(100, maxVal - minVal);
    const drawH = Math.max(1, h - 2);

    for (let i = 0; i < HIST_LEN; i++) {
        const val = historyArr[(headIdx + i) % HIST_LEN];
        const norm = val <= 0 ? 0 : Math.max(0, Math.min(1, (val - minVal) / range));
        const y = (h - 1) - (norm * drawH);
        const x = (i / (HIST_LEN - 1)) * w;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();
}

function makeAtariChannelRow(ch, pitchId, volId, hegId, digiId) {
    const digiHtml = digiId ? `
        <div class="hud-row">
            <label>Digi Hack</label>
            <span id="${digiId}" class="hud-text-sel">--</span>
        </div>` : '';

    return `
        <div class="hud-channel">
            <h4>[ CH ${ch} ]</h4>
            <div class="hud-row">
                <label>Freq</label>
                <canvas class="hud-sparkline" id="${pitchId}-chart" width="100" height="18"></canvas>
                <span class="hud-val" id="${pitchId}-val">0 Hz</span>
            </div>
            <div class="hud-row">
                <label>Volume</label>
                <div class="hud-bar"><div class="hud-bar-fill" id="${volId}-bar"></div></div>
                <span class="hud-val" id="${volId}-val" style="width: 24px;">0</span>
                <div style="width: 5px;"></div>
                <div class="hud-led" id="${hegId}-led"></div><span style="font-size:0.8em; color:var(--text-color);">HEG</span>
            </div>
            ${digiHtml}
        </div>
    `;
}

function makeC64ChannelRow(ch, id) {
    return `
        <div class="hud-channel">
            <h4>[ VOICE ${ch} ]</h4>
            <div class="hud-row">
                <label>Freq</label>
                <canvas class="hud-sparkline" id="c64-pitch-${id}-chart" width="100" height="18"></canvas>
                <span class="hud-val" id="c64-pitch-${id}-val">0 Hz</span>
            </div>
            <div class="hud-row">
                <label>Wave</label>
                <div class="hud-led" id="c64-tri-${id}-led"></div><span style="margin-right:8px">TRI</span>
                <div class="hud-led" id="c64-saw-${id}-led"></div><span style="margin-right:8px">SAW</span>
                <div class="hud-led" id="c64-pul-${id}-led"></div><span style="margin-right:8px">PUL</span>
                <div class="hud-led" id="c64-noi-${id}-led"></div><span>NOI</span>
            </div>
            <div class="hud-row">
                <label>PW</label>
                <div class="hud-bar"><div class="hud-bar-fill" id="c64-pw-${id}-bar"></div></div>
                <span class="hud-val" id="c64-pw-${id}-val" style="width: 38px;">0%</span>
            </div>
            <div class="hud-row">
                <label>ADSR</label>
                <span class="hud-text-sel" id="c64-adsr-${id}-val" style="flex-grow:1; font-size: 0.9em;">A:0 D:0 S:0 R:0</span>
                <div class="hud-led" id="c64-gate-${id}-led"></div><span style="font-size:0.8em; color:var(--text-color);">GATE</span>
            </div>
        </div>
    `;
}

function makeAmigaChannelRow(ch, pan) {
    return `
        <div class="hud-channel">
            <h4>[ DMA CH ${ch} • ${pan} ]</h4>
            <div class="hud-row">
                <label>Rate</label>
                <canvas class="hud-sparkline" id="amiga-pitch-${ch}-chart" width="100" height="18"></canvas>
                <span class="hud-val" id="amiga-pitch-${ch}-val">0 Hz</span>
            </div>
            <div class="hud-row">
                <label>Volume</label>
                <div class="hud-bar"><div class="hud-bar-fill" id="amiga-vol-${ch}-bar"></div></div>
                <span class="hud-val" id="amiga-vol-${ch}-val" style="width: 30px;">0</span>
            </div>
            <div class="hud-row">
                <label>Buffer</label>
                <span class="hud-text-sel" id="amiga-len-${ch}-val" style="flex-grow:1;">0 Bytes</span>
                <div class="hud-led" id="amiga-dma-${ch}-led"></div><span style="font-size:0.8em; color:var(--text-color);">ACT</span>
            </div>
        </div>
    `;
}

function cacheDomForSystem(system) {
    const byId = (id) => document.getElementById(id);

    if (system === 'atari') {
        return {
            channels: ['a', 'b', 'c'].map((ch, idx) => ({
                pitchVal: byId(`pitch-${ch}-val`),
                chart: getChartRef(`pitch-${ch}-chart`),
                volBar: byId(`vol-${ch}-bar`),
                volVal: byId(`vol-${ch}-val`),
                hegLed: byId(`heg-${ch}-led`),
                digiVal: idx < 2 ? byId(`digi-${ch}`) : null
            })),
            noiseBar: byId('noise-bar'),
            noiseVal: byId('noise-val'),
            toneLeds: [byId('tone-a-led'), byId('tone-b-led'), byId('tone-c-led')],
            noiseLeds: [byId('noise-a-led'), byId('noise-b-led'), byId('noise-c-led')],
            envBar: byId('env-bar'),
            envVal: byId('env-val'),
            envShapeVal: byId('env-shape-val')
        };
    }

    if (system === 'c64') {
        return {
            voices: [1, 2, 3].map((v) => ({
                pitchVal: byId(`c64-pitch-${v}-val`),
                chart: getChartRef(`c64-pitch-${v}-chart`),
                pwBar: byId(`c64-pw-${v}-bar`),
                pwVal: byId(`c64-pw-${v}-val`),
                triLed: byId(`c64-tri-${v}-led`),
                sawLed: byId(`c64-saw-${v}-led`),
                pulLed: byId(`c64-pul-${v}-led`),
                noiLed: byId(`c64-noi-${v}-led`),
                gateLed: byId(`c64-gate-${v}-led`),
                adsrVal: byId(`c64-adsr-${v}-val`)
            })),
            cutBar: byId('c64-cut-bar'),
            cutVal: byId('c64-cut-val'),
            resBar: byId('c64-res-bar'),
            resVal: byId('c64-res-val'),
            routeLeds: [byId('c64-route-1-led'), byId('c64-route-2-led'), byId('c64-route-3-led')],
            lpLed: byId('c64-lp-led'),
            bpLed: byId('c64-bp-led'),
            hpLed: byId('c64-hp-led'),
            v3OffLed: byId('c64-v3off-led'),
            volBar: byId('c64-vol-bar'),
            volVal: byId('c64-vol-val')
        };
    }

    if (system === 'amiga') {
        return {
            channels: [0, 1, 2, 3].map((c) => ({
                pitchVal: byId(`amiga-pitch-${c}-val`),
                chart: getChartRef(`amiga-pitch-${c}-chart`),
                volBar: byId(`amiga-vol-${c}-bar`),
                volVal: byId(`amiga-vol-${c}-val`),
                lenVal: byId(`amiga-len-${c}-val`),
                dmaLed: byId(`amiga-dma-${c}-led`)
            }))
        };
    }

    return null;
}

export function updateChipHUD(stateGetters) {
    const matrix = document.getElementById('hud-matrix');
    if (!matrix) return;

    const activeSystem = stateGetters.getActiveSystem();
    const isPlaying = stateGetters.getIsPlaying();
    const currentChipRegs = stateGetters.getCurrentChipRegs();

    if (cachedSystem !== activeSystem) {
        if (activeSystem === 'atari') {
            matrix.innerHTML = `
                <div class="atari-analyzer-grid">
                    <div>
                        ${makeAtariChannelRow('A', 'pitch-a', 'vol-a', 'heg-a', 'digi-a')}
                        ${makeAtariChannelRow('B', 'pitch-b', 'vol-b', 'heg-b', 'digi-b')}
                        ${makeAtariChannelRow('C', 'pitch-c', 'vol-c', 'heg-c', null)}
                    </div>
                    <div>
                        <div class="hud-channel">
                            <h4>[ MIXER & NOISE ]</h4>
                            <div class="hud-row">
                                <label>N-Freq</label>
                                <div class="hud-bar"><div class="hud-bar-fill" id="noise-bar"></div></div>
                                <span class="hud-val" id="noise-val">0 Hz</span>
                            </div>
                            <div class="hud-row">
                                <label>Tone</label>
                                <div class="hud-led" id="tone-a-led"></div><span style="margin-right: 12px">A</span>
                                <div class="hud-led" id="tone-b-led"></div><span style="margin-right: 12px">B</span>
                                <div class="hud-led" id="tone-c-led"></div><span>C</span>
                            </div>
                            <div class="hud-row">
                                <label>Noise</label>
                                <div class="hud-led" id="noise-a-led"></div><span style="margin-right: 12px">A</span>
                                <div class="hud-led" id="noise-b-led"></div><span style="margin-right: 12px">B</span>
                                <div class="hud-led" id="noise-c-led"></div><span>C</span>
                            </div>
                        </div>

                        <div class="hud-channel">
                            <h4>[ HARDWARE ENVELOPE ]</h4>
                            <div class="hud-row">
                                <label>Frequency</label>
                                <div class="hud-bar"><div class="hud-bar-fill" id="env-bar"></div></div>
                                <span class="hud-val" id="env-val">0.0 Hz</span>
                            </div>
                            <div class="hud-row">
                                <label>Shape</label>
                                <span id="env-shape-val" class="hud-text-sel">--</span>
                            </div>
                            <div class="hud-row">
                                <label>Global Trig</label>
                                <span id="digi-g-val" class="hud-text-sel" style="flex-grow: 1;">--</span>
                                <div id="hud-digi-led" style="width: 10px; height: 10px; border-radius: 50%; background: #440000; border: 1px solid #ff0000; box-shadow: none;"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else if (activeSystem === 'c64') {
            matrix.innerHTML = `
                <div class="atari-analyzer-grid">
                    <div>
                        ${makeC64ChannelRow(1, '1')}
                        ${makeC64ChannelRow(2, '2')}
                        ${makeC64ChannelRow(3, '3')}
                    </div>
                    <div>
                        <div class="hud-channel">
                            <h4>[ ANALOG FILTER ]</h4>
                            <div class="hud-row">
                                <label>Cutoff</label>
                                <div class="hud-bar"><div class="hud-bar-fill" id="c64-cut-bar"></div></div>
                                <span class="hud-val" id="c64-cut-val">0Hz 55°</span>
                            </div>
                            <div class="hud-row">
                                <label>Resonance</label>
                                <div class="hud-bar"><div class="hud-bar-fill" id="c64-res-bar"></div></div>
                                <span class="hud-val" id="c64-res-val">0</span>
                            </div>
                            <div class="hud-row">
                                <label>Type</label>
                                <div class="hud-led" id="c64-lp-led"></div><span style="margin-right:12px">LP</span>
                                <div class="hud-led" id="c64-bp-led"></div><span style="margin-right:12px">BP</span>
                                <div class="hud-led" id="c64-hp-led"></div><span>HP</span>
                            </div>
                            <div class="hud-row">
                                <label>Routing</label>
                                <div class="hud-led" id="c64-route-1-led"></div><span style="margin-right:12px">V1</span>
                                <div class="hud-led" id="c64-route-2-led"></div><span style="margin-right:12px">V2</span>
                                <div class="hud-led" id="c64-route-3-led"></div><span>V3</span>
                            </div>
                        </div>
                        <div class="hud-channel">
                            <h4>[ MASTER OUTPUT ]</h4>
                            <div class="hud-row">
                                <label>Volume</label>
                                <div class="hud-bar"><div class="hud-bar-fill" id="c64-vol-bar"></div></div>
                                <span class="hud-val" id="c64-vol-val">0</span>
                            </div>
                            <div class="hud-row">
                                <label>Voice3 Off</label>
                                <div class="hud-led" id="c64-v3off-led"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else if (activeSystem === 'amiga') {
            const ledState = currentChipRegs && currentChipRegs[29] !== undefined ? currentChipRegs[29] : 1;
            const overrideState = currentChipRegs && currentChipRegs[30] !== undefined ? currentChipRegs[30] : 0;

            const ledClass = ledState === 1 ? 'on' : '';
            const ledStyle = ledState === 1
                ? 'background:#ff0000; box-shadow:0 0 8px #ff0000;'
                : 'background:#440000; box-shadow:none;';
            const overrideStyle = overrideState > 0 ? 'display:block;' : 'display:none;';

            matrix.innerHTML = `
                <div class="atari-analyzer-grid">
                    <div>
                        ${makeAmigaChannelRow(0, 'L')}
                        ${makeAmigaChannelRow(1, 'R')}
                        ${makeAmigaChannelRow(2, 'R')}
                    </div>
                    <div>
                        ${makeAmigaChannelRow(3, 'L')}
                        <div class="hud-channel">
                            <h4>[ PAULA 8364 & FILTERS ]</h4>
                            <div class="hud-row">
                                <label>Clock</label>
                                <span class="hud-text-sel" style="flex-grow: 1;">3.55 MHz (PAL)</span>
                            </div>
                            <div class="hud-row" style="position: relative;">
                                <label>LED LP</label>
                                <span class="hud-text-sel" style="flex-grow: 1;">12dB Butterw.</span>
                                
                                <div style="display: flex; flex-direction: column; align-items: center; margin-left: 8px;">
                                    <div style="display: flex; align-items: center; gap: 6px;">
                                        <div class="hud-led ${ledClass}" id="amiga-led-pwr" style="${ledStyle} border-color:#ff8800; cursor:pointer;" title="Klicken, um Amiga LED-Filter manuell umzuschalten"></div>
                                        <span style="font-size:0.8em; color:var(--text-color); font-weight:bold;">PWR</span>
                                    </div>
                                    <span id="amiga-led-override" style="color:#ff8800; font-size:7px; margin-top:3px; font-weight:bold; letter-spacing:0.5px; ${overrideStyle}">-override-</span>
                                </div>
                            </div>
                            <div class="hud-row">
                                <label>RC LP</label>
                                <span class="hud-text-sel" style="flex-grow: 1;">6dB (4.4kHz)</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        resetHistories();
        cachedSystem = activeSystem;
        hudDom = cacheDomForSystem(activeSystem);
    }

    // Im eingeklappten Zustand ([ LAB MODE: OFF ]) keine Canvas-/DOM-Arbeit pro Frame verschwenden
    const hudBody = document.getElementById('hud-body');
    if (hudBody?.classList.contains('hidden')) return;
    if (!isPlaying || !currentChipRegs || !hudDom) return;

    if (activeSystem === 'atari') {
        const r = currentChipRegs;
        const hists = [pitchHistA, pitchHistB, pitchHistC];

        for (let i = 0; i < 3; i++) {
            const ch = hudDom.channels[i];
            const lo = r[i * 2];
            const hi = r[i * 2 + 1];
            const pitch = ((hi & 0x0F) << 8) | lo;
            let hz = pitch === 0 ? 0 : 2000000 / (16 * pitch);
            if (hz > 15000) hz = 0;

            hists[i][histIdx] = hz;
            setText(ch.pitchVal, `${Math.round(hz)} Hz`);
            drawSparkline(ch.chart, hists[i], (histIdx + 1) % HIST_LEN, '#55ff55');

            const volReg = r[8 + i];
            const vol = volReg & 0x0F;
            setBarWidth(ch.volBar, (vol / 15) * 100);
            setText(ch.volVal, String(vol));
            setLed(ch.hegLed, (volReg & 0x10) !== 0);

            if (ch.digiVal) {
                const digi = (hi & 0xF0) >> 4;
                setText(ch.digiVal, digi > 0 ? `SMP #${digi}` : '--');
            }
        }

        histIdx = (histIdx + 1) % HIST_LEN;

        const noiseP = r[6] & 0x1F;
        const exactHz = NOISE_LUT_HZ[noiseP];
        const noiseStr = exactHz >= 10000 ? `${(exactHz / 1000).toFixed(1)} kHz` : `${exactHz} Hz`;
        setBarWidth(hudDom.noiseBar, (noiseP / 31) * 100);
        setText(hudDom.noiseVal, noiseStr);

        const mix = r[7];
        for (let i = 0; i < 3; i++) {
            setLed(hudDom.toneLeds[i], (mix & (1 << i)) === 0);
            setLed(hudDom.noiseLeds[i], (mix & (1 << (i + 3))) === 0);
        }

        const envP = (r[12] << 8) | r[11];
        const envHz = envP === 0 ? 0 : 2000000 / (256 * envP);
        setBarWidth(hudDom.envBar, (envP / 65535) * 100);
        setText(hudDom.envVal, `${envHz.toFixed(1)} Hz`);

        const shapeBits = r[13];
        const anyHeg = ((r[8] | r[9] | r[10]) & 0x10) !== 0;
        let shapeStr = '--';
        if (shapeBits !== 0xFF && (shapeBits !== 0 || anyHeg)) {
            const s = shapeBits & 0x0F;
            const sym = s < 4 ? '\\___' : (s < 8 ? '/___' : (YM_ENV_SHAPES[s] || `0x${s.toString(16).toUpperCase()}`));
            shapeStr = `[0x${s.toString(16).toUpperCase()}] ${sym}`;
        }
        setText(hudDom.envShapeVal, shapeStr);

    } else if (activeSystem === 'c64') {
        const r = currentChipRegs;
        const hists = [pitchHistA, pitchHistB, pitchHistC];

        for (let v = 0; v < 3; v++) {
            const voice = hudDom.voices[v];
            const base = v * 7;

            const freq = r[base] | (r[base + 1] << 8);
            let hz = freq ? (freq * 985248) / 16777216 : 0;
            if (hz > 15000) hz = 0;

            hists[v][histIdx] = hz;
            setText(voice.pitchVal, hz >= 1000 ? `${(hz / 1000).toFixed(1)} kHz` : `${Math.round(hz)} Hz`);
            drawSparkline(voice.chart, hists[v], (histIdx + 1) % HIST_LEN, '#7c8cf8');

            const pw = r[base + 2] | ((r[base + 3] & 0x0F) << 8);
            setBarWidth(voice.pwBar, (pw / 4095) * 100);
            setText(voice.pwVal, `${Math.round((pw / 4095) * 100)}%`);

            const ctrl = r[base + 4];
            setLed(voice.triLed, (ctrl & 16) !== 0);
            setLed(voice.sawLed, (ctrl & 32) !== 0);
            setLed(voice.pulLed, (ctrl & 64) !== 0);
            setLed(voice.noiLed, (ctrl & 128) !== 0);
            setLed(voice.gateLed, (ctrl & 1) !== 0);

            const ad = r[base + 5];
            const sr = r[base + 6];
            setText(voice.adsrVal, `A:${ad >> 4} D:${ad & 15} S:${sr >> 4} R:${sr & 15}`);
        }

        histIdx = (histIdx + 1) % HIST_LEN;

        const temp = r[29] || 55;
        const fcut = (r[21] & 7) | (r[22] << 3);
        const norm = fcut / 2047.0;

        // S-curve JFET transfer matching MOS 6581 CUTOFF_LUT (30Hz to 6200Hz)
        let baseHz = 30.0 + (1200.0 * norm) + (7200.0 * norm * norm) - (2230.0 * norm * norm * norm);
        if (baseHz > 6200.0) baseHz = 6200.0;

        // Exponential thermal semiconductor drift matching sid-chip.js
        const thermalCoefficient = Math.exp(-(temp - 55.0) * 0.003);
        const fhz = Math.max(30.0, Math.min(6800.0, baseHz * thermalCoefficient));

        const cutStr = fhz >= 1000 ? `${(fhz / 1000).toFixed(1)}k ${temp}°` : `${Math.round(fhz)}Hz ${temp}°`;
        setBarWidth(hudDom.cutBar, (fcut / 2047) * 100);
        setText(hudDom.cutVal, cutStr);

        const fres = r[23] >> 4;
        setBarWidth(hudDom.resBar, (fres / 15) * 100);
        setText(hudDom.resVal, String(fres));

        const froute = r[23] & 15;
        for (let v = 0; v < 3; v++) {
            setLed(hudDom.routeLeds[v], (froute & (1 << v)) !== 0);
        }

        const fmode = r[24] & 0xF0;
        setLed(hudDom.lpLed, (fmode & 16) !== 0);
        setLed(hudDom.bpLed, (fmode & 32) !== 0);
        setLed(hudDom.hpLed, (fmode & 64) !== 0);
        setLed(hudDom.v3OffLed, (fmode & 128) !== 0);

        const vol = r[24] & 15;
        setBarWidth(hudDom.volBar, (vol / 15) * 100);
        setText(hudDom.volVal, String(vol));

    } else if (activeSystem === 'amiga') {
        const r = currentChipRegs;
        const hists = [pitchHistA, pitchHistB, pitchHistC, pitchHistD];

        for (let c = 0; c < 4; c++) {
            const ch = hudDom.channels[c];
            const base = c * 7;

            const address = (r[base] << 8) | r[base + 1];
            const lenWords = (r[base + 2] << 8) | r[base + 3];
            const period = (r[base + 4] << 8) | r[base + 5];
            const vol = r[base + 6];

            let hz = period > 0 ? 3546895 / period : 0;
            if (hz > 60000) hz = 0;

            hists[c][histIdx] = hz;
            setText(ch.pitchVal, hz >= 1000 ? `${(hz / 1000).toFixed(1)} kHz` : `${Math.round(hz)} Hz`);
            drawSparkline(ch.chart, hists[c], (histIdx + 1) % HIST_LEN, '#ff8800');

            setBarWidth(ch.volBar, (vol / 64) * 100);
            setText(ch.volVal, String(vol));
            setText(ch.lenVal, `${lenWords * 2} B`);

            const isAct = address > 0 && vol > 0 && lenWords > 0;
            setLed(ch.dmaLed, isAct);
        }

        histIdx = (histIdx + 1) % HIST_LEN;
    }
}