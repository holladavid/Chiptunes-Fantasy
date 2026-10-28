// === js/app.js ===
// =========================================================================
//                  CHIPTUNES FANTASY - MAIN APP CONTROLLER
// =========================================================================
import { FullscreenUI } from './ui/fullscreen-ui.js';
import { getTracklistEntries, trackRegistry } from '../tracks/index.js';
import { systemDescriptions } from './content/museum.js'; 
import { chipCheatSheets } from './content/cheatsheets.js'; 
import { workletRegistry } from './worklets/registry.js';
import { initScroller } from './visuals/scroller.js'; 
import { initVisuals } from './visuals/visualizer.js'; 
import { updateChipHUD, resetHUD } from './ui/hud-debugger.js'; 
import { 
    initAudioEngine, 
    loadEmuCore, 
    resumeAudioContext,
    getAudioContext, 
    getAnalyserNode, 
    getMasterGain, 
    getYmNode, 
    getPaulaNode, 
    getSidNode,
    setMasterCrossfeed // NEU IMPORTIERT!
} from './audio/audio-controller.js';
import { LivingSilicon } from './ui/living-silicon.js';
import { MediaSessionController } from './audio/media-session.js';
import { formatFrameTime, framesToSeconds, getPlayerRate, isStoredLoopTransition, secondsToFrames } from './audio/playback-timing.js';

let fsUI = null;
let siliconVisualizer = null; // Living Silicon Instanz
let currentOscValue = 0;
let currentChipRegs = null;
let sidRegisterWriteRate = 0;
let activeSystem = 'c64'; // Standard-System auf 'c64' korrigiert (passend zum Boot-Screen)
let trackData = [];    
let isPlaying = false; 
let currentTrackIndex = -1;
let playbackState = 'idle';
let currentTrackTitle = '';
let tracklistDirectory = '';
let currentScrollerText = "+++ INITIALIZING DEMO ENGINE... +++";
let lastKnownFrame = 0; 
let previousFrame = 0;       
let lastTrackChangeTime = 0; 
const livingSiliconChipNames = {
    c64: 'MOS 6581 SID',
    amiga: 'MOS 8364 PAULA',
    atari: 'ATARI ST YM2149F'
};
let isEcoMode = false;      
let isUserDragging = false; 
let currentSubsongIndex = 1; 
let channelVolumes = new Float32Array(4);
let playRequestToken = 0; // NEU: Async Race Condition Schutz
let playbackSessionId = 0; // NEU: Unidirectional State Sync für den Scene-DJ

const mediaSessionArtwork = [{
    src: new URL('./assets/media-session-cover.png', window.location.href).href,
    sizes: '512x512',
    type: 'image/png'
}];
const mediaSessionAlbums = {
    c64: 'Chiptunes Fantasy · MOS 6581 SID',
    amiga: 'Chiptunes Fantasy · MOS 8364 Paula',
    atari: 'Chiptunes Fantasy · Yamaha YM2149F'
};
const mediaSession = new MediaSessionController({
    onPlay: () => requestPlay(),
    onPause: () => requestPause(),
    onNext: () => requestNextTrack(),
    onPrevious: () => requestPreviousTrack(),
    onSeekBackward: offset => seekBySeconds(-offset),
    onSeekForward: offset => seekBySeconds(offset),
    onSeekTo: seconds => seekToSeconds(seconds)
});

const playbackStatusLabels = {
    idle: 'STANDBY',
    loading: 'DECODING',
    playing: 'BUS ACTIVE',
    paused: 'BUS HALTED',
    error: 'FAULT'
};

function getActiveCoreName() {
    const select = document.getElementById('core-selector');
    const cores = workletRegistry[activeSystem];
    const core = cores?.[Number(select?.value) || 0];
    return core?.name || livingSiliconChipNames[activeSystem];
}

function updateNowPlayingSystem() {
    const systemNames = { c64: 'C64', amiga: 'AMIGA', atari: 'ATARI ST' };
    const element = document.getElementById('now-playing-system');
    if (element) element.textContent = `${systemNames[activeSystem]} · ${getActiveCoreName()}`;
}

function syncTracklistPlaybackState() {
    document.querySelectorAll('#tracklist li[data-track-index]').forEach(item => {
        const isCurrent = Number(item.dataset.trackIndex) === currentTrackIndex;
        item.classList.toggle('selected-track', isCurrent);
        item.classList.toggle('active-track', isCurrent && playbackState === 'playing');
        item.dataset.playbackState = isCurrent ? playbackState : '';
        if (isCurrent) item.setAttribute('aria-current', 'true');
        else item.removeAttribute('aria-current');
    });
}

function setPlaybackState(nextState, detail = '') {
    playbackState = nextState;
    const nowPlaying = document.getElementById('now-playing');
    const status = document.getElementById('playback-status');
    const title = document.getElementById('now-playing-title');
    const detailElement = document.getElementById('now-playing-detail');
    const defaultDetails = {
        idle: 'SELECT A TRACK FROM THE ARCHIVE',
        loading: 'FETCHING + PARSING BINARY DATA',
        playing: getActiveCoreName(),
        paused: 'POSITION PRESERVED · BUS STANDBY',
        error: 'ROM INJECTION FAILED'
    };

    document.body.dataset.playbackState = nextState;
    if (nowPlaying) {
        nowPlaying.dataset.state = nextState;
        nowPlaying.setAttribute('aria-busy', String(nextState === 'loading'));
    }
    if (status) status.textContent = playbackStatusLabels[nextState] || playbackStatusLabels.idle;
    if (title) title.textContent = currentTrackTitle || 'AWAITING INJECTION';
    if (detailElement) detailElement.textContent = detail || defaultDetails[nextState] || defaultDetails.idle;

    updateNowPlayingSystem();
    syncTracklistPlaybackState();
    if (fsUI) fsUI.updatePlaybackState(nextState);
}

// Cursor-Hiding Inaktivitäts-Timer
let mouseIdleTimer = null;
const visualZone = document.getElementById('visual-zone');

function resetMouseIdleTimer() {
    if (!visualZone) return;
    
    // Aktiv-Zustand: Klassen sofort entfernen
    visualZone.classList.remove('user-inactive');
    visualZone.classList.remove('no-cursor');
    clearTimeout(mouseIdleTimer);
    
    const isFS = document.fullscreenElement || document.webkitFullscreenElement || visualZone.classList.contains('pseudo-fullscreen');
    
    // Inaktivitäts-Timer starten
    mouseIdleTimer = setTimeout(() => {
        // UI-Elemente faden globally aus (Sowohl im Fenster als auch im Vollbild)
        visualZone.classList.add('user-inactive');
        
        // Der Mauszeiger verschwindet NUR im echten/pseudo Vollbild
        if (isFS) {
            visualZone.classList.add('no-cursor');
        }
    }, 3000); // 3 Sekunden Inaktivität
}


