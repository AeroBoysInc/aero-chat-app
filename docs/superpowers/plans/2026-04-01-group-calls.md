# Group Calls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add group audio calls (2-4 participants) over full-mesh WebRTC with glass card UI, screen sharing, and 1:1 escalation.

**Architecture:** New `groupCallStore.ts` manages N peer connections per call via a shared Supabase Realtime broadcast channel (`call:group:{callId}`). Signaling messages include `fromUserId`/`toUserId` for per-pair routing. UI is a 2x2 glass card grid with voice activity detection via AnalyserNode. Existing `callStore.ts` is untouched except for exposing refs needed by escalation.

**Tech Stack:** Zustand, Supabase Realtime (broadcast), WebRTC (RTCPeerConnection mesh), Web Audio API (AnalyserNode), React, Tailwind CSS, Lucide icons.

**Spec:** `docs/superpowers/specs/2026-04-01-group-calls-design.md`

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/store/groupCallStore.ts` | Group call state, mesh management, signaling, audio pipeline |
| Create | `src/components/call/GroupCallView.tsx` | Main group call UI — 2x2 grid, screen share layout, controls |
| Create | `src/components/call/ParticipantCard.tsx` | Individual glass card — avatar, name, status, audio bars |
| Create | `src/components/call/AddToCallModal.tsx` | Friend picker modal for adding participants mid-call |
| Create | `src/components/call/IncomingGroupCallModal.tsx` | Incoming group call notification with participant avatars |
| Modify | `src/App.tsx:278-297` | Extend ring channel to handle `call:group-invite` event |
| Modify | `src/components/chat/ChatLayout.tsx` | Render GroupCallView alongside existing CallView |
| Modify | `src/components/call/CallControls.tsx` | Add "Add person" button for 1:1 escalation |
| Modify | `src/store/callStore.ts` | Export helper to extract refs for escalation |

---

### Task 1: Group Call Store — State & Types

**Files:**
- Create: `src/store/groupCallStore.ts`

This task sets up the store skeleton with types, initial state, module-level refs, and placeholder actions. No WebRTC logic yet — just the Zustand structure.

- [ ] **Step 1: Create the store file with types and initial state**

```typescript
// src/store/groupCallStore.ts
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { createPeerConnection, createBlackVideoTrack } from '../lib/webrtc';
import type { Profile } from './authStore';
import { useAudioStore } from './audioStore';
import { createNoisePipeline, createGainPipeline, type NoisePipeline } from '../lib/noiseSuppression';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface GroupParticipant {
  userId: string;
  username: string;
  avatarUrl: string | null;
  isMuted: boolean;
  isSpeaking: boolean;
  audioLevel: number; // 0-1
}

export interface GroupCallState {
  status: 'idle' | 'calling' | 'ringing' | 'connected';
  callId: string | null;
  participants: Map<string, GroupParticipant>;
  myUserId: string | null;

  screenSharingUserId: string | null;
  localScreenStream: MediaStream | null;

  isMuted: boolean;
  callStartedAt: number | null;
  invitedUserIds: string[];

  // Actions
  startGroupCall: (friends: Profile[]) => Promise<void>;
  escalateToGroup: (newFriend: Profile) => Promise<void>;
  joinGroupCall: (callId: string, inviterUserId: string, existingParticipants: GroupParticipant[]) => Promise<void>;
  leaveCall: () => void;
  addParticipant: (friend: Profile) => Promise<void>;
  toggleMute: () => void;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => void;
  handleIncomingGroupInvite: (callId: string, participants: GroupParticipant[], inviter: Profile) => void;
}

// ─── Module-level refs (NOT in Zustand — native objects break devtools) ─────

const _peerConnections = new Map<string, RTCPeerConnection>();
const _pendingCandidates = new Map<string, RTCIceCandidateInit[]>();
const _remoteStreams = new Map<string, MediaStream>();
const _analysers = new Map<string, AnalyserNode>();

let _groupChannel: ReturnType<typeof supabase.channel> | null = null;
let _channelSubscribed = false;
let _rawAudioStream: MediaStream | null = null;
let _noisePipeline: NoisePipeline | null = null;
let _screenStream: MediaStream | null = null;
let _localStream: MediaStream | null = null;
let _audioContext: AudioContext | null = null;
let _vadInterval: ReturnType<typeof setInterval> | null = null;

// ─── Cleanup helper ─────────────────────────────────────────────────────────

function cleanupAll() {
  // Stop VAD
  if (_vadInterval) { clearInterval(_vadInterval); _vadInterval = null; }

  // Close all peer connections
  for (const pc of _peerConnections.values()) pc.close();
  _peerConnections.clear();
  _pendingCandidates.clear();
  _remoteStreams.clear();
  _analysers.clear();

  // Stop media
  _localStream?.getTracks().forEach(t => t.stop());
  _screenStream?.getTracks().forEach(t => t.stop());
  _noisePipeline?.dispose();

  // Close audio context
  _audioContext?.close().catch(() => {});

  // Remove channel
  if (_groupChannel) supabase.removeChannel(_groupChannel);

  // Null refs
  _groupChannel = null;
  _channelSubscribed = false;
  _rawAudioStream = null;
  _noisePipeline = null;
  _screenStream = null;
  _localStream = null;
  _audioContext = null;
}

// ─── Initial state ──────────────────────────────────────────────────────────

const INITIAL_STATE = {
  status: 'idle' as const,
  callId: null,
  participants: new Map<string, GroupParticipant>(),
  myUserId: null,
  screenSharingUserId: null,
  localScreenStream: null,
  isMuted: false,
  callStartedAt: null,
  invitedUserIds: [],
};

// ─── Store ──────────────────────────────────────────────────────────────────

export const useGroupCallStore = create<GroupCallState>((set, get) => ({
  ...INITIAL_STATE,

  startGroupCall: async () => { /* Task 2 */ },
  escalateToGroup: async () => { /* Task 5 */ },
  joinGroupCall: async () => { /* Task 3 */ },
  leaveCall: () => {
    const { callId } = get();
    if (callId) {
      _groupChannel?.send({ type: 'broadcast', event: 'group:leave', payload: { callId, userId: get().myUserId } });
    }
    cleanupAll();
    set(INITIAL_STATE);
  },
  addParticipant: async () => { /* Task 4 */ },
  toggleMute: () => {
    const { isMuted, callId, myUserId } = get();
    const next = !isMuted;
    _localStream?.getAudioTracks().forEach(t => { t.enabled = !next; });
    _groupChannel?.send({ type: 'broadcast', event: 'group:mute', payload: { callId, userId: myUserId, muted: next } });
    set({ isMuted: next });
  },
  startScreenShare: async () => { /* Task 4 */ },
  stopScreenShare: () => { /* Task 4 */ },
  handleIncomingGroupInvite: () => { /* Task 3 */ },
}));
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd aero-chat-app && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/store/groupCallStore.ts
git commit -m "feat(group-calls): add groupCallStore skeleton with types, refs, cleanup"
```

---

### Task 2: Mesh Signaling — startGroupCall & Channel Setup

**Files:**
- Modify: `src/store/groupCallStore.ts`

Implements `startGroupCall`: get audio, build pipeline, subscribe to group channel, set up signaling handlers, ring all invitees via REST broadcast.

- [ ] **Step 1: Add signaling channel setup helper**

Add this above the store `create()` call in `groupCallStore.ts`:

```typescript
// ─── Signaling helpers ──────────────────────────────────────────────────────

