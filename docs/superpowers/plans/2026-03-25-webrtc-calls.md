# WebRTC Voice / Video / Screen Share Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 1-on-1 voice calls, video calls, and screen sharing to AeroChat using WebRTC peer-to-peer with Supabase Realtime Broadcast for signaling.

**Architecture:** `callStore` (Zustand) owns all serializable call state plus actions; module-level refs (`_peerConnection`, `_signalingChannel`, `_screenStream`, `_cameraTrack`, `_pendingOffer`) hold the mutable browser objects that must not live in Zustand. Incoming ring notifications travel via a per-user `call:ring:{userId}` Broadcast channel (App.tsx subscribes on mount). All subsequent signaling (answer, ICE, hang-up, screen-share events) uses a shared `call:{sortedIds}` channel. `CallView` renders as an `position: absolute; inset: 0` layer inside `ChatLayout`'s layer-host div — same pattern as GAME/DEV layers.

**Tech Stack:** WebRTC (`RTCPeerConnection`, `getUserMedia`, `getDisplayMedia`), Supabase Realtime Broadcast, Zustand 5, React 19, Lucide React icons, Tailwind + CSS custom properties (Frutiger Aero design system), Vitest + jsdom for unit tests.

**Spec:** `docs/superpowers/specs/2026-03-25-webrtc-calls-design.md`

---

## File Map

### New Files
| File | Purpose |
|---|---|
| `src/lib/webrtc.ts` | ICE server config + `createPeerConnection()` factory + `createBlackVideoTrack()` utility |
| `src/store/callStore.ts` | Full call state, module-level WebRTC refs, all call actions |
| `src/components/call/CallView.tsx` | Full-screen call layer (all 4 UI states) |
| `src/components/call/IncomingCallModal.tsx` | Ringing overlay shown to callee |
| `src/components/call/CallControls.tsx` | Auto-hiding controls pill bar |
| `src/components/call/CameraFeed.tsx` | Reusable `<video>` wrapper with glassmorphism frame |
| `src/store/callStore.test.ts` | Vitest unit tests for pure store logic |

### Modified Files
| File | Change |
|---|---|
| `src/components/chat/ChatLayout.tsx` | Add CALL LAYER (absolute, same CSS-transform pattern as GAME/DEV layers) |
| `src/components/chat/ChatWindow.tsx` | Add voice + video call buttons to header |
| `src/App.tsx` | Subscribe to `call:ring:{userId}` channel; call `hangUp()` on sign-out |
| `src/components/chat/Sidebar.tsx` | Show `● In call` badge when `callStore.status === 'connected'` |
| `package.json` | Add `vitest`, `@vitest/ui`, `jsdom`, `@testing-library/react` as devDeps |

---

## Task 1: Add Vitest + write foundation `src/lib/webrtc.ts`

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts` (add test config)
- Create: `src/lib/webrtc.ts`
- Create: `src/store/callStore.test.ts` (initial smoke test)

- [ ] **Step 1: Install Vitest dev dependencies**

```bash
cd "aero-chat-app"
pnpm add -D vitest @vitest/ui jsdom @testing-library/react @testing-library/user-event
```

- [ ] **Step 2: Add test script and Vitest config to `package.json`**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest",
"test:ui": "vitest --ui"
```

- [ ] **Step 3: Add Vitest config block to `vite.config.ts`**

Read `vite.config.ts` first. Then add inside the config object:
```ts
test: {
  environment: 'jsdom',
  globals: true,
  setupFiles: ['./src/test-setup.ts'],
},
```

- [ ] **Step 4: Create `src/test-setup.ts`**

```ts
import { vi } from 'vitest';

// Mock RTCPeerConnection
const mockPC = {
  addTrack: vi.fn(),
  getSenders: vi.fn(() => []),
  createOffer: vi.fn(() => Promise.resolve({ type: 'offer', sdp: 'mock-sdp' })),
  createAnswer: vi.fn(() => Promise.resolve({ type: 'answer', sdp: 'mock-answer-sdp' })),
  setLocalDescription: vi.fn(() => Promise.resolve()),
  setRemoteDescription: vi.fn(() => Promise.resolve()),
  addIceCandidate: vi.fn(() => Promise.resolve()),
  close: vi.fn(),
  onicecandidate: null as any,
  ontrack: null as any,
  oniceconnectionstatechange: null as any,
  iceConnectionState: 'new' as RTCIceConnectionState,
};
global.RTCPeerConnection = vi.fn(() => ({ ...mockPC })) as any;

// Mock navigator.mediaDevices
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn(() => Promise.resolve({
      getAudioTracks: () => [{ kind: 'audio', enabled: true, stop: vi.fn() }],
      getVideoTracks: () => [],
      getTracks: () => [{ kind: 'audio', enabled: true, stop: vi.fn() }],
    })),
    getDisplayMedia: vi.fn(),
  },
  writable: true,
});

// Mock HTMLCanvasElement.captureStream
HTMLCanvasElement.prototype.captureStream = vi.fn(() => ({
  getVideoTracks: () => [{ kind: 'video', stop: vi.fn() }],
})) as any;
```

- [ ] **Step 5: Create `src/lib/webrtc.ts`**

```ts
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  // TODO: Add self-hosted TURN (coturn) before public launch
  // { urls: 'turn:your-server.com:3478', username: '...', credential: '...' }
];

export function createPeerConnection(): RTCPeerConnection {
  return new RTCPeerConnection({ iceServers: ICE_SERVERS });
}

/**
 * Creates a tiny black 2×2 canvas video track.
 * Always added as the video sender at call setup so replaceTrack()
 * is safe in both audio-only and video calls.
 */
export function createBlackVideoTrack(): MediaStreamTrack {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 2;
  canvas.getContext('2d')?.fillRect(0, 0, 2, 2);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (canvas as any).captureStream(1).getVideoTracks()[0];
}
```

- [ ] **Step 6: Write smoke test in `src/store/callStore.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { ICE_SERVERS, createPeerConnection } from '../lib/webrtc';

describe('webrtc.ts', () => {
  it('exports two Google STUN servers', () => {
    expect(ICE_SERVERS).toHaveLength(2);
    expect(ICE_SERVERS[0].urls).toBe('stun:stun.l.google.com:19302');
  });

  it('createPeerConnection returns RTCPeerConnection instance', () => {
    const pc = createPeerConnection();
    expect(pc).toBeDefined();
  });
});
```

- [ ] **Step 7: Run tests to verify setup**

```bash
cd "aero-chat-app" && pnpm test --run
```
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
cd "aero-chat-app" && git add src/lib/webrtc.ts src/store/callStore.test.ts src/test-setup.ts package.json vite.config.ts
git commit -m "feat: add webrtc foundation + Vitest setup"
```

---

## Task 2: `callStore` — skeleton (types, refs, initial state, stubs)

**Files:**
- Create: `src/store/callStore.ts`

- [ ] **Step 1: Create `src/store/callStore.ts` with full type definitions and stubs**

```ts
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { createPeerConnection, createBlackVideoTrack } from '../lib/webrtc';
import type { Profile } from './authStore';

// ─── Module-level refs — NOT in Zustand state ───────────────────────────────
// Mutable native objects that would break devtools serialization if in Zustand.
// Pattern follows presenceChannelRef in App.tsx.
let _peerConnection: RTCPeerConnection | null = null;
let _signalingChannel: ReturnType<typeof supabase.channel> | null = null;
let _screenStream: MediaStream | null = null;
let _cameraTrack: MediaStreamTrack | null = null; // saved before screen share starts
let _pendingOffer: RTCSessionDescriptionInit | null = null; // stored on callee side

// ─── State shape ─────────────────────────────────────────────────────────────
export interface CallState {
  status: 'idle' | 'calling' | 'ringing' | 'connected';
  // 'calling'  = local user initiated call, waiting for answer
  // 'ringing'  = local user is being called (IncomingCallModal shown)
  // 'connected' = active call

