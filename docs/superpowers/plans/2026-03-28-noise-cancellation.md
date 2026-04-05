# Real Noise Cancellation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the browser-hint `noiseSuppression` constraint with a real ML-based RNNoise WASM pipeline that intercepts the MediaStream after capture, applies to voice calls and voice message recording, and supports real-time toggle during live calls via `RTCPeerConnection.replaceTrack`.

**Architecture:** A new `src/lib/noiseSuppression.ts` module wraps `@jitsi/rnnoise-wasm` behind a `createNoisePipeline(rawStream)` function that builds a Web Audio `ScriptProcessorNode` pipeline (raw stream → RNNoise WASM → processed stream). The WASM module is lazy-loaded once and cached. `callStore.ts` gains `_rawAudioStream` / `_noisePipeline` module-level refs and a `setNoiseCancellation` action that handles live track replacement via `sender.replaceTrack`. `ChatWindow.tsx` and `GeneralPanel.tsx` are updated to use the new pipeline and action.

**Tech Stack:** `@jitsi/rnnoise-wasm`, Web Audio API (`ScriptProcessorNode`, `AudioContext`), WebRTC (`RTCPeerConnection.getSenders`, `replaceTrack`), `vite-plugin-wasm`, `vite-plugin-top-level-await`, Vitest

---

## File Map

| File | Change |
|---|---|
| `src/lib/noiseSuppression.ts` | Create — WASM loading, pipeline construction, `NoisePipeline` interface |
| `src/lib/noiseSuppression.test.ts` | Create — Vitest tests for fallback and pipeline interface |
| `src/store/callStore.ts` | Modify — module-level refs, pipeline integration at call start/answer, `setNoiseCancellation`, hangUp cleanup |
| `src/components/chat/ChatWindow.tsx` | Modify — `recordingPipelineRef`, pipeline in `startRecording`, dispose in cancel/stop |
| `src/components/settings/GeneralPanel.tsx` | Modify — toggle calls `callStore.setNoiseCancellation` instead of `audioStore.set` |
| `vite.config.ts` | Modify — add `vite-plugin-wasm` and `vite-plugin-top-level-await` plugins |

---

## Task 1: Install packages, configure Vite, create `noiseSuppression.ts`

**Files:**
- Modify: `vite.config.ts`
- Create: `src/lib/noiseSuppression.ts`
- Create: `src/lib/noiseSuppression.test.ts`

---

- [ ] **Step 1: Install packages**

```bash
cd aero-chat-app
pnpm add @jitsi/rnnoise-wasm
pnpm add -D vite-plugin-wasm vite-plugin-top-level-await
```

- [ ] **Step 2: Update `vite.config.ts` to enable WASM**

Replace the entire file:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react(), wasm(), topLevelAwait()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    env: {
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
}));
```

- [ ] **Step 3: Write failing tests for `noiseSuppression.ts`**

Create `src/lib/noiseSuppression.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @jitsi/rnnoise-wasm before importing noiseSuppression
vi.mock('@jitsi/rnnoise-wasm', () => ({
  default: vi.fn(),
}));

// Mock AudioContext and related Web Audio APIs
const mockConnect = vi.fn();
const mockDisconnect = vi.fn();
const mockClose = vi.fn();
const mockResume = vi.fn().mockResolvedValue(undefined);
const mockCreateMediaStreamSource = vi.fn(() => ({ connect: mockConnect, disconnect: mockDisconnect }));
const mockCreateScriptProcessor = vi.fn(() => ({
  connect: mockConnect,
  disconnect: mockDisconnect,
  onaudioprocess: null,
}));
const mockDestinationStream = new EventTarget() as MediaStream;
const mockCreateMediaStreamDestination = vi.fn(() => ({ stream: mockDestinationStream }));

vi.stubGlobal('AudioContext', vi.fn(() => ({
  state: 'running',
  resume: mockResume,
  createMediaStreamSource: mockCreateMediaStreamSource,
  createScriptProcessor: mockCreateScriptProcessor,
  createMediaStreamDestination: mockCreateMediaStreamDestination,
  close: mockClose,
})));

function makeMockStream(hasAudio = true): MediaStream {
  const track = { kind: 'audio', stop: vi.fn() } as unknown as MediaStreamTrack;
  return {
    getAudioTracks: () => (hasAudio ? [track] : []),
    getTracks: () => (hasAudio ? [track] : []),
  } as unknown as MediaStream;
}

