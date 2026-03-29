/**
 * RNNoise-based noise suppression pipeline + gain-only pipeline.
 *
 * Uses @jitsi/rnnoise-wasm (Emscripten-compiled C library).
 * The module exposes raw C functions accessed via WASM heap pointers.
 *
 * The WASM module is loaded once and cached — subsequent calls reuse it.
 * Falls back to the raw stream if WASM fails to load.
 */

import { createRNNWasmModuleSync } from '@jitsi/rnnoise-wasm';

// Emscripten module interface — exposes raw C functions and WASM heap.
// The sync variant has the WASM binary inlined as base64, so it works in
// production Vite builds without a separate rnnoise.wasm network fetch.
interface RNNoiseModule {
  _rnnoise_create(modelPtr: number): number;
  _rnnoise_destroy(state: number): void;
  // Returns VAD probability; processes audio via WASM heap pointers
  _rnnoise_process_frame(state: number, outPtr: number, inPtr: number): number;
  _malloc(size: number): number;
  _free(ptr: number): void;
  HEAPF32: Float32Array;
  ready: Promise<RNNoiseModule>;
}

export interface NoisePipeline {
  /** Use this stream for WebRTC tracks and MediaRecorder — it contains processed audio. */
  processedStream: MediaStream;
  /** Adjusts microphone input gain. gain=1.0 is unity (100%); 0.5 = 50%; 1.5 = 150%. */
  setInputGain(gain: number): void;
  /** Closes the AudioContext, frees WASM state, stops processed tracks. */
  dispose: () => void;
}

// RNNoise requires exactly 480 samples per frame at 48 kHz
const FRAME_SIZE = 480;

// Cached after first successful load — cleared on rejection to allow retry
let _wasmModulePromise: Promise<RNNoiseModule> | null = null;

async function getRNNoiseModule(): Promise<RNNoiseModule> {
  if (!_wasmModulePromise) {
    // createRNNWasmModuleSync() returns the Module immediately (WASM is inlined),
    // but functions are only available after module.ready resolves.
    _wasmModulePromise = (createRNNWasmModuleSync() as unknown as RNNoiseModule).ready
      .catch(err => {
        _wasmModulePromise = null; // allow retry on next call
        return Promise.reject(err);
      });
  }
  return _wasmModulePromise;
}

/**
 * Lightweight gain-only pipeline: source → gainNode → dest.
 * Use when noise cancellation is off but input volume control is still needed.
 */
export async function createGainPipeline(rawStream: MediaStream): Promise<NoisePipeline> {
  if (rawStream.getAudioTracks().length === 0) {
    return { processedStream: rawStream, setInputGain: () => {}, dispose: () => {} };
  }

  const ctx = new AudioContext({ sampleRate: 48000 });
  if (ctx.state === 'suspended') await ctx.resume();

  const source   = ctx.createMediaStreamSource(rawStream);
  const gainNode = ctx.createGain();
  const dest     = ctx.createMediaStreamDestination();

  source.connect(gainNode);
  gainNode.connect(dest);

  let disposed = false;
  return {
    processedStream: dest.stream,
    setInputGain: (gain: number) => { gainNode.gain.value = gain; },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      try { source.disconnect(); gainNode.disconnect(); ctx.close(); } catch {}
    },
  };
}

/**
 * Builds a noise suppression + gain pipeline around rawStream.
 * Graph: source → gainNode → scriptProcessor(RNNoise) → dest
 *
 * Returns a NoisePipeline whose processedStream contains the cleaned audio.
 * If rawStream has no audio tracks, or if the WASM fails to load, returns
 * a no-op pipeline wrapping the original stream so callers never need to
 * branch on success.
 */