  callId: string | null;
  contact: Profile | null;
  isCaller: boolean;
  callType: 'audio' | 'video'; // set at call initiation, carried in call:offer payload

  contactIsRinging: boolean; // true when call:ringing received from callee (shows "Ringing…")
  contactIsSharing: boolean; // true when remote user is screen sharing (drives screen-dominant UI)

  localStream: MediaStream | null;
  remoteStream: MediaStream | null;

  isMuted: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;

  callStartedAt: number | null; // Date.now() when status → 'connected'; drives duration timer

  pendingCandidates: RTCIceCandidateInit[]; // queued before remote description is set

  // Actions
  handleIncomingOffer(
    offer: RTCSessionDescriptionInit,
    callId: string,
    contact: Profile,
    callType: 'audio' | 'video',
    myUserId: string,
  ): void;
  startCall(contact: Profile, callType: 'audio' | 'video'): Promise<void>;
  // NOTE: answerCall() takes no parameters — the offer is stored in the module-level
  // _pendingOffer ref by handleIncomingOffer(). This differs from the spec interface
  // (which lists parameters) but is safer: avoids stale React closure captures and
  // keeps IncomingCallModal callers parameter-free.
  answerCall(): Promise<void>;
  hangUp(): void;
  rejectCall(): void;
  toggleMute(): void;
  toggleCamera(): void;
  startScreenShare(): Promise<void>;
  stopScreenShare(): void;
}

export const INITIAL_CALL_STATE = {
  status: 'idle' as const,
  callId: null,
  contact: null,
  isCaller: false,
  callType: 'audio' as const,
  contactIsRinging: false,
  contactIsSharing: false,
  localStream: null,
  remoteStream: null,
  isMuted: false,
  isCameraOn: false,
  isScreenSharing: false,
  callStartedAt: null,
  pendingCandidates: [],
};

export const useCallStore = create<CallState>((set, get) => ({
  ...INITIAL_CALL_STATE,

  handleIncomingOffer: () => { /* Task 3 */ },
  startCall: async () => { /* Task 4 */ },
  answerCall: async () => { /* Task 5 */ },
  hangUp: () => { /* Task 6 */ },
  rejectCall: () => { /* Task 6 */ },
  toggleMute: () => { /* Task 7 */ },
  toggleCamera: () => { /* Task 7 */ },
  startScreenShare: async () => { /* Task 8 */ },
  stopScreenShare: () => { /* Task 8 */ },
}));
```

- [ ] **Step 2: Add store state tests to `src/store/callStore.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useCallStore, INITIAL_CALL_STATE } from './callStore';

