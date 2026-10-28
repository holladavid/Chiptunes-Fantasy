// Resolve real Amiga fixtures in either the repository's nested layout or a
// flat external fixture directory. Required fixtures fail loudly: a missing
// file must never turn an integration test into a green skip.
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(here, '..', '..', 'tracks', 'amiga');

function indexFiles(root) {
    if (!existsSync(root)) throw new Error(`Amiga-Fixture-Verzeichnis fehlt: ${root}`);
    const byName = new Map();
    const visit = directory => {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
            const absolute = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                visit(absolute);
                continue;
            }
            if (!entry.isFile()) continue;
            const key = entry.name.toLowerCase();
            const previous = byName.get(key);
            if (previous && previous !== absolute) {
                throw new Error(`Mehrdeutiges Amiga-Fixture "${entry.name}": ${previous} und ${absolute}`);
            }
            byName.set(key, absolute);
        }
    };
    visit(path.resolve(root));
    return byName;
}

export function createAmigaFixtureResolver(required = [], root = process.env.HIPC_FIXTURES || defaultRoot) {
    const absoluteRoot = path.resolve(root);
    const byName = indexFiles(absoluteRoot);
    const resolve = name => {
        const direct = path.resolve(absoluteRoot, name);
        if (existsSync(direct)) return direct;
        const match = byName.get(path.basename(name).toLowerCase());
        if (match) return match;
        throw new Error(`Pflicht-Fixture fehlt: ${name} (Wurzel: ${absoluteRoot})`);
    };
    for (const name of required) resolve(name);
    return Object.freeze({
        root: absoluteRoot,
        fx: resolve,
        // Kept for the existing test-option shape; required names throw above.
        has: name => {
            resolve(name);
            return true;
        }
    });
}
