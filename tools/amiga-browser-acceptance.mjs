// Real Chromium acceptance through audio-controller.js and the production UI.
//   NODE_PATH=$(npm root -g) CHROMIUM_PATH=/usr/bin/chromium \
//     node tools/amiga-browser-acceptance.mjs \
//     --report doc/verification/amiga/phase5-browser.json
// Requires Playwright and Chromium; no hardware/UADE or underrun-proof claim.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const require = createRequire(import.meta.url);
let chromium;
try {
    ({ chromium } = require('playwright'));
} catch {
    throw new Error('Playwright fehlt. Mit NODE_PATH=$(npm root -g) oder einer lokalen Installation erneut ausführen.');
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
    const key = process.argv[index];
    if (!key?.startsWith('--') || index + 1 >= process.argv.length) throw new Error(`Ungültiges Argument: ${key}`);
    args.set(key.slice(2), process.argv[index + 1]);
}
const playMilliseconds = Number(args.get('milliseconds') || 600);
if (!Number.isFinite(playMilliseconds) || playMilliseconds < 200) throw new RangeError('--milliseconds must be at least 200');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceHash = relative => sha256(readFileSync(path.join(ROOT, relative)));

const acceptanceHtml = `<!doctype html><meta charset="utf-8"><button id="boot">START AUDIO</button>
<script type="module">
import { initAudioEngine, loadEmuCore, resumeAudioContext, getAudioContext, getAnalyserNode, getPaulaNode } from '/js/audio/audio-controller.js';
import { workletRegistry } from '/js/worklets/registry.js';
import { amigaPlaylist } from '/tracks/amiga/playlist.js';
let latestView = null;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const viewState = () => latestView ? { led: latestView[33], mode: latestView[38], dmaMask: latestView[39] } : null;
const analyserState = () => {
    const analyser = getAnalyserNode();
    const samples = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(samples);
    let peak = 0, sumSquare = 0, nonFinite = 0;
    for (const sample of samples) {
        if (!Number.isFinite(sample)) nonFinite++;
        peak = Math.max(peak, Math.abs(sample));
        sumSquare += sample * sample;
    }
    return { peak, rms: Math.sqrt(sumSquare / samples.length), nonFinite };
};
window.__amigaAcceptance = {
    ready: false,
    error: null,
    async init(sampleRate) {
        try {
            await initAudioEngine(sampleRate);
            await loadEmuCore('amiga', workletRegistry.amiga[0], event => {
                if (event.data instanceof Float32Array) latestView = event.data;
            });
            await resumeAudioContext();
            this.ready = true;
        } catch (error) { this.error = String(error); throw error; }
    },
    async play(path, milliseconds) {
        latestView = null;
        const entry = amigaPlaylist.find(item => item.path === path);
        if (!entry) throw new Error('Unbekannter Titel: ' + path);
        const track = await entry.loadAsync();
        const node = getPaulaNode();
        for (const [name, data] of Object.entries(track.samples || {})) {
            node.port.postMessage({ type: 'UPLOAD_SAMPLE', name, data });
        }
        node.port.postMessage({ type: 'PLAY_TRACK', track });
        await resumeAudioContext();
        await sleep(milliseconds);
        const initial = viewState();
        const output = analyserState();
        const cycles = [];
        for (let index = 0; index < 3; index++) {
            node.port.postMessage({ type: 'CYCLE_FILTER' });
            await sleep(100);
            cycles.push(viewState());
        }
        return {
            path, type: track.type, contextRate: getAudioContext().sampleRate,
            contextState: getAudioContext().state, initial, output, cycles
        };
    },
    async close() { const context = getAudioContext(); if (context) await context.close(); }
};
document.getElementById('boot').addEventListener('click', () => {
    const rate = Number(new URLSearchParams(location.search).get('rate'));
    window.__amigaAcceptance.init(rate).catch(() => {});
});
</script>`;