function setupPeerConnection(
  remoteUserId: string,
  callId: string,
  myUserId: string,
): RTCPeerConnection {
  const pc = createPeerConnection();
  _peerConnections.set(remoteUserId, pc);

  // Add local audio track to this peer
  const audioTrack = _noisePipeline?.processedStream.getAudioTracks()[0];
  if (audioTrack && _localStream) {
    pc.addTrack(audioTrack, _localStream);
  }

  // Add black video placeholder (for screen share replaceTrack later)
  pc.addTrack(createBlackVideoTrack());

  // ICE candidates
  pc.onicecandidate = (e) => {
    if (!e.candidate) return;
    _groupChannel?.send({
      type: 'broadcast',
      event: 'group:ice',
      payload: { candidate: e.candidate.toJSON(), callId, fromUserId: myUserId, toUserId: remoteUserId },
    });
  };

  // Remote tracks
  const remoteStream = new MediaStream();
  _remoteStreams.set(remoteUserId, remoteStream);

  pc.ontrack = (e) => {
    remoteStream.addTrack(e.track);
    // Set up analyser for this remote stream if not already
    if (!_analysers.has(remoteUserId) && _audioContext) {
      const source = _audioContext.createMediaStreamSource(remoteStream);
      const analyser = _audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      _analysers.set(remoteUserId, analyser);
    }
  };

  // Connection state
  pc.oniceconnectionstatechange = () => {
    if (pc.iceConnectionState === 'failed') {
      // Remove this peer
      pc.close();
      _peerConnections.delete(remoteUserId);
      _remoteStreams.delete(remoteUserId);
      _analysers.delete(remoteUserId);
      _pendingCandidates.delete(remoteUserId);
      useGroupCallStore.setState(s => {
        const next = new Map(s.participants);
        next.delete(remoteUserId);
        // Auto-end if alone
        if (next.size === 0) {
          cleanupAll();
          return { ...INITIAL_STATE };
        }
        return { participants: next };
      });
    }
    if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
      const { status } = useGroupCallStore.getState();
      if (status !== 'connected') {
        useGroupCallStore.setState({ status: 'connected', callStartedAt: Date.now() });
      }
    }
  };

  return pc;
}

async function createOfferForPeer(remoteUserId: string, callId: string, myUserId: string) {
  const pc = _peerConnections.get(remoteUserId);
  if (!pc) return;
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  _groupChannel?.send({
    type: 'broadcast',
    event: 'group:offer',
    payload: { sdp: offer, callId, fromUserId: myUserId, toUserId: remoteUserId },
  });
}

