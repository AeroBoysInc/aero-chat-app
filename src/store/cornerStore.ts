import { create } from 'zustand';

export type CornerPanel = 'games' | 'video' | null;

interface CornerStore {
  activePanel: CornerPanel;
  setActivePanel: (p: CornerPanel) => void;

  // Video state — persists while video plays even when panel is closed
  videoInputUrl: string;
  videoId: string | null;
  videoTitle: string;
  videoIsPlaying: boolean;
  videoCurrentTime: number; // seconds

  setVideoInputUrl: (url: string) => void;
  setVideoId: (id: string | null) => void;
  setVideoTitle: (t: string) => void;
  setVideoIsPlaying: (v: boolean) => void;
  setVideoCurrentTime: (t: number) => void;
}

export const useCornerStore = create<CornerStore>()((set) => ({
  activePanel: null,
  setActivePanel: (activePanel) => set({ activePanel }),

  videoInputUrl: '',
  videoId: null,
  videoTitle: '',
  videoIsPlaying: false,
  videoCurrentTime: 0,

  setVideoInputUrl: (videoInputUrl) => set({ videoInputUrl }),
  setVideoId: (videoId) => set({ videoId }),
  setVideoTitle: (videoTitle) => set({ videoTitle }),
  setVideoIsPlaying: (videoIsPlaying) => set({ videoIsPlaying }),
  setVideoCurrentTime: (videoCurrentTime) => set({ videoCurrentTime }),
}));

export function parseYouTubeId(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0];
    if (u.hostname.includes('youtube.com')) {
      // /watch?v=ID
      const v = u.searchParams.get('v');
      if (v) return v;
      // /embed/ID or /shorts/ID
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts[0] === 'embed' || parts[0] === 'shorts') return parts[1] ?? null;
    }
  } catch {}
  return null;
}

export function fmtTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}
