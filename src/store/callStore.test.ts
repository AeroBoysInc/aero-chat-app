import { describe, it, expect, beforeEach } from 'vitest';
import { ICE_SERVERS, createPeerConnection } from '../lib/webrtc';
import { useCallStore, INITIAL_CALL_STATE } from './callStore';

describe('webrtc.ts', () => {
  it('exports two Google STUN servers', () => {
    expect(ICE_SERVERS).toHaveLength(2);
    expect(ICE_SERVERS[0].urls).toBe('stun:stun.l.google.com:19302');
  });

  it('createPeerConnection returns RTCPeerConnection instance', () => {
    const pc = createPeerConnection();
    expect(pc).toBeDefined();
  });
});

describe('callStore initial state', () => {
  beforeEach(() => {
    // Reset store between tests
    useCallStore.setState(INITIAL_CALL_STATE);
  });

  it('starts idle', () => {
    expect(useCallStore.getState().status).toBe('idle');
  });

  it('has null callId on init', () => {
    expect(useCallStore.getState().callId).toBeNull();
  });

  it('has empty pendingCandidates on init', () => {
    expect(useCallStore.getState().pendingCandidates).toEqual([]);
  });
});
