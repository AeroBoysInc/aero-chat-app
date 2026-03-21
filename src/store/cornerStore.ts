import { create } from 'zustand';

export type CornerPanel = 'games' | 'music' | null;

const SPOTIFY_KEY = 'aero_spotify_connected';

interface CornerStore {
  activePanel: CornerPanel;
  setActivePanel: (p: CornerPanel) => void;

  // Spotify connection — 'connected' persists to localStorage
  spotifyConnected: boolean;
  setSpotifyConnected: (v: boolean) => void;

  // Music player state — stays alive while panel is hidden
  musicInputUrl: string;
  musicEmbedUrl: string | null;
  musicTitle: string;

  setMusicInputUrl: (url: string) => void;
  setMusicEmbedUrl: (url: string | null) => void;
  setMusicTitle: (t: string) => void;
}

export const useCornerStore = create<CornerStore>()((set) => ({
  activePanel: null,
  setActivePanel: (activePanel) => set({ activePanel }),

  spotifyConnected: false,          // true once user approves in current session
  setSpotifyConnected: (spotifyConnected) => {
    if (spotifyConnected) localStorage.setItem(SPOTIFY_KEY, '1');
    else localStorage.removeItem(SPOTIFY_KEY);
    set({ spotifyConnected });
  },

  musicInputUrl: '',
  musicEmbedUrl: null,
  musicTitle: '',

  setMusicInputUrl: (musicInputUrl) => set({ musicInputUrl }),
  setMusicEmbedUrl: (musicEmbedUrl) => set({ musicEmbedUrl }),
  setMusicTitle: (musicTitle) => set({ musicTitle }),
}));

/** Returns true if the user approved Spotify in a previous session */
export function wasSpotifyConnected(): boolean {
  try { return localStorage.getItem('aero_spotify_connected') === '1'; } catch { return false; }
}

/** Parse any Spotify URL and return the embed URL + display info */
export function parseSpotify(url: string): { embedUrl: string; type: string } | null {
  try {
    const u = new URL(url.trim());
    if (!u.hostname.includes('spotify.com')) return null;
    const parts = u.pathname.split('/').filter(Boolean);
    const validTypes = ['track', 'album', 'playlist', 'artist', 'episode', 'show'];
    const type = parts[0];
    const id = parts[1]?.split('?')[0];
    if (!validTypes.includes(type) || !id) return null;
    return {
      embedUrl: `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`,
      type,
    };
  } catch {}
  return null;
}

/** Fetch track/album/playlist title via Spotify oEmbed (no API key required) */
export async function fetchSpotifyTitle(url: string): Promise<string> {
  try {
    const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`);
    if (!res.ok) return '';
    const data = await res.json();
    return (data.title as string) ?? '';
  } catch { return ''; }
}
