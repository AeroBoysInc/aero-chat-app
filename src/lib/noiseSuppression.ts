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

// ─── Noise gate ─────────────────────────────────────────────────────────────
// Monitors audio level and smoothly attenuates output when below the speaking
// threshold. Kills residual hiss/hum during silence — same technique as
// Discord and Zoom use alongside their ML models.
//
// The threshold is driven by audioStore.inputSensitivity (0–100).
// 0 = most sensitive (gate barely closes), 100 = least sensitive (gate closes aggressively).
// Maps to a 0.002–0.08 normalized range via exponential curve for natural feel.

import { useAudioStore } from '../store/audioStore';

const GATE_ATTACK_MS       = 8;      // ramp to full volume (fast — don't clip start of words)
const GATE_RELEASE_MS      = 120;    // ramp to silence (gradual — avoid chopping word tails)
const GATE_FLOOR           = 0.0;    // minimum gain when gate is closed (0 = full silence)
const GATE_POLL_MS         = 15;     // how often we check levels

/** Convert inputSensitivity (0–100) to a normalized open threshold (0.002–0.08). */
function sensitivityToThreshold(sensitivity: number): number {
  const t = Math.max(0, Math.min(100, sensitivity)) / 100; // 0–1
  // Exponential curve: low sensitivity → barely closes, high → aggressive
  return 0.002 + (0.08 - 0.002) * (t * t);
}

interface NoiseGate {
  gateGain: GainNode;
  analyser: AnalyserNode;
  intervalId: ReturnType<typeof setInterval>;
}

// ─── Live mic level for settings UI meter ───────────────────────────────────
// Active pipelines register their analyser so the settings panel can read
// real-time mic input level without creating its own stream.

let _activePipelineAnalyser: AnalyserNode | null = null;

/** Returns the current mic input level (0–1) from the active pipeline, or 0 if none. */
export function getLiveMicLevel(): number {
  if (!_activePipelineAnalyser) return 0;
  const buf = new Uint8Array(_activePipelineAnalyser.frequencyBinCount);
  _activePipelineAnalyser.getByteFrequencyData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i];
  return sum / buf.length / 255;
}

// ─── High-pass filter ───────────────────────────────────────────────────────
// Cuts low-frequency rumble (AC hum, fans, room resonance) below ~85Hz.
// Human speech fundamentals start around 85Hz; most energy is 100Hz+.
// This alone removes 20-40% of typical background noise.

function createHighPass(ctx: AudioContext): BiquadFilterNode {
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 85;
  hp.Q.value = 0.7; // Butterworth — flat passband, no resonance
  return hp;
}

// ─── Voice clarity EQ ───────────────────────────────────────────────────────
// Shapes the frequency spectrum to reduce room sound and boost articulation.
// Same technique podcast engineers use to make voices sound "close-mic'd":
//   1. Cut mud    (~250Hz, -4dB)  — where room boom and boxiness live
//   2. Cut honk   (~400Hz, -2dB)  — nasal "boxy" room resonance
//   3. Boost presence (~3kHz, +3dB) — consonant clarity, makes words cut through
//   4. Boost air  (~5.5kHz, +2dB) — crispness and "breathiness"

interface VoiceEQ {
  nodes: BiquadFilterNode[];
  first: BiquadFilterNode;
  last: BiquadFilterNode;
}

function createVoiceEQ(ctx: AudioContext): VoiceEQ {
  const mudCut = ctx.createBiquadFilter();
  mudCut.type = 'peaking';
  mudCut.frequency.value = 250;
  mudCut.Q.value = 1.2;
  mudCut.gain.value = -4;

  const honkCut = ctx.createBiquadFilter();
  honkCut.type = 'peaking';
  honkCut.frequency.value = 400;
  honkCut.Q.value = 1.0;
  honkCut.gain.value = -2;

  const presence = ctx.createBiquadFilter();
  presence.type = 'peaking';
  presence.frequency.value = 3000;
  presence.Q.value = 0.8;
  presence.gain.value = 3;

  const air = ctx.createBiquadFilter();
  air.type = 'peaking';
  air.frequency.value = 5500;
  air.Q.value = 0.7;
  air.gain.value = 2;

  // Chain: mudCut → honkCut → presence → air
  mudCut.connect(honkCut);
  honkCut.connect(presence);
  presence.connect(air);

  return { nodes: [mudCut, honkCut, presence, air], first: mudCut, last: air };
}

// ─── Compressor / limiter ───────────────────────────────────────────────────
// Prevents loud peaks from spiking painfully. Sits at the end of the chain
// so all processed audio is peak-limited before leaving the pipeline.

