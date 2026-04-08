// src/store/groupCallStore.ts
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { createPeerConnection, createBlackVideoTrack, serializeSdp } from '../lib/webrtc';
import type { Profile } from './authStore';
import { useAudioStore } from './audioStore';
import { createNoisePipeline, createGainPipeline, type NoisePipeline } from '../lib/noiseSuppression';
import { useFriendStore } from './friendStore';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface GroupParticipant {
  userId: string;
  username: string;
  avatarUrl: string | null;
  isMuted: boolean;
  isSpeaking: boolean;
  audioLevel: number; // 0-1
  cardGradient?: string | null;
  cardImageUrl?: string | null;
  cardImageParams?: { zoom: number; x: number; y: number } | null;
}

export interface GroupCallState {
  status: 'idle' | 'calling' | 'ringing' | 'connected';
  callId: string | null;
  participants: Map<string, GroupParticipant>;
  myUserId: string | null;

  screenSharingUserId: string | null;
  localScreenStream: MediaStream | null;

  isMuted: boolean;
  isDeafened: boolean;
  callStartedAt: number | null;
  invitedUserIds: string[];

  // Actions
  startGroupCall: (friends: Profile[]) => Promise<void>;
  escalateToGroup: (newFriend: Profile) => Promise<void>;
  joinGroupCall: (callId: string, inviterUserId: string, existingParticipants: GroupParticipant[]) => Promise<void>;
  leaveCall: () => void;
  addParticipant: (friend: Profile) => Promise<void>;
  toggleMute: () => void;
  toggleDeafen: () => void;
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
// eslint-disable-next-line prefer-const -- written in subscribe callback, read in joinGroupCall (Task 3)
let _channelSubscribed = false; void _channelSubscribed;
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
  isDeafened: false,
  callStartedAt: null,
  invitedUserIds: [],
};

// ─── Helper: look up card background from friends or auth store ──────────

function getCardFields(userId: string): Pick<GroupParticipant, 'cardGradient' | 'cardImageUrl' | 'cardImageParams'> {
  const friend = useFriendStore.getState().friends.find(f => f.id === userId);
  if (friend) return { cardGradient: friend.card_gradient, cardImageUrl: friend.card_image_url, cardImageParams: friend.card_image_params };
  return { cardGradient: null, cardImageUrl: null, cardImageParams: null };
}

// ─── Helper: setup a peer connection for a remote user ─────────────────────

async function setupPeerConnection(
  remoteUserId: string,
  callId: string,
  myUserId: string,
): Promise<RTCPeerConnection> {
  const pc = await createPeerConnection();
  _peerConnections.set(remoteUserId, pc);

  // Add local audio track from noise pipeline
  if (_noisePipeline) {
    for (const track of _noisePipeline.processedStream.getAudioTracks()) {
      pc.addTrack(track, _noisePipeline.processedStream);
    }
  }

  // Add black video placeholder so video sender exists for later replaceTrack
  const blackTrack = createBlackVideoTrack();
  const blackStream = new MediaStream([blackTrack]);
  pc.addTrack(blackTrack, blackStream);

  // Forward ICE candidates via broadcast channel
  pc.onicecandidate = (e) => {
    if (e.candidate && _groupChannel) {
      _groupChannel.send({
        type: 'broadcast',
        event: 'group:ice',
        payload: {
          candidate: e.candidate.toJSON(),
          callId,
          fromUserId: myUserId,
          toUserId: remoteUserId,
        },
      });
    }
  };

  // Remote stream setup
  const remoteStream = new MediaStream();
  _remoteStreams.set(remoteUserId, remoteStream);

  pc.ontrack = (e) => {
    remoteStream.addTrack(e.track);

    // Set up AnalyserNode for VAD if we have an audio context and this is audio
    if (_audioContext && e.track.kind === 'audio') {
      const source = _audioContext.createMediaStreamSource(new MediaStream([e.track]));
      const analyser = _audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      _analysers.set(remoteUserId, analyser);
    }
  };

  pc.oniceconnectionstatechange = () => {
    const state = pc.iceConnectionState;
    if (state === 'failed') {
      // Clean up this peer
      pc.close();
      _peerConnections.delete(remoteUserId);
      _remoteStreams.delete(remoteUserId);
      _analysers.delete(remoteUserId);
      _pendingCandidates.delete(remoteUserId);

      const store = useGroupCallStore.getState();
      const nextParticipants = new Map(store.participants);
      nextParticipants.delete(remoteUserId);
      useGroupCallStore.setState({ participants: nextParticipants });

      // Auto-end if alone (only self remains)
      if (_peerConnections.size === 0) {
        store.leaveCall();
      }
    } else if (state === 'connected' || state === 'completed') {
      useGroupCallStore.setState({ status: 'connected' });
    }
  };

  return pc;
}

