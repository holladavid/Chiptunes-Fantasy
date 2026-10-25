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

The selected combined waveforms use the documented wired-AND topology at full 12-bit resolution. The previous freely chosen bleed factors, frequency-dependent relaxation and capacitive bus-charge approximation are removed from Exact.

**Limit:** logical wired-AND is a documented digital baseline, not a calibrated model of the analogue pull-down interactions of a particular 6581. Real chip captures or an independently parameterized empirical model are still required before claiming authentic combined-waveform output.

The 4096-entry `WAVE_DAC_6581_R3` preserves the project's existing R3 DAC fingerprint and adds the four lower input bits by monotone segment interpolation. It removes premature 8-bit quantization; it is not a new hardware DAC measurement.

## Envelope generator

Each voice has an independent cycle-level state machine:

- GATE changes propagate through a two-clock input pipeline.
- The 15-bit rate counter wraps at `$7FFF` and is never reset by GATE or TEST.
- A rate tick occurs only on exact equality with the selected period, not on `>=`. Shortening a period below the current counter therefore waits for wraparound.
- Attack increments linearly and enters Decay at envelope 255.
- Decay/Release use exponential divider periods 1, 2, 4, 8, 16 and 30.
- The divider period is reloaded after an envelope decrement at thresholds 93, 54, 26, 14 and 6.
- Entering Attack resets the exponential counter and clears the zero hold; the rate counter continues.
- Envelope zero holds until a later Attack, preventing release wraparound.

These rules make rapid retriggering and rate changes dependent on prior internal state instead of hiding that state through a convenient reset.

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

The focused digital tests cover primitive 12-bit values, every noise tap, combined-selector logic, GATE delay, rate-counter preservation/wraparound, linear attack, exponential thresholds, release/zero hold, DAC-latch retention and model/DAC identity. The offline trace stores waveform values as `Uint16`, so lower four DAC-input bits remain observable.

## Documentation references and remaining validation

The implementation was written independently from public hardware documentation and behavioral descriptions; no reSIDfp/VICE source code or tables were imported.

- MOS 6581 datasheet: register, comparator, TEST and envelope architecture — https://ccrma.stanford.edu/~chet/projects/tech_content/6581.pdf
- Bob Yannes architecture interview and technical annotations: 12-bit waveform DAC and wired selector — https://www.cpcwiki.eu/index.php/SID
- Noise register/tap reference — https://www.oxyron.de/html/registers_sid.html
- Die/capture-based ADSR divider investigation — http://ploguechipsounds.blogspot.com/2010/03/sid-6581r3-adsr-tables-up-close.html
- Combined-waveform capture variability and calibration requirements — https://www.wothke.ch/tinyrsid/index.php/combined

Still required for external accuracy acceptance: aligned real-hardware and whole-tune black-box comparisons, combined-waveform capture fitting, multi-level analogue DAC/DC/distortion calibration, complete bus timing and musical listening tests. Phase 3 covers one documented filter/mixer stimulus matrix against reSIDfp; it does not close these remaining items.
