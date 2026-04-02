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
 */
export function createBlackVideoTrack(): MediaStreamTrack {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 2;
  canvas.getContext('2d')?.fillRect(0, 0, 2, 2);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (canvas as any).captureStream(1).getVideoTracks()[0];
}
