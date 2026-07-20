// === js/visuals/dse/registry.js ===
// =========================================================
// DEMO-SCENE-ELEMENT (DSE) REGISTRY & METADATA SCHEMAS
// Features a fluent Builder Pattern for strict separation of
// Z-Order (layer), behavior (lifecycle), and concurrency limits.
// Upgraded with Diagnostic Testing features (disabled & exclusive)
// =========================================================

import { LimitBar } from './universal/limit-bar.js';
import { Copperbars } from './universal/copperbars.js';
import { VoidElement } from './universal/void-element.js'; 
import { C64RetroSunset } from './c64/retro-sunset.js';
import { AmigaRetroSunset } from './amiga/retro-sunset.js';
import { AtariRetroSunset } from './atari/retro-sunset.js';
import { Starfield } from './universal/starfield.js'; 
import { AmigaCube } from './amiga/glenz-cube.js';
import { AtariBobs } from './atari/lissajous-bobs.js';
import { ChunkyPlasma } from './c64/chunky-plasma.js';
import { KefrensCheckerboard } from './amiga/kefrens-checkerboard.js';
import { WireframeMorph } from './atari/wireframe-morph.js';
import { TrackPresenter } from './universal/track-presenter.js';
import { AmigaBoingBall } from './amiga/boing-ball.js';
import { AtariDotTorus } from './atari/dot-torus.js';
import { SidSiliconBg } from './c64/sid-silicon-bg.js';
import { PaulaSiliconBg } from './amiga/paula-silicon-bg.js';
import { YmSiliconBg } from './atari/ym-silicon-bg.js';
import { C64VectorStar } from './c64/vector-star.js';

// =========================================================
// FLUENT BUILDER PATTERN (1 Funktion je Attribut)
// =========================================================
class DseBuilder {
    constructor(DseClass) {
        this.Class = DseClass;
        this.meta = {
            name: DseClass.name || 'UnnamedDSE',
            systems: ['all'],
            layer: 'foreground',       // Visuelle Z-Order (background, floor, foreground, overlay)
            lifecycle: 'managed',      // Verhalten (managed, permanent, oneshot)
            maxInstances: 1,           // Maximal gleichzeitige Instanzen im aktiven Render-Pool
            weight: 10,                // Roulette-Gewichtung
            duration: 15.0,            // Mindest-Laufzeit (managed) oder absolute Lebensdauer (oneshot)
            climaxHold: 10.0,          // Nachbrennzeit des Climax
            isVoid: false,             // Marker für unsichtbare Platzhalter
            isDisabled: false,         // Schaltet das Element für Tests komplett ab
            isExclusive: false         // Blendet alle anderen managed Elemente für Tests aus
        };
    }

    name(val) { this.meta.name = val; return this; }
    systems(...sys) { this.meta.systems = sys.length ? sys : ['all']; return this; }
    layer(val) { this.meta.layer = val; return this; }
    lifecycle(val) { this.meta.lifecycle = val; return this; }
    maxInstances(val) { this.meta.maxInstances = val; return this; }
    weight(val) { this.meta.weight = val; return this; }
    duration(val) { this.meta.duration = val; return this; }
    climaxHold(val) { this.meta.climaxHold = val; return this; }
    isVoid() { this.meta.isVoid = true; return this; }
    
    // --- DIAGNOSE FUNKTIONEN FÜR TESTING/DEBUGGING ---
    disabled() { this.meta.isDisabled = true; return this; }
    exclusive() { this.meta.isExclusive = true; return this; }

    build() {
        // Compile-Time Validierung, schützt vor fehlerhafter DSE-Deklaration
        const validLayers = ['background', 'floor', 'foreground', 'overlay'];
        if (!validLayers.includes(this.meta.layer)) throw new Error(`[DSE Schema] ${this.meta.name}: Invalid layer.`);
        
        const validLifecycles = ['managed', 'permanent', 'oneshot'];
        if (!validLifecycles.includes(this.meta.lifecycle)) throw new Error(`[DSE Schema] ${this.meta.name}: Invalid lifecycle.`);

        return { Class: this.Class, metadata: this.meta };
    }
}

// Wrapper für syntaktischen Zucker
const RegisterDSE = (DseClass) => new DseBuilder(DseClass);

