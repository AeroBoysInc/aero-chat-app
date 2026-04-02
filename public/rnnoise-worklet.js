/**
 * RNNoise AudioWorklet Processor
 *
 * Runs noise suppression in the audio rendering thread (off main thread).
 * Receives the compiled WASM module via port.postMessage from the main thread.
 *
 * RNNoise processes 480 samples at 48 kHz (~10ms frames).
 * AudioWorklet feeds 128 samples per process() call.
 *
 * Uses a circular output buffer (4 frames = 1920 samples) to absorb the
 * mismatch between 480-frame processing and 128-sample output blocks.
 */

const FRAME_SIZE = 480;
const OUT_RING_SIZE = FRAME_SIZE * 4; // 1920 samples — enough to never underrun

class RNNoiseProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    this._ready = false;
    this._disposed = false;

    // WASM state
    this._exports = null;
    this._memory = null;
    this._state = 0;
    this._inPtr = 0;
    this._outPtr = 0;

    // Input accumulator (fills up to 480 samples before processing)
    this._inputBuf = new Float32Array(FRAME_SIZE);
    this._inputOffset = 0;

    // Circular output ring buffer
    this._outRing = new Float32Array(OUT_RING_SIZE);
    this._outWrite = 0; // write head
    this._outRead = 0;  // read head
    this._outCount = 0;  // samples available to read

    // Pre-fill with ~2 frames of silence to absorb initial latency
    this._outCount = FRAME_SIZE * 2;
    this._outWrite = FRAME_SIZE * 2;

    this.port.onmessage = (e) => {
      if (e.data.type === 'init') {
        this._initWasm(e.data.wasmModule);
      } else if (e.data.type === 'dispose') {
        this._dispose();
      }
    };
  }

  async _initWasm(wasmModule) {
    try {
      const self = this;
      const importObject = {
        a: {
          // emscripten_resize_heap — RNNoise doesn't need to grow memory
          a: () => 0,
          // emscripten_memcpy_big
          b: (dest, src, num) => {
            const heap = new Uint8Array(self._memory.buffer);
            heap.copyWithin(dest, src, src + num);
          },
        },
      };

      const instance = await WebAssembly.instantiate(wasmModule, importObject);
      this._exports = instance.exports;
      this._memory = this._exports.c; // memory export

      // Allocate RNNoise state and IO buffers
      this._state = this._exports.f(0); // rnnoise_create(NULL)
      this._inPtr = this._exports.g(FRAME_SIZE * 4); // malloc (float32 = 4 bytes)
      this._outPtr = this._exports.g(FRAME_SIZE * 4);

      this._ready = true;
      this.port.postMessage({ type: 'ready' });
    } catch (err) {
      this.port.postMessage({ type: 'error', message: err.message });
    }
  }

  _dispose() {
    if (this._disposed) return;
    this._disposed = true;
    if (this._exports && this._state) {
      this._exports.h(this._state);  // rnnoise_destroy
      this._exports.i(this._inPtr);  // free
      this._exports.i(this._outPtr); // free
    }
  }

  _writeToRing(samples, length) {
    for (let i = 0; i < length; i++) {
      this._outRing[this._outWrite] = samples[i];
      this._outWrite = (this._outWrite + 1) % OUT_RING_SIZE;
    }
    this._outCount += length;
  }

  _readFromRing(output, length) {
    const available = Math.min(this._outCount, length);
    for (let i = 0; i < available; i++) {
      output[i] = this._outRing[this._outRead];
      this._outRead = (this._outRead + 1) % OUT_RING_SIZE;
    }
    this._outCount -= available;
    // Zero-fill if we somehow underrun (shouldn't happen with pre-fill)
    for (let i = available; i < length; i++) {
      output[i] = 0;
    }
  }

  process(inputs, outputs) {
    if (this._disposed) return false;

    const input = inputs[0]?.[0];
    const output = outputs[0]?.[0];
    if (!input || !output) return true;

    if (!this._ready) {
      // Pass through until WASM is ready
      output.set(input);
      return true;
    }

    // Fresh heap view each call (safe against theoretical buffer detach)
    const heap = new Float32Array(this._memory.buffer);
    const inHeapOff = this._inPtr >> 2;
    const outHeapOff = this._outPtr >> 2;

    // Feed input into 480-sample frames and process
    let iPos = 0;
    while (iPos < input.length) {
      const toCopy = Math.min(FRAME_SIZE - this._inputOffset, input.length - iPos);
      this._inputBuf.set(input.subarray(iPos, iPos + toCopy), this._inputOffset);
      this._inputOffset += toCopy;
      iPos += toCopy;

      if (this._inputOffset === FRAME_SIZE) {
        // Copy input to WASM heap (scale float [-1,1] → int16 range for RNNoise)
        for (let i = 0; i < FRAME_SIZE; i++) {
          heap[inHeapOff + i] = this._inputBuf[i] * 32768;
        }

        // Run RNNoise
        this._exports.j(this._state, this._outPtr, this._inPtr);

        // Read processed output, scale back to [-1,1], write to ring buffer
        const processed = new Float32Array(FRAME_SIZE);
        for (let i = 0; i < FRAME_SIZE; i++) {
          processed[i] = heap[outHeapOff + i] / 32768;
        }
        this._writeToRing(processed, FRAME_SIZE);

        this._inputOffset = 0;
      }
    }

    // Read 128 processed samples from ring buffer into output
    this._readFromRing(output, output.length);

    return true;
  }
}

registerProcessor('rnnoise-processor', RNNoiseProcessor);
