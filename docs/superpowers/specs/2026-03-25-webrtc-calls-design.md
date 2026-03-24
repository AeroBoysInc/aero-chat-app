# WebRTC Voice / Video / Screen Share — Design Spec

**Date:** 2026-03-25
**Status:** Approved — ready for implementation planning
**Scope:** 1-on-1 calls only (group calls deferred). Web client (Vercel) primary target. Mobile layout is out of scope for this iteration.

---

## 1. Architecture Overview

### New files
| File | Purpose |
|---|---|
| `src/store/callStore.ts` | Zustand store — owns all serializable call state + actions |
| `src/lib/webrtc.ts` | Pure helper: ICE config, `RTCPeerConnection` factory |
| `src/components/call/CallView.tsx` | Full-screen call layer rendered inside `ChatLayout` |
| `src/components/call/IncomingCallModal.tsx` | Ringing overlay shown to callee |
| `src/components/call/CallControls.tsx` | Mute / camera / screen share / chat / hang up bar |
| `src/components/call/CameraFeed.tsx` | Reusable `<video>` wrapper with glassmorphism frame |

### Modified files
| File | Change |
|---|---|
| `src/components/chat/ChatLayout.tsx` | Add `CallView` as a third layout layer (same pattern as `GameLayer`) |
| `src/components/chat/ChatWindow.tsx` | Add call button (voice + video) to the chat header |
| `src/App.tsx` | Subscribe to incoming call signals globally on mount |
| `src/components/chat/Sidebar.tsx` | Show subtle "● In call" indicator when `callStore.status !== 'idle'` |

### Data flow
```
callStore (serializable state)
  + module-level refs (peerConnection, signalingChannel, screenStream)
        │
        ├── webrtc.ts (RTCPeerConnection factory, ICE config)
        │
        └── Supabase Broadcast channel
              call:{sortedIds}  ← signaling only (SDP + ICE candidates)

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
idle ──[startCall]──► calling ──[call:ringing received]──► calling (contactIsRinging=true)
         │                │                                      │
    [sends call:offer]    │                              [call:answer]──► connected ──[call:hangup]──► idle
                          │                                                    │
                     [call:reject / call:busy / 30s timeout]            [call:hangup]
                          ▼                                               (either side)
                         idle
```

**Note on caller state:** The caller stays in `'calling'` throughout. Receiving `call:ringing` does not change `status` — it sets `contactIsRinging: true` in the store, which the UI uses to show "Ringing…" instead of "Calling…". There is no separate `ringing_ack` store state.

**Sender roles:**
- `call:offer` — caller only
- `call:answer` — callee only
- `call:ringing` — callee only (acknowledgement that modal is shown)
- `call:reject` — callee only
- `call:busy` — callee only
- `call:hangup` — **either side** (caller cancelling before answer also uses `call:hangup`, not `call:reject`)
- `call:ice` — both sides
- `call:screenshare-start` / `call:screenshare-stop` — sharer only (see Section 5)

### Signal events
| Event | Sender | Payload | Purpose |
|---|---|---|---|
| `call:offer` | Caller | `{ sdp, callId, callType }` | Initiate call with SDP offer + call type |
| `call:ringing` | Callee | `{ callId }` | Acknowledge receipt — caller can show "Ringing…" UI |
| `call:answer` | Callee | `{ sdp, callId }` | Accept call with SDP answer |
| `call:ice` | Both | `{ candidate, callId }` | Trickle ICE candidate |
| `call:reject` | Callee | `{ callId }` | Decline call |
| `call:hangup` | Either | `{ callId }` | End active or pending call (callee or caller) |
| `call:busy` | Callee | `{ callId }` | Already in another call |
| `call:screenshare-start` | Sharer | `{ callId }` | Notify viewer that screen sharing has started |
| `call:screenshare-stop` | Sharer | `{ callId }` | Notify viewer that screen sharing has stopped |

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

**ICE restart:** If `iceConnectionState` becomes `disconnected`, attempt one ICE restart by calling `createOffer({ iceRestart: true })` and completing a fresh offer/answer exchange via the signaling channel. If state reaches `failed` after 8s, tear down the call. ICE restart uses the same `call:offer` / `call:answer` signals with the existing `callId`.

---

## 3. `callStore` Shape

**Non-serializable handles (module-level refs, NOT in Zustand reactive state):**
```ts
// Held as module-level variables inside callStore.ts — never in Zustand state
let _peerConnection: RTCPeerConnection | null = null;
let _signalingChannel: ReturnType<typeof supabase.channel> | null = null;
let _screenStream: MediaStream | null = null;
let _cameraTrack: MediaStreamTrack | null = null; // saved before screen share so it can be restored
```

