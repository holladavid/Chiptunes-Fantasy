# YM2149 Phase 0 Measurement Harness

## Scope

The Phase 0 harness makes the production YM2149 digital core measurable without a DOM or `AudioWorklet`. It is a refactoring and regression foundation, not a claim that the current envelope start, YM6 effects, DAC mapping, summing model or output filters are hardware-correct.

The signal path is:

```text
cycle-stamped register events -> YM2149Core.clockCycle() -> raw Float32 output -> IEEE-float WAV
                                      |
                                      +-> cycle/state trace
```

The raw tap is before the polyphase resampler, `AtariAnalogFilter` and master DSP. It includes the current DAC and summing model so that the Phase 0 refactor remains comparable with the production core. The raw harness remains a register-only core harness; Phase 2 effects have their own cycle-level tests and are applied between effect timing and `YM2149Core.clockCycle()` in the production worklet.

## Event and cycle contract

An event is a setup-time object:

```js
{ cycle: 40000, register: 13, value: 0x0A }
```

- `cycle` is zero-based and must lie inside the requested render.
- Registers 0 through 15 and byte values 0 through 255 are accepted.
- Events may be unsorted. Setup sorts them by cycle while preserving input order within a cycle.
- All writes for a cycle are applied before exactly one `YM2149Core.clockCycle()` call.
- R13 value `$FF` preserves the current envelope state, matching the production register-dump convention.
- Trace storage is preallocated; the harness and digital core perform no object or array allocation in the cycle loop.

## Outputs

`renderYMOffline()` returns:

- `raw`: one `Float32Array` value per YM clock;
- `trace`: preallocated state snapshots on the requested cycle grid;
- `ym`: the final `YM2149Core` state.

The trace contains cycle number, raw output, all 16 registers, three tone dividers and outputs, noise divider/LFSR/output, envelope divider/position/shape/level and three current channel amplitudes.

`encodeYMWav()` writes deterministic mono IEEE-float32 WAV at the native 2 MHz clock by default. `ymTraceToCsv()` exports the state trace without normalization, filtering or quantization.

## Commands

```bash
# Check every archived Phase 0 case.
node tools/ym-render.mjs --case all --check

# Render raw PCM, WAV, JSON metadata and a CSV state trace.
node tools/ym-render.mjs --case tone-a --out artifacts/ym --raw --trace

# Run focused parser, timing, core and production-worklet tests.
node --test test/ym-parser.test.mjs test/ym-transport.test.mjs test/ym-core.test.mjs test/ym6-effects.test.mjs test/ym-resampler.test.mjs test/ym-exact.test.mjs

# Re-pin only after a reviewed emulation change.
node tools/ym-render.mjs --case all --update-baseline
```

## Phase 1 digital behavior

- Writing R13, except for the `$FF` no-write convention, immediately selects level 31 for falling shapes and level 0 for rising shapes. The envelope divider starts at `8 * max(period, 1)`, so the first level lasts a full step.
- Fixed volume register value 0 maps to silent DAC level 0. Other fixed values use the existing `2 * value + 1` mapping; envelope mode uses the 5-bit level directly.
- `PLAY_TRACK` resets the digital core, effect progress, cycle accumulator, resampler ring, output filters, fade and displayed channel levels. `STOP_TRACK` and `RESUME_TRACK` do not reset the digital or transport state.
- Envelope hold/continue selection uses shape bits rather than allocating a table on each envelope tick.

## Phase 2 YM6 effect timing

`js/worklets/lib/ym6-effects.js` decodes both YM6 effect slots independently. R14/R15 are timer-count fields only; they are not generic Digidrum triggers. Timer frequency is `2457600 / predivisor / timerCount`, with the MFP predivisor table `[stopped, 4, 10, 16, 50, 64, 100, 200]`.

The effect clock uses integer phase accumulation on the 2 MHz YM timeline. Each YM cycle adds 2,457,600 to a slot phase; an event consumes `ymClock * predivisor * timerCount`. This avoids accumulated floating-point rate error. A newly started effect schedules its first event at the next YM cycle. Unchanged continuous commands retain their phase across VBLs, while every Digidrum command re-triggers its sample.

Unsigned 8-bit Digidrum data uses its upper four amplitude bits. Nibble zero is silent and nonzero nibbles use the existing `2 * n + 1` DAC-level mapping. The last sample remains for a full timer step; afterwards the voice returns to its current register volume. SID-Voice alternates 0/VMAX, Sinus-SID loops eight levels derived from `round(VMAX * (1 + sin(position * pi / 4)) / 2)`, and Sync-Buzzer writes the encoded R13 shape at timer events. These are digital format rules, not an analog or real-hardware calibration claim.

Focused checks cover exact event cycles, both known corpus timer classes, all 16 unsigned amplitude nibbles, retriggering, effect end, continuous phase, both slots, SID-Voice, Sinus-SID and Sync-Buzzer. Five-second production renders of the five listed reference tracks are finite and repeatable. Only `WINGLEV1.YM` (6083.168317 Hz) and `Turrican2_TheDesertRocks.YM` (6023.529412 Hz) contain active YM6 timer commands in the supplied corpus. The YM5 files `GOLDRUN.YM`, `UnionDemo_NinjaRemix.YM` and `thalion_loader.YM` have zero timer fields and therefore do not provide production coverage for the other effects.

## Phase 3 format and transport contract

