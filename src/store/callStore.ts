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