describe('callStore initial state', () => {
  beforeEach(() => {
    // Reset store between tests
    useCallStore.setState(INITIAL_CALL_STATE);
  });

  it('starts idle', () => {
    expect(useCallStore.getState().status).toBe('idle');
  });

  it('has null callId on init', () => {
    expect(useCallStore.getState().callId).toBeNull();
  });

  it('has empty pendingCandidates on init', () => {
    expect(useCallStore.getState().pendingCandidates).toEqual([]);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd "aero-chat-app" && pnpm test --run
```
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
cd "aero-chat-app" && git add src/store/callStore.ts src/store/callStore.test.ts
git commit -m "feat: add callStore skeleton with types and initial state"
```

---

## Task 3: `callStore` — `handleIncomingOffer` (callee-side setup + glare)

**Files:**
- Modify: `src/store/callStore.ts`

This action is called from App.tsx when a `call:offer` arrives on the `call:ring:{userId}` channel.

- [ ] **Step 1: Replace the `handleIncomingOffer` stub with the full implementation**

Inside `create<CallState>((set, get) => ({ ... }))`, replace the stub:

```ts
handleIncomingOffer: (offer, callId, contact, callType, myUserId) => {
  const { status, callId: myCallId, contact: myContact } = get();

  // ── Glare detection ─────────────────────────────────────────────────────
  // Both sides tried to call simultaneously. Lower userId wins as caller.
  if (status === 'calling' && myContact?.id === contact.id) {
    if (myUserId < contact.id) {
      // I win — I stay as caller, ignore their offer
      return;
    } else {
      // I lose — tear down my outgoing attempt, then proceed as callee
      // 1. Send hangup for my outgoing offer
      _signalingChannel?.send({
        type: 'broadcast',
        event: 'call:hangup',
        payload: { callId: myCallId },
      });
      // 2. Stop local stream and close PC
      get().localStream?.getTracks().forEach(t => t.stop());
      _screenStream?.getTracks().forEach(t => t.stop());
      _peerConnection?.close();
      supabase.removeChannel(_signalingChannel!);
      _peerConnection = null;
      _signalingChannel = null;
      _screenStream = null;
      _cameraTrack = null;
      // Reset state to idle before setting ringing below
      useCallStore.setState(INITIAL_CALL_STATE);
    }
  }

  // ── Busy check ───────────────────────────────────────────────────────────
  // Re-read status from store — glare teardown above may have reset it to 'idle'.
  const currentStatus = get().status;
  if (currentStatus === 'connected' || currentStatus === 'ringing') {
    // Already in a call — send busy signal via a fire-and-forget REST broadcast
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    const topic = `call:${[myUserId, contact.id].sort().join(':')}`;
    fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ topic, event: 'call:busy', payload: { callId } }],
      }),
    }).catch(() => {});
    return;
  }

  // ── Subscribe to the shared signaling channel ────────────────────────────
  const channelName = `call:${[myUserId, contact.id].sort().join(':')}`;
  _signalingChannel = supabase
    .channel(channelName)
    .on('broadcast', { event: 'call:ice' }, async ({ payload }) => {
      if (payload.callId !== callId) return;
      if (_peerConnection?.remoteDescription) {
        await _peerConnection.addIceCandidate(payload.candidate).catch(() => {});
      } else {
        useCallStore.setState(s => ({
          pendingCandidates: [...s.pendingCandidates, payload.candidate],
        }));
      }
    })
    .on('broadcast', { event: 'call:hangup' }, ({ payload }) => {
      if (payload.callId !== callId) return;
      get().hangUp();
    })
    .on('broadcast', { event: 'call:screenshare-start' }, ({ payload }) => {
      if (payload.callId !== callId) return;
      set({ contactIsSharing: true });
    })
    .on('broadcast', { event: 'call:screenshare-stop' }, ({ payload }) => {
      if (payload.callId !== callId) return;
      set({ contactIsSharing: false });
    })
    // ICE restart: caller sends a new call:offer on the session channel (not ring channel)
    .on('broadcast', { event: 'call:offer' }, async ({ payload }) => {
      if (payload.callId !== callId || !_peerConnection) return;
      // Treat as an ICE-restart offer from the caller
      await _peerConnection.setRemoteDescription(payload.sdp);
      const restartAnswer = await _peerConnection.createAnswer();
      await _peerConnection.setLocalDescription(restartAnswer);
      _signalingChannel?.send({
        type: 'broadcast',
        event: 'call:answer',
        payload: { sdp: restartAnswer, callId },
      });
    })
    .subscribe((status) => {
      // Send ringing ONLY after channel is SUBSCRIBED — send() on an unsubscribed
      // channel is silently dropped, causing the caller to never see "Ringing…"
      if (status === 'SUBSCRIBED') {
        _signalingChannel?.send({
          type: 'broadcast',
          event: 'call:ringing',
          payload: { callId },
        });
      }
    });

  // Store offer for answerCall()
  _pendingOffer = offer;

  set({
    status: 'ringing',
    callId,
    contact,
    isCaller: false,
    callType,
  });
},
```

- [ ] **Step 2: Run tests to confirm nothing broken**

```bash
cd "aero-chat-app" && pnpm test --run
```

- [ ] **Step 3: Commit**

```bash
cd "aero-chat-app" && git add src/store/callStore.ts
git commit -m "feat(callStore): add handleIncomingOffer with glare detection"
```

---

## Task 4: `callStore` — `startCall` (caller side)

**Files:**
- Modify: `src/store/callStore.ts`

- [ ] **Step 1: Replace the `startCall` stub**

```ts
startCall: async (contact, callType) => {
  const authData = await supabase.auth.getUser();
  const myUserId = authData.data.user?.id;
  if (!myUserId) return;

  // ── Get local media ───────────────────────────────────────────────────
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: callType === 'video',
    });
  } catch (err: unknown) {
    const name = (err as DOMException)?.name;
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      // Both mic + camera denied — abort
      console.error('[call] Media access denied', err);
      // TODO: show toast "Microphone access denied — check browser permissions"
      return;
    }
    if (name === 'NotFoundError' && callType === 'video') {
      // Camera not found — retry audio-only
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        // Camera unavailable — call proceeds audio-only
      } catch {
        console.error('[call] Microphone also unavailable');
        return;
      }
    } else {
      throw err;
    }
  }

  const callId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const channelName = `call:${[myUserId, contact.id].sort().join(':')}`;

  _peerConnection = createPeerConnection();
  const remoteStream = new MediaStream();

  // ── Add tracks ───────────────────────────────────────────────────────
  // Always add a black placeholder video sender so replaceTrack() is safe.
  // No stream arg: associating with the local getUserMedia stream causes SDP stream
  // binding issues in audio-only calls (stream only has audio, video sender gets mislinked).
  const blackTrack = createBlackVideoTrack();
  _peerConnection.addTrack(blackTrack);

  // Add audio
  stream.getAudioTracks().forEach(t => _peerConnection!.addTrack(t, stream));

  // For video calls, replace the black placeholder with the real camera track
  let cameraOn = false;
  if (callType === 'video' && stream.getVideoTracks().length > 0) {
    const videoSender = _peerConnection.getSenders().find(s => s.track?.kind === 'video');
    if (videoSender) {
      await videoSender.replaceTrack(stream.getVideoTracks()[0]);
      cameraOn = true;
    }
  }

  // ── Subscribe to signaling channel BEFORE creating offer ────────────
  // CRITICAL: onicecandidate fires as soon as setLocalDescription() is called.
  // _signalingChannel must exist by then or early ICE candidates are silently dropped.
  _signalingChannel = supabase
    .channel(channelName)
    .on('broadcast', { event: 'call:ringing' }, ({ payload }) => {
      if (payload.callId !== callId) return;
      set({ contactIsRinging: true });
    })
    .on('broadcast', { event: 'call:answer' }, async ({ payload }) => {
      if (payload.callId !== callId) return;
      await _peerConnection!.setRemoteDescription(payload.sdp);
      // Drain queued ICE candidates
      const { pendingCandidates } = get();
      for (const c of pendingCandidates) {
        await _peerConnection!.addIceCandidate(c).catch(() => {});
      }
      set({ pendingCandidates: [] });
    })
    .on('broadcast', { event: 'call:ice' }, async ({ payload }) => {
      if (payload.callId !== callId) return;
      if (_peerConnection?.remoteDescription) {
        await _peerConnection.addIceCandidate(payload.candidate).catch(() => {});
      } else {
        set(s => ({ pendingCandidates: [...s.pendingCandidates, payload.candidate] }));
      }
    })
    .on('broadcast', { event: 'call:reject' }, ({ payload }) => {
      if (payload.callId !== callId) return;
      get().hangUp();
      // TODO: show "Call declined" toast
    })
    .on('broadcast', { event: 'call:hangup' }, ({ payload }) => {
      if (payload.callId !== callId) return;
      get().hangUp();
    })
    .on('broadcast', { event: 'call:busy' }, ({ payload }) => {
      if (payload.callId !== callId) return;
      get().hangUp();
      // TODO: show "Contact is in another call" toast
    })
    .on('broadcast', { event: 'call:screenshare-start' }, ({ payload }) => {
      if (payload.callId !== callId) return;
      set({ contactIsSharing: true });
    })
    .on('broadcast', { event: 'call:screenshare-stop' }, ({ payload }) => {
      if (payload.callId !== callId) return;
      set({ contactIsSharing: false });
    })
    .subscribe();

  // ── Wire up peer connection events (after channel is ready) ──────────
  _peerConnection.ontrack = (e) => {
    e.streams[0]?.getTracks().forEach(t => remoteStream.addTrack(t));
    useCallStore.setState({ remoteStream });
  };

  _peerConnection.onicecandidate = (e) => {
    if (!e.candidate) return;
    _signalingChannel?.send({
      type: 'broadcast',
      event: 'call:ice',
      payload: { candidate: e.candidate.toJSON(), callId },
    });
  };

  _peerConnection.oniceconnectionstatechange = () => {
    const state = _peerConnection?.iceConnectionState;
    if (state === 'connected' || state === 'completed') {
      useCallStore.setState({ status: 'connected', callStartedAt: Date.now() });
    }
    if (state === 'disconnected') {
      handleIceRestart(callId);
    }
    if (state === 'failed') {
      // TODO: show "Call ended (connection lost)" toast
      get().hangUp();
    }
  };

  // ── Create offer (ICE gathering starts here — channel is already ready) ─
  const offer = await _peerConnection.createOffer();
  await _peerConnection.setLocalDescription(offer);

  // Update state
  set({
    status: 'calling',
    callId,
    contact,
    isCaller: true,
    callType,
    localStream: stream,
    remoteStream,
    isCameraOn: cameraOn,
    isMuted: false,
  });

  // ── Send ring notification via REST broadcast (no subscription needed) ─
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [{
        topic: `call:ring:${contact.id}`,
        event: 'call:offer',
        payload: { sdp: offer, callId, callType, callerId: myUserId },
      }],
    }),
  }).catch(err => console.error('[call] Failed to send ring notification', err));

  // ── 30-second no-answer timeout ───────────────────────────────────────
  setTimeout(() => {
    const { status: s, callId: cid } = get();
    if (s === 'calling' && cid === callId) {
      get().hangUp();
      // TODO: show "No answer" toast
    }
  }, 30_000);

  // ── beforeunload: best-effort hangup signal ───────────────────────────
  const beforeUnloadHangup = () => {
    _signalingChannel?.send({
      type: 'broadcast',
      event: 'call:hangup',
      payload: { callId },
    });
  };
  window.addEventListener('beforeunload', beforeUnloadHangup, { once: true });
},
```

Also add this helper function OUTSIDE the `create()` call (at module scope), before the store:

```ts
// ICE restart helper — called on 'disconnected' state
let _iceRestartTimer: ReturnType<typeof setTimeout> | null = null;

function handleIceRestart(callId: string) {
  if (_iceRestartTimer) return; // already pending
  _iceRestartTimer = setTimeout(async () => {
    _iceRestartTimer = null;
    if (!_peerConnection) return;
    if (_peerConnection.iceConnectionState === 'failed') {
      useCallStore.getState().hangUp();
      return;
    }
    try {
      const offer = await _peerConnection.createOffer({ iceRestart: true });
      await _peerConnection.setLocalDescription(offer);
      _signalingChannel?.send({
        type: 'broadcast',
        event: 'call:offer',
        payload: { sdp: offer, callId },
      });
    } catch {
      useCallStore.getState().hangUp();
    }
  }, 8_000);
}
```

- [ ] **Step 2: Run tests**

```bash
cd "aero-chat-app" && pnpm test --run
```

- [ ] **Step 3: Commit**

```bash
cd "aero-chat-app" && git add src/store/callStore.ts
git commit -m "feat(callStore): implement startCall with WebRTC + ring notification"
```

---

## Task 5: `callStore` — `answerCall`

**Files:**
- Modify: `src/store/callStore.ts`

- [ ] **Step 1: Replace the `answerCall` stub**

```ts
answerCall: async () => {
  const { callId, contact, callType } = get();
  if (!callId || !contact || !_pendingOffer || !_signalingChannel) return;

  // ── Get local media ───────────────────────────────────────────────────
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: callType === 'video',
    });
  } catch (err: unknown) {
    const name = (err as DOMException)?.name;
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      get().rejectCall();
      return;
    }
    // Camera denied but mic ok — proceed audio-only
    if (callType === 'video') {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      } catch {
        get().rejectCall();
        return;
      }
    } else {
      get().rejectCall();
      return;
    }
  }

  const remoteStream = new MediaStream();
  _peerConnection = createPeerConnection();

  // ── Add local tracks ─────────────────────────────────────────────────
  // No stream arg on blackTrack — same reason as in startCall (SDP stream binding)
  const blackTrack = createBlackVideoTrack();
  _peerConnection.addTrack(blackTrack);
  stream.getAudioTracks().forEach(t => _peerConnection!.addTrack(t, stream));

  let cameraOn = false;
  if (callType === 'video' && stream.getVideoTracks().length > 0) {
    const videoSender = _peerConnection.getSenders().find(s => s.track?.kind === 'video');
    if (videoSender) {
      await videoSender.replaceTrack(stream.getVideoTracks()[0]);
      cameraOn = true;
    }
  }

  // ── Wire up events ───────────────────────────────────────────────────
  _peerConnection.ontrack = (e) => {
    e.streams[0]?.getTracks().forEach(t => remoteStream.addTrack(t));
    useCallStore.setState({ remoteStream });
  };

  _peerConnection.onicecandidate = (e) => {
    if (!e.candidate) return;
    _signalingChannel?.send({
      type: 'broadcast',
      event: 'call:ice',
      payload: { candidate: e.candidate.toJSON(), callId },
    });
  };

  _peerConnection.oniceconnectionstatechange = () => {
    const state = _peerConnection?.iceConnectionState;
    if (state === 'connected' || state === 'completed') {
      useCallStore.setState({ status: 'connected', callStartedAt: Date.now() });
    }
    if (state === 'disconnected') {
      handleIceRestart(callId);
    }
    if (state === 'failed') {
      get().hangUp();
    }
  };

  // ── SDP exchange ─────────────────────────────────────────────────────
  await _peerConnection.setRemoteDescription(_pendingOffer);

  // Drain any ICE candidates that arrived before PeerConnection was created
  const { pendingCandidates } = get();
  for (const c of pendingCandidates) {
    await _peerConnection.addIceCandidate(c).catch(() => {});
  }

  const answer = await _peerConnection.createAnswer();
  await _peerConnection.setLocalDescription(answer);

  _signalingChannel.send({
    type: 'broadcast',
    event: 'call:answer',
    payload: { sdp: answer, callId },
  });

  _pendingOffer = null;

  set({
    localStream: stream,
    remoteStream,
    pendingCandidates: [],
    isCameraOn: cameraOn,
    isMuted: false,
  });

  // ── beforeunload: best-effort hangup from callee side ─────────────────
  const beforeUnloadHangup = () => {
    _signalingChannel?.send({
      type: 'broadcast',
      event: 'call:hangup',
      payload: { callId },
    });
  };
  window.addEventListener('beforeunload', beforeUnloadHangup, { once: true });
},
```

- [ ] **Step 2: Run tests**

```bash
cd "aero-chat-app" && pnpm test --run
```

- [ ] **Step 3: Commit**

```bash
cd "aero-chat-app" && git add src/store/callStore.ts
git commit -m "feat(callStore): implement answerCall"
```

---

## Task 6: `callStore` — `hangUp` + `rejectCall`

**Files:**
- Modify: `src/store/callStore.ts`

- [ ] **Step 1: Replace `hangUp` and `rejectCall` stubs**

```ts
hangUp: () => {
  const { callId } = get();

  // 1. Send hangup signal (best-effort — channel may already be gone)
  if (callId) {
    _signalingChannel?.send({
      type: 'broadcast',
      event: 'call:hangup',
      payload: { callId },
    });
  }

  // 2. Stop all media tracks
  get().localStream?.getTracks().forEach(t => t.stop());
  _screenStream?.getTracks().forEach(t => t.stop());

  // 3. Close PeerConnection
  _peerConnection?.close();

  // 4. Remove signaling channel from Supabase
  if (_signalingChannel) {
    supabase.removeChannel(_signalingChannel);
  }

  // 5. Clear ICE restart timer
  if (_iceRestartTimer) {
    clearTimeout(_iceRestartTimer);
    _iceRestartTimer = null;
  }

  // 6. Null all module-level refs
  _peerConnection = null;
  _signalingChannel = null;
  _screenStream = null;
  _cameraTrack = null;
  _pendingOffer = null;

  // 7. Reset Zustand state
  useCallStore.setState(INITIAL_CALL_STATE);
},

rejectCall: () => {
  const { callId } = get();

  // Send reject signal before cleaning up
  if (callId) {
    _signalingChannel?.send({
      type: 'broadcast',
      event: 'call:reject',
      payload: { callId },
    });
  }

  // Directly clean up without sending a second hangup:
  // Stop any acquired local media tracks (may have been obtained if answerCall() was called)
  get().localStream?.getTracks().forEach(t => t.stop());
  _screenStream?.getTracks().forEach(t => t.stop());
  if (_signalingChannel) supabase.removeChannel(_signalingChannel);
  _peerConnection = null;
  _signalingChannel = null;
  _screenStream = null;
  _cameraTrack = null;
  _pendingOffer = null;
  if (_iceRestartTimer) { clearTimeout(_iceRestartTimer); _iceRestartTimer = null; }

  useCallStore.setState(INITIAL_CALL_STATE);
},
```

- [ ] **Step 2: Add hangUp tests**

In `src/store/callStore.test.ts`, add:

```ts
describe('callStore.hangUp', () => {
  beforeEach(() => {
    useCallStore.setState({
      ...INITIAL_CALL_STATE,
      status: 'connected',
      callId: 'test-id',
    });
  });

  it('resets state to idle', () => {
    useCallStore.getState().hangUp();
    expect(useCallStore.getState().status).toBe('idle');
    expect(useCallStore.getState().callId).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd "aero-chat-app" && pnpm test --run
```
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
cd "aero-chat-app" && git add src/store/callStore.ts src/store/callStore.test.ts
git commit -m "feat(callStore): implement hangUp and rejectCall with full cleanup"
```

---

## Task 7: `callStore` — `toggleMute` + `toggleCamera`

**Files:**
- Modify: `src/store/callStore.ts`

- [ ] **Step 1: Replace toggle stubs**

```ts
toggleMute: () => {
  const { localStream, isMuted } = get();
  if (!localStream) return;
  const next = !isMuted;
  localStream.getAudioTracks().forEach(t => { t.enabled = !next; });
  set({ isMuted: next });
},

toggleCamera: () => {
  const { localStream, isCameraOn, callType } = get();
  if (!localStream) return;

  if (callType === 'video' && localStream.getVideoTracks().length > 0) {
    // For video calls: enable/disable the real camera track
    const next = !isCameraOn;
    localStream.getVideoTracks().forEach(t => { t.enabled = next; });
    set({ isCameraOn: next });
  }
  // Audio-only calls: no camera to toggle — button is hidden in UI anyway
},
```

- [ ] **Step 2: Add toggle tests**

```ts
describe('callStore toggles', () => {
  const mockStream = {
    getAudioTracks: () => [{ kind: 'audio', enabled: true, stop: vi.fn() }],
    getVideoTracks: () => [{ kind: 'video', enabled: true, stop: vi.fn() }],
    getTracks: () => [],
  } as unknown as MediaStream;

  beforeEach(() => {
    useCallStore.setState({
      ...INITIAL_CALL_STATE,
      status: 'connected',
      localStream: mockStream,
      isMuted: false,
      isCameraOn: true,
      callType: 'video',
    });
  });

  it('toggleMute flips isMuted', () => {
    useCallStore.getState().toggleMute();
    expect(useCallStore.getState().isMuted).toBe(true);
    useCallStore.getState().toggleMute();
    expect(useCallStore.getState().isMuted).toBe(false);
  });

  it('toggleCamera flips isCameraOn', () => {
    useCallStore.getState().toggleCamera();
    expect(useCallStore.getState().isCameraOn).toBe(false);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd "aero-chat-app" && pnpm test --run
```
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
cd "aero-chat-app" && git add src/store/callStore.ts src/store/callStore.test.ts
git commit -m "feat(callStore): add toggleMute and toggleCamera"
```

---

## Task 8: `callStore` — `startScreenShare` + `stopScreenShare`

**Files:**
- Modify: `src/store/callStore.ts`

- [ ] **Step 1: Replace screen share stubs**

```ts
startScreenShare: async () => {
  const { callId, isCameraOn, localStream } = get();
  if (!callId || !_peerConnection || !_signalingChannel) return;

  let screenStream: MediaStream;
  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 30, width: { ideal: 1920 } },
      audio: true, // system/tab audio where supported (Chrome, Edge)
    });
  } catch (err: unknown) {
    if ((err as DOMException)?.name === 'NotAllowedError') {
      // User cancelled the picker — silent fail, no state change
      return;
    }
    throw err;
  }

  const screenTrack = screenStream.getVideoTracks()[0];

  // Save current camera track so we can restore it on stop
  if (isCameraOn && localStream) {
    _cameraTrack = localStream.getVideoTracks()[0] ?? null;
  }

  // Replace the video sender track with the screen track
  const videoSender = _peerConnection.getSenders().find(s => s.track?.kind === 'video');
  if (videoSender) {
    await videoSender.replaceTrack(screenTrack);
  }

  _screenStream = screenStream;

  // Auto-stop when user clicks the browser's native "Stop sharing" bar
  screenTrack.addEventListener('ended', () => {
    useCallStore.getState().stopScreenShare();
  });

  // Notify the remote peer
  _signalingChannel.send({
    type: 'broadcast',
    event: 'call:screenshare-start',
    payload: { callId },
  });

  set({ isScreenSharing: true });
},

stopScreenShare: () => {
  const { callId, isCameraOn } = get();
  if (!_signalingChannel || !_peerConnection) return;

  // Stop screen stream tracks
  _screenStream?.getTracks().forEach(t => t.stop());

  // Restore the video sender:
  // - If camera was on: put back the saved camera track
  // - If camera was off: put back a black placeholder track
  const videoSender = _peerConnection.getSenders().find(s => s.track?.kind === 'video');
  if (videoSender) {
    const restoreTrack = (isCameraOn && _cameraTrack)
      ? _cameraTrack
      : createBlackVideoTrack();
    videoSender.replaceTrack(restoreTrack).catch(() => {});
  }

  _cameraTrack = null;
  _screenStream = null;

  _signalingChannel.send({
    type: 'broadcast',
    event: 'call:screenshare-stop',
    payload: { callId },
  });

  set({ isScreenSharing: false });
},
```

- [ ] **Step 2: Run all tests**

```bash
cd "aero-chat-app" && pnpm test --run
```

- [ ] **Step 3: Commit**

```bash
cd "aero-chat-app" && git add src/store/callStore.ts
git commit -m "feat(callStore): add startScreenShare and stopScreenShare"
```

---

## Task 9: `CameraFeed` component

**Files:**
- Create: `src/components/call/CameraFeed.tsx`

A reusable `<video>` wrapper that auto-plays a `MediaStream`. Used for both the remote video and the local PiP.

- [ ] **Step 1: Create `src/components/call/CameraFeed.tsx`**

```tsx
import { useEffect, useRef } from 'react';

interface CameraFeedProps {
  stream: MediaStream | null;
  muted?: boolean;
  /** css width / height e.g. '100%' or '80px' */
  style?: React.CSSProperties;
  className?: string;
  label?: string; // shown when stream is null
}

export function CameraFeed({ stream, muted = false, style, className, label }: CameraFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (stream) {
      el.srcObject = stream;
      el.play().catch(() => {});
    } else {
      el.srcObject = null;
    }
  }, [stream]);

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 12,
        background: 'rgba(0, 0, 0, 0.6)',
        border: '1.5px solid rgba(91, 200, 245, 0.35)',
        boxShadow: '0 0 16px rgba(0, 180, 255, 0.15)',
        ...style,
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
      {!stream && label && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          color: 'rgba(255,255,255,0.4)',
          fontFamily: 'Inter, sans-serif',
        }}>
          {label}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Manual verify**

Run `pnpm dev` from `aero-chat-app/`. No errors in the console from this file.

- [ ] **Step 3: Commit**

```bash
cd "aero-chat-app" && git add src/components/call/CameraFeed.tsx
git commit -m "feat(call): add CameraFeed component"
```

---

## Task 10: `CallControls` component

**Files:**
- Create: `src/components/call/CallControls.tsx`

Auto-hiding pill bar at the bottom: `[Mute] [Camera] [ScreenShare] [Chat] | [HangUp]`. Hides 3s after last mouse movement, reappears on `mousemove`.

- [ ] **Step 1: Create `src/components/call/CallControls.tsx`**

```tsx
import { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, MicOff, Video, VideoOff, Monitor, MessageSquare, PhoneOff } from 'lucide-react';
import { useCallStore } from '../../store/callStore';

interface CallControlsProps {
  onToggleChat: () => void;
  chatOpen: boolean;
}

export function CallControls({ onToggleChat, chatOpen }: CallControlsProps) {
  const { isMuted, isCameraOn, isScreenSharing, callType, toggleMute, toggleCamera, startScreenShare, stopScreenShare, hangUp } = useCallStore();
  const [visible, setVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetHideTimer = useCallback(() => {
    setVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setVisible(false), 3000);
  }, []);

  useEffect(() => {
    resetHideTimer();
    window.addEventListener('mousemove', resetHideTimer);
    return () => {
      window.removeEventListener('mousemove', resetHideTimer);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [resetHideTimer]);

  const btnBase: React.CSSProperties = {
    width: 40,
    height: 40,
    borderRadius: '50%',
    border: '1px solid rgba(255,255,255,0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    color: 'rgba(255,255,255,0.85)',
    background: 'rgba(255,255,255,0.1)',
    flexShrink: 0,
  };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 24,
        left: '50%',
        transform: `translateX(-50%)`,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.4s ease',
        pointerEvents: visible ? 'auto' : 'none',
        zIndex: 20,
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 16px',
        background: 'rgba(4, 12, 35, 0.85)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 40,
        backdropFilter: 'blur(16px)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
      }}>

        {/* Mute */}
        <button
          onClick={toggleMute}
          title={isMuted ? 'Unmute' : 'Mute'}
          style={{
            ...btnBase,
            background: isMuted ? 'rgba(255,160,0,0.3)' : 'rgba(255,255,255,0.1)',
            border: isMuted ? '1px solid rgba(255,160,0,0.6)' : '1px solid rgba(255,255,255,0.15)',
          }}
        >
          {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>

        {/* Camera — only shown for video calls */}
        {callType === 'video' && (
          <button
            onClick={toggleCamera}
            title={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
            style={{ ...btnBase }}
          >
            {isCameraOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
          </button>
        )}

        {/* Screen share */}
        <button
          onClick={() => isScreenSharing ? stopScreenShare() : startScreenShare()}
          title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
          style={{
            ...btnBase,
            background: isScreenSharing ? 'rgba(220,50,50,0.4)' : 'rgba(255,255,255,0.1)',
            border: isScreenSharing ? '1px solid rgba(220,50,50,0.7)' : '1px solid rgba(255,255,255,0.15)',
          }}
        >
          <Monitor className="h-4 w-4" />
        </button>

        {/* Chat */}
        <button
          onClick={onToggleChat}
          title="Chat"
          style={{
            ...btnBase,
            background: chatOpen ? 'rgba(0,180,255,0.25)' : 'rgba(255,255,255,0.1)',
            border: chatOpen ? '1px solid rgba(0,200,255,0.5)' : '1px solid rgba(255,255,255,0.15)',
          }}
        >
          <MessageSquare className="h-4 w-4" />
        </button>

        {/* Separator */}
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.15)', margin: '0 4px' }} />

        {/* Hang up */}
        <button
          onClick={hangUp}
          title="End call"
          style={{
            ...btnBase,
            width: 48,
            borderRadius: 20,
            background: 'rgba(220,50,50,0.85)',
            border: '1px solid rgba(220,50,50,0.9)',
          }}
        >
          <PhoneOff className="h-4 w-4" />
        </button>

      </div>
    </div>
  );
}
```

- [ ] **Step 2: Manual verify** — `pnpm dev`, no TS errors.

- [ ] **Step 3: Commit**

```bash
cd "aero-chat-app" && git add src/components/call/CallControls.tsx
git commit -m "feat(call): add CallControls auto-hiding pill bar"
```

---

## Task 11: `IncomingCallModal` component

**Files:**
- Create: `src/components/call/IncomingCallModal.tsx`

Shown when `status === 'ringing'`. Glassmorphism card, pulsing avatar ring, Accept / Reject. `Enter` = accept, `Escape` = reject.

- [ ] **Step 1: Create `src/components/call/IncomingCallModal.tsx`**

```tsx
import { useEffect } from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { useCallStore } from '../../store/callStore';
import { AvatarImage } from '../ui/AvatarImage';

export function IncomingCallModal() {
  const { contact, callType, answerCall, rejectCall } = useCallStore();

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') answerCall();
      if (e.key === 'Escape') rejectCall();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answerCall, rejectCall]);

  if (!contact) return null;

  return (
    // Backdrop — blurred chat behind
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0, 8, 24, 0.72)',
      backdropFilter: 'blur(12px)',
      zIndex: 50,
    }}>
      {/* Card */}
      <div style={{
        width: 280,
        background: 'rgba(4, 12, 35, 0.92)',
        border: '1px solid rgba(0, 200, 255, 0.22)',
        borderRadius: 24,
        boxShadow: '0 12px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,200,255,0.08)',
        backdropFilter: 'blur(20px)',
        padding: '32px 24px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        textAlign: 'center',
      }}>

        {/* Pulsing avatar ring */}
        <div style={{
          position: 'relative',
          width: 80,
          height: 80,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {/* Animated ring */}
          <div style={{
            position: 'absolute',
            inset: -8,
            borderRadius: '50%',
            border: '2px solid rgba(0, 200, 255, 0.5)',
            animation: 'pulse-ring 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite',
          }} />
          <div style={{
            position: 'absolute',
            inset: -16,
            borderRadius: '50%',
            border: '2px solid rgba(0, 200, 255, 0.25)',
            animation: 'pulse-ring 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) 0.3s infinite',
          }} />
          <AvatarImage username={contact.username} avatarUrl={contact.avatar_url} size="xl" />
        </div>

        <div>
          <p style={{ fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.9)', fontFamily: 'Inter, sans-serif' }}>
            {contact.username}
          </p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            {callType === 'video' ? <Video className="h-3 w-3" /> : <Phone className="h-3 w-3" />}
            Incoming {callType === 'video' ? 'video' : 'voice'} call
          </p>
        </div>

        {/* Accept / Reject */}
        <div style={{ display: 'flex', gap: 24, marginTop: 8 }}>
          <button
            onClick={rejectCall}
            title="Reject (Esc)"
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'rgba(220,50,50,0.85)',
              border: '1px solid rgba(220,50,50,0.9)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(220,50,50,0.4)',
              transition: 'transform 0.1s',
            }}
            onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.95)')}
            onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <PhoneOff className="h-5 w-5" />
          </button>
          <button
            onClick={answerCall}
            title="Accept (Enter)"
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'rgba(0,180,80,0.85)',
              border: '1px solid rgba(0,200,100,0.9)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(0,180,80,0.4)',
              transition: 'transform 0.1s',
            }}
            onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.95)')}
            onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <Phone className="h-5 w-5" />
          </button>
        </div>

        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 4 }}>
          Enter to accept · Esc to reject
        </p>
      </div>

      {/* Add pulse-ring keyframes to the document once */}
      <style>{`
        @keyframes pulse-ring {
          0%   { transform: scale(1);   opacity: 1; }
          80%  { transform: scale(1.4); opacity: 0; }
          100% { transform: scale(1.4); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 2: Check that `AvatarImage` accepts a `size="xl"` prop**

Read `src/components/ui/AvatarImage.tsx` to verify. If `xl` is not a valid size value, use the largest available size (likely `lg` or map `xl` to a specific pixel size inline). Adjust the import/call accordingly.

- [ ] **Step 3: Manual verify** — `pnpm dev`, no TS errors.

- [ ] **Step 4: Commit**

```bash
cd "aero-chat-app" && git add src/components/call/IncomingCallModal.tsx
git commit -m "feat(call): add IncomingCallModal with glassmorphism card"
```

---

## Task 12: `CallView` — full layout, all states, PiP drag, chat side panel

**Files:**
- Create: `src/components/call/CallView.tsx`

`CallView` is the full-screen overlay. It covers all 4 UI states:
- **State 1:** Video call — remote camera fills view, self PiP bottom-right, controls bar
- **State 2:** Viewer in screen share — shared screen fills view, `[name] is sharing` pill, self PiP
- **State 3:** Sharer side — own screen fills view, `You are sharing` pill, controls bar (share button highlighted)
- **State 4:** Ringing — renders `IncomingCallModal` over blurred backdrop (status = 'ringing')

Chat side panel (260px) slides in from the right; call view shrinks to accommodate.

- [ ] **Step 1: Create `src/components/call/CallView.tsx`**

```tsx
import { useState, useRef, useCallback, useEffect } from 'react';
import { useCallStore } from '../../store/callStore';
import { CameraFeed } from './CameraFeed';
import { CallControls } from './CallControls';
import { IncomingCallModal } from './IncomingCallModal';
import { useChatStore } from '../../store/chatStore';
import { ChatWindow } from '../chat/ChatWindow';
import { Phone, Video, Monitor } from 'lucide-react';

/** Formats elapsed seconds as M:SS */
function formatDuration(startedAt: number): string {
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function CallView() {
  const {
    status,
    contact,
    callType,
    localStream,
    remoteStream,
    contactIsSharing,
    isScreenSharing,
    contactIsRinging,
    isCaller,
    callStartedAt,
    hangUp,
  } = useCallStore();

  const [chatOpen, setChatOpen] = useState(false);
  const [duration, setDuration] = useState('0:00');

  // Duration timer
  useEffect(() => {
    if (status !== 'connected' || !callStartedAt) { setDuration('0:00'); return; }
    setDuration(formatDuration(callStartedAt));
    const id = setInterval(() => setDuration(formatDuration(callStartedAt!)), 1000);
    return () => clearInterval(id);
  }, [status, callStartedAt]);

  // Close chat panel when call ends
  useEffect(() => {
    if (status === 'idle') setChatOpen(false);
  }, [status]);

  // ── PiP drag state ───────────────────────────────────────────────────
  const pipRef = useRef<HTMLDivElement>(null);
  const pipPos = useRef({ x: 16, y: 16 }); // offsets from bottom-right
  const draggingPip = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  const onPipMouseDown = useCallback((e: React.MouseEvent) => {
    draggingPip.current = true;
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pipPos.current.x, py: pipPos.current.y };
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent) => {
      if (!draggingPip.current || !pipRef.current) return;
      const dx = ev.clientX - dragStart.current.mx;
      const dy = ev.clientY - dragStart.current.my;
      pipPos.current = {
        x: Math.max(8, dragStart.current.px - dx),
        y: Math.max(8, dragStart.current.py - dy),
      };
      pipRef.current.style.right = `${pipPos.current.x}px`;
      pipRef.current.style.bottom = `${pipPos.current.y}px`;
    };
    const onUp = () => {
      draggingPip.current = false;
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  if (status === 'idle') return null;

  const isConnected = status === 'connected';
  const isIncomingRinging = status === 'ringing';
  const isOutgoingCalling = status === 'calling';

  // What fills the main view area (left of chat panel)
  const showRemoteScreen = isConnected && contactIsSharing;
  const showOwnScreen = isConnected && isScreenSharing;

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      background: 'rgba(2, 6, 22, 0.97)',
      borderRadius: 16,
      overflow: 'hidden',
      animation: 'fadeSlideIn 0.3s ease',
    }}>

      {/* ── Main call area ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

        {/* Incoming call overlay */}
        {isIncomingRinging && <IncomingCallModal />}

        {/* Outgoing call — "Calling..." / "Ringing..." */}
        {isOutgoingCalling && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            background: 'linear-gradient(145deg, rgba(0,30,80,0.6), rgba(0,10,40,0.9))',
          }}>
            <div style={{
              width: 96,
              height: 96,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(0,180,255,0.4), rgba(0,80,200,0.3))',
              border: '2.5px solid rgba(0,200,255,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'pulse-ring 2s ease infinite',
            }}>
              {callType === 'video' ? <Video className="h-10 w-10" style={{ color: 'rgba(0,200,255,0.8)' }} /> : <Phone className="h-10 w-10" style={{ color: 'rgba(0,200,255,0.8)' }} />}
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 22, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
                {contact?.username}
              </p>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>
                {isCaller && contactIsRinging ? 'Ringing…' : 'Calling…'}
              </p>
            </div>
            {/* Hang up while calling */}
            <button
              onClick={hangUp}
              style={{
                marginTop: 16,
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'rgba(220,50,50,0.85)',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Phone className="h-5 w-5" style={{ transform: 'rotate(135deg)' }} />
            </button>
          </div>
        )}

        {/* Connected — main video area */}
        {isConnected && (
          <>
            {/* Remote video or screen fill */}
            {showRemoteScreen || showOwnScreen || callType === 'video' ? (
              <CameraFeed
                stream={remoteStream}
                style={{ position: 'absolute', inset: 0, borderRadius: 0, border: 'none', boxShadow: 'none' }}
              />
            ) : (
              // Audio-only — avatar in center
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(145deg, rgba(0,30,80,0.6), rgba(0,10,40,0.9))',
              }}>
                <div style={{
                  width: 96,
                  height: 96,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(0,180,255,0.4), rgba(0,80,200,0.3))',
                  border: '2.5px solid rgba(0,200,255,0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 36,
                  fontWeight: 700,
                  color: 'rgba(0,200,255,0.8)',
                }}>
                  {contact?.username?.[0]?.toUpperCase()}
                </div>
              </div>
            )}

            {/* Screen sharing pill */}
            {(showRemoteScreen || showOwnScreen) && (
              <div style={{
                position: 'absolute',
                top: 16,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 12px',
                background: 'rgba(220,50,50,0.75)',
                border: '1px solid rgba(220,50,50,0.9)',
                borderRadius: 20,
                backdropFilter: 'blur(8px)',
                fontSize: 12,
                color: 'white',
                fontWeight: 600,
                zIndex: 10,
              }}>
                <Monitor className="h-3 w-3" />
                {showOwnScreen ? 'You are sharing' : `${contact?.username} is sharing`}
              </div>
            )}

            {/* Duration timer — top right */}
            <div style={{
              position: 'absolute',
              top: 16,
              right: 16,
              fontFamily: 'monospace',
              fontSize: 13,
              color: 'rgba(255,255,255,0.6)',
              background: 'rgba(0,0,0,0.4)',
              padding: '2px 8px',
              borderRadius: 8,
              zIndex: 10,
            }}>
              {duration}
            </div>

            {/* Self-camera PiP — draggable, bottom-right */}
            <div
              ref={pipRef}
              onMouseDown={onPipMouseDown}
              style={{
                position: 'absolute',
                bottom: `${pipPos.current.y}px`,
                right: `${pipPos.current.x}px`,
                width: 120,
                height: 90,
                cursor: 'grab',
                zIndex: 15,
              }}
            >
              <CameraFeed
                stream={localStream}
                muted
                style={{ width: '100%', height: '100%' }}
                label="Camera off"
              />
            </div>

            {/* Controls bar */}
            <CallControls onToggleChat={() => setChatOpen(o => !o)} chatOpen={chatOpen} />
          </>
        )}
      </div>

      {/* ── Chat side panel ── */}
      <div style={{
        width: chatOpen ? 260 : 0,
        flexShrink: 0,
        overflow: 'hidden',
        transition: 'width 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
        borderLeft: chatOpen ? '1px solid rgba(0,200,255,0.18)' : 'none',
        background: 'rgba(4, 10, 28, 0.95)',
      }}>
        {contact && chatOpen && (
          <ChatWindow contact={contact} />
        )}
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: scale(0.98); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes pulse-ring {
          0%   { box-shadow: 0 0 0 0   rgba(0,200,255,0.4); }
          70%  { box-shadow: 0 0 0 20px rgba(0,200,255,0); }
          100% { box-shadow: 0 0 0 0   rgba(0,200,255,0); }
        }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 2: Manual verify** — `pnpm dev`, no TS errors. Check that `ChatWindow` can accept a `contact` without `onBack` (it should, since `onBack` is optional).

