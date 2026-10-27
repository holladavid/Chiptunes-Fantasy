#!/usr/bin/env python3
"""
uade_fit.py  -  Vergleicht ein UADE-Rendering mit unserer Wiedergabe (Stimmen einzeln gerendert).

  python3 tools/uade-compare/uade_fit.py --uade level2.wav --module tracks/amiga/Wings_Of_Death-Level_2.hipc \
          [--song 0] [--seconds 150] [--lowpass 2500] [--paula js/worklets/amiga/paula-exact.js]

Aufruf aus dem Repo-Wurzelverzeichnis. Voraussetzungen: Node >= 22, Python 3 mit numpy und scipy.
UADE: uade123 -f out.wav -e wav --filter=none --panning=0 <Datei>   (Stereo, harte Amiga-Trennung: L = Stimmen 0+3, R = 1+2)

Methode: Jede Stimme wird einzeln durch unseren echten Laufzeitpfad gerendert (tools/coso-render-paula.mjs --stereo 2).
Pro Tick (882 Samples) wird jede UADE-Seite als gewichtete Summe der zwei Stimmen der Seite angepasst (kleinste Quadrate).
  feste Phase  : nur blockweise Ausrichtung -> empfindlich für TONHÖHE (0,1 % Fehler summieren sich zu Phasenfehlern)
  lokale Phase : +-40 Samples je Fenster frei -> prüft WELLENFORM, LAUTSTÄRKE, HÜLLKURVE und Wellenwechsel
Ausgegeben wird der Anteil der UADE-Energie, den das Modell erklärt (1 - Residuum/Signal).
"""
import argparse, os, struct, subprocess, sys, tempfile
import numpy as np

RATE = 44100
TICK_HZ = (3546895 / 5) / 14188


def read_wav(path):
    """WAV mit beliebigem Header (auch Streaming-Platzhalter in der Längenangabe): Daten bis zum Dateiende."""
    raw = open(path, 'rb').read()
    assert raw[:4] == b'RIFF' and raw[8:12] == b'WAVE', 'keine WAV-Datei'
    o, fmt, data = 12, None, None
    while o + 8 <= len(raw):
        cid, sz = raw[o:o + 4], struct.unpack_from('<I', raw, o + 4)[0]
        if cid == b'fmt ':
            fmt = struct.unpack_from('<HHIIHH', raw, o + 8)
        elif cid == b'data':
            data = raw[o + 8:]
            break
        o += 8 + sz + (sz & 1)
    tag, ch, rate, _, _, bits = fmt
    assert bits == 16, 'nur 16 Bit'
    n = len(data) // (2 * ch)
    return np.frombuffer(data[:n * 2 * ch], dtype='<i2').reshape(-1, ch).astype(np.float32) / 32768, rate


def xlag(ref, mod, lo, hi):
    """Versatz k in [lo, hi] mit ref[n+k] ~ mod[n] (FFT-Kreuzkorrelation)."""
    n = len(mod)
    nfft = 1 << int(np.ceil(np.log2(len(ref) + n)))
    c = np.fft.irfft(np.fft.rfft(ref, nfft) * np.conj(np.fft.rfft(mod, nfft)), nfft)
    ks = np.arange(lo, hi + 1)
    return int(ks[int(np.argmax([c[k] if k >= 0 else c[nfft + k] for k in ks]))])


def render_quad(repo, module, song, seconds, paula, out, tickhz):
    cmd = ['node', os.path.join(repo, 'tools', 'coso-render-paula.mjs'), '--in', module, '--song', str(song),
           '--seconds', str(seconds), '--tickhz', str(tickhz), '--stereo', '2', '--out', out]
    if paula:
        cmd += ['--paula', paula]
    subprocess.run(cmd, check=True, capture_output=True)
    w = read_wav(out)[0]
    assert w.shape[1] == 4
    return w


def block_lags(ref_mix, mod_mix, seconds, block_s=5.0):
    lag0 = xlag(ref_mix[:int(12 * RATE)], mod_mix[:int(10 * RATE)], 0, int(0.3 * RATE))
    B = int(block_s * RATE)
    lags, prev = [], lag0
    for b0 in range(0, int(seconds * RATE) - B, B):
        lo = max(b0 + prev - 300, 0)
        r, m = ref_mix[lo:lo + B + 600], mod_mix[b0:b0 + B]
        if len(r) < len(m):
            break
        prev = lo + xlag(r, m, 0, 600) - b0
        lags.append(prev)
    return np.array(lags), lag0, B