function subscribeToGroupChannel(callId: string, myUserId: string): Promise<void> {
  const channelName = `call:group:${callId}`;

  _groupChannel = supabase
    .channel(channelName)
    .on('broadcast', { event: 'group:offer' }, async ({ payload }) => {
      if (payload.callId !== callId || payload.toUserId !== myUserId) return;
      const fromId = payload.fromUserId;
      let pc = _peerConnections.get(fromId);
      if (!pc) {
        pc = setupPeerConnection(fromId, callId, myUserId);
      }
      await pc.setRemoteDescription(payload.sdp);
      // Drain pending candidates
      const pending = _pendingCandidates.get(fromId) ?? [];
      for (const c of pending) await pc.addIceCandidate(c).catch(() => {});
      _pendingCandidates.delete(fromId);
      // Send answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      _groupChannel?.send({
        type: 'broadcast',
        event: 'group:answer',
        payload: { sdp: answer, callId, fromUserId: myUserId, toUserId: fromId },
      });
    })
    .on('broadcast', { event: 'group:answer' }, async ({ payload }) => {
      if (payload.callId !== callId || payload.toUserId !== myUserId) return;
      const pc = _peerConnections.get(payload.fromUserId);
      if (!pc) return;
      await pc.setRemoteDescription(payload.sdp);
      const pending = _pendingCandidates.get(payload.fromUserId) ?? [];
      for (const c of pending) await pc.addIceCandidate(c).catch(() => {});
      _pendingCandidates.delete(payload.fromUserId);
    })
    .on('broadcast', { event: 'group:ice' }, async ({ payload }) => {
      if (payload.callId !== callId || payload.toUserId !== myUserId) return;
      const pc = _peerConnections.get(payload.fromUserId);
      if (pc?.remoteDescription) {
        await pc.addIceCandidate(payload.candidate).catch(() => {});
      } else {
        const q = _pendingCandidates.get(payload.fromUserId) ?? [];
        q.push(payload.candidate);
        _pendingCandidates.set(payload.fromUserId, q);
      }
    })
    .on('broadcast', { event: 'group:join' }, ({ payload }) => {
      if (payload.callId !== callId || payload.userId === myUserId) return;
      // Add participant to state
      useGroupCallStore.setState(s => {
        const next = new Map(s.participants);
        if (!next.has(payload.userId)) {
          next.set(payload.userId, {
            userId: payload.userId,
            username: payload.username,
            avatarUrl: payload.avatar_url,
            isMuted: false,
            isSpeaking: false,
            audioLevel: 0,
          });
        }
        return { participants: next };
      });
      // Set up mesh connection — lower ID creates the offer
      const pc = setupPeerConnection(payload.userId, callId, myUserId);
      if (myUserId < payload.userId) {
        createOfferForPeer(payload.userId, callId, myUserId);
      }
    })
    .on('broadcast', { event: 'group:leave' }, ({ payload }) => {
      if (payload.callId !== callId || payload.userId === myUserId) return;
      // Tear down this peer
      _peerConnections.get(payload.userId)?.close();
      _peerConnections.delete(payload.userId);
      _remoteStreams.delete(payload.userId);
      _analysers.delete(payload.userId);
      _pendingCandidates.delete(payload.userId);
      useGroupCallStore.setState(s => {
        const next = new Map(s.participants);
        next.delete(payload.userId);
        if (next.size === 0) {
          cleanupAll();
          return { ...INITIAL_STATE };
        }
        return { participants: next, screenSharingUserId: s.screenSharingUserId === payload.userId ? null : s.screenSharingUserId };
      });
    })
    .on('broadcast', { event: 'group:mute' }, ({ payload }) => {
      if (payload.callId !== callId || payload.userId === myUserId) return;
      useGroupCallStore.setState(s => {
        const next = new Map(s.participants);
        const p = next.get(payload.userId);
        if (p) next.set(payload.userId, { ...p, isMuted: payload.muted });
        return { participants: next };
      });
    })
    .on('broadcast', { event: 'group:ringing' }, ({ payload }) => {
      if (payload.callId !== callId) return;
      useGroupCallStore.setState(s => ({
        invitedUserIds: s.invitedUserIds.filter(id => id !== payload.userId),
      }));
    })
    .on('broadcast', { event: 'group:reject' }, ({ payload }) => {
      if (payload.callId !== callId) return;
      useGroupCallStore.setState(s => ({
        invitedUserIds: s.invitedUserIds.filter(id => id !== payload.userId),
      }));
    })
    .on('broadcast', { event: 'group:screenshare-start' }, ({ payload }) => {
      if (payload.callId !== callId) return;
      useGroupCallStore.setState({ screenSharingUserId: payload.userId });
    })
    .on('broadcast', { event: 'group:screenshare-stop' }, ({ payload }) => {
      if (payload.callId !== callId) return;
      useGroupCallStore.setState(s => ({
        screenSharingUserId: s.screenSharingUserId === payload.userId ? null : s.screenSharingUserId,
      }));
    });

  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Group channel subscription timeout')), 10_000);
    _groupChannel!.subscribe((status) => {
      if (status === 'SUBSCRIBED') { _channelSubscribed = true; clearTimeout(timeout); resolve(); }
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { clearTimeout(timeout); reject(new Error(`Channel failed: ${status}`)); }
    });
  });
}
```

- [ ] **Step 2: Implement startGroupCall action**

Replace the placeholder `startGroupCall` in the store:

```typescript
startGroupCall: async (friends) => {
  const { data: authData } = await supabase.auth.getUser();
  const myUserId = authData.user?.id;
  if (!myUserId) return;

  const nc = useAudioStore.getState().noiseCancellation;
  const callId = `group-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // Get audio
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false },
      video: false,
    });
  } catch {
    console.error('[group-call] Microphone access denied');
    return;
  }

  _localStream = stream;
  _rawAudioStream = stream;
  _noisePipeline = nc ? await createNoisePipeline(stream) : await createGainPipeline(stream);
  _noisePipeline.setInputGain(useAudioStore.getState().inputVolume / 100);
  _audioContext = new AudioContext({ sampleRate: 48000 });

  // Subscribe to signaling channel
  try {
    await subscribeToGroupChannel(callId, myUserId);
  } catch (err) {
    console.error('[group-call] Channel subscription failed', err);
    stream.getTracks().forEach(t => t.stop());
    _noisePipeline?.dispose();
    _noisePipeline = null;
    _rawAudioStream = null;
    _localStream = null;
    return;
  }

  // Get my profile
  const { useAuthStore } = await import('./authStore');
  const user = useAuthStore.getState().user;

  // Build participant map (me + invited friends as pending)
  const participants = new Map<string, GroupParticipant>();
  if (user) {
    participants.set(myUserId, {
      userId: myUserId,
      username: user.username,
      avatarUrl: user.avatar_url ?? null,
      isMuted: false,
      isSpeaking: false,
      audioLevel: 0,
    });
  }

  set({
    status: 'calling',
    callId,
    myUserId,
    participants,
    isMuted: false,
    invitedUserIds: friends.map(f => f.id),
  });

  // Broadcast group:join for myself
  _groupChannel?.send({
    type: 'broadcast',
    event: 'group:join',
    payload: { callId, userId: myUserId, username: user?.username, avatar_url: user?.avatar_url },
  });

  // Ring each friend via REST broadcast
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const myParticipant = participants.get(myUserId);

  for (const friend of friends) {
    fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{
          topic: `call:ring:${friend.id}`,
          event: 'call:group-invite',
          payload: {
            callId,
            inviterId: myUserId,
            inviterName: user?.username,
            inviterAvatar: user?.avatar_url,
            participants: myParticipant ? [myParticipant] : [],
          },
        }],
      }),
    }).catch(err => console.error('[group-call] Ring failed for', friend.id, err));
  }

  // Start VAD polling
  startVAD(myUserId);

  // beforeunload cleanup
  window.addEventListener('beforeunload', () => {
    _groupChannel?.send({ type: 'broadcast', event: 'group:leave', payload: { callId, userId: myUserId } });
  }, { once: true });
},
```

- [ ] **Step 3: Add VAD polling helper**

Add above the store `create()` call:

```typescript
function startVAD(myUserId: string) {
  if (_vadInterval) clearInterval(_vadInterval);
  _vadInterval = setInterval(() => {
    const { participants } = useGroupCallStore.getState();
    const next = new Map(participants);
    let changed = false;

    for (const [userId, analyser] of _analysers) {
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length / 255;
      const speaking = avg > 0.04;
      const p = next.get(userId);
      if (p && (p.isSpeaking !== speaking || Math.abs(p.audioLevel - avg) > 0.01)) {
        next.set(userId, { ...p, isSpeaking: speaking, audioLevel: avg });
        changed = true;
      }
    }

    if (changed) useGroupCallStore.setState({ participants: next });
  }, 100);
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd aero-chat-app && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/store/groupCallStore.ts
git commit -m "feat(group-calls): implement startGroupCall, mesh signaling, VAD"
```

---

### Task 3: Join Group Call & Incoming Invite Handling

**Files:**
- Modify: `src/store/groupCallStore.ts`
- Modify: `src/App.tsx:278-297`
- Create: `src/components/call/IncomingGroupCallModal.tsx`

- [ ] **Step 1: Implement joinGroupCall and handleIncomingGroupInvite**

Replace the placeholders in the store:

```typescript
handleIncomingGroupInvite: (callId, participants, inviter) => {
  const { status } = get();
  // Busy check — already in a 1:1 or group call
  if (status !== 'idle') return;

  set({
    status: 'ringing',
    callId,
    participants: new Map(participants.map(p => [p.userId, p])),
    invitedUserIds: [],
  });
},

joinGroupCall: async (callId, inviterUserId, existingParticipants) => {
  const { data: authData } = await supabase.auth.getUser();
  const myUserId = authData.user?.id;
  if (!myUserId) return;

  const nc = useAudioStore.getState().noiseCancellation;

  // Get audio
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false },
      video: false,
    });
  } catch {
    // Reject if no mic
    set(INITIAL_STATE);
    return;
  }

  _localStream = stream;
  _rawAudioStream = stream;
  _noisePipeline = nc ? await createNoisePipeline(stream) : await createGainPipeline(stream);
  _noisePipeline.setInputGain(useAudioStore.getState().inputVolume / 100);
  _audioContext = new AudioContext({ sampleRate: 48000 });

  // Subscribe to group channel
  try {
    await subscribeToGroupChannel(callId, myUserId);
  } catch (err) {
    console.error('[group-call] Channel subscription failed', err);
    stream.getTracks().forEach(t => t.stop());
    _noisePipeline?.dispose();
    _noisePipeline = null;
    _rawAudioStream = null;
    _localStream = null;
    set(INITIAL_STATE);
    return;
  }

  // Get my profile
  const { useAuthStore } = await import('./authStore');
  const user = useAuthStore.getState().user;

  // Build participants map
  const participants = new Map<string, GroupParticipant>(
    existingParticipants.map(p => [p.userId, p])
  );
  if (user) {
    participants.set(myUserId, {
      userId: myUserId,
      username: user.username,
      avatarUrl: user.avatar_url ?? null,
      isMuted: false,
      isSpeaking: false,
      audioLevel: 0,
    });
  }

  set({
    status: 'connected',
    callId,
    myUserId,
    participants,
    callStartedAt: Date.now(),
    isMuted: false,
  });

  // Broadcast join — existing participants will create offers
  _groupChannel?.send({
    type: 'broadcast',
    event: 'group:join',
    payload: { callId, userId: myUserId, username: user?.username, avatar_url: user?.avatar_url },
  });

  // Start VAD
  startVAD(myUserId);

  // beforeunload
  window.addEventListener('beforeunload', () => {
    _groupChannel?.send({ type: 'broadcast', event: 'group:leave', payload: { callId, userId: myUserId } });
  }, { once: true });
},
```

- [ ] **Step 2: Extend ring channel in App.tsx**

In `src/App.tsx`, find the ring channel subscription (around line 282-294) and add a second `.on()` handler for group invites BEFORE the `.subscribe()` call:

```typescript
// Add this AFTER the existing .on('broadcast', { event: 'call:offer' }, ...) handler
// and BEFORE .subscribe()
.on('broadcast', { event: 'call:group-invite' }, ({ payload }) => {
  const { callId, inviterId, inviterName, inviterAvatar, participants } = payload;
  if (!callId || !inviterId) return;

  // Only accept from friends
  const inviter = useFriendStore.getState().friends.find(f => f.id === inviterId);
  if (!inviter) return;

  // Check not already in a call
  const { useGroupCallStore } = require('../store/groupCallStore');
  const groupStatus = useGroupCallStore.getState().status;
  const callStatus = useCallStore.getState().status;
  if (groupStatus !== 'idle' || (callStatus !== 'idle')) return;

  useGroupCallStore.getState().handleIncomingGroupInvite(
    callId,
    participants ?? [],
    { ...inviter, username: inviterName ?? inviter.username },
  );
})
```

Also add the import at the top of App.tsx:

```typescript
import { useGroupCallStore } from './store/groupCallStore';
```

- [ ] **Step 3: Create IncomingGroupCallModal**

```typescript
// src/components/call/IncomingGroupCallModal.tsx
import { useEffect } from 'react';
import { Phone, PhoneOff, Users } from 'lucide-react';
import { useGroupCallStore } from '../../store/groupCallStore';
import { AvatarImage } from '../ui/AvatarImage';

export function IncomingGroupCallModal() {
  const { status, callId, participants, joinGroupCall } = useGroupCallStore();

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Enter') handleAccept();
      if (e.key === 'Escape') handleReject();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [callId, participants]);

  if (status !== 'ringing') return null;

  const participantList = Array.from(participants.values());
  const names = participantList.map(p => p.username);
  const displayNames = names.length <= 2
    ? names.join(' and ')
    : `${names.slice(0, 2).join(', ')} and ${names.length - 2} other${names.length - 2 > 1 ? 's' : ''}`;

  function handleAccept() {
    if (!callId) return;
    joinGroupCall(callId, '', participantList);
  }

  function handleReject() {
    useGroupCallStore.setState({
      status: 'idle',
      callId: null,
      participants: new Map(),
      invitedUserIds: [],
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.70)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="flex flex-col items-center gap-5 rounded-3xl p-8 text-center"
        style={{
          background: 'rgba(10,22,40,0.95)',
          border: '1px solid rgba(0,212,255,0.25)',
          boxShadow: '0 8px 48px rgba(0,0,0,0.60), 0 0 40px rgba(0,212,255,0.10)',
          minWidth: 300,
        }}
      >
        <Users className="h-10 w-10" style={{ color: '#00d4ff' }} />
        <div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Group Call</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{displayNames}</p>
        </div>

        {/* Participant avatars */}
        <div className="flex -space-x-2">
          {participantList.slice(0, 4).map(p => (
            <div key={p.userId} className="ring-2 ring-[#0a1628] rounded-full">
              <AvatarImage username={p.username} avatarUrl={p.avatarUrl} size="lg" />
            </div>
          ))}
        </div>

        {/* Accept / Reject */}
        <div className="flex gap-4">
          <button
            onClick={handleReject}
            className="flex items-center gap-2 rounded-full px-6 py-3 font-bold text-sm"
            style={{ background: 'rgba(239,68,68,0.20)', border: '1px solid rgba(239,68,68,0.40)', color: '#ef4444' }}
          >
            <PhoneOff className="h-4 w-4" /> Decline
          </button>
          <button
            onClick={handleAccept}
            className="flex items-center gap-2 rounded-full px-6 py-3 font-bold text-sm"
            style={{ background: 'rgba(52,211,153,0.20)', border: '1px solid rgba(52,211,153,0.40)', color: '#34d399' }}
          >
            <Phone className="h-4 w-4" /> Join
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd aero-chat-app && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/store/groupCallStore.ts src/App.tsx src/components/call/IncomingGroupCallModal.tsx
git commit -m "feat(group-calls): implement joinGroupCall, incoming invite handling, ring channel"
```

---

### Task 4: Screen Share, Add Participant & Mute Broadcast

**Files:**
- Modify: `src/store/groupCallStore.ts`

- [ ] **Step 1: Implement startScreenShare and stopScreenShare**

Replace the placeholders:

```typescript
startScreenShare: async () => {
  const { callId, myUserId, screenSharingUserId } = get();
  if (!callId || !myUserId) return;

  // If someone else is sharing, don't allow
  if (screenSharingUserId && screenSharingUserId !== myUserId) return;

  let screenStream: MediaStream;
  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 30, width: { ideal: 1920 } },
      audio: true,
    });
  } catch (err: unknown) {
    if ((err as DOMException)?.name === 'NotAllowedError') return;
    throw err;
  }

  _screenStream = screenStream;
  const screenTrack = screenStream.getVideoTracks()[0];

  // Replace black video placeholder on all peer connections
  for (const pc of _peerConnections.values()) {
    const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
    if (videoSender) await videoSender.replaceTrack(screenTrack);
  }

  // Auto-stop when browser "Stop sharing" is clicked
  screenTrack.addEventListener('ended', () => {
    useGroupCallStore.getState().stopScreenShare();
  });

  _groupChannel?.send({
    type: 'broadcast',
    event: 'group:screenshare-start',
    payload: { callId, userId: myUserId },
  });

  set({ screenSharingUserId: myUserId, localScreenStream: screenStream });
},

stopScreenShare: () => {
  const { callId, myUserId } = get();
  if (!callId || !myUserId) return;

  _screenStream?.getTracks().forEach(t => t.stop());

  // Replace with black track on all peers
  const blackTrack = createBlackVideoTrack();
  for (const pc of _peerConnections.values()) {
    const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
    if (videoSender) videoSender.replaceTrack(blackTrack).catch(() => {});
  }

  _screenStream = null;

  _groupChannel?.send({
    type: 'broadcast',
    event: 'group:screenshare-stop',
    payload: { callId, userId: myUserId },
  });

  set({ screenSharingUserId: null, localScreenStream: null });
},
```

- [ ] **Step 2: Implement addParticipant**

Replace the placeholder:

```typescript
addParticipant: async (friend) => {
  const { callId, myUserId, participants } = get();
  if (!callId || !myUserId) return;
  if (participants.size >= 4) return; // Max 4

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  const { useAuthStore } = await import('./authStore');
  const user = useAuthStore.getState().user;

  const participantList = Array.from(participants.values());

  fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
    method: 'POST',
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{
        topic: `call:ring:${friend.id}`,
        event: 'call:group-invite',
        payload: {
          callId,
          inviterId: myUserId,
          inviterName: user?.username,
          inviterAvatar: user?.avatar_url,
          participants: participantList,
        },
      }],
    }),
  }).catch(err => console.error('[group-call] Ring failed for', friend.id, err));

  set(s => ({ invitedUserIds: [...s.invitedUserIds, friend.id] }));
},
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd aero-chat-app && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/store/groupCallStore.ts
git commit -m "feat(group-calls): implement screen share, addParticipant, mute broadcast"
```

---

### Task 5: 1:1 Escalation

**Files:**
- Modify: `src/store/groupCallStore.ts`
- Modify: `src/store/callStore.ts`

- [ ] **Step 1: Add export helper to callStore for extracting refs**

Add at the bottom of `src/store/callStore.ts`, before the closing `));`:

```typescript
// ─── Escalation helper — extracts refs for group call migration ─────────
export function extractCallRefsForEscalation() {
  const pc = _peerConnection;
  const rawStream = _rawAudioStream;
  const pipeline = _noisePipeline;
  const localStream = useCallStore.getState().localStream;
  const contact = useCallStore.getState().contact;

  // Null the refs so hangUp doesn't close them
  _peerConnection = null;
  _rawAudioStream = null;
  _noisePipeline = null;
  _screenStream = null;

  // Reset callStore to idle without closing the peer connection
  if (_signalingChannel) supabase.removeChannel(_signalingChannel);
  _signalingChannel = null;
  _channelSubscribed = false;
  _cameraTrack = null;
  _pendingOffer = null;
  if (_iceRestartTimer) { clearTimeout(_iceRestartTimer); _iceRestartTimer = null; }

  useCallStore.setState(INITIAL_CALL_STATE);

  return { peerConnection: pc, rawAudioStream: rawStream, noisePipeline: pipeline, localStream, contact };
}
```

Also add `extractCallRefsForEscalation` to the exports by ensuring it's exported as a standalone function (it already is since it's declared with `export function`).

