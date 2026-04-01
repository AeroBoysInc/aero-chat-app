// src/store/groupCallStore.ts
// Imports used by placeholder actions in Tasks 2–5:
/* eslint-disable @typescript-eslint/no-unused-vars */
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { createPeerConnection, createBlackVideoTrack } from '../lib/webrtc';
import type { Profile } from './authStore';
import { useAudioStore } from './audioStore';
import { createNoisePipeline, createGainPipeline, type NoisePipeline } from '../lib/noiseSuppression';

// Suppress noUnusedLocals for skeleton — these are used in Tasks 2–5
void createPeerConnection; void createBlackVideoTrack; void useAudioStore;
void createNoisePipeline; void createGainPipeline;

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

  // Null refs (void reads suppress noUnusedLocals until Tasks 2–5 use them)
  void _channelSubscribed; void _rawAudioStream;
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
