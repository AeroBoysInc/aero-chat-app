import { supabase } from './supabase';

/** Fallback STUN-only config (used when TURN fetch fails) */
const STUN_ONLY: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

/** Cached TURN credentials (refreshed every 12 hours) */
let _cachedIceServers: RTCIceServer[] | null = null;
let _cacheExpiry = 0;

/**
 * Fetch short-lived TURN credentials from Cloudflare via our Edge Function.
 * Falls back to STUN-only if the fetch fails (e.g. no TURN configured yet).
 */
export async function getIceServers(): Promise<RTCIceServer[]> {
  // Return cache if still valid (refresh every 12h, credentials last 24h)
  if (_cachedIceServers && Date.now() < _cacheExpiry) {
    return _cachedIceServers;
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return STUN_ONLY;

    const res = await supabase.functions.invoke('turn-credentials');

    if (res.error || !res.data?.iceServers) {
      console.warn('TURN credential fetch failed, using STUN only:', res.error);
      return STUN_ONLY;
    }

    const turnServers: RTCIceServer[] = res.data.iceServers;

    // Combine STUN + TURN for best connectivity
    _cachedIceServers = [
      ...STUN_ONLY,
      ...turnServers,
    ];
    _cacheExpiry = Date.now() + 12 * 60 * 60 * 1000; // 12 hours

    console.log('TURN credentials fetched successfully');
    return _cachedIceServers;
  } catch (err) {
    console.warn('TURN credential fetch error, using STUN only:', err);
    return STUN_ONLY;
  }
}

/** Synchronous STUN-only fallback for backward compat */
export const ICE_SERVERS = STUN_ONLY;

export async function createPeerConnection(): Promise<RTCPeerConnection> {
  const iceServers = await getIceServers();
  return new RTCPeerConnection({ iceServers });
}

/**
 * Creates a tiny black 2×2 canvas video track.
 * Always added as the video sender at call setup so replaceTrack()
 * is safe in both audio-only and video calls.
 *
 * Falls back to a silent MediaStreamTrack if captureStream is unavailable
 * (e.g. Firefox in some contexts).
 */
export function createBlackVideoTrack(): MediaStreamTrack {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;
    canvas.getContext('2d')?.fillRect(0, 0, 2, 2);
    // captureStream exists on HTMLCanvasElement but isn't in all TS typings
    const stream = (canvas as any).captureStream(0) as MediaStream;
    const track = stream.getVideoTracks()[0];
    if (track) return track;
  } catch {
    // captureStream not available — fall through to MediaStream constructor
  }
  // Fallback: create a track via a temporary peer connection's transceiver
  // This works cross-browser where captureStream doesn't
  const pc = new RTCPeerConnection();
  const transceiver = pc.addTransceiver('video', { direction: 'sendonly' });
  const track = transceiver.sender.track!;
  // Don't close pc — it owns the track. It'll be GC'd when track stops.
  return track;
}

/**
 * Normalize an SDP descriptor to a plain { type, sdp } object.
 * Ensures cross-browser compatibility when passing SDP through JSON
 * serialization (e.g. Supabase broadcast). RTCSessionDescription objects
 * from Firefox may carry extra properties that confuse Chrome's
 * setRemoteDescription, and vice versa.
 */
export function serializeSdp(desc: RTCSessionDescriptionInit): RTCSessionDescriptionInit {
  return { type: desc.type, sdp: desc.sdp };
}
