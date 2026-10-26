# SID Phase 2 — MOS 6581 R3 Digital Model

## Scope and model boundary

`SIDChip` now declares the explicit model identity `MOS6581_R3` and binds separate 12-bit waveform-DAC and 8-bit envelope-DAC tables. The hardware-oriented Exact path uses `sid-waveforms-6581.js` and `sid-envelope.js`.

`SIDFantasyChip` remains a separate artistic stereo studio implementation. It is not presented as an Exact CSG 8580 mode. A hardware-oriented 8580 profile is still future work.

Phase 2 changed the digital waveform and envelope paths only. Phase 3 subsequently calibrated the filter/mixer in `sid-filter-model.md` without changing this digital contract; CPU/bus timing remains separate Phase-4 work.

## 12-bit waveform path

The waveform selector retains all 12 DAC-input bits until conversion:

- Sawtooth: accumulator bits 23–12.
- Triangle: accumulator bits 23–11, conditionally inverted by the own/ring MSB.
- Pulse: direct 12-bit accumulator/PW comparator; TEST forces all 12 bits high.
- Noise: LFSR bits 20, 18, 14, 11, 9, 5, 2 and 0 feed DAC bits 11–4; bits 3–0 are zero. There is no artificial `0.68` gain.
- OSC3 exposes only the upper eight bits through the retained `waveOut8Bit` mirror.

When no waveform is selected, the waveform DAC input latch holds its last 12-bit value. It no longer drifts toward an invented fixed `0x18` level. This also preserves the digital basis of TEST/waveform-latch sample techniques.

Most combined selectors retain the documented wired-AND topology at full 12-bit resolution. The previous freely chosen bleed factors, frequency-dependent relaxation and capacitive bus-charge approximation remain removed from Exact. Triangle+pulse (`$50`) is the one measured exception: `sid-combined-6581.js` uses 257 independently fitted phase-domain anchors with integer interpolation.

**Limit for the other selectors:** logical wired-AND is a documented digital baseline, not a calibrated model of the analogue pull-down interactions of a particular 6581. Real chip captures or independently parameterized empirical models are still required before claiming authentic output for those combinations.

The 4096-entry `WAVE_DAC_6581_R3` preserves the project's existing R3 DAC fingerprint and adds the four lower input bits by monotone segment interpolation. It removes premature 8-bit quantization; it is not a new hardware DAC measurement.

### Triangle+pulse `$50` calibration and Giana regression

The supplied Great Giana Sisters Highscore tune exposed a real Exact/Fantasy difference in Subsong 2. Around 30 seconds, voice 3 selects `$50` with pulse widths near 8. Exact's former wired-AND returned zero for 99.802% of the traced samples; Fantasy's separate artistic LUT retained an audible triangle-derived signal. Envelope and filter tracing did not explain the missing voice.

The Exact correction was fitted independently through public libresidfp API calls, using revision `c1791383ca843a855e5d4366da6a7277e34e801d`, `MOS6581`, `AVERAGE`, 985248 Hz, `NONE`, filter disabled, voice 3, immediate attack and full sustain. The downloaded archive used for this measurement has SHA-256 `deff740e2af2be38839cf9f7f474606476b08ef6e0082e44ed78848b335b96c4`; this is recorded separately from the older filter-measurement archive hash. No implementation source or internal waveform table was imported.

A pulse-low stimulus at frequency `$2001` visits every phase-12 value. Two million public-output samples were captured; the second million supplied the phase-binned fit. Sawtooth- and triangle-only captures confirmed the phase origin. The curve is indexed by accumulator bits 23–12, not by the folded triangle value, because opposite phase halves are not interchangeable. External-output normalization uses the measured saw range -4604…5880; normalized values above the 12-bit model boundary are clamped. The constant pulse state uses the fitted low-state plateau rather than the external filter's drifting DC. The production table samples every sixteenth phase value and interpolates with prepared typed-array reads and primitive integer arithmetic only.