function initApp() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js')
                .then(reg => console.log('[PWA] Service Worker erfolgreich gekoppelt.', reg.scope))
                .catch(err => console.warn('[PWA] Service-Worker-Kopplung fehlgeschlagen.', err));
        });
    }

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            setTheme(e.currentTarget.getAttribute('data-theme'));
        });
    });

    document.querySelectorAll('[role="button"][tabindex="0"]').forEach(control => {
        control.addEventListener('keydown', event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            control.click();
        });
    });

    const bootScreen = document.getElementById("boot-screen");
    bootScreen.addEventListener("click", async () => {
        const demoContainer = document.getElementById("demo-container");
        if (!demoContainer) return;

        bootScreen.classList.add("hidden");
        demoContainer.classList.remove("hidden");
        
        await initAudioEngine();
        
        try {
            await loadEmuCore('atari', workletRegistry.atari[0], handleWorkletMessage);
            await loadEmuCore('c64', workletRegistry.c64[0], handleWorkletMessage);
            await loadEmuCore('amiga', workletRegistry.amiga[0], handleWorkletMessage);
        } catch (err) {
            console.error("[CRITICAL] Cores konnten nicht geladen werden:", err);
        }

        initVisuals({
            getEcoMode: () => isEcoMode,
            getCurrentOscValue: () => currentOscValue,
            getChannelVolumes: () => channelVolumes,
            getTrackData: () => trackData,
            getAnalyserNode: getAnalyserNode,  
            getIsPlaying: () => isPlaying,
            getAudioContext: getAudioContext,
            getPlaybackSessionId: () => playbackSessionId,
            getCurrentChipRegs: () => currentChipRegs,
            getSidRegisterWriteRate: () => sidRegisterWriteRate
        }, {
            updateTimelineUI: () => updateTimelineUI(),
            updateChipHUD: () => updateChipHUD({
                getActiveSystem: () => activeSystem,
                getIsPlaying: () => isPlaying,
                getCurrentChipRegs: () => currentChipRegs,
                getChannelVolumes: () => channelVolumes // NEU: Lautstärken an das HUD-Modul koppeln
            })
        });

        initScroller(() => currentScrollerText, () => isEcoMode); 
        
        // INTERAKTIVE SKEUOMORPHIC LED KOPPLUNG (AMIGA)
        document.getElementById('chip-hud').addEventListener('click', (e) => {
            if (e.target && e.target.id === 'amiga-led-pwr') {
                const paulaNode = getPaulaNode();
                if (paulaNode) {
                    paulaNode.port.postMessage({ type: 'CYCLE_FILTER' });
                }
            }
        });

        // =========================================================
        // NEU: MUSEUM ARCHIVE TOGGLE SCHALTER VERKABELN
        // =========================================================
        const btnToggleArchive = document.getElementById('btn-toggle-archive');
        if (btnToggleArchive) {
            btnToggleArchive.addEventListener('click', () => {
                const isExpanded = document.body.classList.toggle('archive-expanded');
                btnToggleArchive.textContent = isExpanded ? '[ EXPAND ]' : '[ COLLAPSE ]';
                btnToggleArchive.setAttribute('aria-expanded', String(!isExpanded));
            });
        }

        // Event-Listener für das Cursor-Hiding binden
        if (visualZone) {
                visualZone.addEventListener('mousemove', resetMouseIdleTimer);
                visualZone.addEventListener('mousedown', resetMouseIdleTimer);
                visualZone.addEventListener('touchstart', resetMouseIdleTimer);
            }

            // =========================================================
            // CHIP INITIALISIERUNGS-REIHENFOLGE GEFIXT
            // Erst das Modul erstellen, dann setTheme() rufen!
            // =========================================================
            siliconVisualizer = new LivingSilicon('living-silicon-container');
            window.siliconVisualizerInstance = siliconVisualizer; // Globaler Hook für den Visualizer
            
            // setTheme triggert nun automatisch siliconVisualizer.setSystem('c64')
            setTheme('theme-c64');
            
            // Initialisiert das Fullscreen Overlay
            fsUI = new FullscreenUI({
                onTogglePlay: () => document.getElementById('btn-play').click(),
                onPrev: () => document.getElementById('btn-prev').click(),
                onNext: () => document.getElementById('btn-next').click()
            });   
        });

        // INTERAKTIVER STEREO BLEND BUTTON
        const btnCrossfeed = document.getElementById('btn-hud-crossfeed');
        if (btnCrossfeed) {
            let crossfeedOn = true;
            btnCrossfeed.addEventListener('click', (e) => {
                crossfeedOn = !crossfeedOn;
                setMasterCrossfeed(crossfeedOn);
                e.target.innerText = crossfeedOn ? '[ STEREO BLEND: ON ]' : '[ STEREO BLEND: OFF ]';
                e.target.style.opacity = crossfeedOn ? '1.0' : '0.5';
            });
        }
}

if (document.readyState === 'loading') document.addEventListener("DOMContentLoaded", initApp);
else initApp();

function formatTime(frames) {
    return formatFrameTime(frames, trackData);
}

function updateTimelineUI() {
    if (!isPlaying || trackData.length === 0) return;
    if (!isUserDragging) {
        document.getElementById('time-current').innerText = formatTime(lastKnownFrame);
        document.getElementById('time-total').innerText = formatTime(trackData.length);
        document.getElementById('progress-slider').value = (lastKnownFrame / trackData.length) * 100;
    }
    mediaSession.updatePosition(framesToSeconds(trackData.length, trackData), framesToSeconds(lastKnownFrame, trackData));
}

const progressSlider = document.getElementById('progress-slider');
progressSlider.addEventListener('mousedown', () => { isUserDragging = true; });
progressSlider.addEventListener('mouseup', () => { isUserDragging = false; });
progressSlider.addEventListener('touchstart', () => { isUserDragging = true; });
progressSlider.addEventListener('touchend', () => { isUserDragging = false; });

progressSlider.addEventListener('input', (e) => {
    if (trackData.length === 0) return;
    const targetPercent = parseFloat(e.target.value);
    const targetFrame = Math.floor((targetPercent / 100) * trackData.length);
    document.getElementById('time-current').innerText = formatTime(targetFrame);
});

progressSlider.addEventListener('change', (e) => {
    const targetPercent = parseFloat(e.target.value);
    seekToFrame(Math.floor((targetPercent / 100) * trackData.length));
});

function canSeekActiveTrack() {
    return trackData.length > 0 && (activeSystem === 'amiga' || activeSystem === 'atari');
}

