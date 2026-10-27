# TECHNICAL DEEP-DIVE: THE ATARI ST YAMAHA YM2149F EMULATION ENGINE
> **"Von Nerds für Nerds" — 2 MHz Register-Dump Playback, YM6 Effect Timing & Two-Stage Polyphase DSP**

This document describes the Atari ST sound path implemented in **Chiptunes Fantasy**, with the same engineering focus as the C64 deep dive. It follows the actual parser, `ym-exact` AudioWorklet, digital YM2149 core, YM6 effect engine, resampler and output filter.

The scope is deliberately precise: this is a **cycle-stepped YM register-dump player**, not a complete Atari ST emulator. It does not execute MC68000 music programs, emulate the complete MFP 68901, or replay SNDH files. The registry name `ym-exact` identifies the hardware-oriented profile; it is not, by itself, proof of physical-chip or mainboard equivalence. Implemented digital behavior, measured software properties and open hardware calibration are kept separate below.

## 1. High-Level Signal & Execution Pipeline

The production path starts with a YM3!, YM3b, YM5! or YM6! file. Parsing produces register frames, optional Digidrum samples and timing metadata. During playback, register frames are applied at the file's player rate while the digital chip and YM6 effects advance on a fixed 2 MHz timeline.

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ FILE & TRANSPORT DOMAIN                                                      │
│                                                                              │
│  YM3! / YM3b / YM5! / YM6!                                                   │
│           │                                                                  │
│           ▼                                                                  │
│  parseYM() ───────────────► 16-byte register frames                          │
│           │                 optional Digidrum Float32Arrays                  │
│           │                 playerRate + loopFrame + metadata                │
│           ▼                                                                  │
│  PLAY_TRACK ──────────────► reset digital/effect/filter/transport state      │
│           │                                                                  │
│           ▼                                                                  │
│  sampleRate / playerRate frame scheduler                                     │
└───────────────────────────────────┬──────────────────────────────────────────┘
                                    │ one complete register frame per player tick
