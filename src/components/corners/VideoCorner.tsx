import { useState, useEffect, useRef } from 'react';
import { Tv, Play, X, AlertCircle } from 'lucide-react';
import { useCornerStore, parseYouTubeId } from '../../store/cornerStore';

// Minimal YT types
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

let ytApiLoaded = false;
let ytApiReady = false;
const ytReadyCallbacks: Array<() => void> = [];

function loadYtApi() {
  if (ytApiLoaded) return;
  ytApiLoaded = true;
  const script = document.createElement('script');
  script.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(script);
  window.onYouTubeIframeAPIReady = () => {
    ytApiReady = true;
    ytReadyCallbacks.forEach(fn => fn());
    ytReadyCallbacks.length = 0;
  };
}

function whenYtReady(fn: () => void) {
  if (ytApiReady) { fn(); return; }
  ytReadyCallbacks.push(fn);
  loadYtApi();
}

export function VideoCorner() {
  const {
    videoInputUrl, videoId, videoTitle,
    setVideoInputUrl, setVideoId, setVideoTitle,
    setVideoIsPlaying, setVideoCurrentTime,
  } = useCornerStore();

  const [inputValue, setInputValue]   = useState(videoInputUrl);
  const [inputError, setInputError]   = useState('');
  const [playerKey, setPlayerKey]     = useState(0); // bump to force div remount + new player
  const playerRef    = useRef<any>(null);
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load YouTube IFrame API on mount
  useEffect(() => { loadYtApi(); }, []);

  // Create / recreate player when playerKey or videoId changes
  useEffect(() => {
    if (!videoId) return;
    const containerId = `yt-player-${playerKey}`;

    function init() {
      if (!document.getElementById(containerId)) return;
      playerRef.current = new window.YT.Player(containerId, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: { autoplay: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: (e: any) => {
            const data = e.target.getVideoData();
            if (data?.title) setVideoTitle(data.title);
          },
          onStateChange: (e: any) => {
            // 1 = playing, 2 = paused, 0 = ended
            const playing = e.data === 1;
            setVideoIsPlaying(playing);
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (playing) {
              intervalRef.current = setInterval(() => {
                const t = playerRef.current?.getCurrentTime?.();
                if (typeof t === 'number') setVideoCurrentTime(Math.floor(t));
                // Re-fetch title once playback starts (it populates after onReady sometimes)
                const d = playerRef.current?.getVideoData?.();
                if (d?.title && !useCornerStore.getState().videoTitle) setVideoTitle(d.title);
              }, 1000);
            } else {
              // On pause/end, do one final time sync
              const t = playerRef.current?.getCurrentTime?.();
              if (typeof t === 'number') setVideoCurrentTime(Math.floor(t));
            }
          },
        },
      });
    }

    whenYtReady(init);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (playerRef.current?.destroy) {
        try { playerRef.current.destroy(); } catch {}
        playerRef.current = null;
      }
      setVideoIsPlaying(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerKey]);

  function handlePlay() {
    const raw = inputValue.trim();
    const id = parseYouTubeId(raw);
    if (!id) {
      setInputError('Please enter a valid YouTube URL.');
      return;
    }
    setInputError('');
    setVideoInputUrl(raw);

    // Destroy old player first
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (playerRef.current?.destroy) {
      try { playerRef.current.destroy(); } catch {}
      playerRef.current = null;
    }

    setVideoTitle('');
    setVideoIsPlaying(false);
    setVideoCurrentTime(0);
    setVideoId(id);
    setPlayerKey(k => k + 1); // new key → div remounts → useEffect creates fresh player
  }

  function handleClear() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (playerRef.current?.destroy) {
      try { playerRef.current.destroy(); } catch {}
      playerRef.current = null;
    }
    setVideoId(null);
    setVideoTitle('');
    setVideoIsPlaying(false);
    setVideoCurrentTime(0);
    setInputValue('');
    setVideoInputUrl('');
    setInputError('');
  }

  return (
    <div
      className="flex h-full flex-col"
      style={{
        width: 300,
        background: 'var(--sidebar-bg)',
        borderRadius: 16,
        border: '1px solid var(--sidebar-border)',
        boxShadow: 'var(--sidebar-shadow)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2.5 px-4 py-4"
        style={{ borderBottom: '1px solid var(--panel-divider)' }}
      >
        <div
          className="flex h-8 w-8 items-center justify-center rounded-xl flex-shrink-0"
          style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.30)' }}
        >
          <Tv className="h-4 w-4" style={{ color: '#a855f7' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>Video Corner</p>
          {videoTitle ? (
            <p className="text-[10px] truncate" style={{ color: '#a855f7' }}>{videoTitle}</p>
          ) : (
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Paste a YouTube URL to play</p>
          )}
        </div>
        {videoId && (
          <button
            onClick={handleClear}
            className="flex-shrink-0 rounded-lg p-1 transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#e03f3f'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'}
            title="Clear video"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* URL input */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex gap-2">
          <input
            className="aero-input flex-1 py-2 text-xs"
            placeholder="https://youtube.com/watch?v=..."
            value={inputValue}
            onChange={e => { setInputValue(e.target.value); setInputError(''); }}
            onKeyDown={e => { if (e.key === 'Enter') handlePlay(); }}
          />
          <button
            onClick={handlePlay}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-aero px-3 py-2 text-xs font-semibold transition-all active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
              color: '#fff',
              border: '1px solid rgba(168,85,247,0.50)',
              boxShadow: '0 2px 8px rgba(168,85,247,0.30)',
            }}
          >
            <Play className="h-3 w-3" />
            Play
          </button>
        </div>
        {inputError && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px]" style={{ color: '#e05050' }}>
            <AlertCircle className="h-3 w-3 flex-shrink-0" />
            {inputError}
          </div>
        )}
      </div>

      {/* Player — always mounted once videoId is set; stays alive even when panel is hidden */}
      <div className="flex-1 px-4 pb-4">
        {videoId ? (
          <div
            className="h-full overflow-hidden rounded-aero-lg"
            style={{ border: '1px solid rgba(168,85,247,0.22)', boxShadow: '0 0 20px rgba(168,85,247,0.12)' }}
          >
            {/* key={playerKey} forces a fresh div when playerKey bumps */}
            <div
              key={playerKey}
              id={`yt-player-${playerKey}`}
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        ) : (
          <div
            className="flex h-full flex-col items-center justify-center gap-3 rounded-aero-lg"
            style={{
              background: 'rgba(168,85,247,0.05)',
              border: '1px dashed rgba(168,85,247,0.20)',
            }}
          >
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.25)' }}
            >
              <Tv className="h-6 w-6" style={{ color: 'rgba(168,85,247,0.60)' }} />
            </div>
            <p className="text-center text-xs" style={{ color: 'var(--text-muted)' }}>
              Paste a YouTube URL above<br />and hit Play
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
