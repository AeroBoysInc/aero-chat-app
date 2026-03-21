import { useState, useEffect } from 'react';
import { Music2, AlertCircle, X, ExternalLink } from 'lucide-react';
import {
  useCornerStore,
  wasSpotifyConnected,
  parseSpotify,
  fetchSpotifyTitle,
} from '../../store/cornerStore';

// Which screen to show inside the panel
type View = 'splash' | 'approval' | 'player';

function getInitialView(connected: boolean): View {
  if (connected) return 'player';
  if (wasSpotifyConnected()) return 'approval';
  return 'splash';
}

// ── Spotify brand palette ────────────────────────────────────────────────────
const GREEN = '#1DB954';
const GREEN_DIM = 'rgba(29,185,84,0.18)';
const GREEN_BORDER = 'rgba(29,185,84,0.35)';

// ── Spotify wordmark SVG (official shape, simplified) ────────────────────────
function SpotifyLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={GREEN}>
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  );
}

// ── View: Splash (never connected) ──────────────────────────────────────────
function SplashView({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-8 text-center gap-5">
      <div
        className="flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ background: GREEN_DIM, border: `1px solid ${GREEN_BORDER}`, boxShadow: `0 0 24px rgba(29,185,84,0.18)` }}
      >
        <SpotifyLogo size={34} />
      </div>

      <div>
        <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
          Connect Spotify
        </p>
        <p className="mt-1.5 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Play any track, album, or playlist while you chat.<br />
          Music keeps playing even when this panel is closed.
        </p>
      </div>

      {/* Feature bullets */}
      <div className="w-full flex flex-col gap-2 text-left">
        {[
          'Tracks, albums & playlists',
          'Podcasts & episodes',
          'Stays playing in the background',
        ].map(f => (
          <div key={f} className="flex items-center gap-2.5">
            <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: GREEN }} />
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{f}</span>
          </div>
        ))}
      </div>

      <button
        onClick={onConnect}
        className="w-full rounded-aero-lg py-3 text-sm font-bold transition-all active:scale-95 hover:brightness-110"
        style={{
          background: GREEN,
          color: '#000',
          boxShadow: `0 4px 16px rgba(29,185,84,0.35)`,
        }}
      >
        Log in with Spotify
      </button>

      <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        You'll be asked to log in to Spotify inside the player.<br />Free and Premium accounts both work.
      </p>
    </div>
  );
}

// ── View: Approval (connected before, asking permission again) ───────────────
function ApprovalView({ onAllow, onDeny }: { onAllow: () => void; onDeny: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-8 text-center gap-5">
      {/* Permission card */}
      <div
        className="w-full rounded-aero-lg p-5 flex flex-col items-center gap-4"
        style={{ background: 'rgba(29,185,84,0.06)', border: `1px solid ${GREEN_BORDER}` }}
      >
        <div className="relative">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: GREEN_DIM, border: `1px solid ${GREEN_BORDER}` }}
          >
            <SpotifyLogo size={30} />
          </div>
          {/* AeroChat connector dot */}
          <div
            className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center"
            style={{ background: 'var(--sidebar-bg)', border: '1.5px solid var(--panel-divider)' }}
          >
            <Music2 style={{ width: 10, height: 10, color: 'var(--text-muted)' }} />
          </div>
        </div>

        <div>
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            Connect to Spotify?
          </p>
          <p className="mt-1.5 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            AeroChat would like to embed your Spotify player so you can listen while you chat.
            No account data is accessed — only the player is embedded.
          </p>
        </div>

        {/* What we access */}
        <div className="w-full rounded-aero p-3 text-left" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>What we embed</p>
          {[
            ['✓', 'Official Spotify embed player'],
            ['✓', 'Your Spotify login (inside the player)'],
            ['✗', 'No account data or tokens accessed'],
          ].map(([icon, text]) => (
            <div key={text} className="flex items-center gap-2 py-0.5">
              <span className="text-[11px] font-bold w-3" style={{ color: icon === '✗' ? 'var(--text-muted)' : GREEN }}>{icon}</span>
              <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Buttons */}
      <div className="flex w-full gap-2">
        <button
          onClick={onDeny}
          className="flex-1 rounded-aero py-2.5 text-sm font-semibold transition-all active:scale-95"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-secondary)' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.10)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'}
        >
          Not now
        </button>
        <button
          onClick={onAllow}
          className="flex-1 rounded-aero py-2.5 text-sm font-bold transition-all active:scale-95 hover:brightness-110"
          style={{ background: GREEN, color: '#000', boxShadow: `0 3px 12px rgba(29,185,84,0.30)` }}
        >
          Allow
        </button>
      </div>
    </div>
  );
}