┌───────────────────────────────────▼──────────────────────────────────────────┐
│ 2 MHz YM LOCKSTEP DOMAIN                                                     │
│                                                                              │
│  YM6Effects.applyFrame() ─────► two effect slots / MFP-derived timing        │
│           │                                                                  │
│           │                    for every required YM cycle:                  │
│           │                                                                  │
│           └──────────────► YM6Effects.clockCycle()                           │
│                                      │ effect levels or R13 writes           │
│                                      ▼                                       │
│                            YM2149Core.clockCycle()                           │
│                             ├─ three tone dividers                            │
│                             ├─ shared 17-bit noise LFSR                       │
│                             ├─ 5-bit hardware envelope                        │
│                             ├─ active-low tone/noise mixer                    │
│                             └─ 32-level DAC + linear three-voice sum          │
│                                      │ one native sample per YM cycle         │
│                                      ▼                                       │
│                            TwoStagePolyphaseResampler.write()                │
└───────────────────────────────────┬──────────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼──────────────────────────────────────────┐
│ HOST AUDIO DOMAIN                                                            │
│                                                                              │
│  TwoStagePolyphaseResampler.process()                                        │
│           │                                                                  │
│           ▼                                                                  │
│  AtariAnalogFilter: linear 15.9 kHz LP + 25 Hz HP                            │
│           │                                                                  │
│           ▼                                                                  │
│  play/pause fade ──────────────► mono sample copied to left and right        │
│                                                                              │
│  YMVisualizer receives register, envelope, noise and channel telemetry       │
└──────────────────────────────────────────────────────────────────────────────┘
```

Two different time grids matter:

1. **Player-frame time:** complete register dumps arrive at `playerRate`, normally 50 Hz in the curated corpus.
2. **Chip-cycle time:** tone, noise, envelope and YM6 effects advance once per 2 MHz YM cycle between those dumps.

The offline measurement harness additionally accepts arbitrary cycle-stamped register events. That is a test interface; it does not mean the production YM format contains per-cycle write timestamps.

## 2. YM Parsing, Metadata & Transport (`ym-parser.js`, `app.js`, `ym-exact.js`)

### 2.1. Supported containers

`parseYM(input)` accepts a `Uint8Array` or `ArrayBuffer`; `loadYmFile(url)` retrieves bytes with `fetch` and calls the same parser. Unsupported signatures and truncated structures are rejected rather than partially played.

| Format | Implemented interpretation |
|---|---|
| **YM3!** | Interleaved 14-register frames, fixed 2 MHz / 50 Hz metadata, loop frame 0. |
| **YM3b** | YM3 layout plus a trailing big-endian loop-frame DWORD. |
| **YM5! / YM6!** | `LeOnArD!` header, 16-register frames, optional Digidrums, metadata strings, clock/rate/loop fields and `End!` marker. |

YM5/YM6 attribute bit 0 selects interleaved versus frame-serial register storage. Sample attributes distinguish signed 8-bit PCM, unsigned offset-binary PCM and already-4-bit data. Parser checks cover lengths, terminated strings, loop range, sample bounds and the final marker.

LH5/LH0-compressed input is deliberately rejected. Such files must be unpacked before they enter the player; decompression is not hidden inside the emulation loop.

### 2.2. Metadata versus the production clock contract

YM5/YM6 parsing exposes `masterClock`, `playerRate`, `loopFrame`, Digidrum counts and sample attributes. `PLAY_TRACK` forwards player rate and loop frame to the worklet.

The current production `ym-exact` processor nevertheless constructs its core and effect engine at a **fixed 2,000,000 Hz**. The forwarded `masterClock` value does not reconfigure that processor. The parser can therefore describe other clock values, but this document does not claim production support for arbitrary YM master clocks. The curated Atari playlist is tested as 2 MHz material.

SNDH is a different problem: it requires executing replay code and emulating the relevant Atari hardware. It is outside this register-dump path.

### 2.3. Frame advance and loops

For each host output sample, the worklet decrements `sampleCounter`. When it reaches zero or below, it adds:

\[
\Delta\text{counter}=\frac{\text{sampleRate}}{\text{playerRate}}
\]

It then writes all 16 registers from the current frame, applies the YM6 effect descriptors, advances `currentFrame`, and jumps to `loopFrame` after the final frame. Invalid or absent loop metadata falls back to frame 0.

The UI, seek slider and Media Session convert frames to seconds with the same player-rate contract. A stored loop to frame 0 remains a loop; it is not confused with an automatic next-track request.

### 2.4. Reset, pause and seek semantics

- **`PLAY_TRACK`** resets the digital core, effects, resampler, output filter, frame counter, fade and displayed channel levels. Restarting a track is therefore bit-identical to starting it in a fresh processor.
- **`STOP_TRACK` / `RESUME_TRACK`** change only the playing state. Digital, effect and transport state remain intact while the output fade runs.
- **`SEEK_TRACK`** changes the frame index and resets YM6 effect progress. It does not reset or fast-forward the YM core, resampler or output filter. Seeking is consequently a frame jump, not a reconstruction of every hardware state that arbitrary historical playback might have produced.

## 3. The Digital YM2149 Core (`ym2149-core.js`)

`YM2149Core` owns 16 byte registers and the complete digital state advanced by `clockCycle()`. Periods and fixed volume levels are cached on register writes so the 2 MHz loop does not repeatedly reassemble them.

### 3.1. Three square-wave tone generators

Each voice has a 12-bit period assembled from its register pair. Period zero is treated as one. On every YM cycle the voice divider decrements; when it expires, it reloads to `8 * period` and toggles the tone output.

A full square-wave cycle contains two toggles:

\[
f_\text{tone}=\frac{2{,}000{,}000}{16\,\max(TP,1)}
\]

There are no wavetable oscillators or host-rate phase increments in the Exact path. The square wave exists as a digital gate on the native YM timeline before resampling.

### 3.2. Shared 17-bit noise generator

The noise period uses the low five bits of R6, again with zero treated as one. Its divider reloads to `16 * periodN`. At each noise step, the core shifts the 17-bit LFSR right, feeds `bit0 XOR bit3` into bit 16, and exposes the old bit 0 as `noiseOut`.

All three voices share this single generator. R7 decides independently for each voice whether tone and/or noise reach its amplitude gate.

### 3.3. Active-low mixer logic

R7 disable bits are active low. In Boolean terms, the implemented gate for each voice is:

\[
\text{gate}=(\text{toneDisable}\lor\text{toneOut})\land
            (\text{noiseDisable}\lor\text{noiseOut})
\]

A passing gate selects the current DAC amplitude; a blocked gate contributes zero. This is a unipolar amplitude model, not a bipolar `+1/-1` square wave.

### 3.4. The 5-bit hardware envelope

R11/R12 form the envelope period, R13 selects its shape, and R8–R10 bit 4 routes a voice to the envelope instead of fixed volume. The envelope has 32 amplitude levels, not merely the 16 fixed-volume positions.

Writing R13, except for the dump convention `$FF`, immediately:

- masks the shape to four bits;
- resets the envelope position;
- selects level 31 for falling shapes or level 0 for rising shapes;
- loads the divider with `8 * max(periodE, 1)`.

Each subsequent envelope step therefore takes `8 * periodE` YM cycles, and a 32-step ramp takes `256 * periodE` cycles. `$FF` leaves both register 13 and the running envelope state untouched.

| R13 | Implemented sequence |
|---:|---|
| 0–3 | Falling ramp once, then 0 |
| 4–7 | Rising ramp once, then 0 |
| 8 | Repeated falling ramp |
| 9 | Falling ramp once, then 0 |
| 10 | Alternating falling/rising ramps |
| 11 | Falling ramp once, then hold 31 |
| 12 | Repeated rising ramp |
| 13 | Rising ramp once, then hold 31 |
| 14 | Alternating rising/falling ramps |
| 15 | Rising ramp once, then 0 |

This describes the implemented state machine and its regression tests. It is not a new claim that every envelope-start nuance has been measured on physical YM2149F silicon.

## 4. YM6 Effects & MFP-Derived Timing (`ym6-effects.js`)

YM6 packs two software-effect slots into register fields. The effect engine decodes these descriptors at player-frame boundaries but advances their timers on every YM cycle.

### 4.1. Effect-slot register map

| Field | Slot 0 | Slot 1 |
|---|---|---|
| Effect type and target voice | R1 bits 7–4 | R3 bits 7–4 |
| MFP predivisor selector | R6 bits 7–5 | R8 bits 7–5 |
| Timer count | R14 | R15 |
| Effect parameter | Target voice's volume register | Target voice's volume register |

An active command needs a nonzero voice, predivisor and timer count. R14/R15 are timer-count fields in this model, not generic standalone Digidrum triggers.

The implemented timer frequency is:

\[
f_\text{timer}=\frac{2{,}457{,}600}
                     {\text{predivisor}\times\text{timerCount}}
\]

with the selector table:

```text
[stopped, 4, 10, 16, 50, 64, 100, 200]
```

### 4.2. Integer phase accumulation on the YM timeline

A newly started slot computes:

```text
timerThreshold = ymClock * predivisor * timerCount
timerPhase     = timerThreshold
```

On every 2 MHz YM cycle, an event consumes `timerThreshold` when due, and the slot then adds `MFP_CLOCK` (2,457,600) to its phase. Initializing the phase to the threshold makes the first event occur at the next YM cycle.

This integer ratio avoids accumulated floating-point timer-rate error. Unchanged continuous commands retain phase across register frames; every active Digidrum command retriggers its sample. The engine models the timing required by YM6 effect descriptors, not the entire physical MFP peripheral.

### 4.3. Four effect types

| Effect | Implemented behavior at timer events |
|---|---|
| **Digidrum** | Converts the normalized sample to a 4-bit amplitude nibble, maps it to a 5-bit DAC level, and overrides the selected voice. The final sample remains for a full timer step before the register-controlled level returns. |
| **SID-Voice** | Alternates the selected voice between zero and its programmed maximum level. |
| **Sinus-SID** | Cycles through eight levels derived from `round(VMAX * (1 + sin(position * π/4)) / 2)`. |
| **Sync-Buzzer** | Writes the encoded shape to R13 at timer events, restarting the hardware envelope state machine. |

For Digidrum, SID-Voice and Sinus-SID, the core is also told to force the selected amplitude gate open. These effects therefore reuse the YM volume/DAC path; they are not presented as an additional native PCM channel inside a YM2149.

## 5. DAC Mapping & Linear Three-Voice Summing

Fixed volume register value 0 is silent. Nonzero fixed values use:

\[
L_5=2V_4+1
\]

Envelope-controlled voices use the 5-bit envelope level directly. Digidrums and the other level-based YM6 effects enter the same 32-position domain.

`YM2149_DAC32` maps that domain to the project's 32-level logarithmic amplitude table. Each voice contributes either zero or its selected table value, after which the core sums all three contributions linearly:

\[
y=(D_A+D_B+D_C)\times\frac{0.42}{1+0.22\times3}
\]

The output scale preserves the previous three-voice full-scale convention. It is a level-continuity choice, not a measured Atari mainboard transfer function.

The Exact path contains no additional nonlinear bus compressor and no `tanh` saturation. This makes voice addition, reset behavior and raw measurements deterministic, but it does not establish physical DAC or motherboard accuracy. Real DAC and output-stage calibration remain open evidence requirements.

## 6. Two-Stage Polyphase Resampling (`polyphase-resampler.js`)

The core produces one sample per 2 MHz YM cycle. Sending that stream directly to a 44.1/48/96 kHz audio device would alias its high-frequency content, so `ym-exact` uses a two-stage, band-limited cascade:

```text
2 MHz ──► 4 × output rate ──► output rate
          intermediate rate
