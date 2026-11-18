// === js/content/cheatsheets.js ===
// ==========================================
// RETRO HARDWARE REGISTERS CHEAT SHEETS
// Quick Reference Guides for SID, YM, and Paula
// ==========================================

export const chipCheatSheets = {
    atari: `
        <strong>YM2149F Cheat Sheet (2,00 MHz):</strong><br>
        <span style="color:var(--highlight-color)">R00-R05:</span> Pitch A/B/C (12-Bit Fine/Coarse; R01/R03-Hi = YM-Digi)<br>
        <span style="color:var(--highlight-color)">R06:</span> Noise Period (5-Bit LFSR-Teiler, 0–31)<br>
        <span style="color:var(--highlight-color)">R07:</span> Mixer (Bit 0–2 Tone, 3–5 Noise, <strong>0 = AN</strong>; Bit 6–7 I/O)<br>
        <span style="color:var(--highlight-color)">R08-R0A:</span> Volume A/B/C (0–15 fest; Bit 4 = 5-Bit HEG-Modus)<br>
        <span style="color:var(--highlight-color)">R0B-R0C:</span> Hardware Envelope (HEG) 16-Bit Periode<br>
        <span style="color:var(--highlight-color)">R0D:</span> HEG Shape (0–F: \\___, /___, ////, /\\/\\, etc.)<br>
        <span style="color:var(--highlight-color)">R0E-R0F:</span> I/O Ports A/B (ST-Bus) · Digidrums via MFP-Timer in R08-R0A
    `,
    c64: `
        <strong>SID 6581 Cheat Sheet ($D400–$D418):</strong><br>
        <span style="color:var(--highlight-color)">R00-R06 ($D400):</span> Voice 1 (Freq, PW, Ctrl, AD, SR)<br>
        <span style="color:var(--highlight-color)">R07-R0D ($D407):</span> Voice 2 (Freq, PW, Ctrl, AD, SR)<br>
        <span style="color:var(--highlight-color)">R0E-R14 ($D40E):</span> Voice 3 (Freq, PW, Ctrl, AD, SR)<br>
        <span style="color:var(--highlight-color)">Ctrl-Bits:</span> 0:Gate · 1:Sync · 2:Ring · 3:Test · 4–7:Tri/Saw/Pul/Noi<br>
        <span style="color:var(--highlight-color)">R15-R16 ($D415):</span> 11-Bit Filter Cutoff (30 Hz – 6,2 kHz R3)<br>
        <span style="color:var(--highlight-color)">R17 ($D417):</span> Resonanz (Bit 4–7) &amp; Filter-Routing V1–V3<br>
        <span style="color:var(--highlight-color)">R18 ($D418):</span> Vol (0–15 / 4-Bit Digi), LP/BP/HP &amp; Bit 7 = 3OFF
    `,
    amiga: `
        <strong>PAULA 8364 DMA Cheat Sheet ($DFF0A0–DF):</strong><br>
        (Telemetrie der 4 DMA-Kanäle: L–R–R–L Hard-Panning)<br>
        <span style="color:var(--highlight-color)">DMA CH 0–3 (je 7 Bytes im HUD-Bus):</span><br>
        [0–1]: Sample-Pointer (Word-aligned) · [2–3]: Buffer (Words×2)<br>
        [4–5]: Periode (3,55 MHz / Per = Rate) · [6]: Volume (0–64)<br>
        <span style="color:var(--highlight-color)">ACT-LED:</span> DMA aktiv (Pointer, Buffer &amp; Volume &gt; 0)<br>
        <br>
        <span style="color:var(--bus-active-color)">&#128161; Gehäuse-LED-Filter (CIA-A $BFE001 / E00–E01):</span><br>
        Die rote <span style="color:var(--highlight-color)">Power-LED (PWR)</span> ist interaktiv! Klicke direkt darauf, um das schaltbare 12-dB/Okt-Butterworth-Filter (3,09 kHz) umzuschalten (<strong>hell / AN</strong> = Filter aktiv, warmer weicher Sound; <strong>gedimmt / AUS</strong> = Bypass, klarer höhenreicher Sound; der feste 4,42-kHz-RC-Filter bleibt stets aktiv).
    `
};