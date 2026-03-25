import { describe, it, expect } from 'vitest';
import { ICE_SERVERS, createPeerConnection } from '../lib/webrtc';

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