Held-out checks used stimuli not fitted into the table. Errors below are reference-output LSB after block-local removal of the external reference's slowly drifting DC:

| Frequency | Pulse width | Correlation | RMS error |
| --- | ---: | ---: | ---: |
| `$2000` | `$008` | 0.971 | 634 |
| `$1357` | `$123` | 0.981 | 596 |
| `$4001` | `$ABC` | 0.737 | 95 |
| `$07FF` | `$020` | 0.929 | 813 |
| `$2001` | `$800` | 0.953 | 461 |

This is documented agreement with an external reference model at these stimuli, not a physical-chip capture or universal hardware-authenticity claim. Other combined selectors and Exact 8580 remain separate work.

The original upload has SHA-256 `014764e6ee11df4b458c6b30e235ea639d702bd56766a87b5e90d4737558b1c8`; only the start-song field was changed in a temporary Subsong-2 reproduction (`b75e6b5a7b8a1c1cf63cd20a21fd2dd49e3e84e8dd97c3c0d8a6e5d62f8024ff`). From 28–36 seconds, corrected Exact voice 3 now has nonzero `$50` output throughout, range 1459…4095 and mean 1708.457. The 45-second Exact render has RMS 0.103214, peak 0.616292 and zero non-finite frames. Chromium also loaded the original upload through the application UI, advanced from its original Subsong 1 to Subsong 2, and reached 00:32 with nonzero finite analyser output and no page or console errors. Fantasy, ADSR, CPU/CIA scheduling, resampling and display timing were not changed.

## Envelope generator

Each voice has an independent cycle-level state machine:

- GATE changes propagate through a two-clock input pipeline.
- The 15-bit rate counter wraps at `$7FFF`; rising GATE restarts its phase, while TEST does not.
- A rate tick occurs only on exact equality with the selected period, not on `>=`. Shortening a period below the current counter therefore waits for wraparound.
- Attack increments linearly and enters Decay at envelope 255.
- Decay/Release use exponential divider periods 1, 2, 4, 8, 16 and 30.
- The divider period is reloaded after an envelope decrement at thresholds 93, 54, 26, 14 and 6.
- Entering Attack restarts the rate phase, resets the exponential counter and clears the zero hold.
- Envelope zero holds until a later Attack, preventing release wraparound. This lower bound also applies when a short GATE pulse enters Release before Attack has produced the first increment.

Release preserves the running counters. A new Attack deliberately establishes a fresh rate phase so that short retriggered notes do not depend on the preceding note's counter position.

### Original-recording short-GATE calibration

The supplied original-SID Wizball High Score recording contains the complete rising “bubble” sequence from six seconds onward. Its SHA-256 is `b092f00c615d7282852a2b2521cc7fe39ed8921bc797da4e8e9b62b403659c24` (48 kHz, stereo, 136.31275 seconds). Production-processor tracing of the original `Wizball.sid` binary found 21 short voice-2 GATE attacks between 5.5 and 10.5 seconds. With the former persistent rate phase, only one attack rose above envelope 128; the other 20 remained at envelope 0 or 1 and were effectively silent.

Restarting the rate phase on rising GATE makes all 21 attacks reach envelope 255 and restores the chirp sequence visible and audible in the original recording. The correction retains the two-clock GATE pipeline, exact period comparator, 15-bit wraparound, exponential Decay/Release, zero hold, waveform/filter/DAC models and the separate Fantasy core. This is original-recording calibration for the observed short-GATE behavior, not a claim that every ADSR property or every 6581 revision has been validated.

A 20-second render from the original Wizball upload, selecting Subsong 7 without modifying its header, has RMS 0.129946, peak 0.652550 and zero non-finite samples. Chromium reached Subsong 7 beyond ten seconds with finite nonzero analyser output and no page or console errors. Twenty-second Crazy Comets and 45-second Giana Subsong 2 regression renders also remain finite; Giana's `$50` voice retains its calibrated 1459…4095 waveform range with zero silent waveform samples in the measured 28–36-second interval.

