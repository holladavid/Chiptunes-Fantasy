// Real Chromium acceptance of C64 folder navigation, museum rendering and production playback.
//   NODE_PATH=$(npm root -g) CHROMIUM_PATH=/usr/bin/chromium \
//     node tools/c64-browser-acceptance.mjs --report doc/verification/c64/curation-browser.json
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
try {
    ({ chromium } = require('playwright'));
} catch {
    throw new Error('Playwright fehlt. Mit NODE_PATH=$(npm root -g) oder einer lokalen Installation erneut ausführen.');
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
    const key = process.argv[index];
    if (!key?.startsWith('--') || index + 1 >= process.argv.length) throw new Error(`Ungültiges Argument: ${key}`);
    args.set(key.slice(2), process.argv[index + 1]);
}
const playMilliseconds = Number(args.get('milliseconds') || 1400);
if (!Number.isFinite(playMilliseconds) || playMilliseconds < 500) throw new RangeError('--milliseconds must be at least 500');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceHash = relative => sha256(readFileSync(path.join(root, relative)));
const mime = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.sid': 'application/octet-stream'
};
const server = createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/favicon.ico') { response.writeHead(204); response.end(); return; }
    const filename = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!filename.startsWith(root + path.sep)) { response.writeHead(403); response.end(); return; }
    try {
        const bytes = readFileSync(filename);
        response.writeHead(200, {
            'Content-Type': mime[path.extname(filename).toLowerCase()] || 'application/octet-stream',
            'Cache-Control': 'no-store'
        });
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

const devices = [
    { name: 'desktop', viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false },
    { name: 'mobile', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
];
const representatives = [
    { path: 'classics/games/ocean-loader-2.sid', text: 'ocean-loader-2.sid', museum: 'OCEAN LOADER 2', format: 'PSID v2' },
    { path: 'classics/demoscene/comaland-100-end.sid', text: 'comaland-100-end.sid', museum: 'COMALAND 100%', format: 'RSID v2' },
    { path: 'Commando.sid', text: 'Commando.sid', museum: 'ROB HUBBARD — COMMANDO', format: 'PSID v2' }
];
const runs = [];

async function readPlayback(page, representative) {
    await page.locator('#info-text h3', { hasText: representative.museum }).waitFor({ state: 'attached', timeout: 30000 });
    await page.waitForTimeout(playMilliseconds);
    return page.evaluate(async expected => {
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
        const links = [...document.querySelectorAll('#info-text .museum-sources a')];
        return {
            path: expected.path,
            contextState: getAudioContext().state,
            sampleRate: getAudioContext().sampleRate,
            core: document.getElementById('core-selector').selectedOptions[0].textContent,
            activeTrack: document.querySelector('#tracklist .active-track')?.textContent || null,
            museum: document.querySelector('#info-text h3')?.textContent || null,
            binaryAnalysis: document.querySelector('#info-text details .terminal-grid')?.textContent || null,
            subsong: document.getElementById('subsong-display')?.textContent || null,
            timeTotal: document.getElementById('time-total')?.textContent || null,
            safeSourceLinks: links.length > 0 && links.every(link => link.target === '_blank' &&
                link.rel === 'noopener noreferrer' && link.protocol === 'https:'),
            output: { peak, rms: Math.sqrt(sumSquare / samples.length), nonFinite }
        };
    }, representative);
}

function validatePlayback(result, representative) {
    result.finiteOutput = result.output.nonFinite === 0;
    result.audible = result.output.rms > 1e-5;
    result.masterPeakWithinCeiling = result.output.peak <= 1.001;
    result.contextRunning = result.contextState === 'running';
    result.museumMatches = result.museum?.includes(representative.museum) || false;
    result.activeTrackMatches = result.activeTrack?.includes(representative.text) || false;
    result.passed = result.finiteOutput && result.audible && result.masterPeakWithinCeiling &&
        result.contextRunning && result.museumMatches && result.activeTrackMatches && result.safeSourceLinks &&
        result.core.includes('MOS 6581');
    return result;
}

try {
    for (const device of devices) {
        const context = await browser.newContext({
            viewport: device.viewport, isMobile: device.isMobile, hasTouch: device.hasTouch,
            serviceWorkers: 'block'
        });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(`pageerror: ${error}`));
        page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
        page.on('requestfailed', request => errors.push(`requestfailed: ${request.url()} ${request.failure()?.errorText}`));
        page.on('response', response => { if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`); });
        page.on('dialog', dialog => { errors.push(`dialog: ${dialog.message()}`); dialog.dismiss().catch(() => {}); });

        await page.goto(origin);
        await page.click('#boot-screen');
        await page.locator('#tracklist .tracklist-folder', { hasText: 'classics' }).waitFor({ timeout: 30000 });
        const rootTracks = await page.locator('#tracklist li:not(.tracklist-folder):not(.tracklist-navigation)').count();
        const rootFolders = await page.locator('#tracklist .tracklist-folder').allTextContents();
        if (rootTracks !== 26 || rootFolders.length !== 1 || !rootFolders[0].includes('classics')) {
            throw new Error(`${device.name}: unerwartete C64-Wurzelansicht`);
        }

        await page.locator('#tracklist .tracklist-folder', { hasText: 'classics' }).click();
        const classicGroups = await page.locator('#tracklist .tracklist-folder').allTextContents();
        if (classicGroups.length !== 2 || !classicGroups[0].includes('games') || !classicGroups[1].includes('demoscene')) {
            throw new Error(`${device.name}: Klassikergruppen fehlen`);
        }
        await page.locator('#tracklist .tracklist-folder', { hasText: 'games' }).click();
        const gameTracks = await page.locator('#tracklist li:not(.tracklist-folder):not(.tracklist-navigation)').count();
        if (gameTracks !== 20) throw new Error(`${device.name}: ${gameTracks} statt 20 Spielklassiker`);

        const tracks = [];
        await page.locator('#tracklist li', { hasText: representatives[0].text }).click();
        const ocean = validatePlayback(await readPlayback(page, representatives[0]), representatives[0]);
        tracks.push(ocean);
        console.log(`UI ${device.name} ${representatives[0].path}: ${ocean.passed ? 'PASS' : 'FAIL'} RMS=${ocean.output.rms}`);
        const screenshot = `doc/verification/c64/curation-${device.name}.png`;
        await page.evaluate(() => {
            const panel = document.getElementById('info-text');
            const heading = panel.querySelector('h3');
            panel.scrollTop += heading.getBoundingClientRect().top - panel.getBoundingClientRect().top - 12;
        });
        await page.screenshot({ path: path.join(root, screenshot), fullPage: true });

        await page.locator('#tracklist .tracklist-navigation').click();
        await page.locator('#tracklist .tracklist-folder', { hasText: 'demoscene' }).click();
        const demoTracks = await page.locator('#tracklist li:not(.tracklist-folder):not(.tracklist-navigation)').count();
        if (demoTracks !== 4) throw new Error(`${device.name}: ${demoTracks} statt vier Demoklassiker`);
        await page.locator('#tracklist li', { hasText: representatives[1].text }).click();
        const comaland = validatePlayback(await readPlayback(page, representatives[1]), representatives[1]);
        tracks.push(comaland);
        console.log(`UI ${device.name} ${representatives[1].path}: ${comaland.passed ? 'PASS' : 'FAIL'} RMS=${comaland.output.rms}`);

        await page.locator('#tracklist .tracklist-navigation').click();
        await page.locator('#tracklist .tracklist-navigation').click();
        await page.locator('#tracklist li').filter({ hasText: /^1\. LOAD SID: Commando\.sid$/ }).click();
        const commando = validatePlayback(await readPlayback(page, representatives[2]), representatives[2]);
        tracks.push(commando);
        console.log(`UI ${device.name} ${representatives[2].path}: ${commando.passed ? 'PASS' : 'FAIL'} RMS=${commando.output.rms}`);

        const layout = await page.evaluate(() => ({
            viewportWidth: window.innerWidth,
            documentWidth: document.documentElement.scrollWidth,
            museumVisible: Boolean(document.getElementById('info-text')?.offsetParent)
        }));
        runs.push({
            device: device.name, rootTracks, rootFolders, classicGroups, gameTracks, demoTracks,
            screenshot, layout, tracks, errors,
            passed: tracks.every(track => track.passed) && errors.length === 0 && layout.museumVisible
        });
        await context.close();
    }
} finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
}

const report = {
    format: 'chiptunes-fantasy-c64-curation-browser-v1',
    referenceStatus: 'Real headless Chromium production UI and playback; no physical-device or underrun-proof claim.',
    browser: browser.version(),
    chromiumPath: process.env.CHROMIUM_PATH || 'Playwright default',
    playMilliseconds,
    appSha256: sourceHash('js/app.js'),
    playlistSha256: sourceHash('tracks/c64/playlist.js'),
    museumSha256: sourceHash('tracks/c64/museum.js'),
    songlengthsSha256: sourceHash('js/content/songlengths.js'),
    runs
};
report.passed = runs.length === 2 && runs.every(run => run.passed);
const filename = path.resolve(root, args.get('report') || 'doc/verification/c64/curation-browser.json');
mkdirSync(path.dirname(filename), { recursive: true });
writeFileSync(filename, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ passed: report.passed, runs: runs.length, errors: runs.map(run => run.errors) }, null, 2));
if (!report.passed) process.exitCode = 1;
