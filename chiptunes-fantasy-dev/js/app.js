// --- IMPORT DER MODULE ---
import { trackRegistry } from '../tracks/registry.js';
import { createKickSample, createBassSample, createChordSample, createSnareSample, createLeadSample } from './utils/amiga-helper.js'; 
import { systemDescriptions, chipCheatSheets } from './content/museum.js'; // <- DIESER IMPORT MUSS INTACT SEIN!
import { workletRegistry } from './worklets/registry.js';
import { initScroller } from './visuals/scroller.js'; // NEU: Scroller-Modul importiert
import { initVisuals } from './visuals/visualizer.js'; // NEU: Visualizer-Modul importiert
import { updateChipHUD, resetHUD } from './ui/hud-debugger.js'; // NEU: Debugger-Modul importiert

// --- GLOBALE VARIABLEN ---
let audioCtx;
let ymNode, paulaNode, sidNode; 
let masterGain;
let analyserNode; 
let currentOscValue = 0; 
let currentChipRegs = null; 
let activeSystem = 'atari';
let trackData = [];    
let currentFrame = 0;  
let isPlaying = false; 
let currentTrackIndex = 0;
let currentScrollerText = "+++ INITIALIZING DEMO ENGINE... +++";
let lastKnownFrame = 0; 
let previousFrame = 0;       // NEU: Merkt sich den vorherigen Frame für den Loop-Check
let lastTrackChangeTime = 0; // NEU: Der kugelsichere Cooldown-Timer
let isEcoMode = false;      // NEU: Status für den Pure Audio Mode
let isUserDragging = false; // NEU: Verhindert Slider-Zucken während des Ziehens
let currentSubsongIndex = 1; // NEU: Speichert das aktive C64-Subsong-Verzeichnis (1-basiert)

// --- YM2149 NOISE FREQUENCY LOOKUP TABLE (2 MHz Clock) ---
// 32 diskrete Werte für die 5 Bits (0 - 31). Periode 0 wird als 1 behandelt.
const NOISE_LUT_HZ = [
    125000, 125000,  62500,  41667,  31250,  25000,  20833,  17857,
     15625,  13889,  12500,  11364,  10417,   9615,   8929,   8333,
      7813,   7353,   6944,   6579,   6250,   5952,   5682,   5435,
      5208,   5000,   4808,   4630,   4464,   4310,   4167,   4032
];

// --- BOOT SEQUENZ (Modul-sicher) ---
function initApp() {
    // Service-Worker für iOS-Homescreen-Standalone-Modus registrieren
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
        if (!demoContainer) {
            alert("FEHLER: HTML Element 'demo-container' fehlt in der index.html!");
            return;
        }

        bootScreen.classList.add("hidden");
        demoContainer.classList.remove("hidden");
        
        await initAudioEngine();
        
        await initAudioEngine();
        
        // Initialisierung des Grafik-Moduls mit asynchronem State-Routing und HUD-Callback
        initVisuals({
            getEcoMode: () => isEcoMode,
            getCurrentOscValue: () => currentOscValue,
            getTrackData: () => trackData,
            getAnalyserNode: () => analyserNode,
            getIsPlaying: () => isPlaying,
            getAudioContext: () => audioCtx
        }, {
            updateTimelineUI: () => updateTimelineUI(),
            // BUGFIX: Verknüpft das neue Debugger-Modul über asynchrone Closures!
            updateChipHUD: () => updateChipHUD({
                getActiveSystem: () => activeSystem,
                getIsPlaying: () => isPlaying,
                getCurrentChipRegs: () => currentChipRegs
            })
        });
        
        initScroller(
            () => currentScrollerText, 
            () => isEcoMode
        ); 
        
        // System initialisieren, aber KEINEN Track automatisch starten!
        setTheme('theme-c64');

    });
}

if (document.readyState === 'loading') document.addEventListener("DOMContentLoaded", initApp);
else initApp();

// Globale Filter-Referenz für das Routing
let amigaFilter; 

// --- AUDIO ENGINE CORE (DYNAMISCH) ---
async function initAudioEngine() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    try {
        amigaFilter = audioCtx.createBiquadFilter();
        amigaFilter.type = 'lowpass';
        amigaFilter.frequency.value = 6000; 

        analyserNode = audioCtx.createAnalyser();
        analyserNode.fftSize = 4096; 

        masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.5; 
        
        masterGain.connect(analyserNode);
        analyserNode.connect(audioCtx.destination);

        // Lade die Standard-Cores für alle Systeme beim Booten
        await loadEmuCore('atari', workletRegistry.atari[0]);
        await loadEmuCore('c64', workletRegistry.c64[0]);
        await loadEmuCore('amiga', workletRegistry.amiga[0]);

    } catch (e) { console.error("Audio Engine Boot Fehler:", e); }
}

