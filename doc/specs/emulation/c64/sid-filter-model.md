# SID Phase 3 — MOS 6581 R3 Filter and Mixer Calibration

## Scope and evidence boundary

Phase 3 calibrates the existing two-integrator Exact filter and corrects mixer routing. It does not change CPU/bus timing, the digital waveform/ADSR contract, the phase-1 resampler, or the artistic Fantasy core.

The external reference is **libresidfp revision `c1791383ca843a855e5d4366da6a7277e34e801d`**, accessed only through its public API as a black box. No reSIDfp/VICE implementation code, internal filter tables or GPL source were imported. The downloaded source archive used for the external measurement tool has SHA-256 `98f940bbf7cd3ef6d2a327b3183ef89a3f112d7c9dc30243e10f3919a8b01349`.

This is a documented fit to an external reference model, **not a real-chip capture and not proof of universal 6581 accuracy**. Physical chips and capacitors vary substantially.

## Measurement method

`test/fixtures/sid-r3-filter-reference.json` archives the external observations and complete provenance:

- MOS6581 profile, PAL native clock 985248 Hz, `SamplingMethod.NONE`.
- One sinusoid per run into `EXT IN`, amplitude 8192 LSB, updated in eight-cycle blocks.
- 49264 settling cycles followed by 98520 measured cycles.
- Single-frequency least-squares AC amplitude after mean removal.
- Nine frequencies from 50 Hz to 12 kHz for the main matrix; 16, 20 and 24 kHz for the upper-cutoff extension.
- LP, BP and HP; nine cutoff anchors at RES=0; RES=4/8/12/15 at FC=512/1024/1536; upper-cutoff RES=15 checks.

A defined higher signal level was selected after a level sweep: very small input was quantization/nonlinearity dominated and did not provide a stable response fit. One input level still does not identify the complete nonlinear device.

The production chip exposes `processFilterMixer(filteredSum, unfilteredSum)` as an allocation-free analog measurement entry point. `tools/sid-filter-measure.mjs` drives the same stimulus through that exact production path. The reference API includes its external output filter; the measurement tool compensates an approximately 16 kHz low-pass for comparison only. This compensation is not inserted into the raw SID chip tap.

## Fitted filter map

`sid-filter-6581.js` builds setup-time typed arrays for all 2048 cutoff registers and all sixteen resonance values. Runtime register writes only read these arrays.

Measured cutoff anchors in hertz:

| FC | 0 | 256 | 512 | 768 | 1024 | 1280 | 1536 | 1792 | 2047 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Hz | 240.00 | 250.96 | 1768.67 | 4926.26 | 7859.61 | 9242.60 | 11041.01 | 12693.17 | 14123.64 |

Intermediate values use linear interpolation. The previous 30 Hz–6.2 kHz polynomial and its temperature detuning are removed. `vcfOffset` remains an explicit per-instance calibration offset; normal browser construction still permits chip variation, while offline measurements use zero.

Damping is cutoff-dependent rather than a single `1.414 - normalizedResonance` line. The fitted base-damping anchors and resonance slopes populate a 2048×16 `Float32Array`. For example:

- FC=512: k=1.47 at RES=0 and k=0.66 at RES=15.
- FC=1024: k=1.78 at RES=0 and k=0.79 at RES=15.

The existing two-substep trapezoidal ZDF solver remains, but its `g` and `k` now come directly from the calibrated register state. The previous independently recomputed feedback and uncalibrated bandpass `tanh` path are removed.

## Mixer contract

- LP, BP and HP remain additive.
- HP uses the documented −3 dB tap (`1/sqrt(2)`) in every mode combination; the former LP+HP-only inversion/gain special case is removed.
- Separate BP and HP feedthrough terms (`0.24` and `0.08`) fit measured stopband floors. There is no shared arbitrary leakage added to every mode.
- Master volume uses sixteen linear steps as specified by the datasheet.
- Voice routing has no invented inter-voice crosstalk coefficients.
- Voice 3 OFF disconnects only the direct path. Voice 3 routed through the filter remains audible. This also removes the stale legacy-DAC reference from that branch.
- The output VCA retains the project's parameterized gain/soft saturation and 0.9 DC-bias model. Those analog DC/distortion parameters are not promoted to hardware-measured facts.

## Reproduction and current result

```bash
# External-reference comparison against the production analog entry point.
node tools/sid-filter-measure.mjs --check

# Write all 639 comparison rows for independent inspection.
node tools/sid-filter-measure.mjs --out artifacts/sid/filter-r3-report.json

# Unit/routing tests and deterministic corpus.
node --test test/sid-filter.test.mjs test/sid-digital.test.mjs test/sid-offline.test.mjs
node tools/sid-render.mjs --case all --check
```

Current comparison over 639 responses after one global API output-scale alignment:

- Median absolute error: **1.876 dB**.
- 95th-percentile absolute error: **6.737 dB**.
- RMS error: **3.396 dB**.

The check fails above 2.5 dB median or 8 dB p95. Errors are largest near deep stopbands and are not evidence of cycle-exact analog equivalence.

`test/fixtures/sid-baseline.json` is the self-generated Phase 3 regression pin. `sid-phase2-baseline.json` and `sid-phase0-baseline.json` preserve earlier output. These hashes are separate from the external R3 reference fixture.

## Remaining acceptance work

- Capture and align one specified physical MOS 6581 R3 with known capacitors and output loading.
- Identify amplitude-dependent distortion, DC drift and $D418 behavior over multiple signal levels.
- Compare combined LP/BP/HP modes and resonance transients against the same external stimulus.
- Perform musical listening tests only after phase-4 CPU/digi timing is complete.