function seekToFrame(targetFrame) {
    if (!canSeekActiveTrack() || !Number.isFinite(targetFrame)) return false;

    const clampedFrame = Math.min(Math.max(Math.floor(targetFrame), 0), trackData.length);
    const node = activeSystem === 'amiga' ? getPaulaNode() : getYmNode();
    if (!node) return false;

    lastKnownFrame = clampedFrame;
    previousFrame = clampedFrame;
    node.port.postMessage({ type: 'SEEK_TRACK', frame: clampedFrame });
    mediaSession.updatePosition(framesToSeconds(trackData.length, trackData), framesToSeconds(clampedFrame, trackData), true);
    return true;
}

function seekToSeconds(seconds) {
    if (!Number.isFinite(seconds)) return false;
    return seekToFrame(secondsToFrames(seconds, trackData));
}

function seekBySeconds(offset) {
    if (!Number.isFinite(offset)) return false;
    return seekToSeconds((framesToSeconds(lastKnownFrame, trackData)) + offset);
}

function handleWorkletMessage(e) {
    // --- NEU: LAB-LOGS AUS DEM HINTERGRUND-THREAD ABFANGEN ---
    if (e.data && e.data.type === 'LAB_LOG') {
        console.log(e.data.msg);
        return;
    }

    if (e.data && e.data.constructor && e.data.constructor.name === 'Float32Array') {
        const view = e.data;
        const systemId = view[0];

        // =========================================================
        // ARCHITEKTUR FIX: Cross-System Message Filtering
        // Ignoriert veraltete Nachrichten von inaktiven Cores.
        // Verhindert Geister-Track-Wechsel beim schnellen Tab-Umschalten!
        // =========================================================
        const systemMapping = {
            0: 'c64',
            1: 'amiga',
            2: 'atari'
        };

        if (systemMapping[systemId] !== activeSystem) {
            return; // Nachricht verwerfen, da sie von einem im Hintergrund stoppenden Core kommt
        }

        const isPlayingVal = view[1] === 1;
        const frameVal = view[2];
        currentOscValue = view[3];
        
        if (!currentChipRegs) {
            currentChipRegs = new Uint8Array(32);
        }
        
        for (let i = 0; i < 32; i++) {
            currentChipRegs[i] = view[4 + i];
        }
        for (let channel = 0; channel < channelVolumes.length; channel++) {
            channelVolumes[channel] = view[34 + channel];
        }

        if (systemId === 0) {
            const tempVal = Math.round(view[33]);
            currentChipRegs[29] = tempVal;
            sidRegisterWriteRate = view[37] || 0;
            for (let voice = 0; voice < 3; voice++) {
                currentChipRegs[30 + voice] = view[38 + voice] || 0;
            }
        }

        if (systemId === 1) {
            const ledState = Math.round(view[33]);
            const overrideState = Math.round(view[38]); 
            currentChipRegs[29] = ledState; 
            currentChipRegs[30] = overrideState; 
            currentChipRegs[31] = Math.round(view[39] || 0);
            
            const pwrLed = document.getElementById('amiga-led-pwr');
            if (pwrLed) {
                if (ledState === 1) {
                    pwrLed.classList.add('on');
                    pwrLed.style.background = '#ff0000';
                    pwrLed.style.boxShadow = '0 0 8px #ff0000';
                } else if (ledState === 0) {
                    pwrLed.classList.remove('on');
                    pwrLed.style.background = '#440000';
                    pwrLed.style.boxShadow = 'none';
                } else {
                    pwrLed.classList.remove('on');
                    pwrLed.style.background = '';
                    pwrLed.style.boxShadow = 'none';
                }
            }

            const pwrLedOverride = document.getElementById('amiga-led-override');
            if (pwrLedOverride) {
                pwrLedOverride.style.display = overrideState > 0 ? 'block' : 'none';
            }
        }
        if (systemId === 2) {
            currentChipRegs[30] = Math.round(view[38]);
            currentChipRegs[31] = view[39];
        }

        previousFrame = lastKnownFrame;
        lastKnownFrame = frameVal;

        if (isPlaying && trackData.length > 0) {
            const reachedTrackBoundary = previousFrame > trackData.length - 20 && lastKnownFrame < 10;
            const returnedToStoredLoop = isStoredLoopTransition(previousFrame, lastKnownFrame, trackData);
            if (reachedTrackBoundary && !returnedToStoredLoop) {
                if (performance.now() - lastTrackChangeTime > 2000) {
                    lastTrackChangeTime = performance.now(); 
                    
                    if (activeSystem === 'c64' && trackData.isSidFile) {
                        const totalSongs = trackData.metadata.songs || 1;
                        if (currentSubsongIndex < totalSongs) {
                            changeC64Subsong(currentSubsongIndex + 1);
                            return; 
                        }
                    }

                    let nextIdx = (currentTrackIndex + 1) % trackRegistry[activeSystem].length;
                    selectAndPlayTrack(nextIdx, activeSystem);
                }
            }
        }
        return; 
    }

    if (e.data.type === 'VISUAL_DATA') {
        currentOscValue = e.data.value;
        previousFrame = lastKnownFrame;
        lastKnownFrame = e.data.frame || 0; 
        currentChipRegs = e.data.regs; 
    }

    if (e.data.type === 'DEBUG') {
        if (isEcoMode) return; 

        let match = e.data.msg.match(/Drum (\d+)/);
        let drumNo = match ? "SMP #" + match[1] : "TRIG";
        
        const led = document.getElementById('hud-digi-led');
        const val = document.getElementById('digi-g-val'); 
        
        if (led && val) {
            val.innerText = drumNo;
            val.style.color = '#ffffff';
            val.style.textShadow = '0 0 10px #ffffff';
            led.style.background = '#ff0000';
            led.style.boxShadow = '0 0 12px #ff0000';
            
            if (val.timeoutId) clearTimeout(val.timeoutId);
            val.timeoutId = setTimeout(() => { 
                led.style.background = '#440000'; 
                led.style.boxShadow = 'none';
                val.style.color = ''; 
                val.style.textShadow = 'none';
                val.innerText = '--'; 
            }, 120);
        }
    }
}

function syncMediaSessionTrack(selectedSong) {
    if (!selectedSong || trackData.length === 0) return;

    const metadata = trackData.metadata;
    let title = metadata?.name || selectedSong.title;
    const artist = metadata?.author || '';

    if (activeSystem === 'c64' && trackData.isSidFile) {
        const totalSongs = metadata?.songs || 1;
        title += ` [SUB ${currentSubsongIndex}/${totalSongs}]`;
    }

    mediaSession.setMetadata(title, artist, mediaSessionAlbums[activeSystem], mediaSessionArtwork);
    mediaSession.setSeekable(canSeekActiveTrack());
    mediaSession.updatePosition(framesToSeconds(trackData.length, trackData), framesToSeconds(lastKnownFrame, trackData), true);
}