These are mutable native objects. Putting them in Zustand would trigger spurious re-renders and break devtools serialization. Pattern follows `presenceChannelRef` in `App.tsx`.

**Serializable Zustand state:**
```ts
interface CallState {
  // Status
  status: 'idle' | 'calling' | 'ringing' | 'connected';
  // 'calling'  = local user initiated, awaiting answer
  // 'ringing'  = local user is being called (callee side — IncomingCallModal shown)
  callId: string | null;
  contact: Profile | null;
  isCaller: boolean;
  callType: 'audio' | 'video';       // set at call initiation, carried in call:offer
  contactIsRinging: boolean;         // true when call:ringing received from callee (UI: "Ringing…")

  // Streams (MediaStream is kept as a ref but stored here for <video> binding)
  localStream: MediaStream | null;   // mic + camera
  remoteStream: MediaStream | null;  // contact's audio/video

  // Track toggles
  isMuted: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;         // local user is sharing
  contactIsSharing: boolean;        // remote user is sharing (driven by call:screenshare-* signals)

  // Timer
  callStartedAt: number | null;     // Date.now() when status → 'connected'; drives duration display

  // ICE queue
  pendingCandidates: RTCIceCandidateInit[];

  // Actions
  startCall(contact: Profile, callType: 'audio' | 'video'): Promise<void>;
  answerCall(offer: RTCSessionDescriptionInit, callId: string, contact: Profile, callType: 'audio' | 'video'): Promise<void>;
  hangUp(): void;
  rejectCall(): void;
  toggleMute(): void;
  toggleCamera(): void;
  startScreenShare(): Promise<void>;
  stopScreenShare(): void;
}
```

**`hangUp()` cleanup sequence:**
1. Send `call:hangup` on the signaling channel
2. Stop all tracks on `localStream` and `_screenStream`
3. Close `_peerConnection`
4. Call `supabase.removeChannel(_signalingChannel)`
5. Null all module-level refs
6. Reset all Zustand state to initial values

---

## 4. CallView UI

### Layout
`CallView` renders as a `position: absolute; inset: 0` layer inside `ChatLayout`'s layer host div — identical to how `GameLayer` is structured. It animates in (slide + fade) when `status !== 'idle'` and out when call ends.

### UI states

**State 1 — Video call (no screen share)**
- Remote camera feed fills the entire view
- Speaking indicator (animated bars) appears beneath the contact's avatar when audio is detected
- Self-camera as draggable PiP (bottom-right, 80×60px, `cursor: grab`)
- `CallControls` pill bar centered at bottom, auto-hides after 3s of mouse inactivity, reappears on `mousemove`
- Call duration timer top-right in monospace (derived from `callStartedAt`)