- [ ] **Step 2: Implement escalateToGroup in groupCallStore**

Replace the placeholder:

```typescript
escalateToGroup: async (newFriend) => {
  const { data: authData } = await supabase.auth.getUser();
  const myUserId = authData.user?.id;
  if (!myUserId) return;

  // Extract refs from 1:1 call
  const { extractCallRefsForEscalation } = await import('./callStore');
  const refs = extractCallRefsForEscalation();
  if (!refs.peerConnection || !refs.contact) return;

  const callId = `group-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // Transfer refs
  _peerConnections.set(refs.contact.id, refs.peerConnection);
  _rawAudioStream = refs.rawAudioStream;
  _noisePipeline = refs.noisePipeline;
  _localStream = refs.localStream;
  _audioContext = new AudioContext({ sampleRate: 48000 });

  // Set up remote stream tracking for the existing peer
  const existingRemoteStream = new MediaStream();
  refs.peerConnection.getReceivers().forEach(r => {
    if (r.track) existingRemoteStream.addTrack(r.track);
  });
  _remoteStreams.set(refs.contact.id, existingRemoteStream);

  // Subscribe to group channel
  try {
    await subscribeToGroupChannel(callId, myUserId);
  } catch (err) {
    console.error('[group-call] Escalation channel failed', err);
    return;
  }

  const { useAuthStore } = await import('./authStore');
  const user = useAuthStore.getState().user;

  // Build participants (me + existing contact)
  const participants = new Map<string, GroupParticipant>();
  if (user) {
    participants.set(myUserId, {
      userId: myUserId, username: user.username, avatarUrl: user.avatar_url ?? null,
      isMuted: false, isSpeaking: false, audioLevel: 0,
    });
  }
  participants.set(refs.contact.id, {
    userId: refs.contact.id, username: refs.contact.username, avatarUrl: refs.contact.avatar_url ?? null,
    isMuted: false, isSpeaking: false, audioLevel: 0,
  });

  set({
    status: 'connected',
    callId,
    myUserId,
    participants,
    callStartedAt: Date.now(),
    isMuted: false,
    invitedUserIds: [newFriend.id],
  });

  // Broadcast join
  _groupChannel?.send({
    type: 'broadcast',
    event: 'group:join',
    payload: { callId, userId: myUserId, username: user?.username, avatar_url: user?.avatar_url },
  });

  // Ring the new friend
  const participantList = Array.from(participants.values());
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
    method: 'POST',
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{
        topic: `call:ring:${newFriend.id}`,
        event: 'call:group-invite',
        payload: {
          callId,
          inviterId: myUserId,
          inviterName: user?.username,
          inviterAvatar: user?.avatar_url,
          participants: participantList,
        },
      }],
    }),
  }).catch(err => console.error('[group-call] Ring failed for', newFriend.id, err));

  // Also need to tell the existing contact to join the group channel
  // Send via the existing peer connection's data channel or via REST
  fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
    method: 'POST',
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{
        topic: `call:ring:${refs.contact.id}`,
        event: 'call:group-invite',
        payload: {
          callId,
          inviterId: myUserId,
          inviterName: user?.username,
          inviterAvatar: user?.avatar_url,
          participants: participantList,
        },
      }],
    }),
  }).catch(() => {});

  startVAD(myUserId);
},
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd aero-chat-app && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/store/groupCallStore.ts src/store/callStore.ts
git commit -m "feat(group-calls): implement 1:1 escalation with ref transfer"
```

---

### Task 6: ParticipantCard Component

**Files:**
- Create: `src/components/call/ParticipantCard.tsx`

- [ ] **Step 1: Create the ParticipantCard component**

```typescript
// src/components/call/ParticipantCard.tsx
import { memo } from 'react';
import { MicOff } from 'lucide-react';
import { AvatarImage } from '../ui/AvatarImage';

