import test from 'node:test';
import assert from 'node:assert/strict';

import { CrtShadowMask } from '../js/visuals/components/crt-shadow-mask.js';

function createFakeGl() {
    const calls = [];
    const gl = {
        VERTEX_SHADER: 1,
        FRAGMENT_SHADER: 2,
        COMPILE_STATUS: 3,
        LINK_STATUS: 4,
        ARRAY_BUFFER: 5,
        STATIC_DRAW: 6,
        TEXTURE_2D: 7,
        TEXTURE_MIN_FILTER: 8,
        TEXTURE_MAG_FILTER: 9,
        NEAREST: 10,
        TEXTURE_WRAP_S: 11,
        TEXTURE_WRAP_T: 12,
        CLAMP_TO_EDGE: 13,
        UNPACK_FLIP_Y_WEBGL: 14,
        BLEND: 15,
        DEPTH_TEST: 16,
        TEXTURE0: 17,
        RGBA: 18,
        UNSIGNED_BYTE: 19,
        FLOAT: 20,
        TRIANGLES: 21,
        createShader: () => ({}),
        shaderSource: () => {},
        compileShader: () => {},
        getShaderParameter: () => true,
        getShaderInfoLog: () => '',
        deleteShader: () => {},
        createProgram: () => ({}),
        attachShader: () => {},
        linkProgram: () => {},
        getProgramParameter: () => true,
        getProgramInfoLog: () => '',
        deleteProgram: () => {},
        createBuffer: () => ({}),
        createTexture: () => ({}),
        getAttribLocation: () => 0,
        getUniformLocation: () => ({}),
        bindBuffer: (...args) => calls.push(['bindBuffer', ...args]),
        bufferData: (...args) => calls.push(['bufferData', ...args]),
        bindTexture: (...args) => calls.push(['bindTexture', ...args]),
        texParameteri: () => {},
        pixelStorei: () => {},
        useProgram: () => {},
        uniform1i: () => {},
        disable: () => {},
        viewport: (...args) => calls.push(['viewport', ...args]),
        activeTexture: () => {},
        texImage2D: (...args) => calls.push(['texImage2D', ...args]),
        texSubImage2D: (...args) => calls.push(['texSubImage2D', ...args]),
        uniform2f: (...args) => calls.push(['uniform2f', ...args]),
        enableVertexAttribArray: () => {},
        vertexAttribPointer: () => {},
        drawArrays: (...args) => calls.push(['drawArrays', ...args])
    };
    return { gl, calls };
}

function createCanvas(gl = null) {
    return {
        width: 640,
        height: 360,
        clientWidth: 320,
        clientHeight: 180,
        getContext(name, options) {
            assert.equal(name, 'webgl');
            assert.equal(options.antialias, false);
            return gl;
        },
        addEventListener() {}
    };
}

test('CRT shadow mask renders the canvas using stable CSS-pixel dimensions', () => {
    const { gl, calls } = createFakeGl();
    const source = createCanvas();
    const output = createCanvas(gl);
    output.width = 0;
    output.height = 0;
    const mask = new CrtShadowMask(source, output);

    assert.equal(mask.isReady, true);
    mask.render();
    mask.render();

    assert.equal(output.width, source.width);
    assert.equal(output.height, source.height);
    assert.equal(calls.filter(([name]) => name === 'texImage2D').length, 1);
    assert.ok(calls.some(([name, ...args]) => name === 'texImage2D' && args.at(-1) === source));
    assert.equal(calls.filter(([name]) => name === 'texSubImage2D').length, 1);
    assert.ok(calls.some(([name, ...args]) => name === 'uniform2f' && args[1] === 320 && args[2] === 180));
    assert.ok(calls.some(([name]) => name === 'drawArrays'));
});

test('CRT shadow mask leaves CSS fallback available without WebGL', () => {
    const originalWarn = console.warn;
    let availabilityChanges = 0;
    console.warn = () => {};
    try {
        const mask = new CrtShadowMask(createCanvas(), createCanvas(), () => availabilityChanges++);
        assert.equal(mask.isReady, false);
        assert.equal(availabilityChanges, 0);
        mask.render();
    } finally {
        console.warn = originalWarn;
    }
});
