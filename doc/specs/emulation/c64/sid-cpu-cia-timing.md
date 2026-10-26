# SID Phase 4 CPU / CIA Timing Contracts

## Scope and evidence boundary

Phase 4 corrects instruction scheduling, MOS 6526 timer behavior, interrupt acknowledgement, selected final-cycle reads and RDY handling shared by `sid-exact` and `sid-fantasy`. It does not alter the Phase 1 resampler, Phase 2 digital SID core, Phase 3 analog filter/mixer calibration or the Fantasy studio DSP chain.

The archived evidence has two deliberately separate classes:

- **External black-box observations:** CPU instruction traces and `$D418` register writes produced through the public libsidplayfp API.
- **Self-generated regression pins:** deterministic periods from this engine. They detect future changes but are not independent truth.

No reference implementation source or internal table is imported. SIDLite was used only as a register sink; it supplies no analog, filter or real-hardware evidence. These tests do not establish exact agreement with a physical C64.

## CPU scheduler contract

`CPU6502` exposes shared scheduler primitives used by both C64 worklets:

- `beginInstruction()` polls before decode, executes the instruction, stages writes and returns the remaining cycle count. The pre-poll preserves the two-cycle CLI/SEI interrupt behavior.
- `pollInterrupts()` also runs at `cyclesRemaining === 2`, the penultimate cycle of longer instructions.
- `advanceCycle()` advances one permitted CPU cycle and commits writes due on that cycle.
- `canAdvanceCycle()` allows staged final writes and NMOS RMW dummy/final writes to proceed while RDY is low; read cycles remain stalled.
- `commitWritesForCycle()` keeps store commits on the final cycle and RMW dummy writes on the penultimate cycle.

Consequences covered by regression tests:

1. CLI delays IRQ recognition through one following instruction.
2. SEI does not cancel an IRQ already accepted while I was clear.
3. An IRQ asserted after the penultimate-cycle poll waits through the next instruction.
4. Store read cycles stall under RDY, but the final SID write still completes.
5. Staged NMOS RMW dummy and final writes are not suppressed by RDY.

For the measured `LDA $DC0D` path, the ICR value, acknowledgement and A/N/Z update occur on the final read cycle. This is a targeted compatibility correction, **not** a general bus-cycle conversion of every CPU read.

## MOS 6526 timer contract

CIA1 and CIA2 Timer A/B implement the modeled Phi2 pipeline without the former `Math.max(2, latch)` clamp:

- A rising START edge schedules a two-clock start delay.
- FORCE LOAD schedules a latch reload rather than writing the counter immediately.
- A loaded or reloaded timer skips the following decrement input.
- Underflow sets the corresponding ICR source, reloads the latch and emits the Timer A pulse used by cascaded Timer B.
- One-shot mode clears START after underflow.
- Timer B in Phi2 mode underflows at `<= 0`; cascade mode uses `< 0`, leaving zero visible for one input interval.

For CIA1 Timer A with latch 2 and FORCE LOAD plus START, the pinned seven-clock counter sequence is:

```text
2, 2, 1, 2, 2, 1, 2
```

For cascaded Timer B with latch 2 and a Timer A pulse on every clock, the pinned sequence is:

```text
1, 0, 2, 2, 1, 0
```

## CIA interrupt output contract

The MOS 6526 interrupt output is modeled as state, not as a purely combinational ICR/IMR level:

- A newly enabled ICR condition schedules interrupt activation after one clock.
- Once active, clearing IMR does not clear the CIA1 interrupt flip-flop or CIA2 NMI line state.
- Reading ICR returns the pending status with bit 7 as appropriate, then clears the status and interrupt output on the committed read.
- CIA2 NMI remains latched until acknowledgement and can trigger again after a later enabled condition.

## Synthetic CIA IRQ corpus

`test/helpers/sid-timing-corpus.mjs` contains the 513-byte machine-language corpus used for both the external observation and the local regression. Only the Timer A latch immediate changes between runs.

```text
Program SHA-256:
13437a077249ec57a4f03ff69478cc359f1494634722053abe27aa6123f2679b
```

The program drives a CIA1 Timer A IRQ handler whose visible `$D418` writes are timestamped on the CPU cycle axis. Small latches are handler-bound: their write spacing is dominated by handler execution and acknowledgement, so it must not be interpreted as a linear timer period.

## External reference provenance

`test/fixtures/sid-phase4-timing-reference.json` pins:

