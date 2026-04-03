import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { createPeerConnection, createBlackVideoTrack, serializeSdp } from '../lib/webrtc';
import { encryptMessage, loadPrivateKey } from '../lib/crypto';
import type { Profile } from './authStore';
import { useAudioStore } from './audioStore';
import { createNoisePipeline, createGainPipeline, type NoisePipeline } from '../lib/noiseSuppression';

// ─── Module-level refs — NOT in Zustand state ───────────────────────────────
// Mutable native objects that would break devtools serialization if in Zustand.
// Pattern follows presenceChannelRef in App.tsx.
let _peerConnection: RTCPeerConnection | null = null;
let _signalingChannel: ReturnType<typeof supabase.channel> | null = null;
let _channelSubscribed = false; // true once signaling channel reaches SUBSCRIBED state
let _screenStream: MediaStream | null = null;
let _cameraTrack: MediaStreamTrack | null = null; // saved before screen share starts
let _pendingOffer: RTCSessionDescriptionInit | null = null; // stored on callee side
let _rawAudioStream: MediaStream | null = null;  // unprocessed getUserMedia audio
let _noisePipeline:  NoisePipeline | null = null; // active NC pipeline, null when off
let _ncSeq = 0; // incremented on each setNoiseCancellation call to detect races

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
  screenStream: MediaStream | null;

  isMuted: boolean;
  isDeafened: boolean;
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
  toggleDeafen(): void;
  toggleCamera(): void;
  startScreenShare(): Promise<void>;
  stopScreenShare(): void;
  setNoiseCancellation(enabled: boolean): Promise<void>;
  setInputGain(value: number): void;
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
  screenStream: null,
  isMuted: false,
  isDeafened: false,
  isCameraOn: false,
  isScreenSharing: false,
  callStartedAt: null,
  pendingCandidates: [],
};

// ICE restart helper — called on 'disconnected' state
let _iceRestartTimer: ReturnType<typeof setTimeout> | null = null;
// Failsafe: if still disconnected after ICE restart attempt, hang up
let _disconnectFailsafe: ReturnType<typeof setTimeout> | null = null;

function handleIceRestart(callId: string) {
  if (_iceRestartTimer) return; // already pending

  // Attempt ICE restart after 4s of disconnection
  _iceRestartTimer = setTimeout(async () => {
    _iceRestartTimer = null;
    if (!_peerConnection) return;
    const state = _peerConnection.iceConnectionState;
    if (state === 'failed' || state === 'closed') {
      useCallStore.getState().hangUp();
      return;
    }
    try {
      const offer = await _peerConnection.createOffer({ iceRestart: true });
      await _peerConnection.setLocalDescription(offer);
      _signalingChannel?.send({
        type: 'broadcast',
        event: 'call:offer',
        payload: { sdp: serializeSdp(offer), callId },
      });
    } catch {
      useCallStore.getState().hangUp();
      return;
    }

    // If still not recovered after another 8s, the peer is gone — hang up
    _disconnectFailsafe = setTimeout(() => {
      _disconnectFailsafe = null;
      if (!_peerConnection) return;
      const s = _peerConnection.iceConnectionState;
      if (s !== 'connected' && s !== 'completed') {
        useCallStore.getState().hangUp();
      }
    }, 8_000);
  }, 4_000);
}

function clearDisconnectTimers() {
  if (_iceRestartTimer) { clearTimeout(_iceRestartTimer); _iceRestartTimer = null; }
  if (_disconnectFailsafe) { clearTimeout(_disconnectFailsafe); _disconnectFailsafe = null; }
}

/**
 * Insert a call event message (call ended / missed call) into the messages table.
 * Content is JSON-stringified with a `_call` flag so ChatWindow can render it specially.
 * Encrypted so it's consistent with all other messages.
 */
