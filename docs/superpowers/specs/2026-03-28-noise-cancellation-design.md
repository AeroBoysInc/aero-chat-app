# Real Noise Cancellation Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the non-functional browser-hint noise suppression with real ML-based noise cancellation using RNNoise WASM, applying to voice calls and voice message recording, with real-time toggle during live calls.

**Tech Stack:** `@jitsi/rnnoise-wasm`, Web Audio API (AudioWorklet), WebRTC (`RTCPeerConnection.getSenders`)

---

## Background

The current implementation passes `noiseSuppression: nc` to `getUserMedia` constraints. This is a browser hint only — Chrome applies minimal WebRTC built-in suppression, other engines vary. The toggle exists in `audioStore` and `GeneralPanel.tsx` but has no meaningful effect. Real noise cancellation requires intercepting the `MediaStream` post-capture and running an ML model over the PCM frames.

---

## Scope

Noise cancellation applies to:
- Voice calls (outbound audio track in WebRTC peer connection)
- Voice message recording (audio captured by `MediaRecorder` in `ChatWindow`)

Real-time toggle: changing the setting while a call is active takes effect immediately — the remote peer hears the change within one processing frame.

---

## Architecture

### New file: `src/lib/noiseSuppression.ts`

Single-responsibility module. Owns WASM loading, AudioContext lifecycle, and pipeline construction.

**Exported interface:**

```typescript
export interface NoisePipeline {
  processedStream: MediaStream;  // use for WebRTC tracks / MediaRecorder
  dispose: () => void;           // closes AudioContext, stops processed tracks
}

export async function createNoisePipeline(rawStream: MediaStream): Promise<NoisePipeline>
```

**Internals:**

- RNNoise WASM module is loaded once on first call and cached in a module-level promise — subsequent `createNoisePipeline` calls reuse the same WASM instance, paying zero extra load cost
- Pipeline: `MediaStreamAudioSourceNode` → `AudioWorkletNode` (RNNoise) → `MediaStreamDestinationNode`
- `AudioWorkletProcessor` runs RNNoise frame-by-frame (480 samples at 48kHz per frame, matching RNNoise's native frame size)
- `dispose()` closes the `AudioContext` and stops all tracks on `processedStream`
- **Fallback**: if WASM load fails (import error, unsupported environment), `createNoisePipeline` logs a warning and returns `{ processedStream: rawStream, dispose: () => {} }` — calls still work, suppression is silently absent

---

### Modified: `src/store/callStore.ts`

**Module-level refs added** (alongside existing `_localStream`):

```typescript
let _rawAudioStream: MediaStream | null = null;   // unprocessed getUserMedia stream
let _noisePipeline:  NoisePipeline | null = null;  // active pipeline, null when NC off
```

**`startCall` and `answerCall` changes:**

After `getUserMedia` succeeds:
1. Store raw stream: `_rawAudioStream = stream`
2. If `noiseCancellation` enabled: `_noisePipeline = await createNoisePipeline(stream)`
3. Construct the `MediaStream` added to `RTCPeerConnection` using `_noisePipeline?.processedStream ?? stream` for the audio track, and the raw stream's video track (if any)

The `_localStream` ref (used for local preview / mute) continues to point at the raw stream — local preview is unaffected by the pipeline.

**New action: `setNoiseCancellation(enabled: boolean)`**

```typescript
setNoiseCancellation: async (enabled: boolean) => {
  // 1. Persist preference
  useAudioStore.getState().set({ noiseCancellation: enabled });

  // 2. If no active call, done
  if (!_peerConnection || !_rawAudioStream) return;

  // 3. Create or destroy pipeline
  if (enabled) {
    _noisePipeline = await createNoisePipeline(_rawAudioStream);
  } else {
    _noisePipeline?.dispose();
    _noisePipeline = null;
  }

  // 4. Swap the audio track on the peer connection
  const newAudioTrack = enabled
    ? _noisePipeline!.processedStream.getAudioTracks()[0]
    : _rawAudioStream.getAudioTracks()[0];
  const sender = _peerConnection.getSenders().find(s => s.track?.kind === 'audio');
  if (sender && newAudioTrack) await sender.replaceTrack(newAudioTrack);
},
```

**`hangUp` changes:**

```typescript
_noisePipeline?.dispose();
_noisePipeline = null;
_rawAudioStream = null;
```

---

### Modified: `src/components/chat/ChatWindow.tsx`

**New ref:**

```typescript
const recordingPipelineRef = useRef<NoisePipeline | null>(null);
```

**`startRecording()` changes:**

After `getUserMedia`:
```typescript
let recordStream = rawStream;
if (noiseCancellation) {
  const pipeline = await createNoisePipeline(rawStream);
  recordingPipelineRef.current = pipeline;
  recordStream = pipeline.processedStream;
}
const recorder = new MediaRecorder(recordStream, { ... });
```

**`stopRecording()` / cancel changes:**

```typescript
recordingPipelineRef.current?.dispose();
recordingPipelineRef.current = null;
```

---

### Modified: `src/components/settings/GeneralPanel.tsx`

The toggle changes from calling `audioStore.set(...)` directly to calling `callStore.setNoiseCancellation(...)`:

```typescript
// Before
onClick={() => set({ noiseCancellation: !noiseCancellation })}

// After
onClick={() => callStore.getState().setNoiseCancellation(!noiseCancellation)}
```

This ensures mid-call toggling flows through the replaceTrack logic.

---

## Package

**Install:** `pnpm add @jitsi/rnnoise-wasm`

Vite handles the WASM asset via `vite-plugin-wasm` (add to `vite.config.ts` as needed) or a `?url` import. The AudioWorklet processor script is registered as a blob URL constructed at runtime so it works without a separate bundled file — the worklet source is a template literal string passed to `URL.createObjectURL(new Blob([src], { type: 'application/javascript' }))`.

The WASM (~73KB) is lazy-loaded on first `createNoisePipeline` call — never at app startup.

`noiseCancellation` defaults to `true` in `audioStore` (already the case) — users get real suppression by default.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| WASM load failure | Log warning, return raw stream — call continues |
| `replaceTrack` failure | Log error, NC preference still saved for next call |
| `AudioContext` suspended (browser autoplay policy) | `context.resume()` called before pipeline construction |
| `getUserMedia` for voice message returns no audio tracks | Skip pipeline construction |

---

## Testing

1. Start a call with NC on — remote peer should have noticeably cleaner audio (keyboard clicks, fan noise suppressed)
2. Toggle NC off mid-call — suppression stops in real time, call continues
3. Toggle NC on mid-call — suppression resumes, call continues
4. Record a voice message with NC on — playback should be clean
5. Record a voice message with NC off — raw audio
6. Toggle NC while not in a call — preference saved, applies on next call start
7. `pnpm build` passes with no TypeScript errors