function changeC64Subsong(subsongId) {
    const sidNode = getSidNode();
    if (activeSystem === 'c64' && trackData && trackData.isSidFile && sidNode) { 
        playbackSessionId++; // NEU: Informiert das Rendering-System über einen Wechsel
        sidNode.port.postMessage({ 
            type: 'CHANGE_SUBSONG', 
            frame: subsongId,
            length: trackData.length 
        });
        currentSubsongIndex = subsongId;
        trackData.metadata.currentSubsong = subsongId; // <<< DIESE ZEILE INJIZIEREN!

        let sldbLengths = trackData.lengths || [180];
        let songLengthSeconds = sldbLengths[subsongId - 1] || sldbLengths[0] || 180;
        trackData.length = songLengthSeconds * 50; 

        lastKnownFrame = 0;
        previousFrame = 0;
        document.getElementById('time-current').innerText = "00:00";
        document.getElementById('time-total').innerText = formatTime(trackData.length);
        document.getElementById('progress-slider').value = 0;

        const subsongDisplay = document.getElementById('subsong-display');
        if (subsongDisplay) {
            subsongDisplay.innerText = `[SUB ${subsongId}/${trackData.metadata.songs}]`;
        }

        let meta = trackData.metadata;
        currentScrollerText = `+++ BOOM! SWITCHED TO SUBSONG ${subsongId} OF ${meta.songs} +++ NOW PLAYING: ${meta.name.toUpperCase()} (TRACK ${subsongId}) BY ${meta.author.toUpperCase()} +++ `;

        if (fsUI) {
            fsUI.updateTrack(`${meta.name.toUpperCase()} [SUB ${subsongId}/${meta.songs}]`);
        }
        currentTrackTitle = meta.name || currentTrackTitle;
        setPlaybackState('playing', `SUB ${subsongId}/${meta.songs} · ${getActiveCoreName()}`);
        syncMediaSessionTrack(trackRegistry[activeSystem][currentTrackIndex]);
    }    

}

function startPlayback() {
    if (isPlaying || trackData.length === 0) return;
    resumeAudioContext().catch(e=>console.log(e));

    isPlaying = true;
    
    let isAmiga = (trackData[0] && trackData[0].isAmiga) || trackData.isAmigaFile;
    let isC64 = (trackData[0] && trackData[0].isC64) || trackData.isSidFile;
    
    const paulaNode = getPaulaNode();
    const sidNode = getSidNode();
    const ymNode = getYmNode();
    
    if (isAmiga) {
        if (paulaNode) paulaNode.port.postMessage({ type: 'PLAY_TRACK', track: trackData });
    } else if (isC64) {
        if (sidNode) {
            if (trackData.isSidFile) {
                sidNode.port.postMessage(trackData); 
            } else {
                sidNode.port.postMessage({ type: 'PLAY_TRACK', track: trackData });
            }
        }
    } else {
        if (ymNode) {
            ymNode.port.postMessage({ 
                type: 'PLAY_TRACK', 
                track: trackData,
                digidrums: trackData.digidrums,
                masterClock: trackData.metadata?.masterClock,
                playerRate: getPlayerRate(trackData),
                loopFrame: trackData.metadata?.loopFrame || 0
            });
        }
    }

    setPlaybackState('playing');
    mediaSession.setPlaybackState('playing');
    mediaSession.updatePosition(framesToSeconds(trackData.length, trackData), framesToSeconds(lastKnownFrame, trackData), true);
}

function resumePlayback() {
    if (isPlaying || trackData.length === 0) return;
    resumeAudioContext().catch(e=>console.log(e));
    isPlaying = true;
    
    const paulaNode = getPaulaNode();
    const sidNode = getSidNode();
    const ymNode = getYmNode();

    if (activeSystem === 'amiga' && paulaNode) paulaNode.port.postMessage({ type: 'RESUME_TRACK' });
    else if (activeSystem === 'c64' && sidNode) sidNode.port.postMessage({ type: 'RESUME_TRACK' });
    else if (ymNode) ymNode.port.postMessage({ type: 'RESUME_TRACK' });

    setPlaybackState('playing');
    mediaSession.setPlaybackState('playing');
    mediaSession.updatePosition(framesToSeconds(trackData.length, trackData), framesToSeconds(lastKnownFrame, trackData), true);
}

function stopPlayback() {
    if (!isPlaying) return;
    isPlaying = false;
    
    const paulaNode = getPaulaNode();
    const sidNode = getSidNode();
    const ymNode = getYmNode();

    if (ymNode) ymNode.port.postMessage({ type: 'STOP_TRACK' });
    if (paulaNode) paulaNode.port.postMessage({ type: 'STOP_TRACK' });
    if (sidNode) sidNode.port.postMessage({ type: 'STOP_TRACK' });

    // =========================================================
    // FIX: Allokationsfreies Zurücksetzen der Volume-Spuren bei Pause
    // =========================================================
    setPlaybackState('paused');
    channelVolumes.fill(0);
    sidRegisterWriteRate = 0;
    mediaSession.setPlaybackState(trackData.length > 0 ? 'paused' : 'none');
    mediaSession.updatePosition(framesToSeconds(trackData.length, trackData), framesToSeconds(lastKnownFrame, trackData), true);
}

let isTransitioning = false; // Verhindert Spam-Klicken der Tabs