async function insertCallMessage(
  senderId: string,
  recipientId: string,
  event: 'ended' | 'missed',
  durationSeconds?: number,
  callType?: 'audio' | 'video',
) {
  try {
    const privateKey = loadPrivateKey(senderId);
    if (!privateKey) return;

    // Fetch recipient's public key
    const { data: profile } = await supabase
      .from('profiles').select('public_key').eq('id', recipientId).single();
    if (!profile?.public_key) return;

    const content = JSON.stringify({
      _call: true,
      event,
      callType: callType ?? 'audio',
      ...(durationSeconds != null ? { duration: durationSeconds } : {}),
    });

    const ciphertext = encryptMessage(content, profile.public_key, privateKey);
    await supabase.from('messages').insert({
      sender_id: senderId,
      recipient_id: recipientId,
      content: ciphertext,
    });
  } catch {
    // Best-effort — don't break the hangup flow
  }
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
        _channelSubscribed = false;
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
          await _peerConnection.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(() => {});
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
        await _peerConnection.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        const restartAnswer = await _peerConnection.createAnswer();
        await _peerConnection.setLocalDescription(restartAnswer);
        _signalingChannel?.send({
          type: 'broadcast',
          event: 'call:answer',
          payload: { sdp: serializeSdp(restartAnswer), callId },
        });
      })
      .subscribe((status) => {
        // Send ringing ONLY after channel is SUBSCRIBED — send() on an unsubscribed
        // channel silently falls back to REST, causing unreliable signaling.
        if (status === 'SUBSCRIBED') {
          _channelSubscribed = true;
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

    const nc = useAudioStore.getState().noiseCancellation;
    const audioConstraints = { echoCancellation: true, noiseSuppression: false, autoGainControl: false };

    // ── Get local media ───────────────────────────────────────────────────
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
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
          stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: false });
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

    _peerConnection = await createPeerConnection();
    const remoteStream = new MediaStream();

    // ── Store raw stream and build audio pipeline ─────────────────────
    // Always create a pipeline so gain control works whether NC is on or off.
    _rawAudioStream = stream;
    _noisePipeline = nc
      ? await createNoisePipeline(stream)
      : await createGainPipeline(stream);
    _noisePipeline.setInputGain(useAudioStore.getState().inputVolume / 100);

    // ── Add tracks ───────────────────────────────────────────────────────
    // Always add a black placeholder video sender so replaceTrack() is safe.
    // No stream arg: associating with the local getUserMedia stream causes SDP stream
    // binding issues in audio-only calls (stream only has audio, video sender gets mislinked).
    const blackTrack = createBlackVideoTrack();
    _peerConnection.addTrack(blackTrack);

    _noisePipeline.processedStream.getAudioTracks().forEach(t => _peerConnection!.addTrack(t, stream));

    // For video calls, replace the black placeholder with the real camera track
    let cameraOn = false;
    if (callType === 'video' && stream.getVideoTracks().length > 0) {
      const videoSender = _peerConnection.getSenders().find(s => s.track?.kind === 'video');
      if (videoSender) {
        await videoSender.replaceTrack(stream.getVideoTracks()[0]);
        cameraOn = true;
      }
    }

    // ── Subscribe to signaling channel and WAIT for SUBSCRIBED ─────────
    // CRITICAL: onicecandidate fires as soon as setLocalDescription() is called.
    // If the channel isn't SUBSCRIBED yet, send() falls back to REST (unreliable
    // and being deprecated by Supabase). We must await SUBSCRIBED before creating
    // the offer so all ICE candidates go through the Realtime WebSocket.
    _signalingChannel = supabase
      .channel(channelName)
      .on('broadcast', { event: 'call:ringing' }, ({ payload }) => {
        if (payload.callId !== callId) return;
        set({ contactIsRinging: true });
      })
      .on('broadcast', { event: 'call:answer' }, async ({ payload }) => {
        if (payload.callId !== callId) return;
        await _peerConnection!.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        // Drain queued ICE candidates
        const { pendingCandidates } = get();
        for (const c of pendingCandidates) {
          await _peerConnection!.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
        }
        set({ pendingCandidates: [] });
      })
      .on('broadcast', { event: 'call:ice' }, async ({ payload }) => {
        if (payload.callId !== callId) return;
        if (_peerConnection?.remoteDescription) {
          await _peerConnection.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(() => {});
        } else {
          set(s => ({ pendingCandidates: [...s.pendingCandidates, payload.candidate] }));
        }
      })
      .on('broadcast', { event: 'call:reject' }, ({ payload }) => {
        if (payload.callId !== callId) return;
        get().hangUp();
      })
      .on('broadcast', { event: 'call:hangup' }, ({ payload }) => {
        if (payload.callId !== callId) return;
        get().hangUp();
      })
      .on('broadcast', { event: 'call:busy' }, ({ payload }) => {
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
      });

    // Wait for the channel to be fully SUBSCRIBED before proceeding
    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Signaling channel subscription timeout')), 10_000);
        _signalingChannel!.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            _channelSubscribed = true;
            clearTimeout(timeout);
            resolve();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            clearTimeout(timeout);
            reject(new Error(`Signaling channel failed: ${status}`));
          }
        });
      });
    } catch (err) {
      console.error('[call] Signaling channel failed to subscribe', err);
      stream.getTracks().forEach(t => t.stop());
      _peerConnection?.close();
      _peerConnection = null;
      if (_signalingChannel) supabase.removeChannel(_signalingChannel);
      _signalingChannel = null;
      _channelSubscribed = false;
      _noisePipeline?.dispose();
      _noisePipeline = null;
      _rawAudioStream = null;
      return;
    }

    // ── Wire up peer connection events (channel is now SUBSCRIBED) ───────
    _peerConnection.ontrack = (e) => {
      remoteStream.addTrack(e.track);
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
        clearDisconnectTimers(); // recovered — cancel any pending hangup
        useCallStore.setState({ status: 'connected', callStartedAt: Date.now() });
      }
      if (state === 'disconnected') {
        handleIceRestart(callId);
      }
      if (state === 'failed') {
        get().hangUp();
      }
    };

    // ── Create offer (ICE gathering starts here — channel is SUBSCRIBED) ─
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

    // ── Send ring notification via REST broadcast with retry ────────────
    // REST broadcast is fire-and-forget: if the receiver's ring channel dropped
    // momentarily, the notification is lost. Retry up to 3 times with 2s gaps,
    // stopping early once the callee responds with call:ringing.
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    const ringPayload = JSON.stringify({
      messages: [{
        topic: `call:ring:${contact.id}`,
        event: 'call:offer',
        payload: { sdp: serializeSdp(offer), callId, callType, callerId: myUserId },
      }],
    });
    const ringHeaders = {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    };

    const sendRing = () => fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
      method: 'POST', headers: ringHeaders, body: ringPayload,
    }).catch(err => console.error('[call] Ring notification failed', err));

    await sendRing();

    // Retry ring if callee hasn't responded yet
    let ringRetries = 0;
    const ringRetryInterval = setInterval(() => {
      const s = get();
      if (s.callId !== callId || s.status !== 'calling' || s.contactIsRinging || ringRetries >= 2) {
        clearInterval(ringRetryInterval);
        return;
      }
      ringRetries++;
      sendRing();
    }, 2_000);

    // ── 30-second no-answer timeout ───────────────────────────────────────
    setTimeout(() => {
      const { status: s, callId: cid } = get();
      if (s === 'calling' && cid === callId) {
        get().hangUp();
        // TODO: show "No answer" toast
      }
    }, 30_000);

    // ── Page close: best-effort hangup signal ──────────────────────────────
    // Use sendBeacon (reliable during unload) + channel send (immediate)
    const supabaseUrlForBeacon = import.meta.env.VITE_SUPABASE_URL as string;
    const onPageClose = () => {
      // Channel send (works if page isn't fully torn down yet)
      _signalingChannel?.send({
        type: 'broadcast',
        event: 'call:hangup',
        payload: { callId },
      });
      // sendBeacon (works even during page teardown)
      try {
        const channelName = `call:${[myUserId, contact.id].sort().join(':')}`;
        navigator.sendBeacon(
          `${supabaseUrlForBeacon}/realtime/v1/api/broadcast`,
          new Blob([JSON.stringify({
            messages: [{ topic: channelName, event: 'call:hangup', payload: { callId } }],
          })], { type: 'application/json' }),
        );
      } catch { /* best-effort */ }
    };
    window.addEventListener('beforeunload', onPageClose, { once: true });
    window.addEventListener('pagehide', onPageClose, { once: true });
  },
  answerCall: async () => {
    const { callId, contact, callType } = get();
    if (!callId || !contact || !_pendingOffer || !_signalingChannel) return;

    const nc = useAudioStore.getState().noiseCancellation;
    const audioConstraints = { echoCancellation: true, noiseSuppression: false, autoGainControl: false };

    // ── Get local media ───────────────────────────────────────────────────
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
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
          stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: false });
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
    _peerConnection = await createPeerConnection();

    // ── Store raw stream and build audio pipeline ─────────────────────
    // Always create a pipeline so gain control works whether NC is on or off.
    _rawAudioStream = stream;
    _noisePipeline = nc
      ? await createNoisePipeline(stream)
      : await createGainPipeline(stream);
    _noisePipeline.setInputGain(useAudioStore.getState().inputVolume / 100);

    // ── Add local tracks ─────────────────────────────────────────────────
    // No stream arg on blackTrack — same reason as in startCall (SDP stream binding)
    const blackTrack = createBlackVideoTrack();
    _peerConnection.addTrack(blackTrack);

    _noisePipeline.processedStream.getAudioTracks().forEach(t => _peerConnection!.addTrack(t, stream));

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
      // Use e.track directly — e.streams[0] is empty when the sender added
      // the track without a stream arg (e.g. black placeholder video track).
      remoteStream.addTrack(e.track);
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
        clearDisconnectTimers();
        useCallStore.setState({ status: 'connected', callStartedAt: Date.now() });
      }
      if (state === 'disconnected') {
        handleIceRestart(callId);
      }
      if (state === 'failed') {
        get().hangUp();
      }
    };

    // ── Wait for channel to be SUBSCRIBED (should already be from handleIncomingOffer)
    if (!_channelSubscribed) {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Signaling channel not ready')), 5_000);
        const check = setInterval(() => {
          if (_channelSubscribed) { clearInterval(check); clearTimeout(timeout); resolve(); }
        }, 50);
      });
    }

    // ── SDP exchange ─────────────────────────────────────────────────────
    await _peerConnection.setRemoteDescription(new RTCSessionDescription(_pendingOffer));

    // Drain any ICE candidates that arrived before PeerConnection was created
    const { pendingCandidates } = get();
    for (const c of pendingCandidates) {
      await _peerConnection.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
    }

    const answer = await _peerConnection.createAnswer();
    await _peerConnection.setLocalDescription(answer);

    _signalingChannel.send({
      type: 'broadcast',
      event: 'call:answer',
      payload: { sdp: serializeSdp(answer), callId },
    });

    _pendingOffer = null;

    set({
      localStream: stream,
      remoteStream,
      pendingCandidates: [],
      isCameraOn: cameraOn,
      isMuted: false,
    });

    // ── Page close: best-effort hangup from callee side ────────────────────
    const supabaseUrlForBeacon = import.meta.env.VITE_SUPABASE_URL as string;
    const authData2 = await supabase.auth.getUser();
    const calleeId = authData2.data.user?.id;
    const onPageClose = () => {
      _signalingChannel?.send({
        type: 'broadcast',
        event: 'call:hangup',
        payload: { callId },
      });
      try {
        const channelName = `call:${[calleeId ?? '', contact!.id].sort().join(':')}`;
        navigator.sendBeacon(
          `${supabaseUrlForBeacon}/realtime/v1/api/broadcast`,
          new Blob([JSON.stringify({
            messages: [{ topic: channelName, event: 'call:hangup', payload: { callId } }],
          })], { type: 'application/json' }),
        );
      } catch { /* best-effort */ }
    };
    window.addEventListener('beforeunload', onPageClose, { once: true });
    window.addEventListener('pagehide', onPageClose, { once: true });
  },
  hangUp: () => {
    const { callId, contact, status, callStartedAt, callType, isCaller } = get();

    // 1. Send hangup signal (best-effort — channel may already be gone)
    if (callId) {
      _signalingChannel?.send({
        type: 'broadcast',
        event: 'call:hangup',
        payload: { callId },
      });
    }

    // 2. Insert call event message (fire-and-forget)
    if (contact) {
      supabase.auth.getUser().then(({ data }) => {
        const myId = data.user?.id;
        if (!myId) return;
        if (status === 'connected' && callStartedAt) {
          // Call ended — insert duration message
          const dur = Math.floor((Date.now() - callStartedAt) / 1000);
          insertCallMessage(myId, contact.id, 'ended', dur, callType);
        } else if (status === 'calling' && isCaller) {
          // Caller hung up before answer — missed call for recipient
          insertCallMessage(myId, contact.id, 'missed', undefined, callType);
        }
      });
    }

    // 3. Stop all media tracks
    get().localStream?.getTracks().forEach(t => t.stop());
    _screenStream?.getTracks().forEach(t => t.stop());

    // 4. Close PeerConnection
    _peerConnection?.close();

    // 5. Remove signaling channel from Supabase
    if (_signalingChannel) {
      supabase.removeChannel(_signalingChannel);
    }

    // 6. Clear ICE restart / disconnect failsafe timers
    clearDisconnectTimers();

    // 7. Null all module-level refs
    _peerConnection = null;
    _signalingChannel = null;
    _channelSubscribed = false;
    _screenStream = null;
    _cameraTrack = null;
    _pendingOffer = null;
    _noisePipeline?.dispose();
    _noisePipeline = null;
    _rawAudioStream = null;
    _ncSeq++;

    // 8. Reset Zustand state
    useCallStore.setState(INITIAL_CALL_STATE);
  },

  rejectCall: () => {
    const { callId, contact, callType } = get();

    // Send reject signal before cleaning up
    if (callId) {
      _signalingChannel?.send({
        type: 'broadcast',
        event: 'call:reject',
        payload: { callId },
      });
    }

    // Insert missed call message (the caller will see it)
    if (contact) {
      supabase.auth.getUser().then(({ data }) => {
        const myId = data.user?.id;
        if (!myId) return;
        // The caller sent it, so insert as if caller sent a missed call
        insertCallMessage(contact.id, myId, 'missed', undefined, callType);
      });
    }

    // Directly clean up without sending a second hangup:
    get().localStream?.getTracks().forEach(t => t.stop());
    _screenStream?.getTracks().forEach(t => t.stop());
    if (_signalingChannel) supabase.removeChannel(_signalingChannel);
    _peerConnection = null;
    _signalingChannel = null;
    _channelSubscribed = false;
    _screenStream = null;
    _cameraTrack = null;
    _pendingOffer = null;
    clearDisconnectTimers();
    _noisePipeline?.dispose();
    _noisePipeline = null;
    _rawAudioStream = null;

    useCallStore.setState(INITIAL_CALL_STATE);
  },
  toggleMute: () => {
    const { localStream, isMuted } = get();
    if (!localStream) return;
    const next = !isMuted;
    localStream.getAudioTracks().forEach(t => { t.enabled = !next; });
    set({ isMuted: next });
  },
  toggleDeafen: () => {
    const { remoteStream, isDeafened } = get();
    if (!remoteStream) return;
    const next = !isDeafened;
    remoteStream.getAudioTracks().forEach(t => { t.enabled = !next; });
    // Deafening also mutes you (standard Discord/voice chat behavior)
    if (next && !get().isMuted) {
      const { localStream } = get();
      localStream?.getAudioTracks().forEach(t => { t.enabled = false; });
      set({ isDeafened: next, isMuted: true });
    } else if (!next && get().isMuted) {
      // Undeafening unmutes you too
      const { localStream } = get();
      localStream?.getAudioTracks().forEach(t => { t.enabled = true; });
      set({ isDeafened: next, isMuted: false });
    } else {
      set({ isDeafened: next });
    }
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

    set({ isScreenSharing: true, screenStream });
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

    set({ isScreenSharing: false, screenStream: null });
  },

  setNoiseCancellation: async (enabled: boolean) => {
    // Persist the preference regardless of call state
    useAudioStore.getState().set({ noiseCancellation: enabled });

    // Nothing to do if there's no active call
    if (!_peerConnection || !_rawAudioStream) return;

    // Guard against rapid toggling: each call gets a unique sequence number.
    // If the number has advanced by the time the await resolves, a newer call
    // has taken over and this result should be discarded.
    const seq = ++_ncSeq;

    // Always build a pipeline (NC on → noise+gain, NC off → gain-only)
    const nextPipeline = enabled
      ? await createNoisePipeline(_rawAudioStream)
      : await createGainPipeline(_rawAudioStream);

    // Stale: a newer toggle (or hangUp) has already taken over
    if (seq !== _ncSeq) {
      nextPipeline.dispose();
      return;
    }

    // Replace the current pipeline and restore the current gain setting
    _noisePipeline?.dispose();
    _noisePipeline = nextPipeline;
    _noisePipeline.setInputGain(useAudioStore.getState().inputVolume / 100);

    // Swap the audio track on the peer connection so the remote side hears the change
    const newAudioTrack = _noisePipeline.processedStream.getAudioTracks()[0];
    const sender = _peerConnection?.getSenders().find(s => s.track?.kind === 'audio');
    try {
      if (sender && newAudioTrack) await sender.replaceTrack(newAudioTrack);
    } catch (err) {
      console.error('[NC] replaceTrack failed:', err);
    }
  },

  setInputGain: (value: number) => {
    // Persist preference regardless of call state
    useAudioStore.getState().set({ inputVolume: value });
    // Apply immediately to active pipeline if in a call
    _noisePipeline?.setInputGain(value / 100);
  },
}));

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