- [ ] **Step 3: Commit**

```bash
cd "aero-chat-app" && git add src/components/call/CallView.tsx
git commit -m "feat(call): add CallView with all states, PiP drag, chat side panel"
```

---

## Task 13: `ChatLayout` — add CALL LAYER

**Files:**
- Modify: `src/components/chat/ChatLayout.tsx`

Add `CallView` as an absolute layer on top of the layer-host div — same pattern as GAME/DEV layers. The call layer appears above everything when `status !== 'idle'`.

- [ ] **Step 1: Add import to ChatLayout.tsx**

At the top, add:
```tsx
import { CallView } from '../call/CallView';
import { useCallStore } from '../../store/callStore';
```

- [ ] **Step 2: Read the `callViewActive` flag from the store**

Inside the `ChatLayout` function body, alongside the other store reads:
```tsx
const callStatus = useCallStore(s => s.status);
const callViewActive = callStatus !== 'idle';
```

- [ ] **Step 3: Add CALL LAYER after the DEV LAYER block**

Inside the layer-host `<div>` (the `relative flex-1 min-w-0 overflow-hidden` div), after the closing `)}` of the DEV LAYER block and before the closing `</div>` of the layer-host:

```tsx
{/* CALL LAYER — slides in over everything when a call is active or ringing */}
<div
  style={{
    position: 'absolute',
    inset: 0,
    transform: callViewActive ? 'translateX(0)' : 'translateX(102%)',
    opacity: callViewActive ? 1 : 0,
    transition: 'transform 0.38s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.32s ease',
    pointerEvents: callViewActive ? 'auto' : 'none',
    willChange: 'transform, opacity',
    zIndex: 30,
  }}
>
  <CallView />
</div>
```