async function setTheme(themeName, isBootSequence = false) {
    if (isTransitioning) return;
    
    const newSystem = themeName === 'theme-atari' ? 'atari' : themeName === 'theme-amiga' ? 'amiga' : 'c64';
    const doAnimate = !isBootSequence && (activeSystem !== newSystem || isPlaying);

    if (doAnimate) {
        isTransitioning = true;
        playRequestToken++; 
        stopPlayback();     
        
        document.body.classList.add('system-transitioning');
        window.dispatchEvent(new CustomEvent('trigger-glitch'));
        
        // Warten, bis der visuelle Blackout-Peak der CSS-Animation erreicht ist (300ms)
        await new Promise(resolve => setTimeout(resolve, 300));
    } else {
        stopPlayback();
    }

    // =========================================================
    // THE HARD SWITCH (Wird exakt im Blackout-Peak ausgeführt!)
    // Wir setzen das komplette UI, CSS und den RAM zurück, 
    // BEVOR die Hardware wieder mit Strom versorgt wird.
    // =========================================================
    
    document.body.className = themeName + (doAnimate ? ' system-transitioning' : '');
    
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        const isActive = tab.getAttribute('data-theme') === themeName;
        tab.classList.toggle('active', isActive);
        tab.setAttribute('aria-pressed', String(isActive));
    });

    activeSystem = newSystem;
    tracklistDirectory = '';
    document.body.classList.remove('archive-expanded');
    const btnToggleArchive = document.getElementById('btn-toggle-archive');
    if (btnToggleArchive) {
        btnToggleArchive.textContent = '[ COLLAPSE ]';
        btnToggleArchive.setAttribute('aria-expanded', 'true');
    }
    updateLivingSiliconTitle();
    
    const tempContainer = document.getElementById('temp-control-container');
    if (tempContainer) {
        if (activeSystem === 'c64') tempContainer.classList.remove('hidden');
        else tempContainer.classList.add('hidden');
    }

    renderTracklist(activeSystem);

    document.getElementById('info-text').innerHTML = `
        <div class="terminal-card">
            <div class="terminal-card-header">&gt; SYSTEM INITIALIZATION</div>
            <div style="padding: 10px 0;">
                <p style="color: var(--highlight-color); margin-bottom: 8px;">[ SYSTEM READY ]</p>
                <p style="font-size: 0.9em; opacity: 0.8;">Please inject a ROM from the archive to initialize bus routing...</p>
                <p class="blinking-cursor" style="margin-top: 15px;">_</p>
            </div>
        </div>
    `;
    
    currentScrollerText = `+++ ${activeSystem.toUpperCase()} SYSTEM READY. AWAITING DATA INJECTION... +++`;

    const legend = document.getElementById('hud-legend');
    if (legend) legend.classList.add('hidden'); 

    const hudBody = document.getElementById('hud-body');
    if (hudBody) hudBody.classList.add('hidden');
    
    const hudMain = document.getElementById('chip-hud'); 
    if (hudMain) hudMain.classList.add('collapsed');     
    
    const hudToggleBtn = document.getElementById('btn-hud-toggle');
    if (hudToggleBtn) hudToggleBtn.innerText = '[ LAB MODE: OFF ]';
    
    const infoBtn = document.getElementById('btn-hud-info');
    if (infoBtn) infoBtn.classList.add('hidden');

    // ---------------------------------------------------------
    // GHOST-TRACK WIPES (RAM Löschen)
    // ---------------------------------------------------------
    trackData = [];
    currentTrackIndex = -1;
    currentTrackTitle = '';
    currentChipRegs = null;
    lastKnownFrame = 0;
    previousFrame = 0;
    mediaSession.clear();
    playbackSessionId++; // Erzwingt auch im DJ-Skillset einen State Sync Reset
    
    resetHUD();
    
    if (fsUI) fsUI.updateTrack("[ AWAITING INJECTION ]");
    
    document.getElementById('progress-slider').value = 0;
    document.getElementById('progress-slider').disabled = true;
    document.getElementById('time-current').innerText = "00:00";
    document.getElementById('time-total').innerText = "00:00";
    
    const subsongDisplay = document.getElementById('subsong-display');
    if (subsongDisplay) {
        subsongDisplay.classList.add('hidden');
        subsongDisplay.innerText = "";
    }
    
    renderCoreSelector(activeSystem);
    updateLivingSiliconTitle();
    setPlaybackState('idle');
    
    if (typeof siliconVisualizer !== 'undefined' && siliconVisualizer) {
        siliconVisualizer.setSystem(activeSystem);
    }

    // =========================================================
    // RAM-WIPE EVENT (Hardware Boot)
    // Da die Trackdaten nun garantiert gelöscht sind, 
    // kann kein neu erwachendes DSE mehr die alten Titel einlesen!
    // =========================================================
    window.dispatchEvent(new CustomEvent('hardware-power-cycle'));

    // --- 3. POWER UP ---
    if (doAnimate) {
        // Die restlichen 300ms der Flicker-Animation abklingen lassen
        await new Promise(resolve => setTimeout(resolve, 300));
        document.body.classList.remove('system-transitioning');
        isTransitioning = false;
    }
}
// === js/app.js (Auszug) ===

function updateLivingSiliconTitle() {
    let chipName = livingSiliconChipNames[activeSystem];
    if (activeSystem === 'c64') {
        const coreIndex = Number(document.getElementById('core-selector').value) || 0;
        chipName = workletRegistry.c64[coreIndex].id === 'sid-fantasy'
            ? 'SID FANTASY STUDIO'
            : 'MOS 6581 R3 EXACT';
    }
    document.getElementById('living-silicon-title').textContent = `> LIVING SILICON · ${chipName}`;
}

function renderCoreSelector(system) {
    const select = document.getElementById('core-selector');
    select.innerHTML = '';
    
    const cores = workletRegistry[system];
    
    // Maximale Länge für das Padding ermitteln
    const maxLen = Math.max(...cores.map(c => c.name.length));

    cores.forEach((core, index) => {
        const opt = document.createElement('option');
        opt.value = index;
        
        let cpuLoad = core.cpu || 1;
        let meter = '';
        for (let i = 1; i <= 4; i++) {
            // UI FIX: Reine ASCII-Zeichen, um Font-Fallback-Bugs (unterschiedliche Breiten) zu verhindern
            meter += (i <= cpuLoad) ? '#' : '-';
        }
        
        // damit auf kleinen Handys-Screens mehr vom Core-Namen sichtbar bleibt.
        const padCount = maxLen - core.name.length + 1;
        const padding = '.'.repeat(padCount);
        
        // Erst Name, dann Punkte, dann CPU-Last
        opt.text = `${core.name} ${padding} CPU:[${meter}]`;
        select.appendChild(opt);
    });
}

function renderTracklist(system) {
    const listElement = document.getElementById('tracklist');
    listElement.innerHTML = '';
    const songs = trackRegistry[system];
    if (!songs) return;

    const supportsFolderNavigation = system === 'amiga' || system === 'atari' || system === 'c64';
    const bindActivation = (item, handler) => {
        item.tabIndex = 0;
        item.setAttribute('role', 'button');
        item.addEventListener('click', handler);
        item.addEventListener('keydown', event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            handler();
        });
    };

    if (supportsFolderNavigation && tracklistDirectory) {
        const upItem = document.createElement('li');
        upItem.classList.add('tracklist-navigation');
        upItem.textContent = '[UP] ..';
        bindActivation(upItem, () => {
            const separatorIndex = tracklistDirectory.lastIndexOf('/');
            tracklistDirectory = separatorIndex === -1 ? '' : tracklistDirectory.slice(0, separatorIndex);
            renderTracklist(system);
        });
        listElement.appendChild(upItem);
    }

    const entries = supportsFolderNavigation
        ? getTracklistEntries(songs, tracklistDirectory)
        : songs.map((song, index) => ({ type: 'track', index, song }));

    entries.forEach(entry => {
        const li = document.createElement('li');
        if (entry.type === 'folder') {
            li.classList.add('tracklist-folder');
            li.textContent = `[DIR] ${entry.name}/`;
            bindActivation(li, () => {
                tracklistDirectory = entry.path;
                renderTracklist(system);
            });
        } else {
            li.textContent = system === 'amiga'
                ? entry.song.path.split('/').pop().replace(/\.[^.]+$/, '').replaceAll('_', ' ')
                : (entry.song.listTitle || entry.song.title);
            li.dataset.trackIndex = entry.index;
            bindActivation(li, () => selectAndPlayTrack(entry.index, system));
        }
        listElement.appendChild(li);
    });
    syncTracklistPlaybackState();
}

