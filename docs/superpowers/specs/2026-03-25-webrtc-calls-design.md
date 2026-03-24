# WebRTC Voice / Video / Screen Share — Design Spec

**Date:** 2026-03-25
**Status:** Approved — ready for implementation planning
**Scope:** 1-on-1 calls only (group calls deferred). Web client (Vercel) primary target.

---

## 1. Architecture Overview

### New files
| File | Purpose |
|---|---|
| `src/store/callStore.ts` | Zustand store — owns all WebRTC state and actions |
| `src/lib/webrtc.ts` | Pure helper: ICE config, `RTCPeerConnection` factory |
| `src/components/call/CallView.tsx` | Full-screen call layer rendered inside `ChatLayout` |
| `src/components/call/IncomingCallModal.tsx` | Ringing overlay shown to callee |
| `src/components/call/CallControls.tsx` | Mute / camera / screen share / chat / hang up bar |
| `src/components/call/CameraFeed.tsx` | Reusable `<video>` wrapper with glassmorphism frame |

### Modified files
| File | Change |
|---|---|
| `src/components/chat/ChatLayout.tsx` | Add `CallView` as a third layout layer (same pattern as `GameLayer`) |
| `src/components/chat/ChatWindow.tsx` | Add call button to the chat header |
| `src/App.tsx` | Subscribe to incoming call signals globally on mount |
| `src/components/chat/Sidebar.tsx` | Show subtle "● In call" indicator when `callStore.status !== 'idle'` |

### Data flow
```
callStore ──── webrtc.ts (RTCPeerConnection)
     │               │
     │         Supabase Broadcast channel
     │         call:{sortedIds}  ← signaling only (SDP + ICE candidates)
     │
ChatLayout
  └── CallView (absolute layer, slides over chat/game layers)
        ├── remote <video> (fills view)   or   ScreenShareView (fills view)
        ├── CameraFeed (draggable PiP, bottom-right)
        ├── CallControls (pill bar, auto-hides after 3s)
        └── ChatSidePanel (slide-in from right, 260px, toggled by chat button)
```

---

## 2. Signaling Protocol

**Channel:** `call:{[userId, contactId].sort().join(':')}` — Supabase Realtime **Broadcast** (ephemeral, never stored in DB).

### Call state machine
```
idle ──[startCall]──► calling ──[call:answer]──► connected ──[hangUp]──► idle
         │                  │
    [call:offer sent]   [call:reject / call:busy / 30s timeout]
         ▼                  ▼
      ringing (callee)    idle
```

### Signal events
| Event | Sender | Payload | Purpose |
|---|---|---|---|
| `call:offer` | Caller | `{ sdp, callId }` | Initiate call with SDP offer |
| `call:answer` | Callee | `{ sdp, callId }` | Accept call with SDP answer |
| `call:ice` | Both | `{ candidate, callId }` | Trickle ICE candidate |
| `call:reject` | Callee | `{ callId }` | Decline call |
| `call:hangup` | Either | `{ callId }` | End active or pending call |
| `call:busy` | Callee | `{ callId }` | Already in another call |

### ICE configuration (`src/lib/webrtc.ts`)
```ts
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  // TODO: Add self-hosted TURN (coturn) before public launch
  // { urls: 'turn:your-server.com:3478', username: '...', credential: '...' }
];
```

**Trickle ICE:** Candidates sent individually as they arrive. `pendingCandidates[]` in the store queues any candidates received before remote description is set; the queue drains immediately after `setRemoteDescription`.

---

## 3. `callStore` Shape

```ts
interface CallState {
  // Status
  status: 'idle' | 'calling' | 'ringing' | 'connected';
  callId: string | null;
  contact: Profile | null;
  isCaller: boolean;

  // Streams
  localStream: MediaStream | null;   // mic + camera
  remoteStream: MediaStream | null;  // contact's audio/video
  screenStream: MediaStream | null;  // getDisplayMedia stream

  // Track toggles
  isMuted: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;

  // Internal WebRTC
  peerConnection: RTCPeerConnection | null;
  pendingCandidates: RTCIceCandidateInit[];

  // Actions
  startCall(contact: Profile): Promise<void>;
  answerCall(offer: RTCSessionDescriptionInit, callId: string, contact: Profile): Promise<void>;
  hangUp(): void;
  rejectCall(): void;
  toggleMute(): void;
  toggleCamera(): void;
  startScreenShare(): Promise<void>;
  stopScreenShare(): void;
}
```

---

## 4. CallView UI

### Layout
`CallView` renders as an `position: absolute; inset: 0` layer inside `ChatLayout`'s layer host div — identical to how `GameLayer` is structured. It animates in (slide + fade) when `status !== 'idle'` and out when call ends.