def fit(U, Q, lags, B, seconds, local, tickhz=TICK_HZ):
    spt = RATE / tickhz
    W = int(round(spt))
    tb = np.arange(len(lags)) * B + B // 2
    sig = res = 0.0
    per_window = {}
    for t in range(2, int(seconds * tickhz) - 2):
        w0 = int(round(t * spt))
        s = w0 + int(round(np.interp(w0, tb, lags)))
        if s + W + local > len(U) or w0 + W > len(Q) or s - local < 0:
            break
        for side, (va, vb) in ((0, (0, 3)), (1, (1, 2))):
            A = np.stack([Q[w0:w0 + W, va], Q[w0:w0 + W, vb]], axis=1).astype(np.float64)
            if local:
                m = A.sum(axis=1)
                if m @ m > 1e-6:
                    seg = U[s - local:s + W + local, side].astype(np.float64)
                    s_use = s - local + int(np.argmax(np.correlate(seg, m, 'valid')))
                else:
                    s_use = s
            else:
                s_use = s
            y = U[s_use:s_use + W, side].astype(np.float64)
            ey = y @ y
            if ey < 1e-4 and not A.any():
                continue
            coef = np.linalg.lstsq(A, y, rcond=None)[0]
            r = y - A @ coef
            sig += ey
            res += r @ r
            k = int(t / tickhz // 30)
            a, b = per_window.get(k, (0.0, 0.0))
            per_window[k] = (a + ey, b + r @ r)
    return 1 - res / sig, {k: 1 - b / a for k, (a, b) in per_window.items() if a > 0}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--uade', required=True)
    ap.add_argument('--module', required=True)
    ap.add_argument('--song', type=int, default=0)
    ap.add_argument('--seconds', type=float, default=120)
    ap.add_argument('--lowpass', type=float, default=2500, help='Tiefpass in Hz für beide Signale (0 = aus)')
    ap.add_argument('--paula', default=None, help='Pfad zur Paula-Worklet-Datei (Standard: js/worklets/amiga/paula-exact.js)')
    ap.add_argument('--local', type=int, default=40, help='Phasenfreiheit in Samples für die lokale Anpassung')
    ap.add_argument('--tickhz', type=float, default=TICK_HZ, help='Replay-Tickrate (Standard: CIA 709379/14188)')
    a = ap.parse_args()
    repo = os.getcwd()

    U, rate = read_wav(a.uade)
    assert rate == RATE and U.shape[1] == 2, 'UADE-Datei muss 44,1 kHz Stereo sein'
    with tempfile.TemporaryDirectory() as td:
        Q = render_quad(repo, a.module, a.song, a.seconds + 3, a.paula, os.path.join(td, 'quad.wav'), a.tickhz)
    if a.lowpass:
        from scipy.signal import butter, sosfiltfilt
        sos = butter(6, a.lowpass, btype='low', fs=RATE, output='sos')
        U = sosfiltfilt(sos, U.astype(np.float64), axis=0).astype(np.float32)
        Q = sosfiltfilt(sos, Q.astype(np.float64), axis=0).astype(np.float32)
    lags, lag0, B = block_lags(U.sum(axis=1).astype(np.float64), Q.sum(axis=1).astype(np.float64), a.seconds)
    drift_ppm = (lags[-1] - lags[0]) / (len(lags) * 5.0 * RATE) * 1e6
    print(f'Anlauf UADE: {lag0 / RATE * 1000:.1f} ms | Drift {lags[-1] - lags[0]:+d} Samples über {len(lags) * 5} s ({drift_ppm:+.0f} ppm)')
    for label, local in (('feste Phase ', 0), ('lokale Phase', a.local)):
        e, pw = fit(U, Q, lags, B, a.seconds, local, a.tickhz)
        print(f'{label}: {100 * e:5.1f} % der UADE-Energie erklärt   | je 30 s: ' + ' '.join(f'{100 * v:.0f}' for k, v in sorted(pw.items())))


if __name__ == '__main__':
    main()