const mime = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml', '.wasm': 'application/wasm'
};
const server = createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/__amiga_acceptance__') {
        response.writeHead(200, { 'Content-Type': mime['.html'], 'Cache-Control': 'no-store' });
        response.end(acceptanceHtml);
        return;
    }
    if (pathname === '/favicon.ico') { response.writeHead(204); response.end(); return; }
    const filename = path.resolve(ROOT, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!filename.startsWith(ROOT + path.sep)) { response.writeHead(403); response.end(); return; }
    try {
        const bytes = readFileSync(filename);
        response.writeHead(200, { 'Content-Type': mime[path.extname(filename).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        response.end(bytes);
    } catch {
        response.writeHead(404); response.end();
    }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required']
});

const viewports = [
    { name: 'desktop', viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false },
    { name: 'mobile', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
];
const inputs = [
    'wings-of-death/Wings_Of_Death-Level_1.hipc',
    'wings-of-death/Wings_Of_Death-Title.hip',
    'ELYSIUM.MOD',
    'space_debris.xm'
];
const engineRuns = [];
const uiRuns = [];

function attachErrors(page, errors) {
    page.on('pageerror', error => errors.push(`pageerror: ${error}`));
    page.on('console', message => {
        if (message.type() === 'error') errors.push(`console: ${message.text()}`);
    });
}

function expectedCycles(result) {
    if (result.type === 'HIPC' || result.type === 'COSO') {
        return { initialMode: 2, initialLed: 0, modes: [0, 1, 2], leds: [0, 1, 0] };
    }
    // ELYSIUM.MOD starts with ProTracker E01: the song itself bypasses the
    // LED filter. Mode 0 must restore this track-authored state after cycling.
    const trackLed = result.path === 'ELYSIUM.MOD' ? 0 : 1;
    return { initialMode: 0, initialLed: trackLed, modes: [1, 2, 0], leds: [1, 0, trackLed] };
}

try {
    for (const device of viewports) {
        for (const sampleRate of [44100, 48000]) {
            const context = await browser.newContext({
                viewport: device.viewport, isMobile: device.isMobile, hasTouch: device.hasTouch,
                serviceWorkers: 'block'
            });
            const page = await context.newPage();
            const errors = [];
            attachErrors(page, errors);
            await page.goto(`${origin}/__amiga_acceptance__?rate=${sampleRate}`);
            await page.click('#boot');
            await page.waitForFunction(() => window.__amigaAcceptance.ready || window.__amigaAcceptance.error, { timeout: 30000 });
            const initialization = await page.evaluate(() => ({ ready: window.__amigaAcceptance.ready, error: window.__amigaAcceptance.error }));
            if (!initialization.ready) throw new Error(`Browserinitialisierung: ${initialization.error}`);
            const tracks = [];
            for (const input of inputs) {
                const result = await page.evaluate(async ({ input, milliseconds }) => {
                    return window.__amigaAcceptance.play(input, milliseconds);
                }, { input, milliseconds: playMilliseconds });
                const expected = expectedCycles(result);
                result.finiteOutput = result.output.nonFinite === 0;
                result.audible = result.output.rms > 1e-5;
                result.masterPeakWithinCeiling = result.output.peak <= 1.001;
                result.rateMatches = result.contextRate === sampleRate;
                result.contextRunning = result.contextState === 'running';
                result.filterCycleMatches = Boolean(result.initial) &&
                    result.initial.mode === expected.initialMode && result.initial.led === expected.initialLed &&
                    result.cycles.every((state, index) => state && state.mode === expected.modes[index] && state.led === expected.leds[index]);
                result.passed = result.finiteOutput && result.audible && result.masterPeakWithinCeiling &&
                    result.rateMatches && result.contextRunning && result.filterCycleMatches;
                tracks.push(result);
                console.log(`BROWSER ${device.name} ${sampleRate} ${input}: ${result.passed ? 'PASS' : 'FAIL'} peak=${result.output.peak}`);
                if (!result.passed) console.log(JSON.stringify({ initial: result.initial, cycles: result.cycles, finiteOutput: result.finiteOutput, audible: result.audible, masterPeakWithinCeiling: result.masterPeakWithinCeiling, rateMatches: result.rateMatches, contextRunning: result.contextRunning, filterCycleMatches: result.filterCycleMatches }));
            }
            await page.evaluate(() => window.__amigaAcceptance.close());
            engineRuns.push({ device: device.name, sampleRate, tracks, errors, passed: tracks.every(track => track.passed) && errors.length === 0 });
            await context.close();
        }

        const context = await browser.newContext({
            viewport: device.viewport, isMobile: device.isMobile, hasTouch: device.hasTouch,
            serviceWorkers: 'block'
        });
        const page = await context.newPage();
        const errors = [];
        attachErrors(page, errors);
        await page.goto(origin);
        await page.click('#boot-screen');
        await page.evaluate(async () => {
            const { getPaulaNode } = await import('/js/audio/audio-controller.js');
            window.__amigaUiView = null;
            for (let attempt = 0; attempt < 600; attempt++) {
                const node = getPaulaNode();
                if (node) {
                    node.port.addEventListener('message', event => {
                        if (event.data instanceof Float32Array) window.__amigaUiView = event.data;
                    });
                    return;
                }
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            throw new Error('Paula-Worklet wurde nicht initialisiert');
        });
        await page.click('.tab-btn[data-theme="theme-amiga"]');
        await page.locator('#tracklist li', { hasText: 'ELYSIUM' }).click();
        await page.waitForTimeout(Math.max(1200, playMilliseconds));
        const state = await page.evaluate(async () => {
            const { getAudioContext, getAnalyserNode } = await import('/js/audio/audio-controller.js');
            const analyser = getAnalyserNode();
            const samples = new Float32Array(analyser.fftSize);
            analyser.getFloatTimeDomainData(samples);
            let peak = 0, sumSquare = 0, nonFinite = 0;
            for (const sample of samples) {
                if (!Number.isFinite(sample)) nonFinite++;
                peak = Math.max(peak, Math.abs(sample));
                sumSquare += sample * sample;
            }
            return {
                contextState: getAudioContext().state,
                sampleRate: getAudioContext().sampleRate,
                core: document.getElementById('core-selector').selectedOptions[0].textContent,
                activeTrack: document.querySelector('#tracklist .active-track')?.textContent || null,
                output: { peak, rms: Math.sqrt(sumSquare / samples.length), nonFinite },
                ledExists: Boolean(document.getElementById('amiga-led-pwr')),
                filterBefore: window.__amigaUiView ? {
                    led: window.__amigaUiView[33], mode: window.__amigaUiView[38]
                } : null
            };
        });
        if (state.ledExists) {
            // The production UI intentionally hides the collapsed HUD after
            // three idle seconds. Wake it through its real input handler first.
            await page.locator('#visual-zone').dispatchEvent(device.hasTouch ? 'touchstart' : 'mousemove');
            await page.click('#btn-hud-toggle');
            await page.waitForSelector('#amiga-led-pwr', { state: 'visible' });
            await page.click('#amiga-led-pwr');
        }
        await page.waitForTimeout(150);
        state.filterAfter = await page.evaluate(() => window.__amigaUiView ? {
            led: window.__amigaUiView[33], mode: window.__amigaUiView[38]
        } : null);
        state.filterCycleMatches = Boolean(state.filterBefore && state.filterAfter) &&
            state.filterBefore.mode === 0 && state.filterBefore.led === 0 &&
            state.filterAfter.mode === 1 && state.filterAfter.led === 1;
        const passed = state.contextState === 'running' && state.core.includes('Exact / A500') &&
            state.activeTrack?.includes('ELYSIUM') && state.output.nonFinite === 0 &&
            state.output.rms > 1e-5 && state.output.peak <= 1.001 && state.ledExists &&
            state.filterCycleMatches && errors.length === 0;
        uiRuns.push({ device: device.name, ...state, errors, passed });
        console.log(`UI ${device.name}: ${passed ? 'PASS' : 'FAIL'} peak=${state.output.peak}`);
        await context.close();
    }
} finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
}

const report = {
    format: 'chiptunes-fantasy-amiga-phase5-browser-v1',
    referenceStatus: 'Real headless Chromium production playback; no hardware/UADE, physical-device or underrun-proof claim.',
    browser: browser.version(),
    chromiumPath: process.env.CHROMIUM_PATH || 'Playwright default',
    workletSha256: sourceHash('js/worklets/amiga/paula-exact.js'),
    audioControllerSha256: sourceHash('js/audio/audio-controller.js'),
    registrySha256: sourceHash('js/worklets/registry.js'),
    playMilliseconds,
    engineRuns,
    uiRuns
};
report.passed = engineRuns.length === 4 && engineRuns.every(run => run.passed) &&
    uiRuns.length === 2 && uiRuns.every(run => run.passed);
const filename = path.resolve(ROOT, args.get('report') || 'doc/verification/amiga/phase5-browser.json');
mkdirSync(path.dirname(filename), { recursive: true });
writeFileSync(filename, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ passed: report.passed, engineRuns: engineRuns.length, uiRuns: uiRuns.length }, null, 2));
if (!report.passed) process.exitCode = 1;
