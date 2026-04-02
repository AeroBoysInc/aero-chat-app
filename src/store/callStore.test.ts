import { describe, it, expect, beforeEach } from 'vitest';
import { ICE_SERVERS, createPeerConnection } from '../lib/webrtc';
import { useCallStore, INITIAL_CALL_STATE } from './callStore';

describe('webrtc.ts', () => {
  it('exports two Google STUN servers', () => {
    expect(ICE_SERVERS).toHaveLength(2);
    expect(ICE_SERVERS[0].urls).toBe('stun:stun.l.google.com:19302');
  });

  it('createPeerConnection returns RTCPeerConnection instance', async () => {
    const pc = await createPeerConnection();
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

describe('callStore.hangUp', () => {
  beforeEach(() => {
    useCallStore.setState({
      ...INITIAL_CALL_STATE,
      status: 'connected',
      callId: 'test-id',
    });
  });

  it('resets state to idle', () => {
    useCallStore.getState().hangUp();
    expect(useCallStore.getState().status).toBe('idle');
    expect(useCallStore.getState().callId).toBeNull();
  });
});

describe('callStore toggles', () => {
  const mockStream = {
    getAudioTracks: () => [{ kind: 'audio', enabled: true, stop: vi.fn() }],
    getVideoTracks: () => [{ kind: 'video', enabled: true, stop: vi.fn() }],
    getTracks: () => [],
  } as unknown as MediaStream;

  beforeEach(() => {
    useCallStore.setState({
      ...INITIAL_CALL_STATE,
      status: 'connected',
      localStream: mockStream,
      isMuted: false,
      isCameraOn: true,
      callType: 'video',
    });
  });

  it('toggleMute flips isMuted', () => {
    useCallStore.getState().toggleMute();
    expect(useCallStore.getState().isMuted).toBe(true);
    useCallStore.getState().toggleMute();
    expect(useCallStore.getState().isMuted).toBe(false);
  });

  it('toggleCamera flips isCameraOn', () => {
    useCallStore.getState().toggleCamera();
    expect(useCallStore.getState().isCameraOn).toBe(false);
  });
});