- [ ] **Step 4: Manual verify** — `pnpm dev`, no TS errors. The app should load normally.

- [ ] **Step 5: Commit**

```bash
cd "aero-chat-app" && git add src/components/chat/ChatLayout.tsx
git commit -m "feat(chat): add CallView as CALL LAYER in ChatLayout"
```

---

## Task 14: `ChatWindow` — call buttons in header

**Files:**
- Modify: `src/components/chat/ChatWindow.tsx`

Add voice (`Phone`) and video (`Video`) call buttons in the header. Only shown when `callStore.status === 'idle'`.

- [ ] **Step 1: Add imports to ChatWindow.tsx**

Find the existing `import { Send, Lock, ... }` line and add `Phone, Video` to the lucide-react imports.

Also add the store import at the top:
```tsx
import { useCallStore } from '../../store/callStore';
```

- [ ] **Step 2: Read callStatus inside the component**

In the `ChatWindow` function body, add:
```tsx
const callStatus = useCallStore(s => s.status);
const { startCall } = useCallStore();
```

- [ ] **Step 3: Add call buttons to the header**

In the header div, find the closing block where the AeroLogo + Lock icons are:
```tsx
<div className="no-drag flex items-center gap-2">
  <AeroLogo size={20} className="opacity-20" />
  <Lock className="h-3 w-3" />
</div>
```

