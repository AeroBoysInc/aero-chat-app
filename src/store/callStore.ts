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

export const useCallStore = create<CallState>((set, get) => ({
  ...INITIAL_CALL_STATE,

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
  hangUp: () => { /* Task 6 */ },
  rejectCall: () => { /* Task 6 */ },
  toggleMute: () => { /* Task 7 */ },
  toggleCamera: () => { /* Task 7 */ },
  startScreenShare: async () => { /* Task 8 */ },
  stopScreenShare: () => { /* Task 8 */ },
}));
