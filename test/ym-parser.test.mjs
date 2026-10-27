import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseYM } from '../js/parsers/ym-parser.js';

function put32(bytes, value) {
    return [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];
}

function asciiBytes(value) {
    return value.split('').map(character => character.charCodeAt(0));
}

function makeYM3(signature = 'YM3!', loopFrame = 0) {
    const bytes = asciiBytes(signature);
    for (let register = 0; register < 14; register++) bytes.push(register + 1, register + 17);
    if (signature === 'YM3b') bytes.push(...put32([], loopFrame));
    return new Uint8Array(bytes);
}

function makeExtended({
    signature = 'YM6!', attributes = 1, masterClock = 2000000, playerRate = 50,
    loopFrame = 0, frames = [[0, 1], [2, 3]], samples = [], name = 'Title', author = 'Author', comment = 'Comment'
} = {}) {
    const bytes = [...asciiBytes(signature), ...asciiBytes('LeOnArD!'), ...put32([], frames.length), ...put32([], attributes),
        (samples.length >> 8) & 255, samples.length & 255, ...put32([], masterClock),
        (playerRate >> 8) & 255, playerRate & 255, ...put32([], loopFrame), 0, 0];
    for (const sample of samples) bytes.push(...put32([], sample.length), ...sample);
    for (const value of [name, author, comment]) bytes.push(...value.split('').map(character => character.charCodeAt(0)), 0);
    if (attributes & 1) {
        for (let register = 0; register < 16; register++) {
            for (const source of frames) bytes.push(source[register] || 0);
        }
    } else {
        for (const source of frames) {
            for (let register = 0; register < 16; register++) bytes.push(source[register] || 0);
        }
    }
    bytes.push(...asciiBytes('End!'));
    return new Uint8Array(bytes);
}

test('YM3 uses fourteen bytes per interleaved frame and default timing metadata', () => {
    const track = parseYM(makeYM3());
    assert.equal(track.frames.length, 2);
    assert.deepEqual([...track.frames[0].slice(0, 4)], [1, 2, 3, 4]);
    assert.deepEqual([...track.frames[1].slice(0, 4)], [17, 18, 19, 20]);
    assert.equal(track.frames[0].length, 16);
    assert.deepEqual(track.metadata, {
        name: 'Unknown', author: 'Unknown', comment: '', type: 'YM3!',
        masterClock: 2000000, playerRate: 50, loopFrame: 0, interleaved: true,
        digidrumCount: 0, digidrumSizes: [], sampleAttributes: { signed: false, already4Bit: false }
    });
});

test('YM3b reads its trailing big-endian loop frame', () => {
    const track = parseYM(makeYM3('YM3b', 1));
    assert.equal(track.metadata.loopFrame, 1);
    assert.equal(track.frames.length, 2);
});

test('YM5 and YM6 expose timing, loop and interleaving metadata', () => {
    const interleaved = parseYM(makeExtended({ signature: 'YM5!', loopFrame: 1, playerRate: 60 }));
    assert.equal(interleaved.metadata.type, 'YM5!');
    assert.equal(interleaved.metadata.masterClock, 2000000);
    assert.equal(interleaved.metadata.playerRate, 60);
    assert.equal(interleaved.metadata.loopFrame, 1);
    assert.equal(interleaved.metadata.interleaved, true);
    assert.deepEqual([...interleaved.frames[1].slice(0, 2)], [2, 3]);

    const sequential = parseYM(makeExtended({ attributes: 0, frames: [[10, 11], [20, 21]] }));
    assert.equal(sequential.metadata.interleaved, false);
    assert.deepEqual([...sequential.frames[0].slice(0, 2)], [10, 11]);
    assert.deepEqual([...sequential.frames[1].slice(0, 2)], [20, 21]);
});

test('unsigned, signed and already-4-bit Digidrum attributes control sample decoding', () => {
    const unsigned = parseYM(makeExtended({ samples: [[0, 128, 255]] }));
    assert.deepEqual([...unsigned.digidrums[0]], [-1, 0, 127 / 128]);
    assert.deepEqual(unsigned.metadata.sampleAttributes, { signed: false, already4Bit: false });
    assert.deepEqual(unsigned.metadata.digidrumSizes, [3]);

    const signed = parseYM(makeExtended({ attributes: 3, samples: [[0, 127, 128, 255]] }));
    assert.deepEqual([...signed.digidrums[0]], [0, 127 / 128, -1, -1 / 128]);
    assert.deepEqual(signed.metadata.sampleAttributes, { signed: true, already4Bit: false });

    const fourBit = parseYM(makeExtended({ attributes: 5, samples: [[0, 7, 15]] }));
    assert.deepEqual([...fourBit.digidrums[0]], [-1, -0.125, 0.875]);
    assert.deepEqual(fourBit.metadata.sampleAttributes, { signed: false, already4Bit: true });
});

test('invalid signatures, headers, ranges and truncated sections are rejected', () => {
    assert.throws(() => parseYM(new Uint8Array(3)), /Signatur/);
    assert.throws(() => parseYM(new Uint8Array(asciiBytes('NOPE'))), /Nicht unterstützte/);
    assert.throws(() => parseYM(new Uint8Array([...asciiBytes('YM3!'), 1, 2])), /14-Byte-Frames/);
    assert.throws(() => parseYM(makeYM3('YM3b', 2)), /Loop-Frame/);
    assert.throws(() => parseYM(new Uint8Array([...asciiBytes('YM6!'), 0])), /LeOnArD!|Header/);

    const cases = [
        [12, 0, /keine Frames/],
        [22, 0, /Masterclock/],
        [26, 0, /Playerrate/],
        [28, 2, /Loop-Frame/]
    ];
    for (const [offset, value, expected] of cases) {
        const bytes = makeExtended();
        bytes.fill(0, offset, offset + (offset === 26 ? 2 : 4));
        bytes[offset] = value;
        assert.throws(() => parseYM(bytes), expected);
    }

    const badCheck = makeExtended();
    badCheck[4] = 0;
    assert.throws(() => parseYM(badCheck), /LeOnArD!/);
    const badEnd = makeExtended();
    badEnd[badEnd.length - 1] = 0;
    assert.throws(() => parseYM(badEnd), /End!/);
    assert.throws(() => parseYM(makeExtended().slice(0, -1)), /End!|Registerdaten/);
    assert.throws(() => parseYM(makeExtended().slice(0, 38)), /terminiert/);

    const badSample = makeExtended({ samples: [[1, 2]] });
    badSample[36] = 10;
    assert.throws(() => parseYM(badSample), /Sampledaten/);
    const badNibble = makeExtended({ attributes: 5, samples: [[16]] });
    assert.throws(() => parseYM(badNibble), /4-Bit-Digidrumwert/);
});

test('all 73 corpus files parse with their documented clock, rate and loop points', () => {
    const root = new URL('../tracks/atari/', import.meta.url).pathname;
    const files = readdirSync(root, { recursive: true }).filter(name => /\.ym$/i.test(name));
    assert.equal(files.length, 73);
    let nonzeroLoops = 0;
    for (const name of files) {
        const track = parseYM(readFileSync(join(root, name)));
        assert.ok(track.frames.length > 0, name);
        assert.equal(track.metadata.masterClock, 2000000, name);
        assert.equal(track.metadata.playerRate, 50, name);
        assert.ok(track.metadata.loopFrame < track.frames.length, name);
        nonzeroLoops += track.metadata.loopFrame !== 0;
    }
    assert.equal(nonzeroLoops, 10);
});
