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
  startCall: async () => { /* Task 4 */ },
  answerCall: async () => { /* Task 5 */ },
  hangUp: () => { /* Task 6 */ },
  rejectCall: () => { /* Task 6 */ },
  toggleMute: () => { /* Task 7 */ },
  toggleCamera: () => { /* Task 7 */ },
  startScreenShare: async () => { /* Task 8 */ },
  stopScreenShare: () => { /* Task 8 */ },
}));