function createCompressor(ctx: AudioContext): DynamicsCompressorNode {
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -24;  // dB — start compressing above this level
  comp.knee.value      = 12;   // dB — soft knee for natural-sounding compression
  comp.ratio.value     = 6;    // 6:1 — aggressive enough to tame spikes
  comp.attack.value    = 0.003; // 3ms — fast attack catches transients
  comp.release.value   = 0.15;  // 150ms — smooth release avoids pumping
  return comp;
}

function createNoiseGate(ctx: AudioContext): NoiseGate {
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.5;

  const gateGain = ctx.createGain();
  gateGain.gain.value = GATE_FLOOR; // start closed

  // Register as the active pipeline analyser for the settings UI meter
  _activePipelineAnalyser = analyser;

  const buf = new Uint8Array(analyser.frequencyBinCount);
  let gateOpen = false;

  const intervalId = setInterval(() => {
    // Read threshold from audioStore on every tick so slider changes apply instantly
    const openThreshold  = sensitivityToThreshold(useAudioStore.getState().inputSensitivity);
    const closeThreshold = openThreshold * 0.65; // hysteresis

    analyser.getByteFrequencyData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i];
    const level = sum / buf.length / 255;

    if (!gateOpen && level > openThreshold) {
      gateOpen = true;
      gateGain.gain.cancelScheduledValues(ctx.currentTime);
      gateGain.gain.setTargetAtTime(1.0, ctx.currentTime, GATE_ATTACK_MS / 1000 / 3);
    } else if (gateOpen && level < closeThreshold) {
      gateOpen = false;
      gateGain.gain.cancelScheduledValues(ctx.currentTime);
      gateGain.gain.setTargetAtTime(GATE_FLOOR, ctx.currentTime, GATE_RELEASE_MS / 1000 / 3);
    }
  }, GATE_POLL_MS);

  return { gateGain, analyser, intervalId };
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

  const source     = ctx.createMediaStreamSource(rawStream);
  const highpass   = createHighPass(ctx);
  const voiceEQ    = createVoiceEQ(ctx);
  const gainNode   = ctx.createGain();
  const dest       = ctx.createMediaStreamDestination();
  const gate       = createNoiseGate(ctx);
  const compressor = createCompressor(ctx);

  // source → highpass → voiceEQ → gainNode → analyser → gateGain → compressor → dest
  source.connect(highpass);
  highpass.connect(voiceEQ.first);
  voiceEQ.last.connect(gainNode);
  gainNode.connect(gate.analyser);
  gate.analyser.connect(gate.gateGain);
  gate.gateGain.connect(compressor);
  compressor.connect(dest);

  let disposed = false;
  return {
    processedStream: dest.stream,
    setInputGain: (gain: number) => { gainNode.gain.value = gain; },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      clearInterval(gate.intervalId);
      if (_activePipelineAnalyser === gate.analyser) _activePipelineAnalyser = null;
      try { source.disconnect(); highpass.disconnect(); voiceEQ.nodes.forEach(n => n.disconnect()); gainNode.disconnect(); gate.analyser.disconnect(); gate.gateGain.disconnect(); compressor.disconnect(); ctx.close(); } catch {}
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
  const highpass = createHighPass(ctx);
  const voiceEQ  = createVoiceEQ(ctx);
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

  const gate       = createNoiseGate(ctx);
  const compressor = createCompressor(ctx);

  // source → highpass → voiceEQ → gainNode → workletNode → analyser → gateGain → compressor → dest
  source.connect(highpass);
  highpass.connect(voiceEQ.first);
  voiceEQ.last.connect(gainNode);
  gainNode.connect(workletNode);
  workletNode.connect(gate.analyser);
  gate.analyser.connect(gate.gateGain);
  gate.gateGain.connect(compressor);
  compressor.connect(dest);

  let disposed = false;
  return {
    processedStream: dest.stream,
    setInputGain: (gain: number) => { gainNode.gain.value = gain; },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      clearInterval(gate.intervalId);
      if (_activePipelineAnalyser === gate.analyser) _activePipelineAnalyser = null;
      try {
        workletNode.port.postMessage({ type: 'dispose' });
        source.disconnect();
        highpass.disconnect();
        voiceEQ.nodes.forEach(n => n.disconnect());
        gainNode.disconnect();
        workletNode.disconnect();
        gate.analyser.disconnect();
        gate.gateGain.disconnect();
        compressor.disconnect();
        ctx.close();
      } catch {
        // Ignore errors during cleanup
      }
    },
  };
}