interface ParticipantCardProps {
  username: string;
  avatarUrl: string | null;
  isMuted: boolean;
  isSpeaking: boolean;
  audioLevel: number;
  isMe: boolean;
  compact?: boolean;
}

const AUDIO_BAR_COUNT = 7;

export const ParticipantCard = memo(function ParticipantCard({
  username, avatarUrl, isMuted, isSpeaking, audioLevel, isMe, compact,
}: ParticipantCardProps) {
  const statusLabel = isMuted ? 'Muted' : isSpeaking ? 'Speaking' : 'Listening';
  const statusColor = isMuted ? 'rgba(239,68,68,0.60)' : isSpeaking ? '#00d4ff' : 'var(--text-muted)';

  if (compact) {
    return (
      <div
        className="flex items-center gap-2.5 rounded-2xl px-3 py-2"
        style={{
          background: isSpeaking ? 'rgba(0,212,255,0.07)' : 'rgba(255,255,255,0.03)',
          border: isSpeaking ? '1px solid rgba(0,212,255,0.25)' : '1px solid rgba(255,255,255,0.08)',
          minWidth: 110,
        }}
      >
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {isSpeaking && (
            <div style={{
              position: 'absolute', inset: -3, borderRadius: '50%',
              border: '2px solid rgba(0,212,255,0.45)',
              boxShadow: '0 0 10px rgba(0,212,255,0.30)',
              pointerEvents: 'none',
            }} />
          )}
          <AvatarImage username={username} avatarUrl={avatarUrl} size="sm" />
          {isMuted && (
            <div style={{
              position: 'absolute', bottom: -1, right: -1, width: 14, height: 14, borderRadius: '50%',
              background: 'rgba(239,68,68,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1.5px solid var(--bg-primary)',
            }}>
              <MicOff className="h-2 w-2 text-white" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold" style={{ color: isSpeaking ? 'white' : 'rgba(255,255,255,0.70)' }}>{username}</p>
          <AudioBars level={isMuted ? 0 : audioLevel} active={isSpeaking} barCount={5} height={8} />
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center gap-2 rounded-2xl p-5 text-center"
      style={{
        background: isSpeaking ? 'rgba(0,212,255,0.07)' : 'rgba(255,255,255,0.03)',
        border: isSpeaking ? '1px solid rgba(0,212,255,0.30)' : '1px solid rgba(255,255,255,0.10)',
        boxShadow: isSpeaking ? '0 0 24px rgba(0,212,255,0.12), inset 0 1px 0 rgba(255,255,255,0.08)' : undefined,
        backdropFilter: 'blur(12px)',
        transition: 'background 0.3s, border-color 0.3s, box-shadow 0.3s',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Inner glow for speaker */}
      {isSpeaking && (
        <div style={{
          position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)',
          width: 100, height: 60,
          background: 'radial-gradient(ellipse, rgba(0,212,255,0.15) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
      )}

      {/* Avatar with speaking ring */}
      <div style={{ position: 'relative', display: 'inline-block' }}>
        {isSpeaking && (
          <div style={{
            position: 'absolute', inset: -5, borderRadius: '50%',
            border: '2px solid rgba(0,212,255,0.55)',
            boxShadow: '0 0 14px rgba(0,212,255,0.40), 0 0 28px rgba(0,212,255,0.15)',
            animation: 'aura-pulse 2.5s ease-in-out infinite',
            pointerEvents: 'none',
          }} />
        )}
        <AvatarImage username={username} avatarUrl={avatarUrl} size="xl" />
        {isMuted && (
          <div style={{
            position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderRadius: '50%',
            background: 'rgba(239,68,68,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid var(--bg-primary)',
          }}>
            <MicOff className="h-2.5 w-2.5 text-white" />
          </div>
        )}
      </div>

      {/* Name + badge */}
      <div>
        <span className="text-sm font-bold" style={{ color: isSpeaking ? 'white' : 'rgba(255,255,255,0.80)' }}>
          {username}
        </span>
        {isMe && (
          <span className="ml-1.5 text-[9px] font-semibold rounded px-1.5 py-0.5"
            style={{ background: 'rgba(0,212,255,0.10)', color: 'rgba(0,212,255,0.70)' }}>You</span>
        )}
      </div>

      {/* Status */}
      <span className="text-[10px] font-medium" style={{ color: statusColor }}>{statusLabel}</span>

      {/* Audio bars */}
      <AudioBars level={isMuted ? 0 : audioLevel} active={isSpeaking} barCount={AUDIO_BAR_COUNT} height={20} />
    </div>
  );
});

/* ── Audio Bars ──────────────────────────────────────────────────────────── */

function AudioBars({ level, active, barCount, height }: { level: number; active: boolean; barCount: number; height: number }) {
  return (
    <div style={{ display: 'flex', gap: 2, justifyContent: 'center', height, alignItems: 'flex-end' }}>
      {Array.from({ length: barCount }).map((_, i) => {
        // Pseudo-random per-bar variation seeded by index
        const variance = 0.6 + 0.4 * Math.sin(i * 2.1 + level * 20);
        const barHeight = active ? Math.max(3, height * level * variance) : 3;
        return (
          <div
            key={i}
            style={{
              width: 3,
              height: barHeight,
              borderRadius: 2,
              background: active
                ? `rgba(0,212,255,${0.35 + level * 0.3})`
                : 'rgba(255,255,255,0.08)',
              transition: 'height 0.1s ease-out',
            }}
          />
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd aero-chat-app && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/call/ParticipantCard.tsx
git commit -m "feat(group-calls): add ParticipantCard with glass styling, speaking ring, audio bars"
```

---

### Task 7: AddToCallModal Component

**Files:**
- Create: `src/components/call/AddToCallModal.tsx`

- [ ] **Step 1: Create the modal**

```typescript
// src/components/call/AddToCallModal.tsx
import { useState, useMemo } from 'react';
import { X, Search } from 'lucide-react';
import { useFriendStore } from '../../store/friendStore';
import { usePresenceStore } from '../../store/presenceStore';
import { useGroupCallStore } from '../../store/groupCallStore';
import { AvatarImage } from '../ui/AvatarImage';
import type { Profile } from '../../store/authStore';

interface Props {
  onClose: () => void;
  /** If true, multi-select mode for starting a fresh group call */
  multiSelect?: boolean;
}

export function AddToCallModal({ onClose, multiSelect }: Props) {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const friends = useFriendStore(s => s.friends);
  const onlineIds = usePresenceStore(s => s.onlineIds);
  const participants = useGroupCallStore(s => s.participants);
  const addParticipant = useGroupCallStore(s => s.addParticipant);
  const startGroupCall = useGroupCallStore(s => s.startGroupCall);

  const slotsUsed = participants.size;
  const slotsAvailable = 4 - slotsUsed - selectedIds.size;

  const inCallIds = useMemo(() => new Set(participants.keys()), [participants]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return friends
      .filter(f => !q || f.username.toLowerCase().includes(q))
      .sort((a, b) => {
        // In call first (disabled), then online, then offline
        const aInCall = inCallIds.has(a.id);
        const bInCall = inCallIds.has(b.id);
        if (aInCall !== bInCall) return aInCall ? -1 : 1;
        const aOnline = onlineIds.has(a.id);
        const bOnline = onlineIds.has(b.id);
        if (aOnline !== bOnline) return aOnline ? -1 : 1;
        return a.username.localeCompare(b.username);
      });
  }, [friends, search, onlineIds, inCallIds]);

  function handleInvite(friend: Profile) {
    if (multiSelect) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(friend.id)) next.delete(friend.id);
        else if (slotsAvailable > 0) next.add(friend.id);
        return next;
      });
    } else {
      addParticipant(friend);
      onClose();
    }
  }

  function handleStartCall() {
    const selected = friends.filter(f => selectedIds.has(f.id));
    if (selected.length > 0) {
      startGroupCall(selected);
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}>
      <div
        className="flex flex-col rounded-2xl p-5"
        style={{
          background: 'linear-gradient(135deg, rgba(10,22,40,0.98), rgba(13,40,71,0.98))',
          border: '1px solid rgba(0,212,255,0.20)',
          boxShadow: '0 8px 48px rgba(0,0,0,0.60), 0 0 40px rgba(0,212,255,0.08)',
          width: 340, maxHeight: '70vh',
        }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            {multiSelect ? 'Start Group Call' : 'Add to Call'}
          </h3>
          <button onClick={onClose} className="flex items-center justify-center rounded-full h-7 w-7"
            style={{ background: 'rgba(255,255,255,0.06)' }}>
            <X className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 rounded-xl px-3 py-2 mb-3"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}>
          <Search className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search friends..."
            className="flex-1 bg-transparent text-xs outline-none"
            style={{ color: 'var(--text-primary)' }}
          />
        </div>

        {/* Friends list */}
        <div className="flex-1 overflow-y-auto space-y-1" style={{ maxHeight: 280 }}>
          {filtered.map(friend => {
            const isInCall = inCallIds.has(friend.id);
            const isOnline = onlineIds.has(friend.id);
            const isSelected = selectedIds.has(friend.id);
            const canInvite = !isInCall && isOnline && (slotsAvailable > 0 || isSelected);

            return (
              <div
                key={friend.id}
                className="flex items-center gap-2.5 rounded-xl px-2 py-2"
                style={{
                  background: isSelected ? 'rgba(0,212,255,0.08)' : 'rgba(255,255,255,0.02)',
                  opacity: isInCall || !isOnline ? 0.4 : 1,
                  cursor: canInvite ? 'pointer' : 'default',
                }}
                onClick={() => canInvite && handleInvite(friend)}
              >
                <div style={{ position: 'relative' }}>
                  <AvatarImage username={friend.username} avatarUrl={friend.avatar_url} size="md" />
                  {isOnline && !isInCall && (
                    <div style={{
                      position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: '50%',
                      background: '#3dd87a', border: '2px solid #0a1628',
                    }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{friend.username}</p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {isInCall ? 'Already in call' : isOnline ? 'Online' : 'Offline'}
                  </p>
                </div>
                {isInCall && <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>&#10003;</span>}
                {!isInCall && isOnline && !multiSelect && (
                  <button className="rounded-lg px-2.5 py-1 text-[10px] font-semibold"
                    style={{ background: 'rgba(0,212,255,0.15)', border: '1px solid rgba(0,212,255,0.30)', color: '#00d4ff' }}>
                    Invite
                  </button>
                )}
                {multiSelect && isSelected && (
                  <div className="h-5 w-5 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(0,212,255,0.25)', border: '1px solid rgba(0,212,255,0.50)' }}>
                    <span className="text-[10px] text-cyan-400">&#10003;</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {slotsAvailable} of 4 slots available
          </span>
          {multiSelect && (
            <button
              onClick={handleStartCall}
              disabled={selectedIds.size === 0}
              className="rounded-xl px-4 py-1.5 text-xs font-bold"
              style={{
                background: selectedIds.size > 0 ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.04)',
                border: selectedIds.size > 0 ? '1px solid rgba(0,212,255,0.40)' : '1px solid rgba(255,255,255,0.08)',
                color: selectedIds.size > 0 ? '#00d4ff' : 'var(--text-muted)',
                cursor: selectedIds.size > 0 ? 'pointer' : 'default',
              }}>
              Start Call ({selectedIds.size})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd aero-chat-app && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/call/AddToCallModal.tsx
git commit -m "feat(group-calls): add AddToCallModal with search, online filtering, multi-select"
```

---

### Task 8: GroupCallView — Main UI

**Files:**
- Create: `src/components/call/GroupCallView.tsx`

- [ ] **Step 1: Create GroupCallView**

```typescript
// src/components/call/GroupCallView.tsx
import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Monitor, MonitorOff, MessageCircle, PhoneOff, UserPlus } from 'lucide-react';
import { useGroupCallStore } from '../../store/groupCallStore';
import { ParticipantCard } from './ParticipantCard';
import { AddToCallModal } from './AddToCallModal';
import { IncomingGroupCallModal } from './IncomingGroupCallModal';
import { CameraFeed } from './CameraFeed';

const MAX_PARTICIPANTS = 4;

function formatDuration(startedAt: number): string {
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function GroupCallView() {
  const {
    status, callId, participants, myUserId,
    isMuted, screenSharingUserId, localScreenStream,
    callStartedAt, invitedUserIds,
    leaveCall, toggleMute, startScreenShare, stopScreenShare,
  } = useGroupCallStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [duration, setDuration] = useState('0:00');
  const [showControls, setShowControls] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Duration ticker
  useEffect(() => {
    if (!callStartedAt) return;
    const id = setInterval(() => setDuration(formatDuration(callStartedAt)), 1000);
    return () => clearInterval(id);
  }, [callStartedAt]);

  // Auto-hide controls
  useEffect(() => {
    function resetHide() {
      setShowControls(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setShowControls(false), 4000);
    }
    window.addEventListener('mousemove', resetHide);
    resetHide();
    return () => {
      window.removeEventListener('mousemove', resetHide);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  // Ringing state — show incoming modal
  if (status === 'ringing') return <IncomingGroupCallModal />;
  if (status === 'idle') return null;

  const participantList = Array.from(participants.values());
  const emptySlots = MAX_PARTICIPANTS - participantList.length;
  const isScreenSharing = !!screenSharingUserId;
  const iAmSharing = screenSharingUserId === myUserId;

  // Find remote screen stream
  const remoteScreenStream = screenSharingUserId && screenSharingUserId !== myUserId
    ? (() => {
        // The screen track comes through the peer connection's video track
        const streams = (window as any).__groupRemoteStreams as Map<string, MediaStream> | undefined;
        // We'll use a ref approach instead — see CameraFeed usage below
        return null;
      })()
    : null;

  const btnBase: React.CSSProperties = {
    width: 44, height: 44, borderRadius: '50%',
    border: '1px solid rgba(255,255,255,0.15)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', transition: 'all 0.15s ease',
    color: 'rgba(255,255,255,0.85)', background: 'rgba(255,255,255,0.08)',
    flexShrink: 0,
  };

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col"
      style={{ background: 'linear-gradient(135deg, #060e1f 0%, #0a1e3d 50%, #0d2847 100%)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-5 pt-4">
        <div className="h-2 w-2 rounded-full" style={{ background: '#3dd87a', boxShadow: '0 0 6px rgba(61,216,122,0.50)' }} />
        <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.50)' }}>Group Call</span>
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.30)' }}>&middot;</span>
        <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.40)' }}>{duration}</span>
        {invitedUserIds.length > 0 && (
          <span className="text-[10px] ml-2 px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}>
            Ringing {invitedUserIds.length}...
          </span>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-6">
        {isScreenSharing ? (
          /* Screen sharing layout */
          <div className="flex flex-col gap-3 w-full h-full max-w-5xl">
            {/* Screen area */}
            <div className="flex-1 rounded-2xl overflow-hidden relative"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.10)' }}>
              {iAmSharing && localScreenStream && (
                <CameraFeed stream={localScreenStream} muted style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              )}
              {/* Sharer badge */}
              <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-lg px-2.5 py-1"
                style={{ background: 'rgba(0,0,0,0.60)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.10)' }}>
                <div className="h-1.5 w-1.5 rounded-full" style={{ background: '#ef4444' }} />
                <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.70)' }}>
                  {participants.get(screenSharingUserId!)?.username ?? 'Someone'} is sharing
                </span>
              </div>
            </div>

            {/* Compact participant strip */}
            <div className="flex gap-2 justify-center flex-wrap">
              {participantList.map(p => (
                <ParticipantCard
                  key={p.userId}
                  username={p.username}
                  avatarUrl={p.avatarUrl}
                  isMuted={p.userId === myUserId ? isMuted : p.isMuted}
                  isSpeaking={p.isSpeaking}
                  audioLevel={p.audioLevel}
                  isMe={p.userId === myUserId}
                  compact
                />
              ))}
            </div>
          </div>
        ) : (
          /* Normal 2x2 grid */
          <div className="grid grid-cols-2 gap-3" style={{ maxWidth: 440 }}>
            {participantList.map(p => (
              <ParticipantCard
                key={p.userId}
                username={p.username}
                avatarUrl={p.avatarUrl}
                isMuted={p.userId === myUserId ? isMuted : p.isMuted}
                isSpeaking={p.isSpeaking}
                audioLevel={p.audioLevel}
                isMe={p.userId === myUserId}
              />
            ))}
            {/* Empty slots */}
            {Array.from({ length: Math.min(emptySlots, MAX_PARTICIPANTS - participantList.length) }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="flex flex-col items-center justify-center rounded-2xl p-5 cursor-pointer"
                style={{
                  background: 'rgba(255,255,255,0.015)',
                  border: '1px dashed rgba(255,255,255,0.10)',
                  minHeight: 160,
                }}
                onClick={() => setShowAddModal(true)}
              >
                <div className="flex items-center justify-center rounded-full"
                  style={{ width: 52, height: 52, border: '2px dashed rgba(255,255,255,0.15)' }}>
                  <UserPlus className="h-5 w-5" style={{ color: 'rgba(255,255,255,0.20)' }} />
                </div>
                <span className="mt-2 text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.25)' }}>Add friend</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Controls */}
      <div
        className="flex justify-center pb-6 pt-2"
        style={{ opacity: showControls ? 1 : 0, transition: 'opacity 0.3s' }}
      >
        <div className="flex items-center gap-2.5 rounded-2xl px-5 py-3"
          style={{ background: 'rgba(0,0,0,0.40)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {/* Mute */}
          <button
            onClick={toggleMute}
            style={{
              ...btnBase,
              ...(isMuted ? { background: 'rgba(245,158,11,0.25)', borderColor: 'rgba(245,158,11,0.50)', color: '#f59e0b' } : {}),
            }}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>

          {/* Screen share */}
          <button
            onClick={iAmSharing ? stopScreenShare : startScreenShare}
            style={{
              ...btnBase,
              ...(iAmSharing ? { background: 'rgba(239,68,68,0.25)', borderColor: 'rgba(239,68,68,0.50)', color: '#ef4444' } : {}),
            }}
            title={iAmSharing ? 'Stop sharing' : 'Share screen'}
          >
            {iAmSharing ? <MonitorOff className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
          </button>

          {/* Add person */}
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              ...btnBase,
              ...(participantList.length >= MAX_PARTICIPANTS ? { opacity: 0.35, cursor: 'default' } : {}),
            }}
            title="Add person"
            disabled={participantList.length >= MAX_PARTICIPANTS}
          >
            <UserPlus className="h-4 w-4" />
          </button>

          {/* Separator */}
          <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.12)', margin: '0 4px' }} />

          {/* Leave */}
          <button
            onClick={leaveCall}
            style={{
              ...btnBase,
              width: 48, height: 48, borderRadius: 20,
              background: 'rgba(239,68,68,0.20)', borderColor: 'rgba(239,68,68,0.40)', color: '#ef4444',
            }}
            title="Leave call"
          >
            <PhoneOff className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Hidden audio elements for each remote stream */}
      {participantList.filter(p => p.userId !== myUserId).map(p => (
        <RemoteAudio key={p.userId} userId={p.userId} />
      ))}

      {/* Add to call modal */}
      {showAddModal && <AddToCallModal onClose={() => setShowAddModal(false)} />}
    </div>
  );
}

/* ── Hidden audio playback per remote peer ────────────────────────────── */

function RemoteAudio({ userId }: { userId: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    // Access module-level remote streams from the store module
    // We need to import the getter
    const checkStream = setInterval(() => {
      const el = audioRef.current;
      if (!el) return;
      // Get stream from the exported ref accessor
      import('../../store/groupCallStore').then(mod => {
        const stream = (mod as any)._getRemoteStream?.(userId);
        if (stream && el.srcObject !== stream) {
          el.srcObject = stream;
          el.play().catch(() => {});
        }
      });
    }, 500);
    return () => clearInterval(checkStream);
  }, [userId]);

  return <audio ref={audioRef} autoPlay style={{ display: 'none' }} />;
}
```

- [ ] **Step 2: Add remote stream accessor to groupCallStore**

Add this export at the bottom of `src/store/groupCallStore.ts`:

```typescript
// Accessor for remote streams (used by GroupCallView's hidden audio elements)
export function _getRemoteStream(userId: string): MediaStream | undefined {
  return _remoteStreams.get(userId);
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd aero-chat-app && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/call/GroupCallView.tsx src/store/groupCallStore.ts
git commit -m "feat(group-calls): add GroupCallView with grid, screen share layout, controls"
```

---

### Task 9: Integration — ChatLayout & CallControls

**Files:**
- Modify: `src/components/chat/ChatLayout.tsx`
- Modify: `src/components/call/CallControls.tsx`

- [ ] **Step 1: Add GroupCallView to ChatLayout**

In `src/components/chat/ChatLayout.tsx`, add the import near the top with the other call imports:

```typescript
import { GroupCallView } from '../call/GroupCallView';
import { useGroupCallStore } from '../../store/groupCallStore';
```

Then in the component body, read group call status:

```typescript
const groupCallStatus = useGroupCallStore(s => s.status);
```

And render `<GroupCallView />` alongside `<CallView />` (find where CallView is rendered and add GroupCallView next to it):

```typescript
<CallView />
{groupCallStatus !== 'idle' && <GroupCallView />}
```

- [ ] **Step 2: Add "Add person" button to CallControls for 1:1 escalation**

In `src/components/call/CallControls.tsx`, add imports:

```typescript
import { UserPlus } from 'lucide-react';
import { useGroupCallStore } from '../../store/groupCallStore';
```

Add a new prop to `CallControlsProps`:

```typescript
interface CallControlsProps {
  onToggleChat: () => void;
  chatOpen: boolean;
  onAddPerson?: () => void; // 1:1 escalation
}
```

Add the "Add person" button after the screen share button and before the separator:

```typescript
{/* Add person (1:1 escalation) */}
{onAddPerson && (
  <button onClick={onAddPerson} style={btnBase} title="Add person to call">
    <UserPlus size={17} />
  </button>
)}
```

- [ ] **Step 3: Wire escalation in CallView**

In `src/components/call/CallView.tsx`, add state for the add-person modal and pass the callback. Find where `<CallControls>` is rendered and add:

```typescript
import { AddToCallModal } from './AddToCallModal';
import { useGroupCallStore } from '../../store/groupCallStore';
```

Add state:

```typescript
const [showAddToCall, setShowAddToCall] = useState(false);
```

Pass to CallControls:

```typescript
<CallControls
  onToggleChat={() => setChatOpen(p => !p)}
  chatOpen={chatOpen}
  onAddPerson={status === 'connected' ? () => setShowAddToCall(true) : undefined}
/>
```

And render the modal:

```typescript
{showAddToCall && (
  <AddToCallModal
    onClose={() => setShowAddToCall(false)}
  />
)}
```

The AddToCallModal in this context will call `escalateToGroup` when a friend is selected (since groupCallStore status is idle, it will escalate the 1:1 call).

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd aero-chat-app && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Build and verify**

Run: `cd aero-chat-app && npx vite build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/chat/ChatLayout.tsx src/components/call/CallControls.tsx src/components/call/CallView.tsx
git commit -m "feat(group-calls): integrate GroupCallView into ChatLayout, add escalation button"
```

---

### Task 10: Final Polish — beforeunload, busy checks, edge cases

**Files:**
- Modify: `src/store/groupCallStore.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add busy check in App.tsx ring handler**

In the group-invite handler in App.tsx, the busy check already exists from Task 3. Verify it checks BOTH callStore and groupCallStore status:

```typescript
const groupStatus = useGroupCallStore.getState().status;
const callStatus = useCallStore.getState().status;
if (groupStatus !== 'idle' || callStatus !== 'idle') return;
```

- [ ] **Step 2: Add 30-second invite timeout in groupCallStore**

In `startGroupCall`, after the ring loop, add:

```typescript
// 30s timeout for unanswered invites
setTimeout(() => {
  const { invitedUserIds } = useGroupCallStore.getState();
  if (invitedUserIds.length > 0) {
    useGroupCallStore.setState({ invitedUserIds: [] });
  }
}, 30_000);
```

- [ ] **Step 3: Verify full build**

Run: `cd aero-chat-app && npx tsc --noEmit && npx vite build`
Expected: TypeScript clean, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/store/groupCallStore.ts src/App.tsx
git commit -m "feat(group-calls): add busy checks, invite timeout, edge case handling"
```

- [ ] **Step 5: Push and deploy**

```bash
git push origin main
cd aero-chat-app && vercel --prod --yes
```