async function selectAndPlayTrack(index, system) {
    lastTrackChangeTime = performance.now();

    // =========================================================
    // ASYNC RACE CONDITION PROTECTION
    // =========================================================
    playRequestToken++;
    const myToken = playRequestToken;

    // --- FIX: ZEILE ENTFERNT ---
    // playbackSessionId++; (DIESE ZEILE LÖSCHEN!)

    if (getAudioContext() && getAudioContext().state === 'suspended') {
        resumeAudioContext().catch(e => console.log("AudioContext resume blockiert:", e));
    }

    const songs = trackRegistry[system]; 

    if (!songs || !songs[index]) return;

    const pwrLedOverride = document.getElementById('amiga-led-override');
    if (pwrLedOverride) pwrLedOverride.style.display = 'none';

    stopPlayback();
    mediaSession.setSeekable(false);
    currentTrackIndex = index;
    const selectedSong = songs[index];
    currentTrackTitle = selectedSong.title;

    lastKnownFrame = 0;
    previousFrame = 0;

    resetHUD();

    document.getElementById('progress-slider').disabled = true;
    setPlaybackState('loading', selectedSong.path ? `READING ${selectedSong.path}` : 'PREPARING SYNTHETIC TRACK DATA');
    renderTracklist(system);

    if (selectedSong.loadAsync) {
        const isAmigaSystem = (system === 'amiga');
        const isC64System = (system === 'c64');

        // Der Slider bleibt während des kompletten Ladevorgangs gesperrt.
        document.getElementById('progress-slider').disabled = true;
        
        currentScrollerText = isAmigaSystem 
            ? "+++ DOWNLOADING AND PARSING BINARY AMIGA MODULE... +++"
            : (isC64System ? "+++ DOWNLOADING AND PARSING BINARY C64 PSID FILE... +++" : "+++ DOWNLOADING AND PARSING BINARY YM FILE... +++");
        
        try {
            let parsedFile = await selectedSong.loadAsync();
            
            if (myToken !== playRequestToken) {
                console.warn("[SYSTEM] Veralteter Async-Ladevorgang durch User-Interaktion abgebrochen.");
                return; 
            }

            if (isC64System) {
                trackData = parsedFile; 

                currentSubsongIndex = parsedFile.startSong || 1; 
                trackData.metadata.currentSubsong = currentSubsongIndex; // <<< DIESE ZEILE INJIZIEREN!

                let sldbLengths = trackData.lengths || [180];
                let songLengthSeconds = sldbLengths[currentSubsongIndex - 1] || sldbLengths[0] || 180;
                trackData.length = songLengthSeconds * 50; 
                
                const subsongDisplay = document.getElementById('subsong-display');
                if (subsongDisplay) {
                    subsongDisplay.innerText = `[SUB ${currentSubsongIndex}/${parsedFile.metadata.songs}]`;
                    subsongDisplay.classList.remove('hidden');
                }
            } else {
                const subsongDisplay = document.getElementById('subsong-display');
                if (subsongDisplay) {
                    subsongDisplay.classList.add('hidden');
                    subsongDisplay.innerText = "";
                }

                if (parsedFile.isSequenced) {
                    trackData = parsedFile; 
                } else {
                    trackData = parsedFile.frames; 
                    trackData.digidrums = parsedFile.digidrums || [];
                    
                    // --- FIX: METADATEN WIEDER AN DAS ARRAY ANHÄNGEN! ---
                    trackData.metadata = parsedFile.metadata; 
                }
                
                if (isAmigaSystem) {
                    trackData.isAmigaFile = true; 
                    
                    const paulaNode = getPaulaNode();
                    if (parsedFile.samples && paulaNode) {
                        for (let sampleName in parsedFile.samples) {
                            paulaNode.port.postMessage({
                                type: 'UPLOAD_SAMPLE',
                                name: sampleName,
                                data: parsedFile.samples[sampleName]
                            });
                        }
                    }
                } else {
                    trackData.isYmFile = true;
                }
            }

            let meta = parsedFile.metadata;
            currentTrackTitle = meta?.name || selectedSong.title;
            document.getElementById('progress-slider').disabled = !canSeekActiveTrack();
            setPlaybackState('loading', 'DECODING COMPLETE · ROUTING AUDIO BUS');
            let gridHTML = "";

            if (isAmigaSystem) {
                gridHTML = `
                    <span class="lbl">[TYPE]</span> <span class="val">${meta.type}</span>
                    <span class="lbl">[CHNL]</span> <span class="val">4 DMA</span>
                    <span class="lbl">[SIZE]</span> <span class="val">${Math.floor(meta.fileSize / 1024)} KB</span>
                    <span class="lbl">[PATT]</span> <span class="val">${meta.patternCount}</span>
                    <span class="lbl">[SMPL]</span> <span class="val">${meta.instrumentCount}</span>
                    <span class="lbl">[FILT]</span> <span class="val">LED+RC</span>
                `;
            } else if (isC64System) {
                gridHTML = `
                    <span class="lbl">[ADDR]</span> <span class="val">${meta.loadAddress}</span>
                    <span class="lbl">[SONG]</span> <span class="val">${meta.startSong}/${meta.songs}</span>
                    <span class="lbl">[INIT]</span> <span class="val">${meta.initAddress}</span>
                    <span class="lbl">[SIZE]</span> <span class="val">${Math.floor(meta.fileSize / 1024)} KB</span>
                    <span class="lbl">[PLAY]</span> <span class="val">${meta.playAddress}</span>
                    <span class="lbl">[FILT]</span> <span class="val">ANALOG</span>
                `;
            } else {
                let pcmText = meta.digidrumCount > 0 ? `${meta.digidrumCount} SMP` : "NONE";
                gridHTML = `
                    <span class="lbl">[TYPE]</span> <span class="val">${meta.type}</span>
                    <span class="lbl">[CHNL]</span> <span class="val">3+1</span>
                    <span class="lbl">[LENG]</span> <span class="val">${trackData.length} F</span>
                    <span class="lbl">[P_CM]</span> <span class="val">${pcmText}</span>
                    <span class="lbl">[RATE]</span> <span class="val">50 Hz</span>
                    <span class="lbl">[MIX ]</span> <span class="val">LOG-5</span>
                `;
            }

            // =========================================================
            // SCROLLER LAUFTEXT WIEDER AKTIVIERT (Track-Infos)
            // =========================================================
            currentScrollerText = isAmigaSystem
                ? `+++ BOOM! SUCCESSFULLY DECODED AMIGA MODULE +++ NOW PLAYING: ${meta.name.toUpperCase()} BY ${meta.author.toUpperCase()} +++ FORMAT: ${meta.type} +++ THIS IS PURE PROTRACKER MAGIC +++ `
                : (isC64System
                    ? `+++ BOOM! SUCCESSFULLY CRACKED OPEN BINARY PSID FILE +++ NOW PLAYING: ${meta.name.toUpperCase()} BY ${meta.author.toUpperCase()} +++ FORMAT: ${meta.type} +++ CRANK UP THE VOLUME AND LET THE ANALOG SID FILTERS SHINE +++ `
                    : `+++ BOOM! SUCCESSFULLY CRACKED OPEN BINARY FILE +++ NOW PLAYING: ${meta.name.toUpperCase()} BY ${meta.author.toUpperCase()} +++ COMMENT ALONG THE RIDE: ${meta.comment.toUpperCase() || "NO COMMENT"} +++ CRANK UP THE GAIN AND LET THE YM2149 MELT YOUR SPEAKERS +++ `);

            const systemText = (typeof systemDescriptions !== 'undefined' && systemDescriptions[system]) 
                ? systemDescriptions[system] 
                : '<p style="color: var(--text-color);">[ NO ARCHIVE DATA ]</p>';

            // Z-Depth Card Layout mit nativen Accordions
            document.getElementById('info-text').innerHTML = `
                <div class="terminal-card">
                    <div class="terminal-card-header">&gt; NOW PLAYING</div>
                    <div style="font-size: 1.2em; padding: 5px 0;">${selectedSong.title}</div>
                </div>

                <!-- GFX UPGRADE: Einklappbares Akkordeon für die Binärdaten -->
                <details class="terminal-card" open>
                    <summary class="terminal-card-header" style="cursor: pointer; outline: none;">&gt; BINARY ANALYSIS</summary>
                    <div class="terminal-grid" style="margin-top: 10px;">
                        ${gridHTML}
                    </div>
                </details>

                ${selectedSong.composerInfo ? `
                <div class="terminal-card">
                    ${selectedSong.composerInfo}
                </div>` : ''}

                <div class="terminal-card" style="margin-top: 20px;">
                    ${systemText}
                </div>
            `;

            // --- NEU: HIER IST DER RICHTIGE ORT! ---
            // Jetzt liegen die NEUEN Metadaten sicher in trackData bereit
            playbackSessionId++;
            syncMediaSessionTrack(selectedSong);
            startPlayback();
            
        } catch (err) {
            if (myToken !== playRequestToken) return;
            console.error('[TRACK LOAD]', err);
            trackData = [];
            isPlaying = false;
            document.getElementById('progress-slider').disabled = true;
            mediaSession.clear();
            setPlaybackState('error', err.message || 'UNKNOWN BINARY FORMAT ERROR');
            currentScrollerText = "+++ ERROR LOADING FILE +++ BUS HALTED +++ RETRY OR SELECT ANOTHER TRACK +++";

            const info = document.getElementById('info-text');
            info.innerHTML = '';
            const card = document.createElement('div');
            card.className = 'terminal-card load-error-card';
            const header = document.createElement('div');
            header.className = 'terminal-card-header';
            header.textContent = '> ROM INJECTION FAULT';
            const message = document.createElement('p');
            message.textContent = err.message || 'Unknown binary format error.';
            const hint = document.createElement('p');
            hint.textContent = 'Retry with [ RETRY ROM ] or select another track from the archive.';
            card.append(header, message, hint);
            info.appendChild(card);
        }
    } else {
        const systemText = (typeof systemDescriptions !== 'undefined' && systemDescriptions[system]) 
            ? systemDescriptions[system] 
            : '<p style="color: var(--text-color);">[ Museumdatenarchiv geladen ]</p>';

        document.getElementById('info-text').innerHTML = `
            <div class="terminal-card">
                <div class="terminal-card-header">&gt; NOW PLAYING</div>
                <div style="font-size: 1.2em; padding: 5px 0;">${selectedSong.title}</div>
            </div>
            
            ${selectedSong.composerInfo ? `
            <div class="terminal-card">
                ${selectedSong.composerInfo}
            </div>` : ''}

            <div class="terminal-card" style="margin-top: 20px;">
                ${systemText}
            </div>
        `;
        currentScrollerText = "+++ NOW PLAYING: " + selectedSong.title + " +++";
        trackData = selectedSong.generator();
        document.getElementById('progress-slider').disabled = !canSeekActiveTrack();
        syncMediaSessionTrack(selectedSong);
        startPlayback();
    }
    if (fsUI) fsUI.updateTrack(currentTrackTitle || selectedSong.title);

}