### Zero-level GATE-pulse regression

The v1.5.1 Exact worklet produced non-finite output for two supplied tunes. Production-processor tracing reduced both failures to the same sequence: GATE switched on at envelope zero and cleared the zero hold, then switched off before Attack incremented the envelope. Release subsequently decremented the counter below zero, so the envelope-DAC lookup returned `undefined` and arithmetic produced `NaN`.

The correction enforces the existing zero-level lower bound at the Decay/Release decrement. It does not change CPU/CIA scheduling, filter/mixer calibration, resampling, parser behavior, or Fantasy DSP. A focused regression drives GATE on and off at zero with the slowest Attack and fastest Release; it failed with envelope `-1` before the correction and now holds at zero with finite voice output.

Twenty-second Exact worklet renders used the supplied binaries. Wizball Subsong 7 was selected through a temporary copy whose PSID start-song field alone was changed; the original upload remained unchanged.

| Reproduction | Tune SHA-256 | Non-finite frames before | Non-finite frames after | RMS after |
| --- | --- | ---: | ---: | ---: |
| Crazy Comets, Subsong 1 | `1666b2d22866794f2a0bf78e017664349f0a00e4ffd815b5ae1247c34670a3d3` | 680646 | 0 | 0.182350 |
| Wizball, Subsong 7 (start-song override) | `dd87b77203439680b1d84cf4203a5f5cf682cea44450d1a91d3cb16391d9593c` | 939519 | 0 | 0.122529 |

Chromium playback additionally used both original uploads through the application UI. Wizball starts at Subsong 4 in its original header and was advanced with the Next control to Subsong 7. Both Exact-core checks reported finite, nonzero analyser output and no page or console errors; Crazy Comets was observed beyond its former failure at 5.819875 seconds.

## Regression evidence

```bash
node tools/sid-render.mjs --case all --check
node --expose-gc --test \
  test/sid-offline.test.mjs \
  test/sid-digital.test.mjs \
  test/sid-filter.test.mjs \
  test/sid-resampler.test.mjs \
  test/sid-worklet-resampler.test.mjs
```

`test/fixtures/sid-baseline.json` now pins the reviewed Phase 3 output, which includes the later analog changes. `sid-phase2-baseline.json` preserves the digital-model completion output and `sid-phase0-baseline.json` preserves the earlier Phase 0/1 fixture. All are self-generated regression pins, not hardware-truth references; the separate Phase-3 external reference fixture is documented in `sid-filter-model.md`.

The focused digital tests cover primitive 12-bit values, every noise tap, combined-selector logic, GATE delay and attack rate-phase restart, rate-counter wraparound, linear attack, exponential thresholds, release/zero hold, DAC-latch retention and model/DAC identity. The offline trace stores waveform values as `Uint16`, so lower four DAC-input bits remain observable.

## Documentation references and remaining validation

The implementation was written independently from public hardware documentation and behavioral descriptions; no reSIDfp/VICE source code or tables were imported.

- MOS 6581 datasheet: register, comparator, TEST and envelope architecture — https://ccrma.stanford.edu/~chet/projects/tech_content/6581.pdf
- Bob Yannes architecture interview and technical annotations: 12-bit waveform DAC and wired selector — https://www.cpcwiki.eu/index.php/SID
- Noise register/tap reference — https://www.oxyron.de/html/registers_sid.html
- Die/capture-based ADSR divider investigation — http://ploguechipsounds.blogspot.com/2010/03/sid-6581r3-adsr-tables-up-close.html
- Combined-waveform capture variability and calibration requirements — https://www.wothke.ch/tinyrsid/index.php/combined

Still required for external accuracy acceptance: aligned real-hardware and whole-tune black-box comparisons, combined-waveform capture fitting, multi-level analogue DAC/DC/distortion calibration, complete bus timing and musical listening tests. Phase 3 covers one documented filter/mixer stimulus matrix against reSIDfp; it does not close these remaining items.
