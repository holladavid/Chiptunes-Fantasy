#!/usr/bin/env node
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(HERE, '..');
const args = process.argv.slice(2);
const valueAfter = flag => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
};
const OUTPUT = resolve(valueAfter('--output') || '/mnt/agents/output/DSE-Schritt-1-Baseline');
const ONLY = valueAfter('--only');
const SEED = Number(valueAfter('--seed') || 0x5eed1234) >>> 0;
const SKIP_MOTION = args.includes('--skip-motion');
const PORT = 0;
const MIME = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml'
};

function serveProject() {
    const server = createServer(async (request, response) => {
        try {
            const url = new URL(request.url, 'http://127.0.0.1');
            const pathname = decodeURIComponent(url.pathname);
            const file = resolve(PROJECT_ROOT, `.${pathname}`);
            if (!file.startsWith(`${PROJECT_ROOT}/`) || !existsSync(file)) {
                response.writeHead(404); response.end('Not found'); return;
            }
            const body = await readFile(file);
            response.writeHead(200, {
                'Content-Type': MIME[extname(file)] || 'application/octet-stream',
                'Cache-Control': 'no-store'
            });
            response.end(body);
        } catch (error) {
            response.writeHead(500); response.end(String(error));
        }
    });
    return new Promise(resolveServer => server.listen(PORT, '127.0.0.1', () => resolveServer(server)));
}

function dataUrlBuffer(dataUrl) {
    return Buffer.from(dataUrl.split(',')[1], 'base64');
}

async function savePng(dataUrl, file) {
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, dataUrlBuffer(dataUrl));
}

function cleanStill(result, file) {
    const { png, ...rest } = result;
    return { ...rest, file };
}

function cleanMotion(result, file) {
    const { images, ...rest } = result;
    return { ...rest, file };
}

function cleanRotation(result, files) {
    const phases = result.phases.map((phase, index) => {
        const { png, ...rest } = phase;
        return { ...rest, file: files[index] };
    });
    return { ...result, phases };
}

function round(value, digits = 3) {
    return Number.isFinite(value) ? Number(value.toFixed(digits)) : 0;
}

function errorSignature(error) {
    return String(error.message || error).split('\n')[0];
}

