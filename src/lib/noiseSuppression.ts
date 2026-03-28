/**
 * RNNoise-based noise suppression pipeline.
 *
 * Creates a Web Audio pipeline that processes a raw MediaStream through
 * the RNNoise ML model (via WASM) and returns a cleaned processed stream.
 *
 * The WASM module is loaded once and cached — subsequent calls reuse it.
 * Falls back to the raw stream if WASM fails to load.
 */

interface RNNoiseModule {
  newState(): number;
  deleteState(state: number): void;
  processFrame(state: number, input: Float32Array, output: Float32Array): number;
}

export interface NoisePipeline {
  /** Use this stream for WebRTC tracks and MediaRecorder — it contains cleaned audio. */
  processedStream: MediaStream;
  /** Closes the AudioContext, frees WASM state, stops processed tracks. */
  dispose: () => void;
}

// Cached after first successful load — never re-fetched.
let _wasmModulePromise: Promise<RNNoiseModule> | null = null;

async function getRNNoiseModule(): Promise<RNNoiseModule> {
  if (!_wasmModulePromise) {
    _wasmModulePromise = import('@jitsi/rnnoise-wasm')
      .then(m => m.default())
      .catch(err => {
        _wasmModulePromise = null; // allow retry on next call
        return Promise.reject(err);
      });
  }
  return _wasmModulePromise;
}

/**
 * Builds a noise suppression pipeline around rawStream.
 *
 * Returns a NoisePipeline whose processedStream contains the cleaned audio.
 * If rawStream has no audio tracks, or if the WASM fails to load, returns
 * a no-op pipeline wrapping the original stream so callers never need to
 * branch on success.
 */
export async function createNoisePipeline(rawStream: MediaStream): Promise<NoisePipeline> {
  // No audio — nothing to process
  if (rawStream.getAudioTracks().length === 0) {
    return { processedStream: rawStream, dispose: () => {} };
  }

  let rnnoise: RNNoiseModule;
  try {
    rnnoise = await getRNNoiseModule();
  } catch (err) {
    console.warn('[NC] RNNoise WASM failed to load, falling back to raw stream:', err);
    return { processedStream: rawStream, dispose: () => {} };
  }

  const ctx = new AudioContext({ sampleRate: 48000 });
  if (ctx.state === 'suspended') await ctx.resume();

  const state = rnnoise.newState();
  const source = ctx.createMediaStreamSource(rawStream);
  const dest = ctx.createMediaStreamDestination();

  // RNNoise processes audio in 480-sample frames at 48 kHz.
  // ScriptProcessorNode bufferSize must be a power of 2; 4096 ≈ 85 ms
  // of latency — acceptable for voice chat. (AudioWorklet would be ideal
  // but requires WASM available inside the worklet scope, which adds
  // significant Vite configuration complexity.)
  const FRAME_SIZE = 480;
  const processor = ctx.createScriptProcessor(4096, 1, 1);

  const inputAccum = new Float32Array(FRAME_SIZE);
  let inputOffset = 0;
  const pendingFrames: Float32Array[] = [];
  let pendingHead = 0;        // index of the first unconsumed frame
  let outputPendingOffset = 0;

  processor.onaudioprocess = (e: AudioProcessingEvent) => {
    const input = e.inputBuffer.getChannelData(0);
    const output = e.outputBuffer.getChannelData(0);

    // ── Feed input into RNNoise 480-sample frames ──────────────────────
    let iPos = 0;
    while (iPos < input.length) {
      const toCopy = Math.min(FRAME_SIZE - inputOffset, input.length - iPos);
      inputAccum.set(input.subarray(iPos, iPos + toCopy), inputOffset);
      inputOffset += toCopy;
      iPos += toCopy;

      if (inputOffset === FRAME_SIZE) {
        const processed = new Float32Array(FRAME_SIZE);
        rnnoise.processFrame(state, inputAccum, processed);
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

  source.connect(processor);
  processor.connect(dest);

  let disposed = false;
  return {
    processedStream: dest.stream,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      try {
        source.disconnect();
        processor.disconnect();
        rnnoise.deleteState(state);
        ctx.close();
      } catch {
        // Ignore errors during cleanup — call may already be torn down
      }
    },
  };
}