Replace it with:
```tsx
<div className="no-drag flex items-center gap-2">
  {/* Call buttons — only when idle and friend is confirmed */}
  {callStatus === 'idle' && (
    <>
      <button
        onClick={() => startCall(contact, 'audio')}
        title="Voice call"
        className="flex h-7 w-7 items-center justify-center rounded-lg transition-all"
        style={{
          color: 'var(--text-muted)',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#00d4ff'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
      >
        <Phone className="h-4 w-4" />
      </button>
      <button
        onClick={() => startCall(contact, 'video')}
        title="Video call"
        className="flex h-7 w-7 items-center justify-center rounded-lg transition-all"
        style={{
          color: 'var(--text-muted)',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#00d4ff'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
      >
        <Video className="h-4 w-4" />
      </button>
    </>
  )}
  <AeroLogo size={20} className="opacity-20" />
  <Lock className="h-3 w-3" style={{ color: 'var(--text-muted)' }} />
</div>
```

- [ ] **Step 4: Manual verify** — `pnpm dev`. Open a chat. You should see Phone + Video icons in the header next to the lock.

- [ ] **Step 5: Commit**

```bash
cd "aero-chat-app" && git add src/components/chat/ChatWindow.tsx
git commit -m "feat(chat): add voice and video call buttons to ChatWindow header"
```