### UI states

**State 1 — Video call (no screen share)**
- Remote camera feed fills the entire view
- Speaking indicator (animated bars) appears beneath the contact's avatar when audio is detected
- Self-camera as draggable PiP (bottom-right, 80×60px, `cursor: grab`)
- `CallControls` pill bar centered at bottom, auto-hides after 3s of mouse inactivity, reappears on `mousemove`

**State 2 — Screen sharing active**
- Shared screen fills the entire view
- `"[name] is sharing"` pill (red dot + label) anchored top-center
- Self-camera PiP remains bottom-right, draggable
- `CallControls` pill bar — screen share button highlighted red ("stop sharing")
- Call duration timer top-right in monospace

**State 3 — Incoming call**
- `IncomingCallModal` floats over a blurred-chat backdrop
- Glassmorphism card: pulsing avatar ring, contact name, accept (green) / reject (red) buttons
- Keyboard: `Enter` = accept, `Escape` = reject

### Chat side panel (toggled by chat icon in `CallControls`)
- Slides in from the right edge of the call view (260px wide)
- Call view shrinks to accommodate — both visible simultaneously
- Full message history, input box, send button
- Closes via X button or toggling the chat icon again

### Controls bar buttons (left to right)
`[Mute] [Camera] [Screen Share] [Chat] | [Hang Up]`
- All circular except hang-up (pill shape, red)
- Muted state: microphone icon crossed out, button background shifts to amber
- Camera off state: camera icon crossed out
- Screen sharing active: monitor icon red background
- Chat open: chat icon highlighted cyan

---

## 5. Screen Sharing Mechanics

```ts
// startScreenShare()
const stream = await navigator.mediaDevices.getDisplayMedia({
  video: { frameRate: 30, width: { ideal: 1920 } },
  audio: true, // system/tab audio where browser supports it (Chrome, Edge)
});
// Swap track on existing peer connection — no renegotiation needed
const sender = peerConnection.getSenders().find(s => s.track?.kind === 'video');
await sender.replaceTrack(stream.getVideoTracks()[0]);
```

**Why this beats Discord's screen sharing:**
- No artificial resolution cap — streams at whatever quality `getDisplayMedia` provides (up to 4K depending on browser)
- System audio included when browser supports it (Chrome/Edge)
- `replaceTrack()` means instant swap with no connection renegotiation

**Auto-stop on browser's native "Stop sharing" bar:**
```ts
stream.getVideoTracks()[0].addEventListener('ended', () => callStore.stopScreenShare());
```

**Stopping:** `stopScreenShare()` restores the camera track via `replaceTrack()` (if camera was on), otherwise sends a black track as placeholder.

**User cancels picker:** `NotAllowedError` caught silently — no crash, no state change.

---

## 6. Edge Cases & Error Handling

| Scenario | Behaviour |
|---|---|
| **Glare (both call simultaneously)** | User with lexicographically lower `userId` wins as caller; other side auto-switches to callee role |
| **No answer (30s timeout)** | Caller auto-hangs up, shows "No answer" toast |
| **Tab/browser close mid-call** | `beforeunload` fires `call:hangup`; if that fails, `iceConnectionState → failed` (~8s) triggers cleanup on the other side |
| **ICE failure mid-call** | ICE restart attempted once; if still failed after 8s, tear down and show "Call ended (connection lost)" |
| **Mic denied** | Toast "Microphone access denied", call start aborted |
| **Camera denied** | Call proceeds audio-only; PiP slot shows "Camera unavailable" badge |
| **Both mic + camera denied** | Call start blocked entirely with a clear permissions message |
| **Contact is offline** | Signal never delivered; 30s timeout fires "No answer" |
| **Sign-out during call** | `App.tsx` calls `hangUp()` on auth state change — stops all tracks, closes peer connection, sends `call:hangup` |

---

## 7. Integration with Existing Codebase

- **Signaling subscription** lives in `App.tsx` (same location as the existing `inbox:{userId}` and `global:online` channels) so incoming calls ring even when a different chat is open
- **Call button** added to `ChatWindow.tsx` header — only shown when the contact is a confirmed friend and status is `idle`
- **"● In call" indicator** in `Sidebar.tsx` shown next to the active contact's name when `callStore.status === 'connected'`
- **No new Supabase migrations needed** — signaling is Broadcast-only, no DB writes

---

## 8. Future Work (out of scope for this iteration)

- Self-hosted TURN server (coturn) — required before public launch
- Group calls (SFU, e.g. LiveKit)
- Call recording
- Noise cancellation (Web Audio API or Krisp SDK)
- Reactions / emoji during calls