```text
Project:             libsidplayfp
Revision:            6d1da4dce5ec2eea18f2b1a6a483e49a532f9b41
Archive SHA-256:     95e885c96a119a3421be66997b09bd637519375094b96029fc6b3bf4b3668eac
Configure version:   3.2.0a
C64 model:           PAL
CIA model:           MOS6526
Power-on delay:      0
SID backend:         SIDLite register sink
```

Public API surface used: `SidTune` memory loading, `sidplayfp.play`, `sidplayfp.debug` instruction tracing and `sidplayfp.getSidStatus`. `play(1)` is not treated as an exact cycle axis. A `$D418` store timestamp is derived from the absolute instruction-trace cycle plus three cycles for `STA abs`.

Externally observed `$D418` periods:

| Timer A latch | Periods in PAL CPU cycles | Interpretation |
| ---: | --- | --- |
| 0, 1, 2, 3, 5, 17 | stable 69 | handler-bound |
| 100 | 102, 102, 99, 102, 102, 99, 102 | long-latch comparison |
| 244 | 246, 246, 243, 246 | long-latch comparison |

The engine's separate regression pin is 80 cycles for the small latches, `100, 103, 100, 100, 102, 100, 103` for latch 100 and stable 245 for latch 244. The different small-latch handler period is not presented as a hardware defect because the player stubs differ. The automated external comparison applies only to latches 100 and 244: every engine period must be within three cycles of an external observation and median drift must be at most two cycles.

## 50 Hz display timeline versus PSID play rate

The application's time display uses a 50 Hz frame domain; that domain is not necessarily the music driver's play-call rate. The supplied *Wizball* PSID has speed flags `$01FF`, selecting CIA timing for all nine subsongs. Its 100 Hz play calls made the former `currentFrame` counter advance twice as fast as the intended display time even though the music itself played at the correct speed.

Both C64 worklets now maintain a separate allocation-free `displayClockAccumulator`. Each executed PAL clock adds 50; when the accumulator reaches 985248, it subtracts that clock count and advances only the UI frame. `hostPlayPending`, CIA underflow handling, play dispatch, and all audio-state sequencing remain independent of this counter. Subsong initialization resets both the UI frame and its accumulator.

A regression for each worklet deliberately requests play on every 128-sample block while stepping just beyond one second. Before the correction, `currentFrame` reached 423; both engines now report exactly 50. Ten-second production-worklet renders of *Wizball* Subsong 7 remained byte-identical before and after the change in both engines:

```text
Exact SHA-256:   c24b752e41f8f639beac9ae96ddd3d0e762a84aa971b6907213f7645b405c971
Fantasy SHA-256: cdcee4651e5140f9e3ad62cd02c2cb074fea4fc5c13c3f53a24b65673b7f0ed9
```

The *Crazy Comets* Exact control render also remained byte-identical. Chromium playback with the original *Wizball* upload verified UI-driven selection from its original Subsong 4 to Subsong 7 in both engines: displayed elapsed time followed `AudioContext.currentTime` within the one-second UI quantization, with finite nonzero audio and no page or console errors.

## Reproduction

```bash
node --test test/sid-cpu-timing.test.mjs
node --test test/sid-offline.test.mjs test/sid-digital.test.mjs \
  test/sid-filter.test.mjs test/sid-resampler.test.mjs \
  test/sid-worklet-resampler.test.mjs test/sid-cpu-timing.test.mjs
node tools/sid-render.mjs --case all --check
node tools/sid-filter-measure.mjs --check
```

`test/fixtures/sid-baseline.json` remains the active Phase 3 output pin. `sid-phase3-baseline.json` preserves a historical copy; the Phase 4 timing fixture does not replace or recalibrate the audio baseline.

## Remaining limits

- The CPU is not yet a complete bus-cycle model for every read, write and interrupt stack cycle.
- Final-cycle ICR sampling is targeted at `LDA abs`; all ALU/RMW ICR reads are not converted.
- RDY coverage applies to the existing staged store/RMW paths, not every possible instruction or interrupt-entry sequence.
- Branch-specific interrupt polling quirks were not newly modeled.
- Long-latch agreement with one external implementation is bounded regression evidence, not a physical-hardware measurement.
- No analog conclusion follows from SIDLite or these register-write traces.

## Primary technical references

- MOS/WDC 6502 datasheet: https://www.princeton.edu/~mae412/HANDOUTS/Datasheets/6502.pdf
- MOS 6526 preliminary datasheet: https://6502.org/documents/datasheets/mos/mos_6526_cia_preliminary_mar_1981.pdf
- CIA software model: https://ist.uwaterloo.ca/~schepers/MJK/cia6526.html
- 6502 interrupt polling timing: https://www.nesdev.org/wiki/Visual6502wiki/6502_Timing_of_Interrupt_Handling
