/**
 * RNNoise-based noise suppression via AudioWorklet + gain-only pipeline.
 *
 * The AudioWorklet runs RNNoise in the audio rendering thread (off main thread),
 * cutting latency from ~85ms (old ScriptProcessorNode) to ~10ms.
 *
 * The WASM binary is loaded from /rnnoise.wasm (public/), compiled in the main
 * thread, then the WebAssembly.Module is transferred to the worklet for
 * instantiation.
 */

export interface NoisePipeline {
  /** Use this stream for WebRTC tracks and MediaRecorder — it contains processed audio. */
  processedStream: MediaStream;
  /** Adjusts microphone input gain. gain=1.0 is unity (100%); 0.5 = 50%; 1.5 = 150%. */
  setInputGain(gain: number): void;
  /** Closes the AudioContext, frees WASM state, stops processed tracks. */
  dispose: () => void;
}

// Cached compiled WASM module — shared across pipelines
let _wasmModulePromise: Promise<WebAssembly.Module> | null = null;

async function getCompiledWasmModule(): Promise<WebAssembly.Module> {
  if (!_wasmModulePromise) {
    _wasmModulePromise = WebAssembly.compileStreaming(fetch('/rnnoise.wasm'))
      .catch(err => {
        _wasmModulePromise = null;
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
 * Builds a noise suppression + gain pipeline using AudioWorklet.
 * Graph: source → gainNode → AudioWorkletNode(RNNoise) → dest
 *
 * Returns a NoisePipeline whose processedStream contains the cleaned audio.
 * Falls back to gain-only if WASM or AudioWorklet setup fails.
 */
export async function createNoisePipeline(rawStream: MediaStream): Promise<NoisePipeline> {
  if (rawStream.getAudioTracks().length === 0) {
    return { processedStream: rawStream, setInputGain: () => {}, dispose: () => {} };
  }

  let wasmModule: WebAssembly.Module;
  try {
    wasmModule = await getCompiledWasmModule();
  } catch (err) {
    console.warn('[NC] RNNoise WASM failed to load, falling back to gain-only pipeline:', err);
    return createGainPipeline(rawStream);
  }

  const ctx = new AudioContext({ sampleRate: 48000 });
  if (ctx.state === 'suspended') await ctx.resume();

  // Register the worklet processor
  try {
    await ctx.audioWorklet.addModule('/rnnoise-worklet.js');
  } catch (err) {
    console.warn('[NC] AudioWorklet failed to load, falling back to gain-only pipeline:', err);
    ctx.close();
    return createGainPipeline(rawStream);
  }

  const source   = ctx.createMediaStreamSource(rawStream);
  const gainNode = ctx.createGain();
  const dest     = ctx.createMediaStreamDestination();

  const workletNode = new AudioWorkletNode(ctx, 'rnnoise-processor', {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1],
  });

  // Send the compiled WASM module to the worklet for instantiation
  workletNode.port.postMessage({ type: 'init', wasmModule });

  // Wait for worklet to confirm it's ready (with timeout)
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Worklet init timeout')), 5000);
      workletNode.port.onmessage = (e) => {
        if (e.data.type === 'ready') {
          clearTimeout(timeout);
          resolve();
        } else if (e.data.type === 'error') {
          clearTimeout(timeout);
          reject(new Error(e.data.message));
        }
      };
    });
  } catch (err) {
    console.warn('[NC] Worklet WASM init failed, falling back to gain-only:', err);
    workletNode.disconnect();
    source.disconnect();
    gainNode.disconnect();
    ctx.close();
    return createGainPipeline(rawStream);
  }

  // source → gainNode → workletNode → dest
  source.connect(gainNode);
  gainNode.connect(workletNode);
  workletNode.connect(dest);

  let disposed = false;
  return {
    processedStream: dest.stream,
    setInputGain: (gain: number) => { gainNode.gain.value = gain; },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      try {
        workletNode.port.postMessage({ type: 'dispose' });
        source.disconnect();
        gainNode.disconnect();
        workletNode.disconnect();
        ctx.close();
      } catch {
        // Ignore errors during cleanup
      }
    },
  };
}
