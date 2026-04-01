# Group Calls — Design Spec

**Date:** 2026-04-01
**Status:** Approved

## Overview

Add group audio calls to AeroChat, supporting 2-4 participants over full-mesh WebRTC. Two entry points: start a fresh group call by selecting multiple friends, or escalate an existing 1:1 call by adding participants. Audio-only (video stays 1:1). Screen sharing supported (one sharer at a time).

## Decisions

| Decision | Choice |
|----------|--------|
| Max participants | 4 |
| Topology | Full mesh (N-1 peer connections per participant) |
| Entry points | Fresh multi-invite + escalate 1:1 |
| Ringing | Ring all invitees, start when first accepts, latecomers join live |
| Layout | Glass card 2x2 grid |
| Media | Audio-only |
| Screen sharing | Yes, one at a time — sharer takes main area, cards collapse to bottom row |
| Add mid-call | Friend picker modal from "+" slot |

## Architecture

### Signaling

Reuse Supabase Realtime broadcast channels for signaling. Each group call gets a unique call ID and a shared signaling channel.

**Channel topology:**
- **Ring channel** (REST broadcast): `call:ring:{recipientId}` — same as 1:1, one per invited person
- **Session channel** (WebSocket): `call:group:{callId}` — single shared channel for ALL signaling in the group call

**Why a shared session channel (not per-pair)?**
With mesh, each participant maintains N-1 peer connections, but signaling messages include sender/recipient IDs so each participant can route offers/answers/ICE to the correct peer connection. One channel is simpler than O(N^2) channels.

### Signaling Events

| Event | Payload | Purpose |
|-------|---------|---------|
| `group:offer` | `{ sdp, callId, fromUserId, toUserId }` | SDP offer from one peer to another |
| `group:answer` | `{ sdp, callId, fromUserId, toUserId }` | SDP answer |
| `group:ice` | `{ candidate, callId, fromUserId, toUserId }` | ICE candidate |
| `group:join` | `{ callId, userId, username, avatar_url }` | User joined the call (triggers new mesh connections) |
| `group:leave` | `{ callId, userId }` | User left the call |
| `group:ringing` | `{ callId, userId }` | Callee acknowledged ring |
| `group:reject` | `{ callId, userId }` | Callee rejected |
| `group:screenshare-start` | `{ callId, userId }` | Screen share started |
| `group:screenshare-stop` | `{ callId, userId }` | Screen share stopped |
| `group:mute` | `{ callId, userId, muted }` | Mute state changed (for UI indicators) |

### Mesh Connection Flow

When a new participant joins a group call with N existing participants:

1. New participant subscribes to `call:group:{callId}` and broadcasts `group:join`
2. Each existing participant receives `group:join` and creates a new RTCPeerConnection for the newcomer
3. Each existing participant creates an SDP offer targeted at the newcomer (`toUserId`)
4. Newcomer receives N offers, creates N peer connections, sends N answers
5. ICE candidates flow per-pair using `fromUserId`/`toUserId` routing

**Who creates the offer?** The participant with the lower user ID creates the offer (same glare-prevention pattern as 1:1 calls). This avoids both sides simultaneously offering.

### 1:1 Escalation Flow

When a user clicks "Add person" during an active 1:1 call:

1. Current 1:1 call generates a new group callId. The escalating user calls `groupCallStore.escalateToGroup(newFriend)`.
2. Existing peer connection is transferred from `callStore` module-level refs into `groupCallStore`'s `_peerConnections` map — no media renegotiation needed.
3. `callStore` resets to idle (refs nulled, state reset). Both existing participants subscribe to the new group session channel `call:group:{callId}`.
4. The person being added gets rung via REST broadcast with the group callId
5. When they accept, mesh connections form as described above

### Call State

New Zustand store: `groupCallStore.ts` (separate from existing `callStore.ts` which stays for 1:1).

```typescript
interface GroupCallState {
  status: 'idle' | 'calling' | 'ringing' | 'connected';
  callId: string | null;
  participants: Map<string, GroupParticipant>;  // userId -> participant info
  myUserId: string | null;

  // Screen sharing
  screenSharingUserId: string | null;
  localScreenStream: MediaStream | null;

  // Audio
  isMuted: boolean;

  // Call metadata
  callStartedAt: number | null;
  invitedUserIds: string[];  // pending invites

  // Actions
  startGroupCall: (friends: Profile[]) => Promise<void>;
  escalateToGroup: (newFriend: Profile) => Promise<void>;
  joinGroupCall: (callId: string, participants: GroupParticipant[]) => Promise<void>;
  leaveCall: () => void;
  addParticipant: (friend: Profile) => Promise<void>;
  toggleMute: () => void;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => void;
  handleIncomingGroupInvite: (callId: string, participants: GroupParticipant[], inviter: Profile) => void;
}

interface GroupParticipant {
  userId: string;
  username: string;
  avatarUrl: string | null;
  isMuted: boolean;
  isSpeaking: boolean;
  audioLevel: number;  // 0-1, for visualizer bars
}
```

### Module-Level Refs (not in Zustand)

