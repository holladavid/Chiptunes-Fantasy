// === js/app.js ===
// =========================================================================
//                  CHIPTUNES FANTASY - MAIN APP CONTROLLER
// =========================================================================
import { FullscreenUI } from './ui/fullscreen-ui.js';
import { trackRegistry } from '../tracks/index.js';
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
    getSidNode 
} from './audio/audio-controller.js';
import { LivingSilicon } from './ui/living-silicon.js';

let fsUI = null;
let siliconVisualizer = null; // Living Silicon Instanz
let currentOscValue = 0; 
let currentChipRegs = null; 
let activeSystem = 'c64'; // Standard-System auf 'c64' korrigiert (passend zum Boot-Screen)
let trackData = [];    
let isPlaying = false; 
let currentTrackIndex = 0;
let currentScrollerText = "+++ INITIALIZING DEMO ENGINE... +++";
let lastKnownFrame = 0; 
let previousFrame = 0;       
let lastTrackChangeTime = 0; 
let isEcoMode = false;      
let isUserDragging = false; 
let currentSubsongIndex = 1; 
let channelVolumes = new Float32Array(4);
let playRequestToken = 0; // NEU: Async Race Condition Schutz
let playbackSessionId = 0; // NEU: Unidirectional State Sync für den Scene-DJ

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
            setTheme(e.target.getAttribute('data-theme'));
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
            getCurrentChipRegs: () => currentChipRegs 
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
}

if (document.readyState === 'loading') document.addEventListener("DOMContentLoaded", initApp);
else initApp();

function formatTime(frames) {
    if (!frames) return "00:00";
    let totalSeconds = Math.floor(frames / 50);
    let mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    let secs = (totalSeconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
}

function updateTimelineUI() {
    if (!isPlaying || trackData.length === 0) return;
    if (!isUserDragging) {
        document.getElementById('time-current').innerText = formatTime(lastKnownFrame);
        document.getElementById('time-total').innerText = formatTime(trackData.length);
        document.getElementById('progress-slider').value = (lastKnownFrame / trackData.length) * 100;
    }
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

    // --- NEU: Generative C64 Programme können nicht per Slider gespult werden! ---
    if (trackData.length === 0 || activeSystem === 'c64') return;

    const targetPercent = parseFloat(e.target.value);
    const targetFrame = Math.floor((targetPercent / 100) * trackData.length);
    
    lastKnownFrame = targetFrame;
    previousFrame = targetFrame;

    const seekMsg = { type: 'SEEK_TRACK', frame: targetFrame };
    const paulaNode = getPaulaNode();
    const sidNode = getSidNode();
    const ymNode = getYmNode();

    if (activeSystem === 'amiga' && paulaNode) {
        paulaNode.port.postMessage(seekMsg);
    } else if (activeSystem === 'c64' && sidNode) {
        sidNode.port.postMessage(seekMsg);
    } else if (ymNode) {
        ymNode.port.postMessage(seekMsg);
    }
});

function handleWorkletMessage(e) {
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
            channelVolumes[0] = view[34];
            channelVolumes[1] = view[35];
            channelVolumes[2] = view[36];
            channelVolumes[3] = view[37];            
        }

        if (systemId === 0) {
            const tempVal = Math.round(view[33]);
            currentChipRegs[29] = tempVal; 
        }

        if (systemId === 1) {
            const ledState = Math.round(view[33]);
            const overrideState = Math.round(view[38]); 
            currentChipRegs[29] = ledState; 
            currentChipRegs[30] = overrideState; 
            
            const pwrLed = document.getElementById('amiga-led-pwr');
            if (pwrLed) {
                if (ledState === 0) { 
                    pwrLed.classList.add('on');
                    pwrLed.style.background = '#ff0000';
                    pwrLed.style.boxShadow = '0 0 8px #ff0000';
                } else { 
                    pwrLed.classList.remove('on');
                    pwrLed.style.background = '#440000';
                    pwrLed.style.boxShadow = 'none';
                }
            }

            const pwrLedOverride = document.getElementById('amiga-led-override');
            if (pwrLedOverride) {
                pwrLedOverride.style.display = overrideState > 0 ? 'block' : 'none';
            }
        }

        previousFrame = lastKnownFrame;
        lastKnownFrame = frameVal;

        if (isPlaying && trackData.length > 0) {
            if (previousFrame > trackData.length - 20 && lastKnownFrame < 10) {
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
                digidrums: trackData.digidrums 
            });
        }
    }

    if (fsUI) fsUI.updatePlayState(true);  
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

    if (fsUI) fsUI.updatePlayState(true);
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
    if (fsUI) fsUI.updatePlayState(false);
    channelVolumes.fill(0); 
}

