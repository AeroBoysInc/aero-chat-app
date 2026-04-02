/**
 * RNNoise AudioWorklet Processor
 *
 * Runs noise suppression in the audio rendering thread (off main thread).
 * Receives the compiled WASM module via port.postMessage from the main thread.
 *
 * RNNoise processes 480 samples at 48 kHz (~10ms frames).
 * AudioWorklet feeds 128 samples per process() call, so we accumulate
 * into 480-sample frames, process, and drain into output.
 */

const FRAME_SIZE = 480;

class RNNoiseProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    this._ready = false;
    this._disposed = false;

    // WASM state (set after init)
    this._exports = null;
    this._memory = null;
    this._state = 0;
    this._inPtr = 0;
    this._outPtr = 0;

    // Ring buffer for accumulating 128→480 sample frames
    this._inputBuf = new Float32Array(FRAME_SIZE);
    this._inputOffset = 0;
    this._outputBuf = new Float32Array(FRAME_SIZE);
    this._outputOffset = 0;
    this._outputAvailable = 0;

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
      // Minimal Emscripten env stubs for the two imports RNNoise needs
      let heapU8;
      const importObject = {
        a: {
          // emscripten_resize_heap — not needed for RNNoise (fixed memory)
          a: () => 0,
          // emscripten_memcpy_big — memcpy via WASM heap
          b: (dest, src, num) => {
            heapU8.copyWithin(dest, src, src + num);
          },
        },
      };

      const instance = await WebAssembly.instantiate(wasmModule, importObject);
      this._exports = instance.exports;
      this._memory = this._exports.c; // memory export
      heapU8 = new Uint8Array(this._memory.buffer);

      // Allocate RNNoise state and buffers (float32 = 4 bytes per sample)
      this._state = this._exports.f(0); // rnnoise_create(NULL)
      this._inPtr = this._exports.g(FRAME_SIZE * 4); // malloc
      this._outPtr = this._exports.g(FRAME_SIZE * 4); // malloc

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
      this._exports.h(this._state); // rnnoise_destroy
      this._exports.i(this._inPtr); // free
      this._exports.i(this._outPtr); // free
    }
  }

  process(inputs, outputs) {
    if (this._disposed) return false;
    if (!this._ready) {
      // Pass through until WASM is loaded
      const input = inputs[0]?.[0];
      const output = outputs[0]?.[0];
      if (input && output) output.set(input);
      return true;
    }

    const input = inputs[0]?.[0];
    const output = outputs[0]?.[0];
    if (!input || !output) return true;

    const heap = new Float32Array(this._memory.buffer);
    const inHeapOffset = this._inPtr >> 2;
    const outHeapOffset = this._outPtr >> 2;

    let iPos = 0;
    let oPos = 0;

    // Drain any leftover processed samples from previous call
    while (oPos < output.length && this._outputAvailable > 0) {
      output[oPos++] = this._outputBuf[this._outputOffset++];
      this._outputAvailable--;
    }

    // Feed input samples into 480-sample frames and process
    while (iPos < input.length) {
      const toCopy = Math.min(FRAME_SIZE - this._inputOffset, input.length - iPos);
      this._inputBuf.set(input.subarray(iPos, iPos + toCopy), this._inputOffset);
      this._inputOffset += toCopy;
      iPos += toCopy;

      if (this._inputOffset === FRAME_SIZE) {
        // Copy to WASM heap (scale to int16 range for RNNoise)
        for (let i = 0; i < FRAME_SIZE; i++) {
          heap[inHeapOffset + i] = this._inputBuf[i] * 32768;
        }

        // Process frame
        this._exports.j(this._state, this._outPtr, this._inPtr); // rnnoise_process_frame

        // Read processed output (scale back to [-1, 1])
        for (let i = 0; i < FRAME_SIZE; i++) {
          this._outputBuf[i] = heap[outHeapOffset + i] / 32768;
        }

        this._outputOffset = 0;
        this._outputAvailable = FRAME_SIZE;
        this._inputOffset = 0;

        // Drain processed samples into output
        while (oPos < output.length && this._outputAvailable > 0) {
          output[oPos++] = this._outputBuf[this._outputOffset++];
          this._outputAvailable--;
        }
      }
    }

    // Zero-fill any remaining output samples (initial buffering)
    while (oPos < output.length) {
      output[oPos++] = 0;
    }

    return true;
  }
}

registerProcessor('rnnoise-processor', RNNoiseProcessor);