// =========================================================
// THE OFFICIAL SETLIST REGISTRY
// =========================================================
export const dseRegistry = [
    
    // --- OVERLAYS ---
    RegisterDSE(LimitBar)
        .layer('overlay')
        .lifecycle('permanent') // Dauerhaft auf dem Monitor
        .weight(1)
        .duration(0)
        .climaxHold(0)
        .build(),

    // --- PRESENTERS (One-Shot Overlays) ---
    RegisterDSE(TrackPresenter)
        .layer('overlay')       
        .lifecycle('oneshot')   
        .duration(3.0)          
        .weight(10)
        .climaxHold(0)
        .build(),

    // --- BACKGROUNDS ---
    RegisterDSE(Starfield)
        .layer('background')
        .weight(7)
        .duration(15.0)
        .climaxHold(8.0)
        .build(),
    
    RegisterDSE(C64RetroSunset)
        .systems('c64')
        .layer('background')
        .weight(10)
        .duration(15.0)
        .climaxHold(12.0)
        .build(),

    RegisterDSE(AmigaRetroSunset)
        .systems('amiga')
        .layer('background')
        .weight(10)
        .duration(15.0)
        .climaxHold(12.0)
        .build(),

    RegisterDSE(AtariRetroSunset)
        .systems('atari')
        .layer('background')
        .weight(10)
        .duration(15.0)
        .climaxHold(12.0)
        .build(),

    RegisterDSE(ChunkyPlasma)
        .systems('c64')
        .layer('background')
        .weight(12)
        .duration(12.0)
        .climaxHold(10.0)
        .build(),

    // --- SYSTEM EXCLUSIVE BACKGROUNDS (Living Silicon) ---
    RegisterDSE(SidSiliconBg)
        .systems('c64')
        .layer('background')
        .weight(12)
        .duration(12.0)
        .climaxHold(10.0)
        .build(),

    RegisterDSE(PaulaSiliconBg)
        .systems('amiga')
        .layer('background')
        .weight(12)
        .duration(12.0)
        .climaxHold(10.0)
        .build(),

    RegisterDSE(YmSiliconBg)
        .systems('atari')
        .layer('background')
        .weight(12)
        .duration(12.0)
        .climaxHold(10.0)
        .build(),

    RegisterDSE(VoidElement)
        .name('VoidBackground')
        .layer('background')
        .weight(5)
        .duration(15.0)
        .isVoid()
        .build(),

    // --- FLOORS ---
    RegisterDSE(Copperbars)
        .layer('floor')
        .weight(8)
        .duration(15.0)
        .climaxHold(12.0)
        .build(),
        
    RegisterDSE(KefrensCheckerboard)
        .systems('amiga')
        .layer('floor')
        .weight(12)
        .duration(12.0)
        .climaxHold(15.0)
        .build(),

    RegisterDSE(VoidElement)
        .name('VoidFloor')
        .layer('floor')
        .weight(8)
        .duration(15.0)
        .isVoid()
        .build(),
    
    // --- FOREGROUNDS ---
    RegisterDSE(AmigaCube)
        .systems('amiga')
        .layer('foreground')
        .weight(10)
        .duration(15.0)
        .climaxHold(15.0)
        .maxInstances(1) 
        .build(),

    RegisterDSE(AmigaBoingBall)
        .systems('amiga')
        .layer('foreground')
        .weight(12)
        .duration(12.0)
        .climaxHold(15.0)
        .build(),

    RegisterDSE(AtariDotTorus)
        .systems('atari')
        .layer('foreground')
        .weight(12)
        .duration(12.0)
        .climaxHold(15.0)
        .build(),
    
    RegisterDSE(WireframeMorph)
        .systems('atari')
        .layer('foreground')
        .weight(12)
        .duration(12.0)
        .climaxHold(15.0)
        .build(),

    RegisterDSE(AtariBobs)
        .systems('atari')
        .layer('foreground')
        .weight(10)
        .duration(15.0)
        .climaxHold(10.0)
        .build(),

    // Der rotierende, interaktive C64 Vektor-Stern
    RegisterDSE(C64VectorStar)
        .systems('c64')
        .layer('foreground')
        .weight(12) 
        .duration(12.0)
        .climaxHold(15.0)
        .build(),

    RegisterDSE(VoidElement)
        .name('VoidForeground')
        .layer('foreground')
        .weight(5)
        .duration(15.0)
        .isVoid()
        .build()

]; // Ende der Registry