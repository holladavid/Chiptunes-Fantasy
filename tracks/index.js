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