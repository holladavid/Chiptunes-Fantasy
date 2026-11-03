const VERTEX_SHADER_SOURCE = `
attribute vec2 a_position;
varying vec2 v_uv;

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_uv = a_position * 0.5 + 0.5;
}
`;

const FRAGMENT_SHADER_SOURCE = `
precision mediump float;

varying vec2 v_uv;
uniform sampler2D u_source;
uniform vec2 u_cssSize;

float phosphorDot(vec2 point, float centerX) {
    vec2 distance = vec2((point.x - centerX) / 0.12, (point.y - 0.5) / 0.31);
    float radiusSquared = dot(distance, distance);
    return 1.0 - smoothstep(0.58, 1.0, radiusSquared);
}

void main() {
    vec2 screenPosition = v_uv * u_cssSize;
    float cellSize = 3.0;
    float row = floor(screenPosition.y / cellSize);
    vec2 cellPosition = vec2(
        fract(screenPosition.x / cellSize + mod(row, 2.0) * 0.5),
        fract(screenPosition.y / cellSize)
    );

    vec3 phosphor = vec3(
        phosphorDot(cellPosition, 1.0 / 6.0),
        phosphorDot(cellPosition, 0.5),
        phosphorDot(cellPosition, 5.0 / 6.0)
    );
    vec3 color = texture2D(u_source, v_uv).rgb * (vec3(0.62) + phosphor * 0.85);

    float scanline = 0.965 + 0.035 * cos(screenPosition.y * 1.5707963);
    float cornerDistance = length((v_uv - 0.5) * u_cssSize) / (0.5 * length(u_cssSize));
    float vignette = 1.0 - 0.24 * smoothstep(0.55, 1.0, cornerDistance);
    gl_FragColor = vec4(clamp(color * scanline * vignette, 0.0, 1.0), 1.0);
}
`;

const QUAD_VERTICES = new Float32Array([
    -1, -1,
     1, -1,
    -1,  1,
    -1,  1,
     1, -1,
     1,  1
]);

export class CrtShadowMask {
    constructor(sourceCanvas, maskCanvas, onAvailabilityChange = () => {}) {
        this.sourceCanvas = sourceCanvas;
        this.canvas = maskCanvas;
        this.onAvailabilityChange = onAvailabilityChange;
        this.isReady = false;
        this.gl = null;

        if (!sourceCanvas || !maskCanvas) {
            console.warn('[CRT MASK] Source or output canvas is missing; using the CSS fallback.');
            return;
        }

        const gl = maskCanvas.getContext('webgl', {
            alpha: false,
            antialias: false,
            depth: false,
            stencil: false,
            preserveDrawingBuffer: false,
            powerPreference: 'low-power'
        });
        if (!gl) {
            console.warn('[CRT MASK] WebGL is unavailable; using the CSS fallback.');
            return;
        }

        this.gl = gl;
        if (!this.initialize(gl)) return;

        this.isReady = true;
        this.onAvailabilityChange(true);
        maskCanvas.addEventListener('webglcontextlost', event => {
            event.preventDefault();
            this.isReady = false;
            this.onAvailabilityChange(false);
            console.warn('[CRT MASK] WebGL context was lost; using the CSS fallback.');
        });
    }

    compileShader(gl, type, source) {
        const shader = gl.createShader(type);
        if (!shader) {
            console.error('[CRT MASK] Failed to create a WebGL shader.');
            return null;
        }

        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('[CRT MASK] Shader compilation failed:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    initialize(gl) {
        const vertexShader = this.compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
        if (!vertexShader) return false;
        const fragmentShader = this.compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
        if (!fragmentShader) {
            gl.deleteShader(vertexShader);
            return false;
        }

        const program = gl.createProgram();
        if (!program) {
            console.error('[CRT MASK] Failed to create a WebGL program.');
            gl.deleteShader(vertexShader);
            gl.deleteShader(fragmentShader);
            return false;
        }
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('[CRT MASK] Shader linking failed:', gl.getProgramInfoLog(program));
            gl.deleteProgram(program);
            return false;
        }

        const buffer = gl.createBuffer();
        const texture = gl.createTexture();
        const positionLocation = gl.getAttribLocation(program, 'a_position');
        const sourceLocation = gl.getUniformLocation(program, 'u_source');
        const sizeLocation = gl.getUniformLocation(program, 'u_cssSize');
        if (!buffer || !texture || positionLocation < 0 || sourceLocation === null || sizeLocation === null) {
            console.error('[CRT MASK] Failed to initialize WebGL resources.');
            gl.deleteBuffer(buffer);
            gl.deleteTexture(texture);
            gl.deleteProgram(program);
            return false;
        }

        this.program = program;
        this.buffer = buffer;
        this.texture = texture;
        this.positionLocation = positionLocation;
        this.sourceLocation = sourceLocation;
        this.sizeLocation = sizeLocation;
        this.textureWidth = 0;
        this.textureHeight = 0;

        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTICES, gl.STATIC_DRAW);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.useProgram(program);
        gl.uniform1i(sourceLocation, 0);
        gl.disable(gl.BLEND);
        gl.disable(gl.DEPTH_TEST);
        return true;
    }

    resize(width, height) {
        if (!this.isReady) return;
        if (this.canvas.width !== width) this.canvas.width = width;
        if (this.canvas.height !== height) this.canvas.height = height;
    }

    render() {
        if (!this.isReady) return;
        const width = this.sourceCanvas.width;
        const height = this.sourceCanvas.height;
        const cssWidth = this.sourceCanvas.clientWidth;
        const cssHeight = this.sourceCanvas.clientHeight;
        if (width <= 0 || height <= 0 || cssWidth <= 0 || cssHeight <= 0) return;

        this.resize(width, height);
        const gl = this.gl;
        gl.viewport(0, 0, width, height);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        if (this.textureWidth !== width || this.textureHeight !== height) {
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.sourceCanvas);
            this.textureWidth = width;
            this.textureHeight = height;
        } else {
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.sourceCanvas);
        }
        gl.useProgram(this.program);
        gl.uniform2f(this.sizeLocation, cssWidth, cssHeight);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.enableVertexAttribArray(this.positionLocation);
        gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
}