// Der "virtuelle Lötkolben": Tauscht einen Chip auf dem Mainboard aus!
async function loadEmuCore(system, coreConfig) {
    try {
        // HIER IST DER FIX: { type: 'module' } erlaubt unsere neuen ES6-Importe!
        await audioCtx.audioWorklet.addModule(coreConfig.file, { type: 'module' });
        
        // Alten Chip abklemmen, falls vorhanden
        if (system === 'atari' && ymNode) ymNode.disconnect();
        if (system === 'c64' && sidNode) sidNode.disconnect();
        if (system === 'amiga' && paulaNode) paulaNode.disconnect();

        // Neuen Chip einsetzen
        let newNode = new AudioWorkletNode(audioCtx, coreConfig.processor);
        
        // Routing anwenden
        if (system === 'amiga') {
            newNode.connect(amigaFilter).connect(masterGain);
        } else {
            newNode.connect(masterGain);
        }

        // Sensoren (HUD, Oszilloskop & Auto-Advance) anschließen
        newNode.port.onmessage = (e) => {
            if (e.data.type === 'VISUAL_DATA') {
                currentOscValue = e.data.value;
                previousFrame = lastKnownFrame;
                lastKnownFrame = e.data.frame || 0; 
                currentChipRegs = e.data.regs; 

                // 2. AUTO-ADVANCE (Playlist Jukebox Modus)
                if (isPlaying && trackData.length > 0) {
                    if (previousFrame > trackData.length - 20 && lastKnownFrame < 10) {
                        // NEU: Der 2-Sekunden Cooldown! (Verhindert die Endlosschleife und den Safari-Absturz)
                        if (performance.now() - lastTrackChangeTime > 2000) {
                            lastTrackChangeTime = performance.now(); // Sofort sperren!
                            let nextIdx = (currentTrackIndex + 1) % trackRegistry[activeSystem].length;
                            console.log(`Track zu Ende! Wechsle automatisch zu Track ${nextIdx}...`);
                            selectAndPlayTrack(nextIdx, activeSystem);
                        }
                    }
                }
            }
            
            // DIE REPARIERTE UND OPTIMIERTE ROTE NERD-LED!
            if (e.data.type === 'DEBUG') {
                // NEU: Wenn PURE AUDIO an ist, ignorieren wir alle grafischen Trigger-Events!
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
        };

        // Globale Referenzen updaten
        if (system === 'atari') ymNode = newNode;
        if (system === 'c64') sidNode = newNode;
        if (system === 'amiga') {
            paulaNode = newNode;
            // Wenn der Amiga-Chip neu eingelötet wird, muss sein RAM neu gefüllt werden!
            uploadAmigaSamples(); 
        }

        console.log(`[CORE LOADED] System: ${system} -> ${coreConfig.name}`);
    } catch (e) {
        console.error(`Fehler beim Laden des ${coreConfig.name} Cores:`, e);
    }
}

function uploadAmigaSamples() {
    if (paulaNode) {
        paulaNode.port.postMessage({ type: 'UPLOAD_SAMPLE', name: 'kick', data: createKickSample() });
        paulaNode.port.postMessage({ type: 'UPLOAD_SAMPLE', name: 'bass', data: createBassSample() });
        paulaNode.port.postMessage({ type: 'UPLOAD_SAMPLE', name: 'chord', data: createChordSample() });
        paulaNode.port.postMessage({ type: 'UPLOAD_SAMPLE', name: 'snare', data: createSnareSample() }); // NEU
        paulaNode.port.postMessage({ type: 'UPLOAD_SAMPLE', name: 'lead', data: createLeadSample() });   // NEU
    }
}

// --- TIMELINE HELPER ---
function formatTime(frames) {
    if (!frames) return "00:00";
    let totalSeconds = Math.floor(frames / 50);
    let mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    let secs = (totalSeconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
}

function updateTimelineUI() {
    if (!isPlaying || trackData.length === 0) return;
    // Aktualisierung blockieren, wenn der Nutzer den Regler manuell verschiebt
    if (!isUserDragging) {
        document.getElementById('time-current').innerText = formatTime(lastKnownFrame);
        document.getElementById('time-total').innerText = formatTime(trackData.length);
        document.getElementById('progress-slider').value = (lastKnownFrame / trackData.length) * 100;
    }
}

// --- HIGH-PRECISION SCRUBBING & TRACK-SEEKING ---
const progressSlider = document.getElementById('progress-slider');

progressSlider.addEventListener('mousedown', () => { isUserDragging = true; });
progressSlider.addEventListener('mouseup', () => { isUserDragging = false; });
progressSlider.addEventListener('touchstart', () => { isUserDragging = true; });
progressSlider.addEventListener('touchend', () => { isUserDragging = false; });

progressSlider.addEventListener('input', (e) => {
    if (trackData.length === 0) return;
    const targetPercent = parseFloat(e.target.value);
    const targetFrame = Math.floor((targetPercent / 100) * trackData.length);
    // Sofortige visuelle Rückmeldung der Zeitmarke beim Ziehen
    document.getElementById('time-current').innerText = formatTime(targetFrame);
});

progressSlider.addEventListener('change', (e) => {
    if (trackData.length === 0) return;
    const targetPercent = parseFloat(e.target.value);
    const targetFrame = Math.floor((targetPercent / 100) * trackData.length);
    
    // Lokalen Frame-Zähler synchronisieren
    lastKnownFrame = targetFrame;
    previousFrame = targetFrame;

    // Seek-Signal an den aktiven AudioWorklet-Knoten senden
    const seekMsg = { type: 'SEEK_TRACK', frame: targetFrame };
    if (activeSystem === 'amiga' && paulaNode) {
        paulaNode.port.postMessage(seekMsg);
    } else if (activeSystem === 'c64' && sidNode) {
        sidNode.port.postMessage(seekMsg);
    } else if (ymNode) {
        ymNode.port.postMessage(seekMsg);
    }
});

// --- DER NEUE HIGH-PRECISION PLAYER ---
function startPlayback() {
    if (isPlaying || trackData.length === 0) return;
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(e=>console.log(e));

    isPlaying = true;
    
    // BUGFIX: Sichere Objektabfragen für Amiga und C64 (unterstützt Arrays und strukturierte Binärobjekte)
    let isAmiga = (trackData[0] && trackData[0].isAmiga) || trackData.isAmigaFile;
    let isC64 = (trackData[0] && trackData[0].isC64) || trackData.isSidFile;
    
    if (isAmiga) {
        if (paulaNode) paulaNode.port.postMessage({ type: 'PLAY_TRACK', track: trackData });
        else console.error("[CRITICAL] paulaNode ist undefined. Das Worklet konnte nicht geladen werden.");
    } else if (isC64) {
        if (sidNode) {
            if (trackData.isSidFile) {
                sidNode.port.postMessage(trackData); // Sendet das gesamte C64-Maschinencode-Paket!
            } else {
                // Abwärtskompatibilität für prozedurale Generatoren
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
}

// NEU: Setzt das Playback exakt dort fort, wo es eingefroren wurde!
function resumePlayback() {
    if (isPlaying || trackData.length === 0) return;
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();

    isPlaying = true;
    if (activeSystem === 'amiga') paulaNode.port.postMessage({ type: 'RESUME_TRACK' });
    else if (activeSystem === 'c64' && sidNode) sidNode.port.postMessage({ type: 'RESUME_TRACK' });
    else ymNode.port.postMessage({ type: 'RESUME_TRACK' });
}

function stopPlayback() {
    if (!isPlaying) return;
    isPlaying = false;
    if (ymNode) ymNode.port.postMessage({ type: 'STOP_TRACK' });
    if (paulaNode) paulaNode.port.postMessage({ type: 'STOP_TRACK' });
    if (sidNode) sidNode.port.postMessage({ type: 'STOP_TRACK' });
}

// --- UI & THEME LOGIK ---
function setTheme(themeName) {
    document.body.className = themeName;
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.classList.remove('active');
        if (tab.getAttribute('data-theme') === themeName) tab.classList.add('active');
    });

    activeSystem = themeName === 'theme-atari' ? 'atari' : themeName === 'theme-amiga' ? 'amiga' : 'c64';
    
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

    // NEU: HUD Body und [?] Button beim Systemwechsel sauber verstecken
    const hudBody = document.getElementById('hud-body');
    if (hudBody) hudBody.classList.add('hidden');
    
    const hudMain = document.getElementById('chip-hud'); // NEU
    if (hudMain) hudMain.classList.add('collapsed');     // NEU
    
    const hudToggleBtn = document.getElementById('btn-hud-toggle');
    if (hudToggleBtn) hudToggleBtn.innerText = '[+]';
    
    const infoBtn = document.getElementById('btn-hud-info');
    if (infoBtn) infoBtn.classList.add('hidden');

    trackData = [];
    currentTrackIndex = 0;
    currentChipRegs = null;
    
    // BUGFIX: Leert die Historienpuffer des Debuggers im neuen Modul
    resetHUD();
    
    // Slider zurücksetzen und sperren, bis ein Song geladen wird
    document.getElementById('progress-slider').value = 0;
    document.getElementById('progress-slider').disabled = true;
    document.getElementById('time-current').innerText = "00:00";
    document.getElementById('time-total').innerText = "00:00";
    
    // BUGFIX: Subsong-Anzeige beim Systemwechsel absolut ausblenden!
    const subsongDisplay = document.getElementById('subsong-display');
    if (subsongDisplay) {
        subsongDisplay.classList.add('hidden');
        subsongDisplay.innerText = "";
    }
    
    renderCoreSelector(activeSystem);
}

// Baut die Dropdown-Liste inkl. ASCII-CPU-Meter
function renderCoreSelector(system) {
    const select = document.getElementById('core-selector');
    select.innerHTML = '';
    workletRegistry[system].forEach((core, index) => {
        const opt = document.createElement('option');
        opt.value = index;
        
        let cpuLoad = core.cpu || 1;
        let meter = '';
        for (let i = 1; i <= 4; i++) {
            meter += (i <= cpuLoad) ? '■' : '□';
        }
        
        // FIX 1: Ein klares Trennzeichen für mobile native Dropdowns!
        opt.text = `${core.name} • CPU:${meter}`;
        
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
    // Der Cooldown-Stempel! Setzt die Sperre für den Jukebox-Wechsel auf JETZT
    lastTrackChangeTime = performance.now();

    // iOS Safari Fix: Context sofort beim Klicken aufwecken (falls nötig)
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(e => console.log("AudioContext resume blockiert:", e));
    }

    const songs = trackRegistry[system];
    if (!songs || !songs[index]) {
        return; 
    }

    stopPlayback();
    currentTrackIndex = index;
    const selectedSong = songs[index];
    
    // Frame-Zähler hart resetten, um Geister-Loops zu verhindern
    lastKnownFrame = 0;
    previousFrame = 0; 
    
    // BUGFIX: Historienpuffer des Debuggers leeren
    resetHUD();

    // Regler für das Scrubbing freigeben
    document.getElementById('progress-slider').disabled = false;
    
    renderTracklist(system); 

    if (selectedSong.loadAsync) {
        // Echte Systemprüfungen statt fehlerhafter String-Suchen im Titel
        const isAmigaSystem = (system === 'amiga');
        const isC64System = (system === 'c64'); // NEU
        
        currentScrollerText = isAmigaSystem 
            ? "+++ DOWNLOADING AND PARSING BINARY AMIGA MODULE... +++"
            : (isC64System ? "+++ DOWNLOADING AND PARSING BINARY C64 PSID FILE... +++" : "+++ DOWNLOADING AND PARSING BINARY YM FILE... +++");
        
        try {
            let parsedFile = await selectedSong.loadAsync();
            
            if (isC64System) {
                // Das komplette, binäre CPU-Paket an die Playback-Engine übergeben!
                trackData = parsedFile; 
                currentSubsongIndex = parsedFile.startSong || 1; // Standard-Startsong deklarieren
                
                // Absicherung falls lengths undefiniert ist
                let sldbLengths = trackData.lengths || [180];
                let songLengthSeconds = sldbLengths[currentSubsongIndex - 1] || sldbLengths[0] || 180;
                trackData.length = songLengthSeconds * 50; // Frame-Anzahl synchronisieren
                
                // Subsong-Anzeige im UI befüllen und einblenden!
                const subsongDisplay = document.getElementById('subsong-display');
                if (subsongDisplay) {
                    subsongDisplay.innerText = `[SUB ${currentSubsongIndex}/${parsedFile.metadata.songs}]`;
                    subsongDisplay.classList.remove('hidden');
                }
            } else {
                // BUGFIX: Subsong-Anzeige für Amiga-MODs und Atari-YM-Dateien im Binär-Pfad ausblenden!
                const subsongDisplay = document.getElementById('subsong-display');
                if (subsongDisplay) {
                    subsongDisplay.classList.add('hidden');
                    subsongDisplay.innerText = "";
                }

                trackData = parsedFile.frames; 
                trackData.digidrums = parsedFile.digidrums || [];
                
                if (isAmigaSystem) {
                    trackData.isAmigaFile = true;
                    
                    // --- DYNAMISCHER SAMPLE-UPLOAD ---
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
            
            currentScrollerText = isAmigaSystem
                ? `+++ BOOM! SUCCESSFULLY DECODED AMIGA MODULE +++ NOW PLAYING: ${meta.name.toUpperCase()} BY ${meta.author.toUpperCase()} +++ FORMAT: ${meta.type} +++ THIS IS PURE PROTRACKER MAGIC +++ `
                : (isC64System
                    ? `+++ BOOM! SUCCESSFULLY CRACKED OPEN BINARY PSID FILE +++ NOW PLAYING: ${meta.name.toUpperCase()} BY ${meta.author.toUpperCase()} +++ FORMAT: ${meta.type} +++ CRANK UP THE VOLUME AND LET THE ANALOG SID FILTERS SHINE +++ `
                    : `+++ BOOM! SUCCESSFULLY CRACKED OPEN BINARY FILE +++ NOW PLAYING: ${meta.name.toUpperCase()} BY ${meta.author.toUpperCase()} +++ COMMENT ALONG THE RIDE: ${meta.comment.toUpperCase() || "NO COMMENT"} +++ CRANK UP THE GAIN AND LET THE YM2149 MELT YOUR SPEAKERS +++ `);

            let techInfo = "";
            if (isAmigaSystem) {
                techInfo += `<p><strong>File Signature:</strong> ${meta.type}</p>`;
                techInfo += `<p><strong>Size in Memory:</strong> ${meta.fileSize.toLocaleString('de-DE')} Bytes</p>`;
                techInfo += `<p><strong>Structure:</strong> ${meta.patternCount} Patterns, ${meta.instrumentCount} Synthesized Amiga Instruments</p>`;
                techInfo += `<p><strong>Paula Configuration:</strong> 4 Channels, Direct DMA emulation</p>`;
            } else if (isC64System) {
                // TECHNISCHE AUSWERTUNG FÜR BINÄRE C64-DATEIEN
                techInfo += `<p><strong>File Signature:</strong> ${meta.type}</p>`;
                techInfo += `<p><strong>Size in Memory:</strong> ${meta.fileSize.toLocaleString('de-DE')} Bytes</p>`;
                techInfo += `<p><strong>SID Address Space:</strong> Load: ${meta.loadAddress} | Init: ${meta.initAddress} | Play: ${meta.playAddress}</p>`;
                techInfo += `<p><strong>Song Data:</strong> ${meta.songs} Subsong(s) detected, starting with Song ${meta.startSong}</p>`;
                techInfo += `<p><strong>SID Core:</strong> 6502 Emulator, MOS SID 6581, 3 Voices, Analog SVF filtering</p>`;
            } else {
                techInfo = `<p><strong>File Signature:</strong> ${meta.type} (De-interleaved)</p>`;
                techInfo += `<p><strong>Length:</strong> ${trackData.length} Frames @ 50Hz VBLANK</p>`;
                
                if (meta.digidrumCount > 0) {
                    techInfo += `<p style="margin-top: 5px;"><strong>PCM Data:</strong> ${meta.digidrumCount} Digidrum(s) detected!</p>`;
                    let sizes = meta.digidrumSizes.map(s => s.toLocaleString('de-DE') + ' Bytes').join(' / ');
                    techInfo += `<p style="font-size: 0.9em; margin-left: 10px; color: var(--text-color); opacity: 0.8;">> Sample sizes: [ ${sizes} ]</p>`;
                } else {
                    techInfo += `<p style="margin-top: 5px;"><strong>PCM Data:</strong> None. 100% pure synthesized chip magic.</p>`;
                }
            }

            // Tracker-Design (border-left statt dashed border!)
            let dynamicHTML = `
                <div style="margin-top: 15px; padding: 10px 15px; background: rgba(0,0,0,0.2); border-left: 4px solid var(--highlight-color); position: relative;">
                    <p style="color: var(--highlight-color); margin-bottom: 8px;"><strong>[ BINARY FILE ANALYSIS ]</strong></p>
                    ${techInfo}
                </div>
            `;

            // ROBUSTE ABSICHERUNG: Fallback falls der Import durch Scoping-Probleme blockiert ist
            const systemText = (typeof systemDescriptions !== 'undefined' && systemDescriptions[system]) 
                ? systemDescriptions[system] 
                : '<p style="color: var(--text-color);">[ Museumdatenarchiv geladen, Beschreibung temporär nicht verfügbar ]</p>';

            // Museum füllen
            document.getElementById('info-text').innerHTML = `
                <div style="margin-bottom: 20px;">
                    <h2 style="color: var(--highlight-color);">> NOW PLAYING:</h2>
                    <p style="font-size: 1.2em; padding-top: 5px;">${selectedSong.title}</p>
                </div>
                
                ${dynamicHTML}
                
                <div style="margin-top: 30px; padding-top: 15px;">
                    ${systemText}
                </div>
                <p class="blinking-cursor" style="margin-top: 15px;">_</p>
            `;
            startPlayback();
            
        } catch (err) {
            alert("FEHLER BEIM LADEN: " + err.message);
            currentScrollerText = "+++ ERROR LOADING FILE +++";
        }
    } else {
        // Der alte Weg (Generatoren)
        const systemText = (typeof systemDescriptions !== 'undefined' && systemDescriptions[system]) 
            ? systemDescriptions[system] 
            : '<p style="color: var(--text-color);">[ Museumdatenarchiv geladen ]</p>';

        document.getElementById('info-text').innerHTML = `
            <div style="margin-bottom: 20px;">
                <h2 style="color: var(--highlight-color);">> NOW PLAYING:</h2>
                <p style="font-size: 1.2em; padding-top: 5px;">${selectedSong.title}</p>
            </div>
            ${selectedSong.composerInfo}
            
            <div style="margin-top: 30px; padding-top: 15px;">
                ${systemText}
            </div>
            <p class="blinking-cursor" style="margin-top: 15px;">_</p>
        `;
        currentScrollerText = "+++ NOW PLAYING: " + selectedSong.title + " +++";
        trackData = selectedSong.generator();
        startPlayback();
    }
}

// --- DYNAMISCHER SUBSONG-WECHSEL (Echtzeit!) ---
function changeC64Subsong(subsongId) {
    if (!sidNode || !trackData || !trackData.isSidFile) return;

    // Signalisiere der CPU das Umschalten des Subsongs im Audio-Thread
    sidNode.port.postMessage({ type: 'CHANGE_SUBSONG', frame: subsongId });
    currentSubsongIndex = subsongId;

    // BUGFIX: Absicherung falls lengths undefiniert ist
    let sldbLengths = trackData.lengths || [180];
    let songLengthSeconds = sldbLengths[subsongId - 1] || sldbLengths[0] || 180;
    trackData.length = songLengthSeconds * 50; // Frameanzahl aktualisieren

    // Slider-Timeline hart zurücksetzen
    lastKnownFrame = 0;
    previousFrame = 0;
    document.getElementById('time-current').innerText = "00:00";
    document.getElementById('time-total').innerText = formatTime(trackData.length);
    document.getElementById('progress-slider').value = 0;

    // Subsong-Anzeige aktualisieren
    const subsongDisplay = document.getElementById('subsong-display');
    if (subsongDisplay) {
        subsongDisplay.innerText = `[SUB ${subsongId}/${trackData.metadata.songs}]`;
    }

    // Scroller-Text aktualisieren
    let meta = trackData.metadata;
    currentScrollerText = `+++ BOOM! SWITCHED TO SUBSONG ${subsongId} OF ${meta.songs} +++ NOW PLAYING: ${meta.name.toUpperCase()} (TRACK ${subsongId}) BY ${meta.author.toUpperCase()} +++ `;
    
    console.log(`[C64 JUKEBOX] Switched to Subsong ${subsongId} / ${meta.songs} (${songLengthSeconds}s)`);
}

// --- BUTTON EVENTS ---
document.getElementById('btn-play').addEventListener('click', () => {
    // NEU: iOS SAFARI FIX!
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();

    if (isPlaying) {
        stopPlayback(); 
    } else {
        trackData.length === 0 ? selectAndPlayTrack(0, activeSystem) : resumePlayback();
    }
});

document.getElementById('btn-next').addEventListener('click', () => {
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); // iOS FIX

    // Prüfen, ob wir uns auf einem C64-Track mit mehreren Subsongs befinden
    if (activeSystem === 'c64' && trackData && trackData.isSidFile) {
        const totalSongs = trackData.metadata.songs || 1;
        if (currentSubsongIndex < totalSongs) {
            // Schalte zum nächsten Subsong um und brich das Tracklist-Wechseln ab
            changeC64Subsong(currentSubsongIndex + 1);
            return; 
        }
    }

    // Normales Playlist-Wechseln
    selectAndPlayTrack((currentTrackIndex + 1) % trackRegistry[activeSystem].length, activeSystem);
});

document.getElementById('btn-prev').addEventListener('click', () => {
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); // iOS FIX

    // Prüfen, ob wir uns auf einem C64-Track mit mehreren Subsongs befinden
    if (activeSystem === 'c64' && trackData && trackData.isSidFile) {
        if (currentSubsongIndex > 1) {
            // Schalte zum vorherigen Subsong um und brich das Tracklist-Wechseln ab
            changeC64Subsong(currentSubsongIndex - 1);
            return;
        }
    }

    // Normales Playlist-Wechseln
    let prevIdx = currentTrackIndex - 1;
    if (prevIdx < 0) prevIdx = trackRegistry[activeSystem].length - 1;
    selectAndPlayTrack(prevIdx, activeSystem);
});

// Globale Variable für den Wake Lock Sensor
let wakeLock = null;

// --- PURE AUDIO / ECO MODE TOGGLE (Echte Modularisierung) ---

// FIX 2: Der unsichtbare iOS No-Sleep Video-Hack (Base64)
const noSleepVideo = document.createElement('video');
noSleepVideo.setAttribute('playsinline', '');
noSleepVideo.setAttribute('muted', '');
noSleepVideo.setAttribute('loop', '');
noSleepVideo.src = 'data:video/mp4;base64,AAAAHGZ0eXBtcDQyAAAAAG1wNDJpc29tYXZjMQAAAz5tb292AAAAbG12aGQAAAAA/8f/3v/H/+QAAALuAAAC7gABAAABAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAGGlvZHMAAAAAE//H/+QAAALuAAAC7gABAAAAAAABAAAAMXRyYWsAAABcdGtoZAAAAAD/x//e/8f/5AAAAAEAAAAAAAAC7gAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAgAAAAIAAAAgZWR0cwAAABBlbHN0AAAAAQAAAu4AAAAAAAEAAAAAAixtZGlhAAAAIG1kaGQAAAAA/8f/3v/H/+QAAALuAAAC7gABAAAAAAAxAAAAAAAvaGRscgAAAAAAAAAAdmlkZQAAAAAAAAAAAAAAAFZpZGVvSGFuZGxlcgAAAAIcbWluZgAAABR2bWhkAAAAAQAAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAcRzdGJsAAAAp3N0c2QAAAAAAAAAAQAAAJNhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAgACAEgAAABIAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAR//8AAAAxYXZjQwH0AAr/4QAZZ/QACq608AUBzgAAAwAABgAAAwivDxgXoAAAAQAAABhzdHRzAAAAAAAAAAEAAAABAAAC7gAAAABzdHNzAAAAAAAAAAEAAAABAAAAHHN0c2MAAAAAAAAAAQAAAAEAAAABAAAAHHN0c3oAAAAAAAAAAAAAAAEAAAAeAAAAFHN0Y28AAAAAAAAAAQAAADAAAAA0dWR0YQAAACxtZXRhAAAAAAAAAABoZGxyAAAAAAAAAABtZGlyYXBwbAAAAAAAAAAAAAAA';

// Funktion zum Aktivieren des ECO-Modus (Pure Audio)
async function enableEcoMode() {
    // 1. WICHTIG FÜR iOS: Video MUSS synchron im ersten Klick-Frame starten!
    noSleepVideo.play().catch(e => console.warn('iOS Video-Hack blockiert:', e));

    isEcoMode = true;
    document.getElementById('eco-overlay').classList.remove('hidden');
    
    // 2. Offizielle Wake-Lock-Methode (Desktop & Android)
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log('[SYSTEM] Wake Lock aktiv. Bildschirm bleibt an.');
        }
    } catch (err) {
        console.warn(`Wake Lock API blockiert. Fallback läuft.`);
    }
}

// Funktion zum Deaktivieren des ECO-Modus (Wieder aufwecken)
async function disableEcoMode() {
    isEcoMode = false;
    document.getElementById('eco-overlay').classList.add('hidden');
    
    // Offizielle Methode beenden
    if (wakeLock !== null) {
        await wakeLock.release();
        wakeLock = null;
    }
    
    // iOS Fallback beenden
    noSleepVideo.pause();
    
    // Trigger ein Resize-Event, damit sich die Visualisierungs-Canvases sofort neu kalibrieren
    window.dispatchEvent(new Event('resize'));
}

// KOPPLUNG DER EVENTS: Sowohl ECO-Button als auch WAKE-UP-Button steuern die Funktionen
document.getElementById('btn-eco').addEventListener('click', async () => {
    // Falls audioCtx im Hintergrund schläft, aufwecken
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();

    if (isEcoMode) {
        await disableEcoMode(); // 2. Druck schaltet den ECO-Modus aus!
    } else {
        await enableEcoMode();  // 1. Druck schaltet den ECO-Modus ein!
    }
});

document.getElementById('btn-eco-off').addEventListener('click', async () => {
    await disableEcoMode();
});

document.getElementById('volume-slider').addEventListener('input', (e) => {
    if (masterGain) masterGain.gain.value = e.target.value;
});

// --- FULLSCREEN TOGGLE LOGIK (Mit Promise-Catching & Brute-Force iOS-Support) ---

function enterPseudoFullscreen(visualZone) {
    visualZone.classList.add('pseudo-fullscreen');
    document.getElementById('btn-fullscreen').innerText = '[ EXIT ]';
    document.body.style.overflow = 'hidden'; // Scrollen der App im Hintergrund blockieren
    
    // Das Element aus dem Flex-Container herausreißen und an den Body hängen
    document.body.appendChild(visualZone);
    
    setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
}

function exitPseudoFullscreen(visualZone) {
    visualZone.classList.remove('pseudo-fullscreen');
    document.getElementById('btn-fullscreen').innerText = '[ ⛶ ]';
    document.body.style.overflow = ''; // Scrollen wieder erlauben
    
    const demoContainer = document.getElementById('demo-container');
    const playbackBar = document.getElementById('playback-bar');
    
    // Das Element exakt an seine Ursprungsposition zurückpflanzen
    if (demoContainer && playbackBar) {
        demoContainer.insertBefore(visualZone, playbackBar);
    }
    setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
}

function toggleFullscreen() {
    const visualZone = document.getElementById('visual-zone');
    
    // 1. Befinden wir uns bereits im iOS Pseudo-Vollbild?
    if (visualZone.classList.contains('pseudo-fullscreen')) {
        exitPseudoFullscreen(visualZone);
        return;
    }

    // 2. Befinden wir uns im nativen Vollbild?
    if (document.fullscreenElement || document.webkitFullscreenElement) {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        return;
    }

    // 3. Versuch: Nativer Vollbildmodus aufrufen
    try {
        if (visualZone.requestFullscreen) {
            let promise = visualZone.requestFullscreen();
            if (promise && typeof promise.catch === 'function') {
                // BUGFIX: iOS blockiert requestFullscreen auf DIVs und wirft eine Rejection.
                // Das fangen wir hier live ab und starten direkt unser CSS Fallback!
                promise.catch((err) => {
                    console.log("Native fullscreen rejected by Safari, triggering iOS Fallback.", err);
                    enterPseudoFullscreen(visualZone);
                });
            }
        } else if (visualZone.webkitRequestFullscreen) {
            visualZone.webkitRequestFullscreen();
            
            // Legacy Safari (Pre-Promise) Prüfung für ältere iPads:
            setTimeout(() => {
                if (!document.webkitFullscreenElement && !visualZone.classList.contains('pseudo-fullscreen')) {
                    console.log("Legacy webkitRequestFullscreen failed, triggering iOS Fallback.");
                    enterPseudoFullscreen(visualZone);
                }
            }, 200);
        } else {
            // Gar keine native API vorhanden -> Fallback
            enterPseudoFullscreen(visualZone);
        }
    } catch (err) {
        // Falls die native API hart abstürzt
        enterPseudoFullscreen(visualZone);
    }
}

// Beobachtet native Fullscreen-Zustandsänderungen zur Synchronisation des Button-Textes
function handleFullscreenChange() {
    const btn = document.getElementById('btn-fullscreen');
    const isNativeFS = !!(document.fullscreenElement || document.webkitFullscreenElement);
    
    if (isNativeFS) {
        btn.innerText = '[ EXIT ]';
    } else {
        // Nur wenn wir nicht im Pseudo-Modus sind, den Text zurücksetzen
        const visualZone = document.getElementById('visual-zone');
        if (visualZone && !visualZone.classList.contains('pseudo-fullscreen')) {
            btn.innerText = '[ ⛶ ]';
        }
    }
    // Canvas im VBLANK neu berechnen
    window.dispatchEvent(new Event('resize'));
}

// Event-Kopplung
document.getElementById('btn-fullscreen').addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', handleFullscreenChange);
document.addEventListener('webkitfullscreenchange', handleFullscreenChange); // Safari-Kopplung

// Event-Kopplung
document.getElementById('btn-fullscreen').addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', handleFullscreenChange);
document.addEventListener('webkitfullscreenchange', handleFullscreenChange); // Safari-Kopplung
// Event-Kopplung
document.getElementById('btn-fullscreen').addEventListener('click', () => {
    toggleFullscreen();
});

document.getElementById('btn-hud-info').addEventListener('click', () => {
    const legend = document.getElementById('hud-legend');
    legend.innerHTML = chipCheatSheets[activeSystem]; 
    legend.classList.toggle('hidden');
});

// --- Toggle für das gesamte DSP HUD ---
document.getElementById('btn-hud-toggle').addEventListener('click', (e) => {
    const hud = document.getElementById('chip-hud'); // NEU: Der Haupt-Container
    const body = document.getElementById('hud-body');
    const infoBtn = document.getElementById('btn-hud-info'); 
    const isHidden = body.classList.contains('hidden');
    
    if (isHidden) {
        body.classList.remove('hidden');
        infoBtn.classList.remove('hidden'); 
        hud.classList.remove('collapsed'); // NEU: HUD ausbreiten!
        e.target.innerText = '[-]'; 
    } else {
        body.classList.add('hidden');
        infoBtn.classList.add('hidden'); 
        hud.classList.add('collapsed'); // NEU: HUD schrumpfen!
        e.target.innerText = '[+]'; 
        
        const legend = document.getElementById('hud-legend');
        if (legend) legend.classList.add('hidden');
    }
});

// --- EMU CORE WECHSEL (Dropdown) ---
document.getElementById('core-selector').addEventListener('change', async (e) => {
    stopPlayback();
    const coreIndex = e.target.value;
    const coreConfig = workletRegistry[activeSystem][coreIndex];
    document.getElementById('hud-content') ? document.getElementById('hud-content').innerText = "RE-WIRING DSP..." : null;
    await loadEmuCore(activeSystem, coreConfig);
    // Spielt den Track automatisch mit dem neuen Chip weiter!
    startPlayback(); 
});




