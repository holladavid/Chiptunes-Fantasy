# SID Phase 5: Musical Acceptance and Fantasy Studio Tuning

## Scope and boundaries

Phase 5 compares the production C64 AudioWorklets on real PSID material and makes one measured artistic adjustment to `sid-fantasy`: its stereo output coupling now has a sample-rate-independent 16 Hz corner. The Exact MOS 6581 R3 digital core, Phase 1 resampler, Phase 3 filter/mixer calibration and Phase 4 CPU/CIA scheduler are not retuned.

The shared `DCBlocker` accepts optional setup-time sample-rate and cutoff arguments. Calling it without arguments still selects the historical coefficient `0.995`, so existing non-C64 callers retain their previous recurrence and coefficient. The new coefficient is calculated in the constructor; `process()` remains primitive and allocation-free.

External libsidplayfp/reSIDfp code is used only through public APIs to generate black-box comparison audio. No implementation code or internal tables are imported. External-model agreement is not a physical-chip capture, a controlled listening test or proof of universal hardware accuracy.

## Evidence and reproduction

`test/fixtures/sid-phase5-studio-reference.json` archives the complete numerical report, input and reference WAV hashes, source revisions, render settings and before/after measurements. The copyrighted HVSC tunes and generated WAVs are not committed to the project.

The 20-second inputs are Rob Hubbard's *Commando* and Martin Galway's *Arkanoid*, with these SHA-256 hashes:

```text
Commando.sid  5295378dacb06593a9c1853ce11a325ce885a16e26d56274d424e06492948de8
Arkanoid.sid  9a576463b6d9e46f35cf2c8fbf40b6b3915424b2207d7c44c73b36e6ce9bc1cd
```

External references use libsidplayfp `6d1da4dce5ec2eea18f2b1a6a483e49a532f9b41` and libresidfp `c1791383ca843a855e5d4366da6a7277e34e801d`, PAL and forced MOS 6581, 48 kHz mono, `RESAMPLE_INTERPOLATE`, power-on delay zero, `engine.filter(0, true)` and `engine.initMixer(false)`.

`tools/sid-worklet-render.mjs` loads a local PSID/RSID file and imports the production Exact and Fantasy processors unchanged. Only the browser worklet registration surface is stubbed. It renders 128-frame blocks into preallocated stereo buffers and writes PCM16 WAV plus RMS, peak, DC, stereo-correlation, side-RMS and non-finite metrics. Offline setup pins `Math.random` to `0.5` before processor construction so the optional Exact per-instance calibration is repeatable; browser behavior is unchanged.

```bash
node tools/sid-worklet-render.mjs \
  --engine exact --input /path/to/Commando.sid --seconds 20 \
  --sample-rate 48000 --out exact-commando.wav --report exact-commando.json

node tools/sid-worklet-render.mjs \
  --engine fantasy --input /path/to/Commando.sid --seconds 20 \
  --sample-rate 48000 --out fantasy-commando.wav --report fantasy-commando.json

node tools/sid-worklet-compare.mjs \
  --reference reference-commando.wav --candidate exact-commando.wav \
  --report exact-commando-comparison.json
```

The offline tap is the worklet output before the application's master-bus crossfeed and limiter. For spectral comparison, stereo channels are averaged to mono. A 4096-point symmetric Hann STFT with 2048-sample hop and no boundary padding produces 467 frames. For each frame, uncentered FFT magnitudes from 40 Hz through 20 kHz are L2-normalized and compared by cosine similarity; the fixture records median and p10. This phase-insensitive measure avoids treating clock phase and output-group-delay differences as musical errors. It does not measure waveform-level equivalence.

Band changes use a separate 8192-point Hann STFT with 4096-sample hop. The reported dB value is `10 * log10(candidatePower / referencePower)` over the listed frequency bins. Absolute RMS and peak values are reported separately; no loudness normalization is applied.

## Exact acceptance

Phase 5 does not infer new analog settings from these external-model comparisons. Both deterministic Exact renders are byte-for-byte identical before and after the Fantasy change:

| Tune | RMS | Sample peak | External spectral median | p10 | WAV SHA-256 before = after |
|---|---:|---:|---:|---:|---|
| Commando | 0.159905 | 0.821866 | 0.887454 | 0.816106 | `2f7ca8bc…2f48` |
| Arkanoid | 0.308768 | 0.732312 | 0.863779 | 0.659909 | `5f2ffa44…0413` |

Both have zero non-finite samples. Exact remains mono at the worklet output, with stereo correlation 1 and side RMS 0. These results are acceptance observations for the selected tunes and external model, not a claim that every register program or physical chip is matched.

## Fantasy coupling measurement

The former fixed coefficient `0.995` made the output-coupling corner depend on host sample rate. Its 48 Hz response measured approximately −1.846 dB at 44.1 kHz and −2.117 dB at 48 kHz. Fantasy now constructs both channel blockers as `new DCBlocker(sampleRate, 16.0)`:

```text
coefficient = exp(-2π * cutoffHz / sampleRate)
H(z) = (1 - z^-1) / (1 - coefficient * z^-1)
```

The measured response is −3.00 dB at 16 Hz and approximately −0.448 dB at 48 Hz at both 44.1 and 48 kHz. This preserves more of the intentional 48 Hz digidrum exciter while retaining DC rejection. Panning, stereo filter, bandpass coloration, exciter, saturation, waveform model and all shared CPU/CIA behavior remain unchanged.

| Tune | Metric | Before | After / change |
|---|---|---:|---:|
| Commando | Combined RMS | 0.179143 | 0.188706 |
| Commando | Sample peak | 0.731252 | 0.716010 |
| Commando | Stereo correlation | 0.960666 | 0.962757 |
| Commando | 40–56 Hz power | — | +1.533252 dB |
| Commando | 1–20 kHz power | — | −0.017140 dB |
| Arkanoid | Combined RMS | 0.361511 | 0.386408 |
| Arkanoid | Sample peak | 0.741660 | 0.735155 |
| Arkanoid | Stereo correlation | 0.983645 | 0.984703 |
| Arkanoid | 40–56 Hz power | — | +1.622520 dB |
| Arkanoid | 1–20 kHz power | — | −0.151725 dB |

The before/after spectral-shape similarity is 0.999222 median for *Commando* and 0.999187 for *Arkanoid*, confirming that the adjustment is concentrated in the low-frequency output stage rather than replacing the studio chain. Both after-renders have zero non-finite samples and retain sample-peak headroom below 1.0.

For completeness, the tuned Fantasy/external spectral median and p10 are 0.870620 / 0.802028 for *Commando* and 0.831514 / 0.653255 for *Arkanoid*. Fantasy is an artistic stereo interpretation; these values are diagnostic comparisons, not targets for turning it into another Exact path.

## Regression commands and remaining limits

```bash
node --test test/sid-fantasy-studio.test.mjs test/sid-worklet-resampler.test.mjs
node --test test/sid-offline.test.mjs test/sid-digital.test.mjs test/sid-filter.test.mjs
node --test test/sid-resampler.test.mjs test/sid-cpu-timing.test.mjs
node tools/sid-render.mjs --case all --check
node tools/sid-filter-measure.mjs --check
```

The two-tune corpus is intentionally small and complements rather than replaces the synthetic register/filter suites. No controlled listening panel, real MOS 6581 recording or Exact 8580 model is introduced. The separate Canvas `drawImage` issue remains outside the SID phases and is not changed here.
