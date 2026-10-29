// Real Chromium acceptance of the four Giana Amiga conversions through the production UI.
//   NODE_PATH=$(npm root -g) CHROMIUM_PATH=/usr/bin/chromium \
//     node tools/giana-amiga-browser-acceptance.mjs \
//     --report doc/verification/amiga/giana-browser.json
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
const playMilliseconds = Number(args.get('milliseconds') || 1600);
if (!Number.isFinite(playMilliseconds) || playMilliseconds < 500) throw new RangeError('--milliseconds must be at least 500');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceHash = relative => sha256(readFileSync(path.join(root, relative)));
const mime = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.mod': 'application/octet-stream'
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
    { path: 'giana-sisters/title-screen.mod', text: 'Title Screen', museum: 'TITLE SCREEN' },
    { path: 'giana-sisters/get-ready.mod', text: 'Get Ready!', museum: 'GET READY!' },
    { path: 'giana-sisters/ingame-1-ground.mod', text: 'In-Game 1 – Ground', museum: 'IN-GAME 1 / GROUND' },
    { path: 'giana-sisters/ingame-2-cave.mod', text: 'In-Game 2 – Cave', museum: 'IN-GAME 2 / CAVE' }
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
        const museumText = document.getElementById('info-text')?.textContent || '';
        return {
            path: expected.path,
            contextState: getAudioContext().state,
            sampleRate: getAudioContext().sampleRate,
            core: document.getElementById('core-selector').selectedOptions[0].textContent,
            activeTrack: document.querySelector('#tracklist .active-track')?.textContent || null,
            museum: document.querySelector('#info-text h3')?.textContent || null,
            creditsPresent: museumText.includes('Thomas Lopatic') && museumText.includes('Chris Hülsbeck'),
            conversionDisclosed: museumText.includes('ProTracker-Konvertierung'),
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
        result.creditsPresent && result.conversionDisclosed && result.core.includes('Paula');
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
        await page.click('.tab-btn[data-theme="theme-amiga"]');
        await page.waitForFunction(() => !document.body.classList.contains('system-transitioning'));
        await page.locator('#tracklist .tracklist-folder', { hasText: 'giana-sisters' }).waitFor({ timeout: 30000 });
        const rootTracks = await page.locator('#tracklist li:not(.tracklist-folder):not(.tracklist-navigation)').count();
        const rootFolders = await page.locator('#tracklist .tracklist-folder').allTextContents();
        if (rootTracks !== 10 || rootFolders.length !== 5 || !rootFolders.some(name => name.includes('giana-sisters'))) {
            throw new Error(`${device.name}: unerwartete Amiga-Wurzelansicht`);
        }

        await page.locator('#tracklist .tracklist-folder', { hasText: 'giana-sisters' }).click();
        const trackItems = page.locator('#tracklist li:not(.tracklist-folder):not(.tracklist-navigation)');
        const gianaTracks = await trackItems.count();
        const titles = await trackItems.allTextContents();
        if (gianaTracks !== 4 || JSON.stringify(titles) !== JSON.stringify(representatives.map(track => track.text))) {
            throw new Error(`${device.name}: falsche Giana-Titel ${JSON.stringify(titles)}`);
        }

        const tracks = [];
        for (const [index, representative] of representatives.entries()) {
            await trackItems.nth(index).click();
            const result = validatePlayback(await readPlayback(page, representative), representative);
            tracks.push(result);
            console.log(`UI ${device.name} ${representative.path}: ${result.passed ? 'PASS' : 'FAIL'} RMS=${result.output.rms}`);
            if (index === 0) {
                const screenshot = `doc/verification/amiga/giana-${device.name}.png`;
                await page.evaluate(() => {
                    const panel = document.getElementById('info-text');
                    const heading = panel.querySelector('h3');
                    panel.scrollTop += heading.getBoundingClientRect().top - panel.getBoundingClientRect().top - 12;
                });
                await page.screenshot({ path: path.join(root, screenshot), fullPage: true });
            }
        }

        const screenshot = `doc/verification/amiga/giana-${device.name}.png`;
        const layout = await page.evaluate(() => ({
            viewportWidth: window.innerWidth,
            documentWidth: document.documentElement.scrollWidth,
            museumVisible: Boolean(document.getElementById('info-text')?.offsetParent)
        }));
        runs.push({
            device: device.name, rootTracks, rootFolders, gianaTracks, titles, screenshot, layout, tracks, errors,
            passed: tracks.every(track => track.passed) && errors.length === 0 && layout.museumVisible &&
                layout.documentWidth <= layout.viewportWidth
        });
        await context.close();
    }
} finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
}

const report = {
    format: 'chiptunes-fantasy-amiga-giana-browser-v1',
    referenceStatus: 'Real headless Chromium production UI and playback; no physical-device or underrun-proof claim.',
    browser: browser.version(),
    chromiumPath: process.env.CHROMIUM_PATH || 'Playwright default',
    playMilliseconds,
    appSha256: sourceHash('js/app.js'),
    playlistSha256: sourceHash('tracks/amiga/playlist.js'),
    museumSha256: sourceHash('tracks/amiga/museum.js'),
    provenanceSha256: sourceHash('tracks/amiga/classics/provenance.json'),
    runs
};
report.passed = runs.length === 2 && runs.every(run => run.passed);
const filename = path.resolve(root, args.get('report') || 'doc/verification/amiga/giana-browser.json');
mkdirSync(path.dirname(filename), { recursive: true });
writeFileSync(filename, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ passed: report.passed, runs: runs.length, errors: runs.map(run => run.errors) }, null, 2));
if (!report.passed) process.exitCode = 1;