function enterPseudoFullscreen(visualZone) {
    visualZone.classList.add('pseudo-fullscreen');
    document.getElementById('btn-fullscreen').innerText = '[ EXIT ]';
    document.body.style.overflow = 'hidden'; 
    document.body.appendChild(visualZone);
    setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
}

function exitPseudoFullscreen(visualZone) {
    visualZone.classList.remove('pseudo-fullscreen');
    document.getElementById('btn-fullscreen').innerText = '[ ⛶ ]';
    document.body.style.overflow = ''; 
    const demoContainer = document.getElementById('demo-container');
    const playbackBar = document.getElementById('playback-bar');
    if (demoContainer && playbackBar) {
        demoContainer.insertBefore(visualZone, playbackBar);
    }
    setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
}

function toggleFullscreen() {
    const visualZone = document.getElementById('visual-zone');
    if (visualZone.classList.contains('pseudo-fullscreen')) {
        exitPseudoFullscreen(visualZone);
        return;
    }

    if (document.fullscreenElement || document.webkitFullscreenElement) {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        return;
    }

    try {
        if (visualZone.requestFullscreen) {
            let promise = visualZone.requestFullscreen();
            if (promise && typeof promise.catch === 'function') {
                promise.catch((err) => {
                    console.log("Native fullscreen rejected, triggering iOS Fallback.", err);
                    enterPseudoFullscreen(visualZone);
                });
            }
        } else if (visualZone.webkitRequestFullscreen) {
            visualZone.webkitRequestFullscreen();
            setTimeout(() => {
                if (!document.webkitFullscreenElement && !visualZone.classList.contains('pseudo-fullscreen')) {
                    enterPseudoFullscreen(visualZone);
                }
            }, 200);
        } else {
            enterPseudoFullscreen(visualZone);
        }
    } catch (err) {
        enterPseudoFullscreen(visualZone);
    }
}