function setTheme(themeName) {
    playRequestToken++; // NEU: Bricht alle noch im Hintergrund ladenden Tracks sofort ab!

    document.body.className = themeName;
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.classList.remove('active');
        if (tab.getAttribute('data-theme') === themeName) tab.classList.add('active');
    });

    activeSystem = themeName === 'theme-atari' ? 'atari' : themeName === 'theme-amiga' ? 'amiga' : 'c64';
    
    // NEU: Dem Living Silicon Modul den geänderten Prozessor-Typ übermitteln
    if (siliconVisualizer) {
        siliconVisualizer.setSystem(activeSystem);
    }

    const tempContainer = document.getElementById('temp-control-container');
    if (tempContainer) {
        if (activeSystem === 'c64') tempContainer.classList.remove('hidden');
        else tempContainer.classList.add('hidden');
    }

    renderTracklist(activeSystem);
    stopPlayback(); 

    const headerTitles = {
        'c64': '>>> INFO: MOS Technology SID 6581',
        'amiga': '>>> INFO: MOS Paula 8364',
        'atari': '>>> INFO: Yamaha YM2149 (Atari ST)'
    };
    const headerEl = document.querySelector('.museum-header h2');
    if (headerEl) headerEl.innerText = headerTitles[activeSystem];

    document.getElementById('info-text').innerHTML = `
        ${systemDescriptions[activeSystem]}
        <div>
            <p style="color: var(--highlight-color);">[ SYSTEM READY ]</p>
            <p>Please select a track from the playlist to initialize playback and load data into memory...</p>
            <p class="blinking-cursor" style="margin-top: 15px;">_</p>
        </div>
    `;
    currentScrollerText = `+++ ${activeSystem.toUpperCase()} SYSTEM READY. AWAITING INPUT... +++`;

    const legend = document.getElementById('hud-legend');
    if (legend) legend.classList.add('hidden'); 

    const hudBody = document.getElementById('hud-body');
    if (hudBody) hudBody.classList.add('hidden');
    
    const hudMain = document.getElementById('chip-hud'); 
    if (hudMain) hudMain.classList.add('collapsed');     
    
    const hudToggleBtn = document.getElementById('btn-hud-toggle');
    if (hudToggleBtn) hudToggleBtn.innerText = '[+]';
    
    const infoBtn = document.getElementById('btn-hud-info');
    if (infoBtn) infoBtn.classList.add('hidden');

    trackData = [];
    currentTrackIndex = 0;
    currentChipRegs = null;
    
    resetHUD();
    
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
}

// === js/app.js (Auszug) ===

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

    songs.forEach((song, index) => {
        const li = document.createElement('li');
        li.textContent = song.title;
        if (index === currentTrackIndex) li.classList.add('active-track');
        li.addEventListener('click', () => selectAndPlayTrack(index, system));
        listElement.appendChild(li);
    });
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
    currentTrackIndex = index;
    const selectedSong = songs[index];
    
    lastKnownFrame = 0;
    previousFrame = 0; 
    
    resetHUD();

    document.getElementById('progress-slider').disabled = false;
    renderTracklist(system); 

    if (selectedSong.loadAsync) {
        const isAmigaSystem = (system === 'amiga');
        const isC64System = (system === 'c64');

        // --- NEU: Progress-Slider für C64 Tracks aus Sicherheitsgründen sperren ---
        document.getElementById('progress-slider').disabled = isC64System;
        
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

            const systemText = (typeof systemDescriptions !== 'undefined' && systemDescriptions[system]) 
                ? systemDescriptions[system] 
                : '<p style="color: var(--text-color);">[ NO ARCHIVE DATA ]</p>';

            // Z-Depth Card Layout
            document.getElementById('info-text').innerHTML = `
                <div class="terminal-card">
                    <div class="terminal-card-header">&gt; NOW PLAYING</div>
                    <div style="font-size: 1.2em; padding: 5px 0;">${selectedSong.title}</div>
                </div>

                <div class="terminal-card">
                    <div class="terminal-card-header">&gt; BINARY ANALYSIS</div>
                    <div class="terminal-grid">
                        ${gridHTML}
                    </div>
                </div>

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
            startPlayback();
            
        } catch (err) {
            alert("FEHLER BEIM LADEN: " + err.message);
            currentScrollerText = "+++ ERROR LOADING FILE +++";
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
        startPlayback();
    }
    if (fsUI) fsUI.updateTrack(selectedSong.title);

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

document.getElementById('btn-play').addEventListener('click', () => {
    resumeAudioContext().catch(e=>console.log(e));
    if (isPlaying) {
        stopPlayback(); 
    } else {
        trackData.length === 0 ? selectAndPlayTrack(0, activeSystem) : resumePlayback();
    }
});

document.getElementById('btn-next').addEventListener('click', () => {
    resumeAudioContext().catch(e=>console.log(e));
    if (activeSystem === 'c64' && trackData && trackData.isSidFile) {
        const totalSongs = trackData.metadata.songs || 1;
        if (currentSubsongIndex < totalSongs) {
            changeC64Subsong(currentSubsongIndex + 1);
            return; 
        }
    }
    selectAndPlayTrack((currentTrackIndex + 1) % trackRegistry[activeSystem].length, activeSystem);
});

document.getElementById('btn-prev').addEventListener('click', () => {
    resumeAudioContext().catch(e=>console.log(e));
    if (activeSystem === 'c64' && trackData && trackData.isSidFile) {
        if (currentSubsongIndex > 1) {
            changeC64Subsong(currentSubsongIndex - 1);
            return;
        }
    }
    let prevIdx = currentTrackIndex - 1;
    if (prevIdx < 0) prevIdx = trackRegistry[activeSystem].length - 1;
    selectAndPlayTrack(prevIdx, activeSystem);
});

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
        e.target.innerText = '[-]'; 
    } else {
        body.classList.add('hidden');
        infoBtn.classList.add('hidden'); 
        hud.classList.add('collapsed'); 
        e.target.innerText = '[+]'; 
        const legend = document.getElementById('hud-legend');
        if (legend) legend.classList.add('hidden');
    }
});

document.getElementById('core-selector').addEventListener('change', async (e) => {
    stopPlayback();
    const coreIndex = e.target.value;
    const coreConfig = workletRegistry[activeSystem][coreIndex];
    document.getElementById('hud-content') ? document.getElementById('hud-content').innerText = "RE-WIRING DSP..." : null;
    await loadEmuCore(activeSystem, coreConfig, handleWorkletMessage);
    startPlayback(); 
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