# YM2149 Phase 0 Measurement Harness

## Scope

The Phase 0 harness makes the production YM2149 digital core measurable without a DOM or `AudioWorklet`. It is a refactoring and regression foundation, not a claim that the current envelope start, YM6 effects, DAC mapping, summing model or output filters are hardware-correct.

The signal path is:

```text
cycle-stamped register events -> YM2149Core.clockCycle() -> raw Float32 output -> IEEE-float WAV
                                      |
                                      +-> cycle/state trace
```

The raw tap is before the polyphase FIR, `outLp`, `AtariAnalogFilter` and master DSP. It includes the current DAC and summing model so that the Phase 0 refactor remains comparable with the production core. The raw harness remains a register-only core harness; Phase 2 effects have their own cycle-level tests and are applied between effect timing and `YM2149Core.clockCycle()` in the production worklet.

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

# Run focused core and production-worklet tests.
node --test test/ym-core.test.mjs test/ym6-effects.test.mjs test/ym-exact.test.mjs

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

## Baseline meaning and limits

`test/fixtures/ym-baseline.json` is a self-generated Phase 1 regression pin, not a hardware truth reference. It covers tone, noise, period-zero behavior, mixer activity and all envelope shapes after the digital corrections.

`test/fixtures/ym-production-baseline.json` archives one-second stereo production-worklet hashes for `Giana_Title.YM`, `WINGLEV1.YM` and `GOLDRUN.YM` at 48 kHz with 128-sample process blocks. Phase 2 changed only the `WINGLEV1.YM` hash after the cycle and amplitude tests passed; the other two hashes and all raw Phase 1 baselines remain unchanged. These self-generated hashes are regression anchors, not proof of real-hardware agreement.

The known loop, resampling and analog-model issues remain intentionally unchanged. Their corrections belong to the subsequent release phases.