`parseYM()` accepts YM3!, YM3b, YM5! and YM6! data and validates signatures, fixed-header lengths, register ranges, sample ranges, zero-terminated metadata and the YM5/YM6 `End!` marker. YM3 uses 14 bytes per interleaved frame; YM3b additionally stores its loop frame as a trailing big-endian DWORD. YM5/YM6 register dumps may be interleaved or frame-serial according to attribute bit 0.

YM5/YM6 metadata supplies `masterClock`, `playerRate`, `loopFrame` and sample attributes. Signed samples are normalized from signed 8-bit PCM, unsigned samples from offset-binary PCM, and already-4-bit data is accepted only in the range 0 through 15 before conversion to the normalized representation consumed by the effect engine. Invalid or truncated data is rejected rather than played as a partial track.

`PLAY_TRACK` carries the parsed timing and loop metadata to the production worklet. Frame advance uses `sampleRate / playerRate`, and reaching the track end resumes at the stored `loopFrame`. UI duration, seeking and Media Session position use the same rate conversion. A stored loop transition is distinguished from the legacy end-of-track heuristic so that a loop to frame 0 is not treated as an automatic track change.

Synthetic tests cover non-50-Hz timing, explicit loop points, both register layouts, all sample encodings and malformed inputs. The parser also loads all 73 supplied corpus tracks, and production-worklet checks exercise all ten nonzero stored loop points.

## Phase 4 resampling and output contract

`PolyphaseResampler` generalizes the previously SID-specific Kaiser-windowed sinc implementation without changing its SID API or coefficient path. The YM Exact worklet uses its own explicit configuration: 256 interpolated phases, a 20 kHz requested passband, a 96 dB design attenuation and stopband start at output Nyquist. The former 32-phase, 255-tap, 12.5 kHz filter and the additional fixed-coefficient `outLp` are removed.

Measured kernel limits across all 256 phases are:

| Output rate | Taps | Group delay | Passband range at 1/10/16/20 kHz | Worst response at stopband start |
|---:|---:|---:|---:|---:|
| 44.1 kHz | 5561 | 1.3900 ms | -0.01092 to +0.00003 dB | -96.055 dB |
| 48 kHz | 3067 | 0.7665 ms | -0.00014 to +0.00003 dB | -96.435 dB |
| 96 kHz | 439 | 0.1095 ms | -0.00022 to -0.00003 dB | -97.211 dB |

Every phase is checked for finite coefficients, normalized DC gain and passband response. Streamed tests verify 20 kHz unity gain, rejection of above-Nyquist tones and the declared constant group delay. Production-worklet output is bit-identical across regular and irregular audio block sizes at all three rates. These figures describe the implemented digital filter, not an analog hardware measurement.

The three chip voices now sum linearly. `YM2149_OUTPUT_SCALE` preserves the former three-voice full-scale level; this is a level-continuity convention, not a real-hardware calibration. The unverified nonlinear bus compression is removed. `AtariAnalogFilter` retains its declared 15.9 kHz low-pass and 25 Hz high-pass model but no longer applies `tanh` saturation. Its discrete coefficients place both measured corner regions within 0.05 dB of -3 dB at 44.1/48/96 kHz. No claim of measured Atari mainboard agreement is made.

## Phase 5 production performance and browser acceptance

Phase 5 retains the Phase 4 digital filter targets but implements them as a two-stage cascade with 256 interpolated phases per stage. At 44.1/48/96 kHz the stages use 181+493, 163+297 and 73+87 taps. Worst stopband-start responses are −99.463, −102.999 and −98.939 dB; constant group delays are 1.439558, 0.811333 and 0.129979 ms. Register-derived periods and fixed volume levels are cached on writes, and the FIR loop is unrolled without changing accumulation order.

Sixty-second production renders of `WINGLEV1.YM`, `Turrican2_TheDesertRocks.YM` and `GOLDRUN.YM` are deterministic and finite. Measured sandbox processing budgets are approximately 25–28% of audio duration. Real Chromium AudioWorklet runs cover 44.1/48 kHz at desktop and mobile-emulation viewports. Full quality figures, timing comparisons, browser limitations and reproduction commands are in `doc/specs/emulation/atari/ym-performance-browser.md`.

## Baseline meaning and limits

`test/fixtures/ym-baseline.json` is a self-generated Phase 4 regression pin, not a hardware truth reference. It covers tone, noise, period-zero behavior, mixer activity and all envelope shapes. Its raw/WAV hashes and output-bearing traces were updated only after the linear-summing test passed; oscillator and register behavior was not redesigned in Phase 4.

`test/fixtures/ym-production-baseline.json` archives one-second stereo production-worklet hashes for `Giana_Title.YM`, `WINGLEV1.YM` and `GOLDRUN.YM` at 48 kHz with 128-sample process blocks. Phase 2 changed only the `WINGLEV1.YM` hash. Phase 4 changed `WINGLEV1.YM` and `GOLDRUN.YM` after the FIR, analog, streaming and block-size tests passed. Phase 5 changed those two hashes again after the two-stage cascade passed its cascaded-response, alias, delay and block-size tests; the silent one-second `Giana_Title.YM` anchor remains unchanged. These self-generated hashes are regression anchors, not proof of real-hardware agreement.

Real-hardware DAC/mainboard calibration and controlled listening tests on physical reference devices remain outside the completed checks.
