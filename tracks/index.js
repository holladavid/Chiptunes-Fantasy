// === tracks/index.js ===
// ==========================================
// CENTRAL TRACK PLAYLIST REGISTRY
// ==========================================

import { c64Playlist } from './c64/playlist.js'; 
import { atariPlaylist } from './atari/playlist.js'; 
import { amigaPlaylist } from './amiga/playlist.js'; 

export const trackRegistry = {
    c64: [ ...c64Playlist ],
    atari: [ ...atariPlaylist ], 
    amiga: [ ...amigaPlaylist ]
};

function normalizeSearchText(value = '') {
    return String(value)
        .toLocaleLowerCase('de')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[_./-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function searchTracks(songs, query) {
    const normalizedQuery = normalizeSearchText(query);
    const tokens = normalizedQuery.split(' ').filter(Boolean);
    if (tokens.length === 0) return [];

    return songs
        .map((song, index) => {
            const titleText = normalizeSearchText([song.title, song.listTitle].filter(Boolean).join(' '));
            const pathText = normalizeSearchText([song.path, song.sourcePath].filter(Boolean).join(' '));
            const metadataText = normalizeSearchText(String(song.composerInfo || '').replace(/<[^>]*>/g, ' '));
            const searchableText = `${titleText} ${pathText} ${metadataText}`;
            if (!tokens.every(token => searchableText.includes(token))) return null;

            let score = 0;
            if (titleText.includes(normalizedQuery)) score += 100;
            if (pathText.includes(normalizedQuery)) score += 80;
            if (tokens.every(token => titleText.includes(token))) score += 40;
            if (tokens.every(token => pathText.includes(token))) score += 20;
            return { song, index, score };
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score || a.index - b.index)
        .map(({ song, index }) => ({ song, index }));
}

export function getTracklistEntries(songs, directory = '') {
    const entries = [];
    const folders = new Set();
    const prefix = directory ? `${directory}/` : '';

    songs.forEach((song, index) => {
        const path = song.path || '';
        if (!path.startsWith(prefix)) return;

        const relativePath = path.slice(prefix.length);
        const separatorIndex = relativePath.indexOf('/');
        if (separatorIndex === -1) {
            entries.push({ type: 'track', index, song });
            return;
        }

        const folder = relativePath.slice(0, separatorIndex);
        if (folders.has(folder)) return;
        folders.add(folder);
        entries.push({
            type: 'folder',
            name: folder,
            path: directory ? `${directory}/${folder}` : folder
        });
    });

    return [
        ...entries.filter(entry => entry.type === 'folder'),
        ...entries.filter(entry => entry.type === 'track')
    ];
}