```

Both stages are causal, odd-tap, linear-phase Kaiser-windowed-sinc polyphase filters. Each stage has 256 fractional phases plus an explicit endpoint and linearly interpolates adjacent kernels at runtime.

- Requested passband: 20 kHz, limited internally to `0.45 * stageOutputRate`.
- Design attenuation: 96 dB.
- First-stage maximum stopband: intermediate Nyquist.
- Final-stage stopband: output Nyquist.
- Ring buffers and coefficient tables: allocated during setup/reset, not per output sample.
- Streaming output: independent of AudioWorklet block partitioning in the regression tests.

At 44.1 kHz, the `0.45 * rate` bound makes the effective per-stage passband limit 19.845 kHz. The archived 20 kHz response is still measured and reported separately rather than replaced by the requested design label.

### 6.1. Measured digital-filter properties

These figures describe the implemented software cascade, not an Atari analogue circuit:

| Output rate | Taps, stage 1 + 2 | Constant group delay | Worst 20 kHz passband response | Worst response at stopband start |
|---:|---:|---:|---:|---:|
| 44.1 kHz | 181 + 493 | 1.439558 ms | −0.010446 dB | −99.463 dB |
| 48 kHz | 163 + 297 | 0.811333 ms | −0.000101 dB | −102.999 dB |
| 96 kHz | 73 + 87 | 0.129979 ms | −0.000079 dB | −98.939 dB |

All 256 phases of both stages are checked for finite coefficients, normalized DC gain and impulse position. Streamed tests additionally cover passband gain, above-Nyquist rejection, declared group delay and block-size independence.

The delay is explicit and constant; it is not hidden or described as zero latency.

## 7. Output Filter, Fade & Mono Presentation (`dsp-utils.js`, `ym-exact.js`)

After resampling, `AtariAnalogFilter` applies two linear one-pole stages:

1. a declared 15.9 kHz low-pass;
2. a declared 25 Hz high-pass.

Tests at 44.1, 48 and 96 kHz place both measured corner regions within 0.05 dB of −3 dB. The filter is resettable and linear in the tested sense: doubling its input doubles its output when starting from identical state.

These are software-model properties. No measurement of a physical Atari ST mainboard established the component values or the complete response, so the class name `AtariAnalogFilter` must not be read as a hardware-calibration claim.

A per-output-sample fade moves by 0.002 toward 1 while playing and toward 0 while stopped. It avoids an instantaneous playback-edge step. The final mono sample is copied to both output channels; the Exact worklet does not invent stereo panning for the three YM voices.

Visualizer telemetry is derived from actual registers and core state: tone periods, noise output, envelope level and current per-voice DAC amplitudes. It is not an independent random animation of the sound engine.

## 8. Offline Measurement, Performance & Regression Evidence

### 8.1. Raw-chip measurement harness

`YMOfflineHarness` separates the digital core from browser audio. Setup accepts events such as:

```js
{ cycle: 40000, register: 13, value: 0x0A }
```

Events are stably sorted by cycle, all writes for a cycle are applied first, and exactly one `YM2149Core.clockCycle()` follows. The harness exposes:

- one raw `Float32Array` value per YM cycle;
- preallocated register/divider/LFSR/envelope/volume traces;
- deterministic mono IEEE-float32 WAV export;
- CSV state-trace export.

The raw tap includes the implemented DAC and summing model but bypasses resampling, `AtariAnalogFilter` and master DSP. Production YM6 effects are tested separately and injected in the worklet between effect timing and the core clock.

### 8.2. Hot-path structure

The production review documents these bounded optimizations:

- tone, noise and envelope periods cached on register writes;
- fixed 5-bit levels cached on volume writes;
- explicit clearing of the three effect override levels;
- four-coefficient mono FIR loop unrolling without changing accumulation order.

No object or array allocation was found in the documented digital, effect, resampler and per-sample worklet hot paths. Visualizer storage is preallocated. Digidrum debug messages remain event-driven rather than being emitted per YM cycle.

### 8.3. Measured production behavior

Sixty-second production renders of `WINGLEV1.YM`, `Turrican2_TheDesertRocks.YM` and `GOLDRUN.YM` were deterministic and finite in the supplied Linux sandbox. Their measured processing budgets were approximately 25–28% of rendered audio duration. This is a local performance observation, not a guarantee for other computers or phones.

Real Chromium `AudioContext`/`AudioWorkletNode` checks covered 44.1 and 48 kHz at desktop and mobile-emulation viewports. Analyser activity confirms a running production path; it does not prove glitch-free loudspeaker output or replace controlled listening tests.

Reproduction commands and complete measurements are in:

- `doc/specs/emulation/atari/ym-measurement-harness.md`
- `doc/specs/emulation/atari/ym-performance-browser.md`

### 8.4. What the hashes mean

The synthetic raw/trace/WAV hashes and production-worklet hashes are **self-generated regression anchors**. They detect unintended changes in deterministic software output. They are not captured hardware truth and must not be used to claim physical YM2149F or Atari ST agreement.

Baselines may only be re-pinned after the relevant behavior change has been reviewed and its digital, streaming and transport tests have passed.

## 9. Exact Versus the Artistic Atari Cores

The Atari registry contains four separate processors:

| Registry ID | Role in this architecture |
|---|---|
| `ym-exact` | The cycle-stepped register-dump path documented here. |
| `ym-standard` | A lighter host-rate digital approximation with a separate Digidrum path. |
| `ym-fantasy` | An artistic synthesis/staging engine with additional waveforms, filters and effects. |
| `ym-bladerunner` | An artistic cinematic stereo interpretation with modulation, filters and effects. |

Features of the artistic processors—additional oscillators, stereo detuning, random-noise processing, synthesizer filters, delays or sidechain behavior—must not be attributed to `ym-exact` or to a physical YM2149F. Keeping these engines separate allows creative DSP to evolve without silently changing the hardware-oriented baseline.

## 10. Evidence Boundary & Implementation Map

The current evidence supports deterministic execution of the documented parser, digital state machines, YM6 timing rules, linear mixing, resampling and output filters. It does **not** complete:

- real-chip DAC linearity and level calibration;
- physical Atari ST mainboard/output-stage identification;
- controlled listening tests on reference hardware;
- MC68000/MFP/SNDH replay;
- production playback at arbitrary non-2-MHz YM master clocks;
- universal claims for every YM encoder, malformed dump or undocumented effect convention.

### Primary implementation files

| Area | Source |
|---|---|
| YM container parsing | `js/parsers/ym-parser.js` |
| Browser transport messages | `js/app.js` |
| Production Exact worklet | `js/worklets/atari/ym-exact.js` |
| Digital YM state machines | `js/worklets/lib/ym2149-core.js` |
| YM6 effects and timer phase | `js/worklets/lib/ym6-effects.js` |
| DAC table and output filter | `js/worklets/lib/dsp-utils.js` |
| Two-stage resampling | `js/worklets/lib/polyphase-resampler.js` |
| Raw offline harness | `js/worklets/lib/ym-offline.js` |
| Worklet selection | `js/worklets/registry.js` |

### Focused verification

```bash
node --test \
  test/ym-parser.test.mjs \
  test/ym-transport.test.mjs \
  test/ym-core.test.mjs \
  test/ym6-effects.test.mjs \
  test/ym-resampler.test.mjs \
  test/ym-exact.test.mjs

node tools/ym-worklet-render.mjs \
  --input tracks/atari/Giana_Title.YM \
  --seconds 10 --sample-rate 48000 --repeat 2 \
  --report /tmp/giana-report.json
```

The result is an Atari path whose abstractions are intentionally narrower than a full machine emulator—and therefore clearer to test: register dumps in, deterministic 2 MHz digital state evolution in the middle, measured band-limited host-rate audio out.