describe('createNoisePipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset module-level WASM cache between tests
    vi.resetModules();
  });

  it('returns raw stream unchanged when input has no audio tracks', async () => {
    const { createNoisePipeline } = await import('./noiseSuppression');
    const rawStream = makeMockStream(false);
    const pipeline = await createNoisePipeline(rawStream);
    expect(pipeline.processedStream).toBe(rawStream);
    pipeline.dispose(); // should not throw
  });

  it('returns raw stream as fallback when WASM fails to load', async () => {
    const rnnoiseModule = await import('@jitsi/rnnoise-wasm');
    (rnnoiseModule.default as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('WASM load failed'));

    const { createNoisePipeline } = await import('./noiseSuppression');
    const rawStream = makeMockStream(true);
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const pipeline = await createNoisePipeline(rawStream);
    expect(pipeline.processedStream).toBe(rawStream);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[NC]'), expect.anything());
    pipeline.dispose();
  });

  it('returns a processedStream and a dispose function when WASM loads successfully', async () => {
    const mockState = 42;
    const mockRNNoiseModule = {
      newState: vi.fn(() => mockState),
      deleteState: vi.fn(),
      processFrame: vi.fn(),
    };
    const rnnoiseModule = await import('@jitsi/rnnoise-wasm');
    (rnnoiseModule.default as ReturnType<typeof vi.fn>).mockResolvedValue(mockRNNoiseModule);

    const { createNoisePipeline } = await import('./noiseSuppression');
    const rawStream = makeMockStream(true);

    const pipeline = await createNoisePipeline(rawStream);
    expect(pipeline.processedStream).toBe(mockDestinationStream);
    expect(mockRNNoiseModule.newState).toHaveBeenCalled();

    pipeline.dispose();
    expect(mockRNNoiseModule.deleteState).toHaveBeenCalledWith(mockState);
    expect(mockClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Run tests — confirm they fail**

```bash
cd aero-chat-app && pnpm test --run src/lib/noiseSuppression.test.ts
```

Expected: FAIL — `noiseSuppression.ts` doesn't exist yet.

- [ ] **Step 5: Create `src/lib/noiseSuppression.ts`**

```typescript
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
    _wasmModulePromise = import('@jitsi/rnnoise-wasm').then(m => m.default());
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
    while (oPos < output.length && pendingFrames.length > 0) {
      const frame = pendingFrames[0];
      const toCopy = Math.min(frame.length - outputPendingOffset, output.length - oPos);
      output.set(frame.subarray(outputPendingOffset, outputPendingOffset + toCopy), oPos);
      outputPendingOffset += toCopy;
      oPos += toCopy;
      if (outputPendingOffset >= frame.length) {
        pendingFrames.shift();
        outputPendingOffset = 0;
      }
    }
  };

  source.connect(processor);
  processor.connect(dest);

  return {
    processedStream: dest.stream,
    dispose: () => {
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
```

- [ ] **Step 6: Run tests — confirm they pass**

```bash
cd aero-chat-app && pnpm test --run src/lib/noiseSuppression.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 7: Verify build**

```bash
cd aero-chat-app && pnpm build
```

Expected: clean build, no TypeScript errors.

- [ ] **Step 8: Commit**

```bash
cd aero-chat-app && git add src/lib/noiseSuppression.ts src/lib/noiseSuppression.test.ts vite.config.ts package.json pnpm-lock.yaml
git commit -m "feat: add RNNoise WASM noise suppression pipeline

Creates src/lib/noiseSuppression.ts with createNoisePipeline().
Lazy-loads @jitsi/rnnoise-wasm on first use, processes audio via
ScriptProcessorNode in 480-sample RNNoise frames. Falls back to
raw stream on WASM load failure."
```

---

## Task 2: Update `callStore.ts` — pipeline at call start/answer, `setNoiseCancellation`, hangUp cleanup

**Files:**
- Modify: `src/store/callStore.ts`

---

- [ ] **Step 1: Add module-level refs and import**

At the top of `src/store/callStore.ts`, add the import after the existing imports:

```typescript
import { createNoisePipeline, type NoisePipeline } from '../lib/noiseSuppression';
```

Then add two module-level refs alongside the existing ones (after `let _pendingOffer`):

```typescript
let _rawAudioStream: MediaStream | null = null;  // unprocessed getUserMedia audio
let _noisePipeline:  NoisePipeline | null = null; // active NC pipeline, null when off
```

- [ ] **Step 2: Add `setNoiseCancellation` to the `CallState` interface**

In the `CallState` interface, after `stopScreenShare(): void;`, add:

```typescript
setNoiseCancellation(enabled: boolean): Promise<void>;
```

- [ ] **Step 3: Update `startCall` — store raw stream, apply pipeline to PC audio**

In `startCall`, find the block that adds audio to the peer connection (around line 277):

```typescript
// Add audio
stream.getAudioTracks().forEach(t => _peerConnection!.addTrack(t, stream));
```

Replace the lines `const nc = ...`, `const audioConstraints = ...` and the audio-add block with:

```typescript
    const nc = useAudioStore.getState().noiseCancellation;
    const audioConstraints = { echoCancellation: true, noiseSuppression: false, autoGainControl: false };
```

(We disable the browser's own suppression since RNNoise handles it.)

Then after `getUserMedia` succeeds and `_peerConnection = createPeerConnection()`, store the raw stream and build the pipeline before adding tracks:

```typescript
    // ── Store raw stream and build NC pipeline ────────────────────────
    _rawAudioStream = stream;
    if (nc) {
      _noisePipeline = await createNoisePipeline(stream);
    }

    // Add audio — use processed stream if NC is on, raw stream if off
    const audioSource = nc && _noisePipeline ? _noisePipeline.processedStream : stream;
    audioSource.getAudioTracks().forEach(t => _peerConnection!.addTrack(t, stream));
```

Replace the old audio-add line:
```typescript
    stream.getAudioTracks().forEach(t => _peerConnection!.addTrack(t, stream));
```

- [ ] **Step 4: Update `answerCall` — same pattern**

In `answerCall`, apply the same changes as Step 3:

Replace:
```typescript
    const nc = useAudioStore.getState().noiseCancellation;
    const audioConstraints = { echoCancellation: true, noiseSuppression: nc, autoGainControl: nc };
```
With:
```typescript
    const nc = useAudioStore.getState().noiseCancellation;
    const audioConstraints = { echoCancellation: true, noiseSuppression: false, autoGainControl: false };
```

After `_peerConnection = createPeerConnection()`, add the raw stream + pipeline block before adding tracks:

```typescript
    // ── Store raw stream and build NC pipeline ────────────────────────
    _rawAudioStream = stream;
    if (nc) {
      _noisePipeline = await createNoisePipeline(stream);
    }

    const audioSource = nc && _noisePipeline ? _noisePipeline.processedStream : stream;
    audioSource.getAudioTracks().forEach(t => _peerConnection!.addTrack(t, stream));
```

Replace the old line:
```typescript
    stream.getAudioTracks().forEach(t => _peerConnection!.addTrack(t, stream));
```

- [ ] **Step 5: Add `setNoiseCancellation` action to the store**

Inside `useCallStore = create<CallState>((set, get) => ({ ... }))`, add the new action after `stopScreenShare`:

```typescript
  setNoiseCancellation: async (enabled: boolean) => {
    // Persist the preference regardless of call state
    useAudioStore.getState().set({ noiseCancellation: enabled });

    // Nothing to do if there's no active call
    if (!_peerConnection || !_rawAudioStream) return;

    // Build or tear down the pipeline
    if (enabled) {
      _noisePipeline = await createNoisePipeline(_rawAudioStream);
    } else {
      _noisePipeline?.dispose();
      _noisePipeline = null;
    }

    // Swap the audio track on the peer connection so the remote side hears the change
    const newAudioTrack = enabled
      ? _noisePipeline!.processedStream.getAudioTracks()[0]
      : _rawAudioStream.getAudioTracks()[0];
    const sender = _peerConnection.getSenders().find(s => s.track?.kind === 'audio');
    try {
      if (sender && newAudioTrack) await sender.replaceTrack(newAudioTrack);
    } catch (err) {
      console.error('[NC] replaceTrack failed:', err);
    }
  },
```

- [ ] **Step 6: Update `hangUp` to dispose pipeline and clear refs**

In `hangUp`, find step 6 "Null all module-level refs":

```typescript
    // 6. Null all module-level refs
    _peerConnection = null;
    _signalingChannel = null;
    _screenStream = null;
    _cameraTrack = null;
    _pendingOffer = null;
```

Replace with:

```typescript
    // 6. Null all module-level refs
    _peerConnection = null;
    _signalingChannel = null;
    _screenStream = null;
    _cameraTrack = null;
    _pendingOffer = null;
    _noisePipeline?.dispose();
    _noisePipeline = null;
    _rawAudioStream = null;
```

- [ ] **Step 7: Build check**

```bash
cd aero-chat-app && pnpm build
```

Expected: clean build, no TypeScript errors.

- [ ] **Step 8: Commit**

```bash
cd aero-chat-app && git add src/store/callStore.ts
git commit -m "feat: integrate RNNoise pipeline into call audio path

startCall and answerCall now route audio through createNoisePipeline
when NC is enabled. setNoiseCancellation() handles live replaceTrack
for mid-call toggle. hangUp cleans up pipeline and raw stream refs."
```

---

## Task 3: Update `ChatWindow.tsx` — voice message recording pipeline

**Files:**
- Modify: `src/components/chat/ChatWindow.tsx`

---

- [ ] **Step 1: Add import and ref**

At the top of `ChatWindow.tsx`, add the import alongside existing lib imports:

```typescript
import { createNoisePipeline, type NoisePipeline } from '../../lib/noiseSuppression';
```

In the component body, alongside the other `useRef` declarations (near `mediaRecorderRef`, `audioChunksRef`), add:

```typescript
const recordingPipelineRef = useRef<NoisePipeline | null>(null);
```

- [ ] **Step 2: Update `startRecording` to use the pipeline**

Find `startRecording()` and replace the body:

```typescript
  async function startRecording() {
    try {
      const audioConstraints: MediaTrackConstraints = {
        noiseSuppression: false,
        echoCancellation: true,
        ...(inputDeviceId ? { deviceId: { exact: inputDeviceId } } : {}),
      };
      const rawStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });

      // Route through RNNoise pipeline when NC is enabled
      let recordStream = rawStream;
      if (noiseCancellation) {
        const pipeline = await createNoisePipeline(rawStream);
        recordingPipelineRef.current = pipeline;
        recordStream = pipeline.processedStream;
      }

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus' : 'audio/webm';
      const mr = new MediaRecorder(recordStream, { mimeType });
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = () => {
        rawStream.getTracks().forEach(t => t.stop());
        recordingPipelineRef.current?.dispose();
        recordingPipelineRef.current = null;
      };
      mr.start(100);
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      setRecordDuration(0);
      recordTimerRef.current = setInterval(() => {
        setRecordDuration(d => {
          if (d >= 60) { stopAndSendRecording(); return d; }
          return d + 1;
        });
      }, 1000);
    } catch {
      setSendError('Microphone access denied.');
    }
  }
```

- [ ] **Step 3: Update `cancelRecording` to dispose the pipeline**

Replace `cancelRecording`:

```typescript
  function cancelRecording() {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    recordingPipelineRef.current?.dispose();
    recordingPipelineRef.current = null;
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordDuration(0);
  }
```

- [ ] **Step 4: Build check**

```bash
cd aero-chat-app && pnpm build
```

Expected: clean build, no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
cd aero-chat-app && git add src/components/chat/ChatWindow.tsx
git commit -m "feat: apply RNNoise pipeline to voice message recording

startRecording() routes audio through createNoisePipeline when NC
is enabled. Pipeline is disposed in mr.onstop and cancelRecording."
```

---

## Task 4: Update `GeneralPanel.tsx` — toggle calls `setNoiseCancellation`

**Files:**
- Modify: `src/components/settings/GeneralPanel.tsx`

---

- [ ] **Step 1: Add callStore import**

In `GeneralPanel.tsx`, add the import alongside the existing store imports:

```typescript
import { useCallStore } from '../../store/callStore';
```

- [ ] **Step 2: Update the NC toggle button**

Find the toggle button (around line 125):

```typescript
          <button
            onClick={() => set({ noiseCancellation: !noiseCancellation })}
```

Replace the `onClick` handler:

```typescript
          <button
            onClick={() => useCallStore.getState().setNoiseCancellation(!noiseCancellation)}
```

- [ ] **Step 3: Build check**

```bash
cd aero-chat-app && pnpm build
```

Expected: clean build, no TypeScript errors.

- [ ] **Step 4: Run full test suite**

```bash
cd aero-chat-app && pnpm test --run
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd aero-chat-app && git add src/components/settings/GeneralPanel.tsx
git commit -m "feat: NC toggle routes through callStore.setNoiseCancellation

Ensures mid-call toggle flows through replaceTrack logic. When no
call is active, setNoiseCancellation() still persists the preference
to audioStore for the next call."
```

---

## Final Verification

- [ ] Start a call with NC on — keyboard clicks and fan noise should be suppressed for the remote peer
- [ ] Toggle NC off mid-call — suppression stops in real time, call continues uninterrupted
- [ ] Toggle NC on mid-call — suppression resumes
- [ ] Record a voice message with NC on — playback should be clean
- [ ] Toggle NC while not in a call — preference is saved, applies on next call start
- [ ] `pnpm build` passes cleanly
