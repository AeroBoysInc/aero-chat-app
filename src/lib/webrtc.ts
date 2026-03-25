export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  // TODO: Add self-hosted TURN (coturn) before public launch
  // { urls: 'turn:your-server.com:3478', username: '...', credential: '...' }
];

export function createPeerConnection(): RTCPeerConnection {
  return new RTCPeerConnection({ iceServers: ICE_SERVERS });
}

/**
 * Creates a tiny black 2×2 canvas video track.
 * Always added as the video sender at call setup so replaceTrack()
 * is safe in both audio-only and video calls.
 */
export function createBlackVideoTrack(): MediaStreamTrack {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 2;
  canvas.getContext('2d')?.fillRect(0, 0, 2, 2);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (canvas as any).captureStream(1).getVideoTracks()[0];
}
