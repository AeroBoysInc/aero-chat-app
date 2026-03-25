import { vi } from 'vitest';

// Mock RTCPeerConnection
class MockRTCPeerConnection {
  addTrack = vi.fn();
  getSenders = vi.fn(() => []);
  createOffer = vi.fn(() => Promise.resolve({ type: 'offer', sdp: 'mock-sdp' }));
  createAnswer = vi.fn(() => Promise.resolve({ type: 'answer', sdp: 'mock-answer-sdp' }));
  setLocalDescription = vi.fn(() => Promise.resolve());
  setRemoteDescription = vi.fn(() => Promise.resolve());
  addIceCandidate = vi.fn(() => Promise.resolve());
  close = vi.fn();
  onicecandidate: any = null;
  ontrack: any = null;
  oniceconnectionstatechange: any = null;
  iceConnectionState: RTCIceConnectionState = 'new';
}
global.RTCPeerConnection = MockRTCPeerConnection as any;

// Mock navigator.mediaDevices
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn(() => Promise.resolve({
      getAudioTracks: () => [{ kind: 'audio', enabled: true, stop: vi.fn() }],
      getVideoTracks: () => [],
      getTracks: () => [{ kind: 'audio', enabled: true, stop: vi.fn() }],
    })),
    getDisplayMedia: vi.fn(),
  },
  writable: true,
});

// Mock HTMLCanvasElement.captureStream
HTMLCanvasElement.prototype.captureStream = vi.fn(() => ({
  getVideoTracks: () => [{ kind: 'video', stop: vi.fn() }],
})) as any;
