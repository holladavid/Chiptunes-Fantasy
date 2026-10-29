// Real Chromium acceptance for the expanded fullscreen playback console.
//   NODE_PATH=$(npm root -g) CHROMIUM_PATH=/usr/bin/chromium node tools/fullscreen-console-acceptance.mjs
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mime = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.png': 'image/png', '.svg': 'image/svg+xml', '.sid': 'application/octet-stream',
    '.mod': 'application/octet-stream', '.xm': 'application/octet-stream', '.ym': 'application/octet-stream'
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

const cases = [
    { system: 'c64', query: 'comaland-100-end.sid', composer: 'MAGNAR HARESTAD', release: '2015 CENSOR DESIGN/OXYRON', format: 'RSID v2', channels: 3 },
    { system: 'amiga', query: 'ELYSIUM.MOD', composer: 'UNKNOWN SCENER', release: 'NOT IN FILE', format: 'ProTracker', channels: 4 },
    { system: 'atari', query: 'thalion_loader.YM', composer: 'Jochen Hippel', release: 'NOT IN FILE', format: 'YM5!', channels: 3 }
];
const devices = [
    { name: 'desktop', viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false },
    { name: 'mobile', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
];
const runs = [];

function check(result, condition, message) {
    result.checks.push({ message, passed: Boolean(condition) });
}

try {
    for (const device of devices) {
        for (const testCase of cases) {
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

            const result = { device: device.name, system: testCase.system, checks: [], errors };
            try {
                await page.goto(origin);
                await page.click('#boot-screen');
                await page.locator('#tracklist li[data-track-index]').first().waitFor({ timeout: 30000 });
                if (testCase.system !== 'c64') await page.click(`.tab-btn[data-theme="theme-${testCase.system}"]`);
                await page.fill('#track-search', testCase.query);
                await page.locator('#tracklist li[data-track-index]').first().click();
                await page.waitForFunction(() => document.body.dataset.playbackState === 'playing', null, { timeout: 30000 });
                await page.click('#btn-fullscreen');
                await page.waitForFunction(() => document.body.dataset.stageMode === 'fullscreen');
                await page.waitForTimeout(1200);
                if (testCase.system === 'atari') {
                    await page.waitForFunction(() => [...document.querySelectorAll('.now-playing-channel')]
                        .some(channel => !channel.hidden && Number(channel.getAttribute('aria-valuenow')) > 0), null, { timeout: 5000 });
                }

                const state = await page.evaluate(async () => {
                    const { getAnalyserNode } = await import('/js/audio/audio-controller.js');
                    const analyser = getAnalyserNode();
                    const samples = new Float32Array(analyser.fftSize);
                    analyser.getFloatTimeDomainData(samples);
                    let sumSquare = 0;
                    for (const sample of samples) sumSquare += sample * sample;
                    const overlay = document.getElementById('now-playing');
                    const controls = document.getElementById('fs-ui-bar');
                    const overlayRect = overlay.getBoundingClientRect();
                    const controlsRect = controls.getBoundingClientRect();
                    const visibleChannels = [...document.querySelectorAll('.now-playing-channel')]
                        .filter(channel => !channel.hidden);
                    return {
                        expandedDisplay: getComputedStyle(document.querySelector('.now-playing-expanded')).display,
                        composer: document.getElementById('now-playing-composer').textContent,
                        release: document.getElementById('now-playing-release').textContent,
                        subsong: document.getElementById('now-playing-subsong').textContent,
                        time: document.getElementById('now-playing-time').textContent,
                        format: document.getElementById('now-playing-format').textContent,
                        hardware: document.getElementById('now-playing-hardware').textContent,
                        next: document.getElementById('now-playing-next').textContent,
                        core: document.getElementById('now-playing-system').textContent,
                        compactTrack: document.getElementById('fs-track-info').textContent,
                        channelCount: visibleChannels.length,
                        activeChannels: visibleChannels.filter(channel => Number(channel.getAttribute('aria-valuenow')) > 0).length,
                        liveRegion: document.querySelector('.now-playing-rail').getAttribute('aria-live'),
                        overlayLiveRegion: overlay.getAttribute('aria-live'),
                        overlayRect: { left: overlayRect.left, right: overlayRect.right, top: overlayRect.top, bottom: overlayRect.bottom },
                        controlsTop: controlsRect.top,
                        viewport: { width: innerWidth, height: innerHeight },
                        documentWidth: document.documentElement.scrollWidth,
                        rms: Math.sqrt(sumSquare / samples.length)
                    };
                });
                result.state = state;
                check(result, state.expandedDisplay === 'grid', 'expanded console is visible in fullscreen');
                check(result, state.composer === testCase.composer, 'composer matches parsed metadata');
                check(result, state.release === testCase.release, 'release is accurate or explicitly unavailable');
                check(result, state.format.includes(testCase.format), 'file format is shown');
                check(result, /^\d{2}:\d{2} \/ \d{2}:\d{2}$/.test(state.time), 'elapsed and total time are shown');
                check(result, state.next && state.next !== '—', 'next track is shown');
                check(result, state.core.includes(testCase.system === 'c64' ? 'MOS 6581' : testCase.system === 'amiga' ? 'Paula' : 'YM2149'), 'active core is shown');
                check(result, state.channelCount === testCase.channels, 'only real platform channels are shown');
                check(result, state.activeChannels > 0, 'live channel activity is nonzero');
                check(result, state.liveRegion === 'polite' && !state.overlayLiveRegion, 'only discrete status changes are announced');
                check(result, state.compactTrack.length > 0, 'compact fullscreen track text remains populated');
                check(result, state.rms > 1e-5, 'production audio remains audible');
                check(result, state.overlayRect.left >= 0 && state.overlayRect.right <= state.viewport.width + 1 &&
                    state.overlayRect.top >= 0 && state.overlayRect.bottom <= state.controlsTop + 1,
                    'overlay fits the viewport without covering transport controls');
                check(result, state.documentWidth <= state.viewport.width + 1, 'no horizontal document overflow');

                await page.screenshot({ path: `/tmp/fullscreen-console-${testCase.system}-${device.name}.png` });
                await page.waitForTimeout(3300);
                const inactiveOpacity = await page.locator('#now-playing').evaluate(element => getComputedStyle(element).opacity);
                check(result, Number(inactiveOpacity) === 0, 'console follows fullscreen inactivity hiding');
                await page.locator('#fs-btn-play').focus();
                await page.waitForFunction(() =>
                    getComputedStyle(document.getElementById('now-playing')).opacity === '1' &&
                    getComputedStyle(document.getElementById('fs-ui-bar')).opacity === '1',
                    null, { timeout: 3000 });
                const focusState = await page.evaluate(() => ({
                    overlayOpacity: getComputedStyle(document.getElementById('now-playing')).opacity,
                    controlsOpacity: getComputedStyle(document.getElementById('fs-ui-bar')).opacity,
                    focused: document.activeElement.id
                }));
                result.focusState = focusState;
                check(result, Number(focusState.overlayOpacity) === 1 && Number(focusState.controlsOpacity) === 1 &&
                    focusState.focused === 'fs-btn-play', 'keyboard focus restores hidden fullscreen UI');

                if (device.name === 'desktop') {
                    for (const width of [375, 768, 1024, 1440]) {
                        await page.setViewportSize({ width, height: 900 });
                        await page.mouse.move(20, 20);
                        await page.waitForTimeout(200);
                        const layout = await page.evaluate(() => {
                            const rect = document.getElementById('now-playing').getBoundingClientRect();
                            return {
                                left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
                                innerWidth, stageWidth: document.getElementById('visual-zone').scrollWidth
                            };
                        });
                        (result.layouts ||= []).push({ width, height: 900, ...layout });
                        const fits = layout.left >= 0 && layout.right <= layout.innerWidth + 1 && layout.top >= 0 &&
                            layout.stageWidth <= layout.innerWidth + 1;
                        check(result, fits, `layout fits ${width}px viewport`);
                    }
                } else {
                    for (const height of [667, 640]) {
                        await page.setViewportSize({ width: 375, height });
                        await page.mouse.move(20, 20);
                        await page.waitForTimeout(200);
                        const layout = await page.evaluate(() => {
                            const rect = document.getElementById('now-playing').getBoundingClientRect();
                            const controls = document.getElementById('fs-ui-bar').getBoundingClientRect();
                            return {
                                left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
                                controlsTop: controls.top, innerWidth,
                                stageWidth: document.getElementById('visual-zone').scrollWidth
                            };
                        });
                        (result.layouts ||= []).push({ width: 375, height, ...layout });
                        const fits = layout.left >= 0 && layout.right <= layout.innerWidth + 1 && layout.top >= 0 &&
                            layout.bottom <= layout.controlsTop + 1 && layout.stageWidth <= layout.innerWidth + 1;
                        check(result, fits, `layout fits 375×${height}px viewport`);
                        if (testCase.system === 'c64' && height === 667) {
                            await page.screenshot({ path: '/tmp/fullscreen-console-c64-mobile-small.png' });
                        }
                    }
                }
                await page.keyboard.press('f');
                await page.waitForFunction(() => document.body.dataset.stageMode === 'windowed');
                check(result, true, 'F exits fullscreen from the keyboard');
            } catch (error) {
                result.failure = String(error.stack || error);
            }
            result.passed = !result.failure && errors.length === 0 && result.checks.every(item => item.passed);
            runs.push(result);
            console.log(`${device.name} ${testCase.system}: ${result.passed ? 'PASS' : 'FAIL'}`);
            await context.close();
        }
    }
} finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
}

const report = { format: 'fullscreen-console-acceptance-v1', browser: browser.version(), runs };
report.passed = runs.length === 6 && runs.every(run => run.passed);
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