---

## Task 15: `App.tsx` — incoming call subscription + sign-out cleanup

**Files:**
- Modify: `src/App.tsx`

Two changes:
1. Subscribe to `call:ring:{userId}` Broadcast channel on mount → calls `callStore.handleIncomingOffer`
2. Call `hangUp()` when auth state changes to signed-out (tab close during call → sign out)

- [ ] **Step 1: Add callStore import to App.tsx**

```tsx
import { useCallStore } from './store/callStore';
```

- [ ] **Step 2: Add call ring subscription — new useEffect after the presence useEffect**

```tsx
// ── Incoming call ring subscription ────────────────────────────────────────
useEffect(() => {
  if (!user) return;

  const channel = supabase
    .channel(`call:ring:${user.id}`)
    .on('broadcast', { event: 'call:offer' }, ({ payload }) => {
      const { sdp, callId, callType, callerId } = payload;
      if (!sdp || !callId || !callerId) return;

      // Look up caller's profile from friends list
      const caller = useFriendStore.getState().friends.find(f => f.id === callerId);
      if (!caller) return; // Only accept calls from confirmed friends

      useCallStore.getState().handleIncomingOffer(sdp, callId, caller, callType ?? 'audio', user.id);
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [user?.id]);
```

- [ ] **Step 3: Add hangUp call to the auth state change cleanup**