// ─── Helper: create & send an SDP offer to a remote peer ───────────────────

async function createOfferForPeer(
  remoteUserId: string,
  callId: string,
  myUserId: string,
): Promise<void> {
  const pc = _peerConnections.get(remoteUserId);
  if (!pc) return;
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  _groupChannel?.send({
    type: 'broadcast',
    event: 'group:offer',
    payload: {
      sdp: pc.localDescription ? serializeSdp(pc.localDescription) : null,
      callId,
      fromUserId: myUserId,
      toUserId: remoteUserId,
    },
  });
}

// ─── Helper: subscribe to group signaling channel ──────────────────────────

async function subscribeToGroupChannel(
  callId: string,
  myUserId: string,
): Promise<void> {
  const channel = supabase.channel(`call:group:${callId}`);
  _groupChannel = channel;

  channel.on('broadcast', { event: 'group:offer' }, async ({ payload }) => {
    if (payload.toUserId !== myUserId) return;
    const fromUserId: string = payload.fromUserId;

    let pc = _peerConnections.get(fromUserId);
    if (!pc) {
      pc = await setupPeerConnection(fromUserId, callId, myUserId);
    }

    await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));

    // Drain pending ICE candidates
    const pending = _pendingCandidates.get(fromUserId);
    if (pending) {
      for (const c of pending) await pc.addIceCandidate(new RTCIceCandidate(c));
      _pendingCandidates.delete(fromUserId);
    }

    // Send answer
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    _groupChannel?.send({
      type: 'broadcast',
      event: 'group:answer',
      payload: {
        sdp: pc.localDescription ? serializeSdp(pc.localDescription) : null,
        callId,
        fromUserId: myUserId,
        toUserId: fromUserId,
      },
    });
  });

  channel.on('broadcast', { event: 'group:answer' }, async ({ payload }) => {
    if (payload.toUserId !== myUserId) return;
    const fromUserId: string = payload.fromUserId;
    const pc = _peerConnections.get(fromUserId);
    if (!pc) return;

    await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));

    // Drain pending ICE candidates
    const pending = _pendingCandidates.get(fromUserId);
    if (pending) {
      for (const c of pending) await pc.addIceCandidate(new RTCIceCandidate(c));
      _pendingCandidates.delete(fromUserId);
    }
  });

  channel.on('broadcast', { event: 'group:ice' }, async ({ payload }) => {
    if (payload.toUserId !== myUserId) return;
    const fromUserId: string = payload.fromUserId;
    const pc = _peerConnections.get(fromUserId);

    if (pc && pc.remoteDescription) {
      await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
    } else {
      // Queue until remote description is set
      const pending = _pendingCandidates.get(fromUserId) ?? [];
      pending.push(payload.candidate);
      _pendingCandidates.set(fromUserId, pending);
    }
  });

  channel.on('broadcast', { event: 'group:join' }, async ({ payload }) => {
    if (payload.userId === myUserId) return;

    // Add participant to store
    const store = useGroupCallStore.getState();
    const nextParticipants = new Map(store.participants);
    nextParticipants.set(payload.userId, {
      userId: payload.userId,
      username: payload.username,
      avatarUrl: payload.avatar_url ?? null,
      isMuted: false,
      isSpeaking: false,
      audioLevel: 0,
      ...getCardFields(payload.userId),
    });
    useGroupCallStore.setState({ participants: nextParticipants });

    // Set up peer connection
    await setupPeerConnection(payload.userId, callId, myUserId);

    // Lower ID creates the offer (deterministic tie-breaking)
    if (myUserId < payload.userId) {
      await createOfferForPeer(payload.userId, callId, myUserId);
    }
  });

  channel.on('broadcast', { event: 'group:leave' }, ({ payload }) => {
    if (payload.userId === myUserId) return;
    const remoteUserId: string = payload.userId;

    // Tear down peer
    const pc = _peerConnections.get(remoteUserId);
    if (pc) pc.close();
    _peerConnections.delete(remoteUserId);
    _remoteStreams.delete(remoteUserId);
    _analysers.delete(remoteUserId);
    _pendingCandidates.delete(remoteUserId);

    // Remove from store
    const store = useGroupCallStore.getState();
    const nextParticipants = new Map(store.participants);
    nextParticipants.delete(remoteUserId);
    useGroupCallStore.setState({ participants: nextParticipants });

    // Auto-end if alone
    if (_peerConnections.size === 0) {
      store.leaveCall();
    }
  });

  channel.on('broadcast', { event: 'group:mute' }, ({ payload }) => {
    if (payload.userId === myUserId) return;
    const store = useGroupCallStore.getState();
    const p = store.participants.get(payload.userId);
    if (!p) return;
    const nextParticipants = new Map(store.participants);
    nextParticipants.set(payload.userId, { ...p, isMuted: payload.muted });
    useGroupCallStore.setState({ participants: nextParticipants });
  });

  channel.on('broadcast', { event: 'group:ringing' }, ({ payload }) => {
    const store = useGroupCallStore.getState();
    useGroupCallStore.setState({
      invitedUserIds: store.invitedUserIds.filter((id) => id !== payload.userId),
    });
  });

  channel.on('broadcast', { event: 'group:reject' }, ({ payload }) => {
    const store = useGroupCallStore.getState();
    useGroupCallStore.setState({
      invitedUserIds: store.invitedUserIds.filter((id) => id !== payload.userId),
    });
  });

  channel.on('broadcast', { event: 'group:screenshare-start' }, ({ payload }) => {
    useGroupCallStore.setState({ screenSharingUserId: payload.userId });
  });

  channel.on('broadcast', { event: 'group:screenshare-stop' }, () => {
    useGroupCallStore.setState({ screenSharingUserId: null });
  });

  // Subscribe with timeout
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Group channel subscription timed out'));
    }, 10_000);

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timeout);
        _channelSubscribed = true;
        resolve();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(timeout);
        reject(new Error(`Group channel subscription failed: ${status}`));
      }
    });
  });
}