```typescript
// Map of userId -> RTCPeerConnection (one per remote participant)
const _peerConnections = new Map<string, RTCPeerConnection>();

// Map of userId -> pending ICE candidates (before remote description set)
const _pendingCandidates = new Map<string, RTCIceCandidateInit[]>();

// Map of userId -> MediaStream (remote audio from each participant)
const _remoteStreams = new Map<string, MediaStream>();

// Map of userId -> AnalyserNode (for voice level detection)
const _analysers = new Map<string, AnalyserNode>();

// Shared signaling channel
let _groupChannel: RealtimeChannel | null = null;

// Local audio pipeline (reuse existing NoisePipeline/GainPipeline)
let _rawAudioStream: MediaStream | null = null;
let _noisePipeline: NoisePipeline | null = null;

// Screen share
let _screenStream: MediaStream | null = null;
```

### Audio Pipeline

Reuse the existing `createNoisePipeline`/`createGainPipeline` from `noiseSuppression.ts`. The processed audio track is added to ALL peer connections. When noise cancellation is toggled, replace the audio track on every peer connection's sender.

### Voice Activity Detection

Per-participant audio level detection using Web Audio API `AnalyserNode`:
- Create an AnalyserNode for each remote stream
- Sample frequency data every 100ms
- Average the bins to get a 0-1 level
- Threshold > 0.04 = "speaking" (same as current 1:1 calls)
- Update `GroupParticipant.isSpeaking` and `audioLevel` in store

### Screen Sharing

Same as 1:1 but broadcast to all peers:
1. Get display media
2. For each peer connection, find video sender and `replaceTrack()` with screen track
3. Broadcast `group:screenshare-start` on session channel
4. When stopped, replace tracks back and broadcast `group:screenshare-stop`

One sharer at a time — if someone starts sharing while another is sharing, the first share stops.

## UI Components

### GroupCallView.tsx

Main container component. Three visual states:

**1. Normal (2x2 grid)**
- Glass card for each participant (avatar, name, speaking/listening/muted status, audio level bars)
- Active speaker's card: cyan border glow, animated aura ring, "Speaking" label, active audio bars
- Muted participant: red mute badge on avatar, dimmed card, "Muted" label
- Listening participant: neutral card, "Listening" label, flat audio bars
- Empty slots: dashed border, "+" icon, "Add friend" label — clickable to open modal
- "You" badge on local participant's card

**2. Screen sharing**
- Sharer's screen takes main area (large glass container)
- "X is sharing" badge overlay on screen area with red dot
- Participant cards collapse to horizontal strip at bottom (compact: avatar + name + mini audio bars)
- Speaker highlight still works in compact mode

**3. Controls bar (bottom center)**
- Mute toggle
- Screen share toggle
- Chat toggle (opens existing ChatWindow sidebar)
- Leave call (red)
- Same circular button style as 1:1 CallControls

### AddToCallModal.tsx

Friend picker modal:
- Search input at top
- "Online friends" section: friends who are online and not already in call, with "Invite" button
- "Already in call" section: grayed out with checkmark
- "Offline" section: grayed out, no action
- Slot counter: "X of 4 slots available"
- Close button (X)

### IncomingGroupCallModal.tsx

Similar to existing IncomingCallModal but shows:
- "Group Call" label instead of caller name
- Avatars of all current participants (stacked or in a row)
- "Dean, Alex, and 1 other" style text
- Accept / Reject buttons

### Entry Points

Two ways to start a group call:

1. **From 1:1 call (escalation):** When in an active 1:1 call, an "Add person" button appears in CallControls. Clicking opens AddToCallModal, selecting a friend triggers escalation.
2. **Fresh group call:** A "Group Call" button in the sidebar header (near existing call buttons) opens AddToCallModal in multi-select mode. User picks 2-3 friends and hits "Start Call".

### Ring Channel (App.tsx)

Extend the existing `call:ring:{userId}` subscription to handle a new event:
- `call:group-invite` — carries callId, callType: 'group', list of current participants, inviter info

## Error Handling

- **Participant leaves mid-call:** Close their peer connection, remove from grid, broadcast `group:leave`. If only 1 person left, auto-end call.
- **Mesh connection fails (ICE failed for one peer):** Remove that participant from local view, attempt ICE restart once. If still fails, treat as disconnected.
- **Invite rejected/timeout:** Remove from `invitedUserIds`, no effect on active call.
- **Tab close / beforeunload:** Best-effort `group:leave` broadcast (same as 1:1 hangup).
- **Channel subscription fails:** Abort call start, clean up, show error.

## Performance

- Audio-only mesh with 3 peers = 3 incoming + 3 outgoing audio streams. Lightweight, well within browser capability.
- Voice level detection via AnalyserNode runs on Audio thread (not main thread). Sample at 100ms intervals, not every frame.
- Participant cards use `React.memo` with primitive-only props.
- Audio bars animated via CSS transitions (not React re-renders).

## Out of Scope (for now)

- Video in group calls
- Voice channels (persistent drop-in rooms)
- More than 4 participants
- TURN server (still using STUN only)
- Recording
- Server-side media (SFU/MCU)
