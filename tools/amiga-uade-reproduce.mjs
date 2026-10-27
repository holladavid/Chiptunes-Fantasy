// Reproduce an existing UADE comparison and bind it to exact input/tool hashes.
// The reference WAV is deliberately supplied by the caller; it is not part of
// the source archive. No metric is accepted without its concrete WAV hash.
//   node tools/amiga-uade-reproduce.mjs \
//     --module tracks/amiga/wings-of-death/Wings_Of_Death-Level_2.hipc \
//     --reference /path/to/level2.wav --origin "local UADE export" \
//     --seconds 120 --report /tmp/level2-uade.json
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
    const key = process.argv[i];
    if (!key?.startsWith('--') || i + 1 >= process.argv.length) throw new Error(`Ungültiges Argument: ${key}`);
    args.set(key.slice(2), process.argv[i + 1]);
}
const moduleArg = args.get('module');
const referenceArg = args.get('reference');
const origin = args.get('origin');
if (!moduleArg || !referenceArg || !origin) throw new Error('--module, --reference and --origin are required');
const modulePath = path.resolve(root, moduleArg);
const referencePath = path.resolve(referenceArg);
for (const filename of [modulePath, referencePath]) if (!existsSync(filename)) throw new Error(`Datei fehlt: ${filename}`);
const seconds = Number(args.get('seconds') || 120);
const song = Number(args.get('song') || 0);
const lowpass = Number(args.get('lowpass') || 2500);
const local = Number(args.get('local') || 40);
if (!(seconds > 0) || !Number.isInteger(song) || song < 0 || !(lowpass >= 0) || !Number.isInteger(local) || local < 0) {
    throw new RangeError('Ungültige Messparameter');
}
const sha256 = filename => createHash('sha256').update(readFileSync(filename)).digest('hex');
const toolFiles = ['tools/uade_fit.py', 'tools/coso-render-paula.mjs', 'js/worklets/amiga/paula-exact.js', 'js/worklets/lib/coso-replayer.js', 'js/worklets/lib/coso-vm.js', 'js/worklets/lib/hip-vm.js', 'js/worklets/lib/m68k.js'];
const command = [
    'python3', 'tools/uade_fit.py',
    '--uade', referencePath,
    '--module', modulePath,
    '--song', String(song),
    '--seconds', String(seconds),
    '--lowpass', String(lowpass),
    '--local', String(local)
];
const result = spawnSync(command[0], command.slice(1), { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const uadeVersion = spawnSync('uade123', ['--version'], { cwd: root, encoding: 'utf8' });
const pythonVersion = spawnSync('python3', ['--version'], { cwd: root, encoding: 'utf8' });
const report = {
    format: 'chiptunes-fantasy-amiga-uade-comparison-v1',
    module: {
        path: path.relative(root, modulePath).split(path.sep).join('/'),
        sha256: sha256(modulePath),
        bytes: readFileSync(modulePath).length
    },
    reference: {
        path: referencePath,
        origin,
        sha256: sha256(referencePath),
        bytes: readFileSync(referencePath).length,
        requiredFormat: 'RIFF/WAVE, PCM16, 44100 Hz, stereo; hard channel separation expected by uade_fit.py'
    },
    referenceRenderCommand: `uade123 -f <reference.wav> -e wav --filter=none --panning=0 ${JSON.stringify(path.relative(root, modulePath))}`,
    comparisonCommand: command,
    settings: { seconds, song, lowpassHz: lowpass, localPhaseSamples: local, modelTickHz: 50, modelRenderPath: 'CosoVirtualMachine + PaulaChannel, four separate voices, no A500/master chain' },
    toolSha256: Object.fromEntries(toolFiles.map(file => [file, sha256(path.join(root, file))])),
    environment: {
        node: process.version,
        python: (pythonVersion.stdout || pythonVersion.stderr || '').trim() || 'unavailable',
        uade: uadeVersion.status === 0 ? (uadeVersion.stdout || uadeVersion.stderr).trim() : 'not queried successfully; comparison uses the supplied WAV'
    },
    exitStatus: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    note: 'UADE is an external emulator reference, not real-hardware proof. Hashes bind this output to the exact WAV, module and analysis sources.'
};
const json = JSON.stringify(report, null, 2) + '\n';
if (args.get('report')) {
    const filename = path.resolve(args.get('report'));
    mkdirSync(path.dirname(filename), { recursive: true });
    writeFileSync(filename, json);
}
console.log(json);
if (result.status !== 0) process.exitCode = result.status || 1;