// ─── Helper: Voice Activity Detection interval ─────────────────────────────

function startVAD(myUserId: string): void {
  if (_vadInterval) clearInterval(_vadInterval);

  _vadInterval = setInterval(() => {
    const store = useGroupCallStore.getState();
    let changed = false;
    const nextParticipants = new Map(store.participants);

    for (const [userId, analyser] of _analysers) {
      if (userId === myUserId) continue;
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const avg = sum / data.length / 255; // normalize to 0-1

      const p = nextParticipants.get(userId);
      if (!p) continue;

      const speaking = avg > 0.04;
      if (p.isSpeaking !== speaking || Math.abs(p.audioLevel - avg) > 0.01) {
        nextParticipants.set(userId, { ...p, isSpeaking: speaking, audioLevel: avg });
        changed = true;
      }
    }

    if (changed) {
      useGroupCallStore.setState({ participants: nextParticipants });
    }
  }, 100);
}

// ─── Store ──────────────────────────────────────────────────────────────────

export const useGroupCallStore = create<GroupCallState>((set, get) => ({
  ...INITIAL_STATE,

  startGroupCall: async (friends: Profile[]) => {
    // Get auth user
    const { useAuthStore } = await import('./authStore');
    const user = useAuthStore.getState().user;
    if (!user) throw new Error('Not authenticated');
    const myUserId = user.id;

    // Audio settings
    const { noiseCancellation, inputVolume } = useAudioStore.getState();

    // Generate call ID
    const callId = `group-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      // Get audio stream
      _rawAudioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      });

      // Create noise / gain pipeline
      _noisePipeline = noiseCancellation
        ? await createNoisePipeline(_rawAudioStream)
        : await createGainPipeline(_rawAudioStream);

      _noisePipeline.setInputGain(inputVolume / 100);

      // Store processed stream as localStream for mute toggle
      _localStream = _noisePipeline.processedStream;

      // Audio context for VAD analyser nodes
      _audioContext = new AudioContext({ sampleRate: 48000 });

      // Subscribe to group signaling channel
      await subscribeToGroupChannel(callId, myUserId);
    } catch (err) {
      // Cleanup on failure
      _rawAudioStream?.getTracks().forEach((t) => t.stop());
      _rawAudioStream = null;
      _noisePipeline?.dispose();
      _noisePipeline = null;
      _localStream = null;
      _audioContext?.close().catch(() => {});
      _audioContext = null;
      if (_groupChannel) supabase.removeChannel(_groupChannel);
      _groupChannel = null;
      throw err;
    }

    // Build participant map with self
    const participants = new Map<string, GroupParticipant>();
    participants.set(myUserId, {
      userId: myUserId,
      username: user.username,
      avatarUrl: user.avatar_url ?? null,
      isMuted: false,
      isSpeaking: false,
      audioLevel: 0,
      cardGradient: user.card_gradient,
      cardImageUrl: user.card_image_url,
      cardImageParams: user.card_image_params,
    });

    // Set state to calling
    set({
      status: 'calling',
      callId,
      myUserId,
      participants,
      callStartedAt: Date.now(),
      invitedUserIds: friends.map((f) => f.id),
    });

    // Broadcast join for self
    _groupChannel!.send({
      type: 'broadcast',
      event: 'group:join',
      payload: {
        callId,
        userId: myUserId,
        username: user.username,
        avatar_url: user.avatar_url ?? null,
      },
    });

    // Ring each friend via REST broadcast
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    for (const friend of friends) {
      fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
        method: 'POST',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              topic: `realtime:call:ring:${friend.id}`,
              event: 'call:group-invite',
              payload: {
                callId,
                inviter: {
                  userId: myUserId,
                  username: user.username,
                  avatar_url: user.avatar_url ?? null,
                },
                participants: Array.from(participants.values()),
              },
            },
          ],
        }),
      }).catch((err) => console.warn('[GroupCall] Failed to ring', friend.id, err));
    }

    // 30s timeout for unanswered invites
    setTimeout(() => {
      const { invitedUserIds } = useGroupCallStore.getState();
      if (invitedUserIds.length > 0) {
        useGroupCallStore.setState({ invitedUserIds: [] });
      }
    }, 30_000);

    // Start VAD
    startVAD(myUserId);

    // beforeunload listener
    window.addEventListener('beforeunload', () => {
      get().leaveCall();
    });
  },
  escalateToGroup: async (newFriend) => {
    const { useAuthStore } = await import('./authStore');
    const user = useAuthStore.getState().user;
    if (!user) return;
    const myUserId = user.id;

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

    // Set up remote stream tracking for existing peer
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

    // Build participants (me + existing contact)
    const participants = new Map<string, GroupParticipant>();
    participants.set(myUserId, {
      userId: myUserId, username: user.username, avatarUrl: user.avatar_url ?? null,
      isMuted: false, isSpeaking: false, audioLevel: 0,
      cardGradient: user.card_gradient, cardImageUrl: user.card_image_url, cardImageParams: user.card_image_params,
    });
    participants.set(refs.contact.id, {
      userId: refs.contact.id, username: refs.contact.username, avatarUrl: refs.contact.avatar_url ?? null,
      isMuted: false, isSpeaking: false, audioLevel: 0,
      ...getCardFields(refs.contact.id),
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
      payload: { callId, userId: myUserId, username: user.username, avatar_url: user.avatar_url ?? null },
    });

    // Ring the new friend
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const participantList = Array.from(participants.values());

    fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{
          topic: `realtime:call:ring:${newFriend.id}`,
          event: 'call:group-invite',
          payload: {
            callId,
            inviter: { userId: myUserId, username: user.username, avatar_url: user.avatar_url ?? null },
            participants: participantList,
          },
        }],
      }),
    }).catch(err => console.error('[group-call] Ring failed for', newFriend.id, err));

    // Tell existing contact to auto-escalate to the group channel (not ring — they're already in a call with us)
    fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{
          topic: `realtime:call:ring:${refs.contact.id}`,
          event: 'call:group-escalate',
          payload: {
            callId,
            inviter: { userId: myUserId, username: user.username, avatar_url: user.avatar_url ?? null },
            participants: participantList,
          },
        }],
      }),
    }).catch(() => {});

    startVAD(myUserId);
  },
  joinGroupCall: async (callId, _inviterUserId, existingParticipants) => {
    const { useAuthStore } = await import('./authStore');
    const user = useAuthStore.getState().user;
    if (!user) return;
    const myUserId = user.id;

    const { noiseCancellation, inputVolume } = useAudioStore.getState();

    try {
      _rawAudioStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false },
        video: false,
      });
    } catch {
      set(INITIAL_STATE);
      return;
    }

    _noisePipeline = noiseCancellation
      ? await createNoisePipeline(_rawAudioStream)
      : await createGainPipeline(_rawAudioStream);
    _noisePipeline.setInputGain(inputVolume / 100);
    _localStream = _noisePipeline.processedStream;

    _audioContext = new AudioContext({ sampleRate: 48000 });

    try {
      await subscribeToGroupChannel(callId, myUserId);
    } catch {
      _rawAudioStream?.getTracks().forEach(t => t.stop());
      _rawAudioStream = null;
      _noisePipeline?.dispose();
      _noisePipeline = null;
      _localStream = null;
      _audioContext?.close().catch(() => {});
      _audioContext = null;
      if (_groupChannel) supabase.removeChannel(_groupChannel);
      _groupChannel = null;
      set(INITIAL_STATE);
      return;
    }

    // Build participants map from existing + self (enrich with card data)
    const participants = new Map<string, GroupParticipant>();
    for (const p of existingParticipants) {
      participants.set(p.userId, { ...p, ...getCardFields(p.userId) });
    }
    participants.set(myUserId, {
      userId: myUserId,
      username: user.username,
      avatarUrl: user.avatar_url ?? null,
      isMuted: false,
      isSpeaking: false,
      audioLevel: 0,
      cardGradient: user.card_gradient,
      cardImageUrl: user.card_image_url,
      cardImageParams: user.card_image_params,
    });

    set({
      status: 'connected',
      callId,
      myUserId,
      participants,
      callStartedAt: Date.now(),
      isMuted: false,
    });

    // Broadcast join
    _groupChannel!.send({
      type: 'broadcast',
      event: 'group:join',
      payload: {
        callId,
        userId: myUserId,
        username: user.username,
        avatar_url: user.avatar_url ?? null,
      },
    });

    startVAD(myUserId);

    window.addEventListener('beforeunload', () => {
      get().leaveCall();
    });
  },
  leaveCall: () => {
    const { callId } = get();
    if (callId) {
      _groupChannel?.send({ type: 'broadcast', event: 'group:leave', payload: { callId, userId: get().myUserId } });
    }
    cleanupAll();
    set(INITIAL_STATE);
  },
  addParticipant: async (friend) => {
    let { callId, myUserId, participants } = get();

    // If no group call active, check if there's a 1:1 call to escalate
    if (!callId || !myUserId) {
      const { useCallStore } = await import('./callStore');
      const callStatus = useCallStore.getState().status;
      if (callStatus === 'connected') {
        // Escalate the 1:1 call to a group call with the new friend
        await get().escalateToGroup(friend);
        return;
      }
      return; // No active call at all
    }

    if (participants.size >= 4) return; // Max 4

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const { useAuthStore } = await import('./authStore');
    const user = useAuthStore.getState().user;

    // Re-read after potential async operations
    ({ callId, myUserId, participants } = get());
    const participantList = Array.from(participants.values());

    fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{
          topic: `realtime:call:ring:${friend.id}`,
          event: 'call:group-invite',
          payload: {
            callId,
            inviter: {
              userId: myUserId,
              username: user?.username,
              avatar_url: user?.avatar_url ?? null,
            },
            participants: participantList,
          },
        }],
      }),
    }).catch(err => console.error('[group-call] Ring failed for', friend.id, err));

    set(s => ({ invitedUserIds: [...s.invitedUserIds, friend.id] }));
  },
  toggleMute: () => {
    const { isMuted, callId, myUserId } = get();
    const next = !isMuted;
    _localStream?.getAudioTracks().forEach(t => { t.enabled = !next; });
    _groupChannel?.send({ type: 'broadcast', event: 'group:mute', payload: { callId, userId: myUserId, muted: next } });
    set({ isMuted: next });
  },
  toggleDeafen: () => {
    const { isDeafened, callId, myUserId } = get();
    const next = !isDeafened;
    // Mute/unmute all remote audio tracks
    for (const stream of _remoteStreams.values()) {
      stream.getAudioTracks().forEach(t => { t.enabled = !next; });
    }
    // Deafening also mutes you; undeafening unmutes you
    if (next && !get().isMuted) {
      _localStream?.getAudioTracks().forEach(t => { t.enabled = false; });
      _groupChannel?.send({ type: 'broadcast', event: 'group:mute', payload: { callId, userId: myUserId, muted: true } });
      set({ isDeafened: next, isMuted: true });
    } else if (!next && get().isMuted) {
      _localStream?.getAudioTracks().forEach(t => { t.enabled = true; });
      _groupChannel?.send({ type: 'broadcast', event: 'group:mute', payload: { callId, userId: myUserId, muted: false } });
      set({ isDeafened: next, isMuted: false });
    } else {
      set({ isDeafened: next });
    }
  },
  startScreenShare: async () => {
    const { callId, myUserId, screenSharingUserId } = get();
    if (!callId || !myUserId) return;
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
  handleIncomingGroupInvite: (callId, participants, _inviter) => {
    const { status } = get();
    if (status !== 'idle') return;

    set({
      status: 'ringing',
      callId,
      participants: new Map(participants.map(p => [p.userId, p])),
      invitedUserIds: [],
    });
  },
}));

// Accessor for remote streams (used by GroupCallView's hidden audio elements)
export function _getRemoteStream(userId: string): MediaStream | undefined {
  return _remoteStreams.get(userId);
}