export async function createNoisePipeline(rawStream: MediaStream): Promise<NoisePipeline> {
  // No audio — nothing to process
  if (rawStream.getAudioTracks().length === 0) {
    return { processedStream: rawStream, setInputGain: () => {}, dispose: () => {} };
  }

  let module: RNNoiseModule;
  try {
    module = await getRNNoiseModule();
  } catch (err) {
    console.warn('[NC] RNNoise WASM failed to load, falling back to gain-only pipeline:', err);
    return createGainPipeline(rawStream);
  }

  const ctx = new AudioContext({ sampleRate: 48000 });
  if (ctx.state === 'suspended') await ctx.resume();

  // Allocate WASM state and heap buffers (Float32 = 4 bytes per sample)
  const state = module._rnnoise_create(0);
  const inPtr  = module._malloc(FRAME_SIZE * 4);
  const outPtr = module._malloc(FRAME_SIZE * 4);

  const source   = ctx.createMediaStreamSource(rawStream);
  const gainNode = ctx.createGain();
  const dest     = ctx.createMediaStreamDestination();

  // ScriptProcessorNode bufferSize must be a power of 2; 4096 ≈ 85 ms latency.
  // AudioWorklet would be lower-latency but WASM-in-worklet requires more
  // complex Vite configuration. ScriptProcessorNode is deprecated but still
  // supported — expect deprecation warnings in DevTools.
  const processor = ctx.createScriptProcessor(4096, 1, 1);

  const inputAccum = new Float32Array(FRAME_SIZE);
  let inputOffset = 0;
  const pendingFrames: Float32Array[] = [];
  let pendingHead = 0;
  let outputPendingOffset = 0;

  processor.onaudioprocess = (e: AudioProcessingEvent) => {
    const input  = e.inputBuffer.getChannelData(0);
    const output = e.outputBuffer.getChannelData(0);

    // ── Feed input into RNNoise 480-sample frames ──────────────────────
    let iPos = 0;
    while (iPos < input.length) {
      const toCopy = Math.min(FRAME_SIZE - inputOffset, input.length - iPos);
      inputAccum.set(input.subarray(iPos, iPos + toCopy), inputOffset);
      inputOffset += toCopy;
      iPos += toCopy;

      if (inputOffset === FRAME_SIZE) {
        // RNNoise expects int16-range floats [-32768, 32767]; Web Audio gives [-1, 1]
        const heapIn = inPtr >> 2;
        for (let i = 0; i < FRAME_SIZE; i++) {
          module.HEAPF32[heapIn + i] = inputAccum[i] * 32768;
        }
        module._rnnoise_process_frame(state, outPtr, inPtr);
        // Scale output back to Web Audio range [-1, 1]
        const heapOut = outPtr >> 2;
        const processed = new Float32Array(FRAME_SIZE);
        for (let i = 0; i < FRAME_SIZE; i++) {
          processed[i] = module.HEAPF32[heapOut + i] / 32768;
        }
        pendingFrames.push(processed);
        inputOffset = 0;
      }
    }

    // ── Drain pending processed frames into output ─────────────────────
    let oPos = 0;
    while (oPos < output.length && pendingHead < pendingFrames.length) {
      const frame = pendingFrames[pendingHead];
      const toCopy = Math.min(frame.length - outputPendingOffset, output.length - oPos);
      output.set(frame.subarray(outputPendingOffset, outputPendingOffset + toCopy), oPos);
      outputPendingOffset += toCopy;
      oPos += toCopy;
      if (outputPendingOffset >= frame.length) {
        pendingHead++;
        outputPendingOffset = 0;
      }
    }
    // Compact consumed frames to prevent unbounded growth
    if (pendingHead > 0) {
      pendingFrames.splice(0, pendingHead);
      pendingHead = 0;
    }
  };

  // source → gainNode → processor → dest
  source.connect(gainNode);
  gainNode.connect(processor);
  processor.connect(dest);

  let disposed = false;
  return {
    processedStream: dest.stream,
    setInputGain: (gain: number) => { gainNode.gain.value = gain; },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      try {
        source.disconnect();
        gainNode.disconnect();
        processor.disconnect();
        module._rnnoise_destroy(state);
        module._free(inPtr);
        module._free(outPtr);
        ctx.close();
      } catch {
        // Ignore errors during cleanup — call may already be torn down
      }
    },
  };
}
