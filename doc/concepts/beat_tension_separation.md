By strictly separating **Macro-Dynamics (Tension/State)** from **Micro-Dynamics (Real-time Beat)**, we give DSE creators a incredibly powerful and clean toolset. 

Currently, DSEs are misusing `metrics.pulse[0]` (which fluctuates wildly frame-by-frame) and applying their own internal smoothing/lerping to react to beats. This leads to inconsistent visual pumping across different effects.

Here is the architectural plan to implement a centralized, zero-allocation **Beat Detector & Envelope** into the `SceneDJ`, and how we will route it to the DSEs.

---

### 📝 Implementation Plan: The "Beat & Tension" Separation

#### 1. The Core Concept
*   **Tension (Macro):** Represents the song's structural progression (`playing` -> `buildup` -> `climax`). This will control the **"What and How Fast"** (e.g., base rotation speed, spawning rates, unlocking new movement patterns like the Copperbar-Twist or Atari CPU-Glitches).
*   **Beat (Micro):** A brand new, perfectly shaped exponential decay envelope (0.0 to 1.0). This will control the **"Instantaneous Punch"** (e.g., the scale of the Amiga Cube, the glow of the sunset, the thickness of the Copperbars).

#### 2. Phase 1: Expanding the `SceneDJ` Metrics (Zero-Allocation)
We will introduce a dedicated Beat Detector inside the DJ's `analyzeEnergy` function.
*   Allocate a new metric: `this.beatEnvelope = new Float32Array(1);`
*   **Trigger Logic:** If `transientPulse[0]` crosses a certain system-specific threshold (meaning a kick or snare hit), we snap `beatEnvelope[0] = 1.0` instantly.
*   **Decay Logic:** On frames without a hard transient, we smoothly decay the envelope using a frame-rate independent multiplier (e.g., `beatEnvelope[0] *= Math.max(0, 1.0 - (dt * 12.0))`).
*   **Routing:** We expose this to the DSEs by adding `beat: this.beatEnvelope` to the `this.metrics` payload.

#### 3. Phase 2: Updating the DSEs (Refactoring existing logic)
We will go through our existing DSEs and strip out their custom pulse-smoothing hacks, replacing them with the centralized `metrics.beat[0]`.

*   **`Copperbars`:** 
    *   *Tension:* Drives the base speed and unlocks the `twist` math.
    *   *Beat:* Replaces the direct `pulse` connection. `metrics.beat[0]` will drive the instant thickness (`punch`) and the intensity of the twist, ensuring they pump flawlessly in sync.
*   **`AmigaCube`:** 
    *   *Tension:* Controls rotation speed (`rx`, `ry`, `rz`).
    *   *Beat:* Bound directly to the `scaleMultiplier`, causing the cube to perfectly bounce to the kick drum without needing internal smoothing accumulators.
*   **`RetroSunset`:**
    *   *Tension:* Controls the speed of the water waves and the overall sky alpha.
    *   *Beat:* Bound to `this.sunPulse`. The sun will pump, and the water reflections will scatter exactly on the beat.
*   **`LimitBar`:**
    *   *Beat:* We can replace the `performance.now() % 150` strobe flashing in the Climax state. Instead, the borders will flash purely based on `metrics.beat[0] > 0.5`, tying the visuals directly to the audio track rather than a static timer!

#### 4. The Architectural Benefit
By doing this, any future developer writing a new DSE doesn't need to write complex audio-reaction math. If they want an element to blink or bounce to the music, they literally just multiply their size or opacity by `metrics.beat[0]`. If they want their effect to spin faster during a drop, they check `state === 'climax'`. It makes the DSE template incredibly clean.

---


