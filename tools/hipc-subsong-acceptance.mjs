// Real Chromium acceptance for HIPC subsong selection through the production UI.
//   NODE_PATH=$(npm root -g) CHROMIUM_PATH=/usr/bin/chromium node tools/hipc-subsong-acceptance.mjs
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
try {
    ({ chromium } = require('playwright'));
} catch {
    throw new Error('Playwright fehlt. Mit NODE_PATH=$(npm root -g) oder einer lokalen Installation erneut ausführen.');
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mime = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml', '.wasm': 'application/wasm'
};
const server = createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/favicon.ico') { response.writeHead(204); response.end(); return; }
    const filename = path.resolve(ROOT, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!filename.startsWith(ROOT + path.sep)) { response.writeHead(403); response.end(); return; }
    try {
        const bytes = readFileSync(filename);
        response.writeHead(200, {
            'Content-Type': mime[path.extname(filename).toLowerCase()] || 'application/octet-stream',
            'Cache-Control': 'no-store'
        });
        response.end(bytes);
    } catch {
        response.writeHead(404);
        response.end();
    }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required']
});

const configurations = [
    { name: 'desktop-exact', viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, core: 0 },
    { name: 'desktop-fantasy', viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, core: 1 },
    { name: 'mobile-exact', viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true, core: 0 },
    { name: 'mobile-fantasy', viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true, core: 1 }
];

async function analyserState(page) {
    return page.evaluate(async () => {
        const { getAnalyserNode, getAudioContext } = await import('/js/audio/audio-controller.js');
        const analyser = getAnalyserNode();
        const samples = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(samples);
        let peak = 0;
        let sumSquare = 0;
        let nonFinite = 0;
        for (const sample of samples) {
            if (!Number.isFinite(sample)) nonFinite++;
            peak = Math.max(peak, Math.abs(sample));
            sumSquare += sample * sample;
        }
        return {
            peak,
            rms: Math.sqrt(sumSquare / samples.length),
            nonFinite,
            contextState: getAudioContext().state
        };
    });
}

async function waitForSubsong(page, current, totalTime) {
    try {
        await page.waitForFunction(`() => {
            const display = document.getElementById('subsong-display');
            return display && !display.classList.contains('hidden') &&
                display.textContent === '[SUB ${current}/2]' &&
                document.getElementById('time-total').textContent === '${totalTime}' &&
                document.getElementById('fs-playback-status').dataset.state === 'playing';
        }`, null, { timeout: 30000 });
    } catch (error) {
        console.error(await page.evaluate(() => ({
            display: document.getElementById('subsong-display').outerHTML,
            totalTime: document.getElementById('time-total').textContent,
            playbackState: document.getElementById('fs-playback-status').outerHTML,
            activeTrack: document.querySelector('#tracklist .selected-track')?.textContent,
            errorCard: document.querySelector('.load-error-card')?.textContent
        })));
        throw error;
    }
}

try {
    for (const configuration of configurations) {
        const context = await browser.newContext({
            viewport: configuration.viewport,
            isMobile: configuration.isMobile,
            hasTouch: configuration.hasTouch,
            serviceWorkers: 'block'
        });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(`pageerror: ${error}`));
        page.on('console', message => {
            if (message.type() === 'error') errors.push(`console: ${message.text()}`);
        });

        await page.goto(origin);
        await page.click('#boot-screen');
        await page.click('.tab-btn[data-theme="theme-amiga"]');
        await page.waitForFunction(() => !document.body.classList.contains('system-transitioning'));
        await page.selectOption('#core-selector', String(configuration.core));
        await page.waitForFunction(() => document.querySelectorAll('#tracklist li').length > 0);
        await page.locator('#track-search').fill('Wings_Of_Death-Level_1');
        await page.locator('#tracklist li[data-track-index]', { hasText: 'Wings Of Death-Level 1' }).click();

        await waitForSubsong(page, 1, '03:35');
        await page.waitForTimeout(600);
        const firstAudio = await analyserState(page);
        if (firstAudio.rms <= 1e-5 || firstAudio.nonFinite !== 0 || firstAudio.contextState !== 'running') {
            throw new Error(`${configuration.name}: Subsong 1 ist nicht hörbar: ${JSON.stringify(firstAudio)}`);
        }

        await page.click('#btn-next');
        await waitForSubsong(page, 2, '00:07');
        await page.waitForTimeout(600);
        const secondAudio = await analyserState(page);
        if (secondAudio.rms <= 1e-5 || secondAudio.nonFinite !== 0 || secondAudio.contextState !== 'running') {
            throw new Error(`${configuration.name}: Subsong 2 ist nicht hörbar: ${JSON.stringify(secondAudio)}`);
        }
        const secondState = await page.evaluate(() => ({
            consoleSubsong: document.getElementById('now-playing-subsong').textContent,
            compactTitle: document.getElementById('fs-track-info').textContent,
            activeTrack: document.querySelector('#tracklist .active-track')?.dataset.trackIndex
        }));
        if (secondState.consoleSubsong !== '02 / 02' || !secondState.compactTitle.includes('[SUB 2/2]')) {
            throw new Error(`${configuration.name}: Subsong-Anzeigen nicht synchron: ${JSON.stringify(secondState)}`);
        }
        await page.screenshot({ path: `/tmp/hipc-subsong-${configuration.name}.png`, fullPage: true });

        await page.click('#btn-prev');
        await waitForSubsong(page, 1, '03:35');

        // Seek to the final tick. The next worklet wrap must advance to subsong 2,
        // not to another archive track.
        await page.locator('#progress-slider').evaluate(slider => {
            slider.value = '99.99';
            slider.dispatchEvent(new Event('input', { bubbles: true }));
            slider.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await waitForSubsong(page, 2, '00:07');
        if (errors.length > 0) throw new Error(`${configuration.name}: ${errors.join('\n')}`);
        console.log(`${configuration.name}: PASS (manual next/previous, automatic advance, audible output)`);
        await context.close();
    }
} finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
}