Find the existing `onAuthStateChange` handler:
```tsx
const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
  if (!session) { setUser(null); settled = false; return; }
  ...
});
```

Modify the `if (!session)` branch:
```tsx
if (!session) {
  // Hang up any active call before signing out
  const { status } = useCallStore.getState();
  if (status !== 'idle') {
    useCallStore.getState().hangUp();
  }
  setUser(null);
  settled = false;
  return;
}
```

- [ ] **Step 4: Run tests**

```bash
cd "aero-chat-app" && pnpm test --run
```

- [ ] **Step 5: Manual verify** — `pnpm dev`, no TS errors.

- [ ] **Step 6: Commit**

```bash
cd "aero-chat-app" && git add src/App.tsx
git commit -m "feat(app): subscribe to call ring channel and hangUp on sign-out"
```

---

## Task 16: `Sidebar` — "● In call" indicator

**Files:**
- Modify: `src/components/chat/Sidebar.tsx`

Show a subtle `● In call` indicator in the sidebar footer (next to the current user's avatar) when `callStore.status === 'connected'`.

- [ ] **Step 1: Add import to Sidebar.tsx**

```tsx
import { useCallStore } from '../../store/callStore';
```

- [ ] **Step 2: Read call status inside the Sidebar component**

```tsx
const callStatus = useCallStore(s => s.status);
```

- [ ] **Step 3: Find the sidebar footer area**

Look for the bottom section of the Sidebar component where the current user's avatar and username are displayed (the footer / settings row at the bottom of the sidebar).

Add the indicator next to the username:
```tsx
{callStatus === 'connected' && (
  <span style={{
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
    fontSize: 10,
    color: '#00d4ff',
    fontWeight: 600,
    padding: '1px 6px',
    background: 'rgba(0,180,255,0.12)',
    border: '1px solid rgba(0,180,255,0.3)',
    borderRadius: 10,
    marginLeft: 4,
    letterSpacing: '0.02em',
  }}>
    <span style={{ fontSize: 8 }}>●</span> In call
  </span>
)}
```

The exact insertion point depends on where the sidebar renders the current user's name. Read the bottom of `Sidebar.tsx` to find it, then add the indicator inline with the username text.

- [ ] **Step 4: Manual verify** — `pnpm dev`, no TS errors.

- [ ] **Step 5: Run all tests**

```bash
cd "aero-chat-app" && pnpm test --run
```
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
cd "aero-chat-app" && git add src/components/chat/Sidebar.tsx
git commit -m "feat(sidebar): show In call indicator when call is connected"
```

---

## End-to-End Manual Test Checklist

After all tasks are complete, verify the following scenarios in the browser (open two tabs, log in as two different users):

**Outgoing call:**
- [ ] Click Phone icon in ChatWindow header → call layer slides in, "Calling…" shown
- [ ] Second tab receives ringing modal with contact name + call type
- [ ] First tab shows "Ringing…" after callee tab shows modal
- [ ] Accept on second tab → both tabs show connected state, duration timer starts
- [ ] Either side can hang up → call layer slides out on both tabs

**Video call:**
- [ ] Click Video icon → camera feed visible in self-PiP
- [ ] Camera can be toggled off/on via controls bar
- [ ] PiP can be dragged to different positions

**Screen sharing:**
- [ ] Click Monitor icon → browser screen picker opens
- [ ] Viewer sees "[name] is sharing" pill
- [ ] Click "Stop sharing" → both sides revert to camera/audio view
- [ ] Clicking browser's native Stop Sharing bar also stops correctly

**Edge cases:**
- [ ] Calling a user who is already in a call → "Contact is in another call" behaviour (check console for busy signal)
- [ ] 30-second timeout: call someone who doesn't answer → caller automatically hangs up
- [ ] Sign out during an active call → call ends cleanly

---

## Final Commit

```bash
cd "aero-chat-app" && git add -A
git commit -m "feat: WebRTC voice/video/screen share — complete implementation"
```
