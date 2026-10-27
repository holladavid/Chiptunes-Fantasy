# YM2149 Phase 5 Performance and Browser Acceptance

## Scope and evidence limits

Phase 5 reviews the production `ym-exact` AudioWorklet path after the digital, YM6, transport and output changes from Phases 2–4. The figures below are regression and performance measurements of the implemented software, not measurements of an Atari ST or YM2149 chip.

Offline renders import the unchanged production processor with only `AudioWorkletProcessor`, `registerProcessor` and the message port stubbed. Timing covers repeated `process()` calls and excludes processor construction and track parsing. The harness uses 128-sample blocks and disables only the intentional fade-in, matching the existing production regression tests. Browser checks use real Chromium `AudioContext` and `AudioWorkletNode` instances; a constructor wrapper requests 44100 or 48000 Hz.

Measurements were run in the supplied Linux sandbox. Headless Chromium with a mobile viewport is not a physical mobile device. No controlled listening test, physical-device power test or real-mainboard calibration was performed.

## Hot-path review

The following behavior-preserving changes remove repeated work from the 2 MHz path:

- YM tone, noise and envelope periods are updated on register writes instead of being reassembled on every clock.
- Fixed 5-bit channel levels are updated on volume-register writes; envelope-controlled channels still use the current envelope level.
- The three YM6 effect override slots are cleared explicitly instead of through a typed-array method call.
- The mono FIR inner loop processes four coefficients per iteration while retaining coefficient interpolation and floating-point accumulation order.

No object or array allocation was found in `YM2149Core.clockCycle()`, `YM6Effects.clockCycle()`, `PolyphaseResampler.beginSample()/write()/process()`, the new two-stage streaming wrapper or the per-sample worklet loop. Visualizer storage is preallocated. Digidrum debug messages remain frame/event-driven, not cycle-driven.

The raw digital hashes remain unchanged. All production restart, track-change, block-size and transport tests pass after the hot-path changes.

## Resampler quality and configuration

The former single-stage 96 dB filter required 5561 taps at 44.1 kHz and left too little real-time reserve. Phase 5 therefore uses two cascaded Kaiser-windowed-sinc polyphase stages. The intermediate rate is four times the output rate. Both stages use 256 interpolated phases, a 20 kHz requested passband and a 96 dB design attenuation. The final stopband starts at output Nyquist.

| Output rate | Previous taps | Phase 5 taps, stage 1 + 2 | Group delay | Worst 20 kHz passband response | Worst response at stopband start |
|---:|---:|---:|---:|---:|---:|
| 44.1 kHz | 5561 | 181 + 493 | 1.439558 ms | −0.010446 dB | −99.463 dB |
| 48 kHz | 3067 | 163 + 297 | 0.811333 ms | −0.000101 dB | −102.999 dB |
| 96 kHz | 439 | 73 + 87 | 0.129979 ms | −0.000079 dB | −98.939 dB |

All 256 phases of both stages are checked for finite coefficients, normalized DC gain and impulse position. Cascaded responses are checked at 1, 10, 16 and 20 kHz and at stopband start. Streamed tests verify 20 kHz unity gain, above-Nyquist rejection, declared constant group delay and independence from audio block size. The 96 dB target is retained; the slightly longer constant delay is documented rather than hidden.

## Ten-second production timing comparison

`Giana_Title.YM` was rendered through the production processor. Percentages are total processing time divided by rendered audio duration; lower is better. The “single-stage, cached” column isolates the hot-path work from the later cascade change.

| Output rate | Single-stage before hot-path work | Single-stage, cached hot path | Two-stage Phase 5 | Phase 5 p95 block time |
|---:|---:|---:|---:|---:|
| 44.1 kHz | not measured | 88.97% | 28.46% | 0.928 ms |
| 48 kHz | 77.90% | 56.95% | 25.94% | 0.780 ms |
| 96 kHz | not measured | 25.52% | 24.07% | 0.368 ms |

These timings describe this sandbox only and must not be generalized to other computers or phones. Occasional maximum-block outliers include JIT/host scheduling and are reported in the raw JSON; p95 is not presented as a worst-case guarantee.

## Sixty-second deterministic production renders

Each case was rendered twice from fresh processor instances. Hashes cover left then right channel bytes for every process block. All pairs were bit-identical and contained zero non-finite samples.

| Track | Rate | SHA-256, identical for both runs | Mean real-time budget | Peak absolute sample |
|---|---:|---|---:|---:|
| `WINGLEV1.YM` | 48 kHz | `5e0bd29b6ff0db4051519b1b0ae9181e8f8211f5fba5a911ac0f8ed6161b0097` | 25.64% | 0.631127 |
| `Turrican2_TheDesertRocks.YM` | 48 kHz | `717bef5a339ac3b96e1b5d7f4bb4f915903457d2f8fb4ac18b0d6265c5f2a210` | 25.15% | 0.520795 |
| `GOLDRUN.YM` | 48 kHz | `e923de42b50f96c5f04ef74e86d93252c91f4a5919598e974b1b6079c8fc2f46` | 24.88% | 0.675749 |
| `WINGLEV1.YM` | 44.1 kHz | `baa5bb9f03a05e321b53dbc70614e1c15943cd7076ef743e9c10911171352489` | 28.01% | 0.628418 |

The hashes are self-generated regression anchors, not hardware truth references.

## Chromium AudioWorklet checks

`thalion_loader.YM` was started through the actual UI after the Atari system transition. Each run used approximately 60 seconds of wall-clock playback and sampled the real analyser every five seconds. All contexts requested and reported the intended rate, remained `running`, advanced, and produced non-zero finite analyser data.

| Viewport | Rate | Maximum observed analyser RMS | Local 404 / AudioWorklet errors | Non-finite analyser values | Document horizontal overflow |
|---|---:|---:|---:|---:|---|
| 1440 × 1000 desktop | 44.1 kHz | 0.168096 | 0 / 0 | 0 | no |
| 1440 × 1000 desktop | 48 kHz | 0.177529 | 0 / 0 | 0 | no |
| 390 × 844 mobile emulation | 44.1 kHz | 0.185266 | 0 / 0 | 0 | no |
| 390 × 844 mobile emulation | 48 kHz | 0.194243 | 0 / 0 | 0 | no |

One 44.1 kHz mobile-emulation run logged a closed connection to `fonts.gstatic.com`; request-failure tracing identified the external Press Start 2P font URL. There was no local resource failure. A separate mobile repetition at 48 kHz had no resource or console error. This external font incident is not counted as an AudioWorklet failure, but it is not hidden.

Headless analyser activity demonstrates a running production audio path; it does not prove glitch-free loudspeaker output or replace a listening test on reference devices.

## Reproduction

```bash
# Digital/filter quality and production regression tests
node --test test/ym-core.test.mjs test/ym-exact.test.mjs test/ym-resampler.test.mjs

# Ten-second timing/determinism harness; use --repeat 2 for a hash pair
node tools/ym-worklet-render.mjs \
  --input tracks/atari/Giana_Title.YM \
  --seconds 10 --sample-rate 48000 --repeat 2 \
  --report /tmp/giana-report.json

# Sixty-second production example
node tools/ym-worklet-render.mjs \
  --input tracks/atari/wings-of-death/WINGLEV1.YM \
  --seconds 60 --sample-rate 48000 --repeat 2 \
  --report /tmp/winglev1-report.json
```
