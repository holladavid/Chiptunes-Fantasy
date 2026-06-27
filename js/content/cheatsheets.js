// === js/content/cheatsheets.js ===
// ==========================================
// RETRO HARDWARE REGISTERS CHEAT SHEETS
// Quick Reference Guides for SID, YM, and Paula
// ==========================================

export const chipCheatSheets = {
    atari: `
        <strong>YM2149 Cheat Sheet:</strong><br>
        <span style="color:#fff">R00-R05:</span> Pitch A/B/C (Fine & Coarse)<br>
        <span style="color:#fff">R06:</span> Noise Frequency<br>
        <span style="color:#fff">R07:</span> Mixer (Bit 0-2 Tone, 3-5 Noise)<br>
        <span style="color:#fff">R08-R0A:</span> Volume A/B/C (Bit 4 = HEG Mode)<br>
        <span style="color:#fff">R0B-R0C:</span> Hardware Envelope (HEG) Period<br>
        <span style="color:#fff">R0D:</span> HEG Shape (Saw, Triangle, etc.)<br>
        <span style="color:#fff">R0F:</span> Geheimer Digidrum-Trigger!
    `,
    c64: `
        <strong>SID 6581 Cheat Sheet:</strong><br>
        <span style="color:#fff">R00-R06:</span> Voice 1 (Freq, PW, Ctrl, AD, SR)<br>
        <span style="color:#fff">R07-R0D:</span> Voice 2 (Freq, PW, Ctrl, AD, SR)<br>
        <span style="color:#fff">R0E-R14:</span> Voice 3 (Freq, PW, Ctrl, AD, SR)<br>
        <span style="color:#fff">R15-R16:</span> Filter Cutoff Frequency<br>
        <span style="color:#fff">R17:</span> Resonance & Voice Routing<br>
        <span style="color:#fff">R18:</span> Filter Mode & Master Volume
    `,
    amiga: `
        <strong>PAULA DMA Cheat Sheet:</strong><br>
        (Hardware via Software repräsentiert)<br>
        <span style="color:#fff">CH1-CH4 (je 4 Bytes):</span><br>
        [0-1]: Periode (Pitch)<br>
        [2]: Volume (0-64)<br>
        [3]: Trigger-Status (Aktiv/Inaktiv)<br>
        <br>
        <span style="color:#ff8800">💡 Gehäuse-LED-Filter (Bypass):</span><br>
        Die rote <span style="color:#fff">Power-LED (PWR)</span> ist interaktiv! Klicke direkt darauf, um das analoge 12dB/Okt-Tiefpass-Filter (LED-Filter) manuell zu überbrücken (gedimmt/on = warmer, weicher Sound; hell/off = klarer, höhenreicher Sound).
    `
};