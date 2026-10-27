// ==========================================
// YM BINARY FILE PARSER (YM3! / YM3b / YM5! / YM6!)
// ==========================================

const YM3_CLOCK = 2000000;
const YM3_PLAYER_RATE = 50;
const YM_HEADER_SIZE = 34;
const YM_FRAME_REGISTERS = 16;

function ascii(data, offset, length) {
    let value = '';
    for (let i = 0; i < length; i++) value += String.fromCharCode(data[offset + i]);
    return value;
}

function u16(data, offset) {
    return (data[offset] << 8) | data[offset + 1];
}

function u32(data, offset) {
    return data[offset] * 0x1000000 + (data[offset + 1] << 16) + (data[offset + 2] << 8) + data[offset + 3];
}

function requireBytes(data, offset, length, description) {
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 || offset + length > data.length) {
        throw new Error(`Ungültige oder abgeschnittene YM-Datei: ${description}`);
    }
}

function requireRange(value, maximum, description) {
    if (!Number.isSafeInteger(value) || value < 0 || value >= maximum) {
        throw new Error(`Ungültige YM-Datei: ${description}`);
    }
}

function readMetadataString(data, state, description) {
    const start = state.position;
    while (state.position < data.length && data[state.position] !== 0) state.position++;
    if (state.position >= data.length) throw new Error(`Ungültige oder abgeschnittene YM-Datei: ${description}`);
    const value = ascii(data, start, state.position - start);
    state.position++;
    return value;
}

function decodeSample(data, offset, size, signed, already4Bit) {
    const sample = new Float32Array(size);
    for (let i = 0; i < size; i++) {
        const byte = data[offset + i];
        if (already4Bit) {
            if (byte > 15) throw new Error('Ungültige YM-Datei: 4-Bit-Digidrumwert außerhalb 0...15');
            // YM6Effects converts this normalized representation back to the same nibble.
            sample[i] = byte / 8 - 1;
        } else {
            sample[i] = signed ? (byte << 24 >> 24) / 128 : (byte - 128) / 128;
        }
    }
    return sample;
}

function parseYM3(data, signature) {
    const isYM3b = signature === 'YM3b';
    const trailerSize = isYM3b ? 4 : 0;
    const registerBytes = data.length - 4 - trailerSize;
    if (registerBytes < 14 || registerBytes % 14 !== 0) {
        throw new Error('Ungültige oder abgeschnittene YM-Datei: YM3-Registerdaten müssen aus 14-Byte-Frames bestehen');
    }

    const frameCount = registerBytes / 14;
    const loopFrame = isYM3b ? u32(data, data.length - 4) : 0;
    requireRange(loopFrame, frameCount, 'Loop-Frame außerhalb des Songs');
    const frames = new Array(frameCount);
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
        const frame = new Uint8Array(YM_FRAME_REGISTERS);
        for (let register = 0; register < 14; register++) frame[register] = data[4 + register * frameCount + frameIndex];
        frames[frameIndex] = frame;
    }

    return {
        frames,
        digidrums: [],
        metadata: {
            name: 'Unknown', author: 'Unknown', comment: '', type: signature,
            masterClock: YM3_CLOCK, playerRate: YM3_PLAYER_RATE, loopFrame,
            interleaved: true, digidrumCount: 0, digidrumSizes: [],
            sampleAttributes: { signed: false, already4Bit: false }
        }
    };
}

function parseYM5OrYM6(data, signature) {
    requireBytes(data, 0, YM_HEADER_SIZE + 4, 'YM5/YM6-Header');
    if (ascii(data, 4, 8) !== 'LeOnArD!') throw new Error('Ungültige YM-Datei: LeOnArD!-Signatur fehlt');

    const frameCount = u32(data, 12);
    if (frameCount === 0) throw new Error('Ungültige YM-Datei: keine Frames');
    const attributes = u32(data, 16);
    const digidrumCount = u16(data, 20);
    const masterClock = u32(data, 22);
    const playerRate = u16(data, 26);
    const loopFrame = u32(data, 28);
    const additionalDataSize = u16(data, 32);
    if (masterClock === 0) throw new Error('Ungültige YM-Datei: YM-Masterclock ist null');
    if (playerRate === 0) throw new Error('Ungültige YM-Datei: Playerrate ist null');
    requireRange(loopFrame, frameCount, 'Loop-Frame außerhalb des Songs');

    const state = { position: YM_HEADER_SIZE };
    requireBytes(data, state.position, additionalDataSize, 'Zusatzdaten');
    state.position += additionalDataSize;

    const signed = (attributes & 2) !== 0;
    const already4Bit = (attributes & 4) !== 0;
    const digidrums = new Array(digidrumCount);
    const digidrumSizes = new Array(digidrumCount);
    for (let index = 0; index < digidrumCount; index++) {
        requireBytes(data, state.position, 4, `Samplegröße ${index}`);
        const size = u32(data, state.position);
        state.position += 4;
        requireBytes(data, state.position, size, `Sampledaten ${index}`);
        digidrums[index] = decodeSample(data, state.position, size, signed, already4Bit);
        digidrumSizes[index] = size;
        state.position += size;
    }

    const name = readMetadataString(data, state, 'Songname ist nicht terminiert') || 'Unknown';
    const author = readMetadataString(data, state, 'Autor ist nicht terminiert') || 'Unknown';
    const comment = readMetadataString(data, state, 'Kommentar ist nicht terminiert');
    const registerBytes = frameCount * YM_FRAME_REGISTERS;
    requireBytes(data, state.position, registerBytes + 4, 'Registerdaten oder End!-Marker');
    const registerStart = state.position;
    if (ascii(data, registerStart + registerBytes, 4) !== 'End!') throw new Error('Ungültige YM-Datei: End!-Marker fehlt');

    const interleaved = (attributes & 1) !== 0;
    const frames = new Array(frameCount);
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
        const frame = new Uint8Array(YM_FRAME_REGISTERS);
        for (let register = 0; register < YM_FRAME_REGISTERS; register++) {
            const offset = interleaved
                ? registerStart + register * frameCount + frameIndex
                : registerStart + frameIndex * YM_FRAME_REGISTERS + register;
            frame[register] = data[offset];
        }
        frames[frameIndex] = frame;
    }

    return {
        frames,
        digidrums,
        metadata: {
            name, author, comment, type: signature, masterClock, playerRate, loopFrame,
            interleaved, digidrumCount, digidrumSizes,
            sampleAttributes: { signed, already4Bit }
        }
    };
}

export function parseYM(input) {
    const data = input instanceof Uint8Array
        ? input
        : input instanceof ArrayBuffer
            ? new Uint8Array(input)
            : null;
    if (!data || data.length < 4) throw new Error('Ungültige oder abgeschnittene YM-Datei: Signatur fehlt');
    if (data.length >= 7) {
        const compression = ascii(data, 2, 5);
        if (compression === '-lh5-' || compression === '-lh0-') {
            throw new Error('DATEI IST KOMPRIMIERT! Bitte entpacke sie zuerst lokal mit 7-Zip.');
        }
    }

    const signature = ascii(data, 0, 4);
    if (signature === 'YM3!' || signature === 'YM3b') return parseYM3(data, signature);
    if (signature === 'YM5!' || signature === 'YM6!') return parseYM5OrYM6(data, signature);
    throw new Error(`Nicht unterstützte YM-Signatur: ${signature}`);
}

export async function loadYmFile(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Datei nicht gefunden: ${url}`);
    return parseYM(await response.arrayBuffer());
}