function buildReport(results) {
    const lines = [
        '# DSE-Optimierung – Schritt 1: Baseline und Akzeptanznachweise', '',
        'Dieser Bericht dokumentiert den unveränderten Ausgangszustand. Er ist keine historische Freigabe der einzelnen Effekte. Renderzeiten stammen aus headless Chromium und dienen ausschließlich dem Vergleich innerhalb dieser Baseline.', '',
        '## Prüfumfang', '',
        `- ${results.inventory.length} verwaltete DSE-/System-Kombinationen`,
        `- ${results.stills.length} Einzelbilder: playing, buildup und climax in Mobile Hoch- und Querformat`,
        `- ${results.motions.length} kurze Bewegungssequenzen mit 18 fps`,
        `- ${results.rotations.length} Rotationsläufe Hoch → Quer → Hoch mit derselben DSE-Instanz`,
        `- ${results.diagnostics.length} Determinismus- und Beat-an/Beat-aus-Diagnosen`,
        `- Zufalls-Seed: 0x${results.metadata.seed.toString(16)}`,
        `- Synthetische Musikmetriken; keine Verbesserung der Aktivitätsumschaltung oder Beat-Reaktion`, '',
        '## Kombinationsübersicht', '',
        '| DSE / System | Renderfehler | max. Farben | Palette-Verstöße | p95 max. (ms) | Bewegung Ø | Deterministisch | Beat-Reaktion | Rotation |',
        '|---|---:|---:|---:|---:|---:|---|---|---|'
    ];
    for (const combo of results.inventory) {
        const stills = results.stills.filter(item => item.dse === combo.dse && item.system === combo.system);
        const motions = results.motions.filter(item => item.dse === combo.dse && item.system === combo.system);
        const diagnostics = results.diagnostics.filter(item => item.dse === combo.dse && item.system === combo.system);
        const rotations = results.rotations.filter(item => item.dse === combo.dse && item.system === combo.system);
        const related = [...stills, ...motions, ...rotations, ...diagnostics];
        const errors = related.flatMap(item => item.errors || []);
        const maxColors = Math.max(0, ...stills.map(item => item.color.uniqueColors));
        const maxViolations = Math.max(0, ...stills.map(item => item.color.paletteViolationColors));
        const maxP95 = Math.max(0, ...related.filter(item => item.profile).map(item => item.profile.p95FrameMs));
        const meanMotion = motions.length ? motions.reduce((sum, item) => sum + item.motion.meanChangedPixelRatio, 0) / motions.length : 0;
        const deterministic = diagnostics.length > 0 && diagnostics.every(item => item.determinism.pass);
        const beatChanges = diagnostics.filter(item => item.beatResponse.changed).length;
        const rotationOk = rotations.length === 1 && rotations[0].sameInstance && rotations[0].errors.length === 0;
        lines.push(`| ${combo.dse} / ${combo.system} | ${errors.length} | ${maxColors} | ${maxViolations} | ${round(maxP95, 2)} | ${round(meanMotion * 100, 2)} % | ${deterministic ? 'ja' : 'nein'} | ${beatChanges}/${diagnostics.length} Ausrichtungen | ${rotationOk ? 'ohne Fehler' : 'prüfen'} |`);
    }
    const allErrors = [...results.stills, ...results.motions, ...results.rotations, ...results.diagnostics]
        .flatMap(item => (item.errors || []).map(error => ({ dse: item.dse, system: item.system, message: errorSignature(error) })));
    const uniqueErrors = [...new Map(allErrors.map(item => [`${item.dse}|${item.system}|${item.message}`, item])).values()];
    lines.push('', '## Festgestellte Renderfehler', '');
    if (!uniqueErrors.length) lines.push('Keine Laufzeitfehler im Capture aufgetreten.');
    for (const item of uniqueErrors) lines.push(`- **${item.dse} / ${item.system}:** \`${item.message.replaceAll('`', "'")}\``);
    lines.push('', '## Interpretation', '',
        '- **Palette-Verstöße** zählen RGB-Werte außerhalb der jeweils angenommenen C64-, Amiga- oder Atari-Palette. Sie erfassen unter anderem Browser-Anti-Aliasing und Alpha-Mischungen.',
        '- **Farbanzahl und Palette** allein beweisen keine historische Machbarkeit. Rechenaufwand, Speicher, Rasterzeit und gleichzeitig darstellbare Farben werden in den Folgeschritten bewertet.',
        '- **Beat-Reaktion** bedeutet hier nur, dass sich bei sonst identischem Lauf zwischen Beat 0 und Beat 1 Pixel unterscheiden. Die Qualität der musikalischen Steuerung wird ausdrücklich erst in Schritt 2 verbessert.',
        '- **Rotation ohne Fehler** bestätigt Instanzkontinuität und fehlerfreie Ausgabe. Die visuelle Kontrolle der drei gespeicherten Phasen bleibt Teil des Akzeptanznachweises.',
        '', '## Dateien', '',
        '- `screenshots/`: Einzelbilder aller Zustände und Ausrichtungen',
        '- `motion/`: kurze Bewegungsclips',
        '- `rotation/`: vor, während und nach der Live-Rotation',
        '- `contacts/`: Übersichtstafeln zur visuellen Kontrolle',
        '- `baseline-results.json`: vollständige Messwerte einschließlich Frame-Profilen',
        '- `tools/`: reproduzierbarer Capture-Runner und Browser-Harness', '');
    return lines.join('\n');
}

async function main() {
    await rm(OUTPUT, { recursive: true, force: true });
    await mkdir(OUTPUT, { recursive: true });
    const server = await serveProject();
    const address = server.address();
    const browser = await chromium.launch({
        executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
        headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage']
    });
    const context = await browser.newContext({ viewport: { width: 1000, height: 800 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const runnerErrors = [];
    page.on('pageerror', error => runnerErrors.push(String(error.stack || error)));
    page.on('console', message => {
        if (message.type() === 'error') runnerErrors.push(`console: ${message.text()}`);
    });
    const results = {
        metadata: {
            schema: 1,
            generatedAt: new Date().toISOString(),
            seed: SEED,
            fps: 18,
            viewports: { portrait: { width: 390, height: 844 }, landscape: { width: 844, height: 390 } },
            source: 'unmodified managed DSE implementations; isolated render dispatch equivalent to StageManager.renderAll'
        },
        inventory: [], stills: [], motions: [], rotations: [], diagnostics: [], runnerErrors
    };
    const checkpoint = async () => {
        await writeFile(join(OUTPUT, 'baseline-results.json'), JSON.stringify(results, null, 2));
    };
    try {
        await page.goto(`http://127.0.0.1:${address.port}/tools/dse-baseline/harness.html`, { waitUntil: 'networkidle' });
        await page.waitForFunction(() => Boolean(window.DSEBaseline));
        const fullInventory = await page.evaluate(() => window.DSEBaseline.inventory());
        results.inventory = fullInventory.filter(item => !ONLY || item.id === ONLY || item.dse === ONLY);
        if (!results.inventory.length) throw new Error(`Keine DSE-Kombination für Filter: ${ONLY}`);
        if (!ONLY && results.inventory.length !== 20) throw new Error(`Erwartet: 20 Kombinationen; gefunden: ${results.inventory.length}`);
        console.log(`Baseline: ${results.inventory.length} DSE-/System-Kombinationen`);
        await checkpoint();

        for (const combo of results.inventory) {
            for (const state of ['playing', 'buildup', 'climax']) {
                for (const orientation of ['portrait', 'landscape']) {
                    const request = { dse: combo.dse, system: combo.system, state, orientation, seed: SEED };
                    const captured = await page.evaluate(req => window.DSEBaseline.runStill(req), request);
                    const file = `screenshots/${combo.id}__${state}__${orientation}.png`;
                    await savePng(captured.png, join(OUTPUT, file));
                    results.stills.push(cleanStill(captured, file));
                    await checkpoint();
                }
            }
            console.log(`Stills: ${combo.id}`);
        }

        for (const combo of results.inventory) {
            for (const orientation of ['portrait', 'landscape']) {
                const request = { dse: combo.dse, system: combo.system, state: 'playing', orientation, seed: SEED };
                const diagnostic = await page.evaluate(req => window.DSEBaseline.runDiagnostics(req), request);
                results.diagnostics.push(diagnostic);
                await checkpoint();
            }
            console.log(`Diagnose: ${combo.id}`);
        }

        for (const combo of results.inventory) {
            const captured = await page.evaluate(req => window.DSEBaseline.runRotation(req), {
                dse: combo.dse, system: combo.system, state: 'playing', seed: SEED
            });
            const files = [];
            for (const phase of captured.phases) {
                const file = `rotation/${combo.id}__${phase.phase}-${phase.orientation}.png`;
                await savePng(phase.png, join(OUTPUT, file));
                files.push(file);
            }
            results.rotations.push(cleanRotation(captured, files));
            await checkpoint();
            console.log(`Rotation: ${combo.id}`);
        }

        if (!SKIP_MOTION) {
            for (const combo of results.inventory) {
                for (const orientation of ['portrait', 'landscape']) {
                    const captured = await page.evaluate(req => window.DSEBaseline.runMotion(req), {
                        dse: combo.dse, system: combo.system, state: 'playing', orientation, seed: SEED
                    });
                    const tempDir = join(OUTPUT, '.frames');
                    await rm(tempDir, { recursive: true, force: true });
                    await mkdir(tempDir, { recursive: true });
                    for (let index = 0; index < captured.images.length; index++) {
                        await savePng(captured.images[index], join(tempDir, `frame-${String(index).padStart(3, '0')}.png`));
                    }
                    const file = `motion/${combo.id}__${orientation}.mp4`;
                    const destination = join(OUTPUT, file);
                    await mkdir(dirname(destination), { recursive: true });
                    const encoded = spawnSync('ffmpeg', [
                        '-hide_banner', '-loglevel', 'error', '-y', '-framerate', '18',
                        '-i', join(tempDir, 'frame-%03d.png'),
                        '-vf', 'scale=iw*4:ih*4:flags=neighbor', '-c:v', 'libx264',
                        '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', destination
                    ], { encoding: 'utf8' });
                    if (encoded.status !== 0) throw new Error(`ffmpeg ${combo.id} ${orientation}: ${encoded.stderr}`);
                    results.motions.push(cleanMotion(captured, file));
                    await rm(tempDir, { recursive: true, force: true });
                    await checkpoint();
                }
                console.log(`Motion: ${combo.id}`);
            }
        }

        await mkdir(join(OUTPUT, 'tools', 'dse-baseline'), { recursive: true });
        await cp(join(HERE, 'dse-baseline'), join(OUTPUT, 'tools', 'dse-baseline'), { recursive: true });
        await cp(fileURLToPath(import.meta.url), join(OUTPUT, 'tools', 'dse-baseline-capture.mjs'));
        await writeFile(join(OUTPUT, 'baseline-report.md'), buildReport(results));
        await checkpoint();
        console.log(`Fertig: ${OUTPUT}`);
    } finally {
        await context.close();
        await browser.close();
        await new Promise(resolveClose => server.close(resolveClose));
    }
}

main().catch(error => {
    console.error(error.stack || error);
    process.exitCode = 1;
});