// ── View: Player ─────────────────────────────────────────────────────────────
function PlayerView({ onDisconnect }: { onDisconnect: () => void }) {
  const { musicInputUrl, musicEmbedUrl, musicTitle, setMusicInputUrl, setMusicEmbedUrl, setMusicTitle } = useCornerStore();
  const [inputValue, setInputValue] = useState(musicInputUrl);
  const [inputError, setInputError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLoad() {
    const parsed = parseSpotify(inputValue.trim());
    if (!parsed) {
      setInputError('Please enter a valid Spotify URL (track, album, playlist, episode…)');
      return;
    }
    setInputError('');
    setLoading(true);
    const title = await fetchSpotifyTitle(inputValue.trim());
    setMusicInputUrl(inputValue.trim());
    setMusicEmbedUrl(parsed.embedUrl);
    setMusicTitle(title);
    setLoading(false);
  }

  function handleClear() {
    setMusicEmbedUrl(null);
    setMusicTitle('');
    setMusicInputUrl('');
    setInputValue('');
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* URL input row */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex gap-2">
          <input
            className="aero-input flex-1 py-2 text-xs"
            placeholder="Paste Spotify link…"
            value={inputValue}
            onChange={e => { setInputValue(e.target.value); setInputError(''); }}
            onKeyDown={e => { if (e.key === 'Enter') handleLoad(); }}
          />
          {musicEmbedUrl ? (
            <button
              onClick={handleClear}
              className="flex flex-shrink-0 items-center justify-center rounded-aero px-3 text-xs transition-all active:scale-95"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-muted)' }}
              title="Clear"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={handleLoad}
              disabled={loading || !inputValue.trim()}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-aero px-3 py-2 text-xs font-bold transition-all active:scale-95 disabled:opacity-40 hover:brightness-110"
              style={{ background: GREEN, color: '#000', minWidth: 56 }}
            >
              {loading ? '…' : 'Load'}
            </button>
          )}
        </div>
        {inputError && (
          <div className="mt-1.5 flex items-start gap-1.5 text-[11px]" style={{ color: '#e05050' }}>
            <AlertCircle className="h-3 w-3 flex-shrink-0 mt-0.5" />
            {inputError}
          </div>
        )}
      </div>

      {/* Spotify embed */}
      <div className="flex-1 px-4 pb-4">
        {musicEmbedUrl ? (
          <iframe
            key={musicEmbedUrl}
            src={musicEmbedUrl}
            width="100%"
            height="100%"
            style={{ borderRadius: 12, border: 'none' }}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            title={musicTitle || 'Spotify Player'}
          />
        ) : (
          <div
            className="flex h-full flex-col items-center justify-center gap-3 rounded-aero-lg"
            style={{ background: 'rgba(29,185,84,0.04)', border: `1px dashed ${GREEN_BORDER}` }}
          >
            <SpotifyLogo size={28} />
            <p className="text-xs text-center leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Paste any Spotify link above.<br />
              <span className="text-[10px] opacity-60">Tracks · Albums · Playlists · Podcasts</span>
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{ borderTop: '1px solid var(--panel-divider)' }}
      >
        <a
          href="https://open.spotify.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] transition-opacity hover:opacity-100"
          style={{ color: 'var(--text-muted)', opacity: 0.6 }}
        >
          <ExternalLink className="h-2.5 w-2.5" />
          Open Spotify
        </a>
        <button
          onClick={onDisconnect}
          className="text-[10px] transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#e05050'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'}
        >
          Disconnect
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function MusicCorner() {
  const { spotifyConnected, setSpotifyConnected, musicTitle } = useCornerStore();
  const [view, setView] = useState<View>(() => getInitialView(spotifyConnected));

  // Sync if connected state changes externally
  useEffect(() => {
    if (spotifyConnected && view !== 'player') setView('player');
  }, [spotifyConnected]);

  function handleConnect() {
    setSpotifyConnected(true);
    setView('player');
  }

  function handleAllow() {
    setSpotifyConnected(true);
    setView('player');
  }

  function handleDeny() {
    setView('splash');
  }

  function handleDisconnect() {
    setSpotifyConnected(false);
    setView('splash');
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
        className="flex items-center gap-2.5 px-4 py-3.5 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--panel-divider)' }}
      >
        <div
          className="flex h-8 w-8 items-center justify-center rounded-xl flex-shrink-0"
          style={{ background: GREEN_DIM, border: `1px solid ${GREEN_BORDER}` }}
        >
          <SpotifyLogo size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Music Corner</p>
          {musicTitle && view === 'player' ? (
            <p className="text-[10px] truncate" style={{ color: GREEN }}>♫ {musicTitle}</p>
          ) : (
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {view === 'player' ? 'Paste a Spotify link to play' : 'Powered by Spotify'}
            </p>
          )}
        </div>
      </div>

      {/* View */}
      {view === 'splash'   && <SplashView   onConnect={handleConnect} />}
      {view === 'approval' && <ApprovalView onAllow={handleAllow} onDeny={handleDeny} />}
      {view === 'player'   && <PlayerView   onDisconnect={handleDisconnect} />}
    </div>
  );
}