**State 2 — Screen sharing active (viewer's perspective, driven by `contactIsSharing: true`)**
- Shared screen (`<video>` bound to remote stream, which now carries the screen track) fills the entire view
- `"[name] is sharing"` pill (red dot + label) anchored top-center
- Self-camera PiP remains bottom-right, draggable
- `CallControls` pill bar — unchanged for viewer
- Call duration timer top-right

**State 3 — Screen sharing active (sharer's perspective, `isScreenSharing: true`)**
- Self screen preview fills the view
- `"You are sharing"` pill top-center
- `CallControls` pill bar — screen share button highlighted red ("stop sharing")

**State 4 — Incoming call**
- `IncomingCallModal` floats over a blurred-chat backdrop
- Glassmorphism card: pulsing avatar ring, contact name, call type indicator (voice or video), accept (green) / reject (red) buttons
- Keyboard: `Enter` = accept, `Escape` = reject

### Chat side panel (toggled by chat icon in `CallControls`)
- Slides in from the right edge of the call view (260px wide)
- Call view shrinks to accommodate — both visible simultaneously
- Full message history, input box, send button
- Closes via X button or toggling the chat icon again

### Controls bar buttons (left to right)
`[Mute] [Camera] [Screen Share] [Chat] | [Hang Up]`
- All circular except hang-up (pill shape, red)
- Muted state: mic icon crossed out, button background shifts to amber
- Camera off state: camera icon crossed out
- Screen sharing active: monitor icon red background
- Chat open: chat icon highlighted cyan

---

## 5. Screen Sharing Mechanics

### Sharer side
```ts
// startScreenShare()
const stream = await navigator.mediaDevices.getDisplayMedia({
  video: { frameRate: 30, width: { ideal: 1920 } },
  audio: true, // system/tab audio where supported (Chrome, Edge)
});

// Always add a video sender at call setup time (even for audio-only calls,
// send a black placeholder track) so replaceTrack never encounters a null sender.
const videoSender = _peerConnection.getSenders().find(s => s.track?.kind === 'video');
// videoSender is guaranteed non-null by the setup convention above
await videoSender!.replaceTrack(stream.getVideoTracks()[0]);

// Notify the viewer
_signalingChannel!.send({ type: 'broadcast', event: 'call:screenshare-start', payload: { callId } });

// Auto-stop when user hits browser's native "Stop sharing" bar
stream.getVideoTracks()[0].addEventListener('ended', () => callStore.stopScreenShare());
```

**Audio-only calls:** At peer connection setup, always add a black placeholder video track alongside the audio track. This ensures `getSenders()` always contains a video sender, making `replaceTrack` safe in all call types.

**Stopping:** `stopScreenShare()` retrieves `_cameraTrack` (saved at screen share start) and restores it via `replaceTrack()` (if camera was on), or re-inserts the black placeholder if camera was off. Sends `call:screenshare-stop`. Nulls `_cameraTrack` and `_screenStream`.

**User cancels picker:** `NotAllowedError` caught silently — no crash, no state change.

### Viewer side
The viewer receives `call:screenshare-start` → sets `contactIsSharing: true` in their store → `CallView` transitions to State 2 (screen dominant UI).
When `call:screenshare-stop` arrives → sets `contactIsSharing: false` → `CallView` returns to State 1.

**Why `replaceTrack` alone is not enough for the viewer UI:** `ontrack` does not fire again on track replacement — the `MediaStreamTrack` is swapped in-place. Without the explicit `call:screenshare-*` signals, the viewer's UI would never transition.

### Why this beats Discord's screen sharing
- No artificial resolution cap — streams at whatever quality `getDisplayMedia` provides (up to 4K)
- System audio included where browser supports it (Chrome/Edge)
- `replaceTrack()` = instant swap with no connection renegotiation

---

## 6. Edge Cases & Error Handling

| Scenario | Behaviour |
|---|---|
| **Glare (both call simultaneously)** | User with lexicographically lower `userId` wins as caller. The losing side: (1) sends `call:hangup` to cancel its own outgoing offer, (2) stops its local stream, (3) closes its `RTCPeerConnection`, (4) receives the winner's `call:offer` and proceeds as callee via `answerCall()`. |
| **No answer (30s timeout)** | Caller auto-hangs up, shows "No answer" toast |
| **`call:ringing` received** | Caller transitions UI to "Ringing…" — distinguishes "no answer" from "never delivered" |
| **Tab/browser close mid-call** | `beforeunload` fires `call:hangup` over the WebSocket signaling channel (delivery not guaranteed on hard close). The fallback is the ICE failure path below — no `sendBeacon` (which is HTTP-only and cannot use the WebSocket channel). |
| **ICE `disconnected` → `failed`** | ICE restart attempted once (new offer/answer round trip). If still failed after 8s, tear down and show "Call ended (connection lost)." |
| **Mic denied** | Toast "Microphone access denied — check browser permissions", call start aborted |
| **Camera denied** | Call proceeds audio-only with black placeholder video track; PiP slot shows "Camera unavailable" badge; screen share button still available |
| **Both mic + camera denied** | Call start blocked entirely with a clear permissions message |
| **Contact is offline** | Signal never delivered; `call:ringing` never arrives; 30s timeout fires "No answer" |
| **Contact already in call** | `call:busy` sent immediately; caller sees "Contact is in another call" toast |
| **Sign-out during call** | `App.tsx` calls `hangUp()` on auth state change — stops all tracks, closes PC, sends `call:hangup`, removes signaling channel |

---

## 7. Integration with Existing Codebase

- **Signaling subscription** lives in `App.tsx` alongside the existing `inbox:{userId}` and `global:online` channels — calls ring regardless of which chat is open
- **Call button** in `ChatWindow.tsx` header — two variants: voice (phone icon) and video (camera icon); only shown when contact is a confirmed friend and `status === 'idle'`
- **"● In call" indicator** in `Sidebar.tsx` next to the active contact's name when `status === 'connected'`
- **No new Supabase migrations needed** — signaling is Broadcast-only, no DB writes

---

## 8. Future Work (out of scope for this iteration)

- Self-hosted TURN server (coturn) — **required before public launch**
- Mobile layout for `CallView`
- Group calls (SFU, e.g. LiveKit)
- Call recording
- Noise cancellation (Web Audio API or Krisp SDK)
- Reactions / emoji during calls