function handleFullscreenChange() {
    const btn = document.getElementById('btn-fullscreen');
    const isNativeFS = !!(document.fullscreenElement || document.webkitFullscreenElement);
    if (isNativeFS) {
        btn.innerText = '[ EXIT ]';
    } else {
        const visualZone = document.getElementById('visual-zone');
        if (visualZone && !visualZone.classList.contains('pseudo-fullscreen')) {
            btn.innerText = '[ ⛶ ]';
        }
    }
    window.dispatchEvent(new Event('resize'));
}

let wakeLock = null;

async function enableEcoMode() {
    // noSleepVideo.play() gelöscht!
    isEcoMode = true;
    document.getElementById('eco-overlay').classList.remove('hidden');
    document.body.classList.add('eco-mode'); 
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log('[SYSTEM] Wake Lock aktiv. Bildschirm bleibt an.');
        }
    } catch (err) {
        console.warn(`Wake Lock API blockiert. Fallback läuft.`);
    }
}

async function disableEcoMode() {
    isEcoMode = false;
    document.getElementById('eco-overlay').classList.add('hidden');
    document.body.classList.remove('eco-mode'); 
    if (wakeLock !== null) {
        await wakeLock.release();
        wakeLock = null;
    }
    // noSleepVideo.pause() gelöscht!
    window.dispatchEvent(new Event('resize'));
}

function requestPlay() {
    if (isPlaying || playbackState === 'loading' || !getAudioContext()) return;
    resumeAudioContext().catch(e => console.log(e));
    if (trackData.length === 0) {
        if (playbackState === 'error' && currentTrackIndex >= 0) {
            selectAndPlayTrack(currentTrackIndex, activeSystem);
            return;
        }
        const visibleEntries = getTracklistEntries(trackRegistry[activeSystem], tracklistDirectory);
        const firstVisibleTrack = visibleEntries.find(entry => entry.type === 'track');
        if (firstVisibleTrack) selectAndPlayTrack(firstVisibleTrack.index, activeSystem);
    } else {
        resumePlayback();
    }
}

function requestPause() {
    if (isPlaying) stopPlayback();
}

function requestPlayPause() {
    if (isPlaying) requestPause();
    else requestPlay();
}

function requestNextTrack() {
    if (!getAudioContext()) return;
    resumeAudioContext().catch(e => console.log(e));
    if (currentTrackIndex < 0) {
        const visibleTracks = getTracklistEntries(trackRegistry[activeSystem], tracklistDirectory)
            .filter(entry => entry.type === 'track');
        if (visibleTracks.length > 0) selectAndPlayTrack(visibleTracks[0].index, activeSystem);
        return;
    }
    if (activeSystem === 'c64' && trackData && trackData.isSidFile) {
        const totalSongs = trackData.metadata.songs || 1;
        if (currentSubsongIndex < totalSongs) {
            changeC64Subsong(currentSubsongIndex + 1);
            return;
        }
    }
    selectAndPlayTrack((currentTrackIndex + 1) % trackRegistry[activeSystem].length, activeSystem);
}

function requestPreviousTrack() {
    if (!getAudioContext()) return;
    resumeAudioContext().catch(e => console.log(e));
    if (currentTrackIndex < 0) {
        const visibleTracks = getTracklistEntries(trackRegistry[activeSystem], tracklistDirectory)
            .filter(entry => entry.type === 'track');
        const lastVisibleTrack = visibleTracks[visibleTracks.length - 1];
        if (lastVisibleTrack) selectAndPlayTrack(lastVisibleTrack.index, activeSystem);
        return;
    }
    if (activeSystem === 'c64' && trackData && trackData.isSidFile) {
        if (currentSubsongIndex > 1) {
            changeC64Subsong(currentSubsongIndex - 1);
            return;
        }
    }
    let prevIdx = currentTrackIndex - 1;
    if (prevIdx < 0) prevIdx = trackRegistry[activeSystem].length - 1;
    selectAndPlayTrack(prevIdx, activeSystem);
}

document.getElementById('btn-play').addEventListener('click', requestPlayPause);
document.getElementById('btn-next').addEventListener('click', requestNextTrack);
document.getElementById('btn-prev').addEventListener('click', requestPreviousTrack);

document.getElementById('volume-slider').addEventListener('input', (e) => {
    const masterGain = getMasterGain();
    if (masterGain) masterGain.gain.value = e.target.value;
});

document.getElementById('btn-hud-info').addEventListener('click', () => {
    const legend = document.getElementById('hud-legend');
    legend.innerHTML = chipCheatSheets[activeSystem]; 
    legend.classList.toggle('hidden');
});

document.getElementById('btn-hud-toggle').addEventListener('click', (e) => {
    const hud = document.getElementById('chip-hud'); 
    const body = document.getElementById('hud-body');
    const infoBtn = document.getElementById('btn-hud-info'); 
    const isHidden = body.classList.contains('hidden');
    
    if (isHidden) {
        body.classList.remove('hidden');
        infoBtn.classList.remove('hidden'); 
        hud.classList.remove('collapsed'); 
        e.target.innerText = '[ LAB MODE: ON ]'; // NEU
    } else {
        body.classList.add('hidden');
        infoBtn.classList.add('hidden'); 
        hud.classList.add('collapsed'); 
        e.target.innerText = '[ LAB MODE: OFF ]'; // NEU
        const legend = document.getElementById('hud-legend');
        if (legend) legend.classList.add('hidden');
    }
});

document.getElementById('core-selector').addEventListener('change', async (e) => {
    stopPlayback();
    const coreIndex = e.target.value;
    const coreConfig = workletRegistry[activeSystem][coreIndex];
    updateLivingSiliconTitle();
    updateNowPlayingSystem();
    setPlaybackState(trackData.length > 0 ? 'loading' : 'idle', 'RE-WIRING DSP PIPELINE');
    document.getElementById('hud-content') ? document.getElementById('hud-content').innerText = "RE-WIRING DSP..." : null;
    await loadEmuCore(activeSystem, coreConfig, handleWorkletMessage);
    if (trackData.length > 0) startPlayback();
    else setPlaybackState('idle');
});

document.getElementById('temp-slider').addEventListener('input', (e) => {
    const tempVal = parseInt(e.target.value);
    document.getElementById('temp-display').innerText = `${tempVal}°C`;
    
    const sidNode = getSidNode();
    if (sidNode) {
        sidNode.port.postMessage({ type: 'SET_TEMPERATURE', value: tempVal });
    }
});

document.getElementById('btn-eco').addEventListener('click', async () => {
    await resumeAudioContext();
    if (isEcoMode) {
        await disableEcoMode(); 
    } else {
        await enableEcoMode();  
    }
});

document.getElementById('btn-eco-off').addEventListener('click', async () => {
    await disableEcoMode();
});

document.getElementById('btn-fullscreen').addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', handleFullscreenChange);
document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
