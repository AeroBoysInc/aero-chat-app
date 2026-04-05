import { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { Gamepad2, ArrowLeft } from 'lucide-react';
import { useCornerStore, type SelectedGame } from '../../store/cornerStore';
import { useChessStore } from '../../store/chessStore';
import { useAuthStore } from '../../store/authStore';
import { getInstalledGames, installGame, uninstallGame } from '../../lib/gameInstalls';

// Lazy-load chess: Three.js + drei + postprocessing are ~900KB — don't parse at app startup
const AeroChess = lazy(() =>
  import('../chess/AeroChess').then(m => ({ default: m.AeroChess }))
);
const BubblePop        = lazy(() => import('./games/BubblePop').then(m => ({ default: m.BubblePop })))
const Tropico          = lazy(() => import('./games/Tropico').then(m => ({ default: m.Tropico })))
const TwentyFortyEight = lazy(() => import('./games/TwentyFortyEight').then(m => ({ default: m.TwentyFortyEight })))
const TypingTest       = lazy(() => import('./games/TypingTest').then(m => ({ default: m.TypingTest })))
const Wordle           = lazy(() => import('./games/Wordle').then(m => ({ default: m.Wordle })))

interface GameEntry {
  id: SelectedGame;
  icon: string | React.FC<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  desc: string;
  available: boolean;
  color: string;
  size: string;
  tags: string[];
}

const GAMES: GameEntry[] = [
  {
    id: 'bubblepop',
    icon: '🫧',
    label: 'Bubble Pop',
    desc: 'Pop bubbles before they escape!',
    available: true,
    color: '#00d4ff',
    size: '~80 KB',
    tags: ['Casual', 'Single-player'],
  },
  {
    id: 'tropico',
    icon: '🌴',
    label: 'Tropico',
    desc: 'Jump through 10 tropical levels!',
    available: true,
    color: '#34d399',
    size: '~200 KB',
    tags: ['Action', 'Single-player'],
  },
  {
    id: 'typingtest',
    icon: '⌨️',
    label: 'Type Rush',
    desc: 'Race the clock — WPM test!',
    available: true,
    color: '#00d4ff',
    size: '~60 KB',
    tags: ['Typing', 'Speed'],
  },
  {
    id: 'twentyfortyeight',
    icon: '🔢',
    label: '2048',
    desc: 'Slide tiles to reach 2048!',
    available: true,
    color: '#fb923c',
    size: '~50 KB',
    tags: ['Puzzle', 'Single-player'],
  },
  {
    id: 'wordle',
    icon: '🟩',
    label: 'Wordle',
    desc: 'Guess the word in 6 tries!',
    available: true,
    color: '#a855f7',
    size: '~60 KB',
    tags: ['Word', 'Daily'],
  },
  {
    id: 'chess',
    icon: '♟️',
    label: 'AeroChess',
    desc: 'Classic chess — play friends or challenge a bot',
    available: true,
    color: '#00d4ff',
    size: '~30 KB',
    tags: ['Strategy', 'Multiplayer'],
  },
];

// ── Shared game detail row ────────────────────────────────────────────────────

function GameRow({ game, children }: { game: GameEntry; children: React.ReactNode }) {
  return (
    <div
      className="flex items-center gap-3 rounded-2xl p-3"
      style={{
        background: `rgba(${hexToRgb(game.color)}, 0.06)`,
        border: `1px solid rgba(${hexToRgb(game.color)}, 0.20)`,
      }}
    >
      {/* Icon */}
      <div
        className="flex h-11 w-11 items-center justify-center rounded-xl flex-shrink-0"
        style={{
          background: `rgba(${hexToRgb(game.color)}, 0.15)`,
          border: `1px solid rgba(${hexToRgb(game.color)}, 0.30)`,
          fontSize: typeof game.icon === 'string' ? 22 : undefined,
          boxShadow: `0 0 16px rgba(${hexToRgb(game.color)}, 0.15)`,
        }}
      >
        {typeof game.icon === 'string' ? game.icon : null}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{game.label}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{game.desc}</p>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {game.tags.map(tag => (
            <span
              key={tag}
              className="rounded text-[9px] font-semibold px-1.5 py-0.5"
              style={{
                background: `rgba(${hexToRgb(game.color)}, 0.12)`,
                border: `1px solid rgba(${hexToRgb(game.color)}, 0.20)`,
                color: game.color,
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Action slot */}
      {children}
    </div>
  )
}

// ── Library tab (installed games) ────────────────────────────────────────────

function LibraryTab({
  games,
  onPlay,
  onUninstall,
}: {
  games: GameEntry[]
  onPlay: (id: SelectedGame) => void
  onUninstall: (id: string) => void
}) {
  if (games.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-center">
        <div>
          <p className="text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>No games installed</p>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Browse the Store tab to add games</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {games.map(game => (
        <GameRow key={game.id} game={game}>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <button
              onClick={() => onPlay(game.id)}
              className="rounded-xl px-4 py-2 text-xs font-bold transition-all"
              style={{
                background: `rgba(${hexToRgb(game.color)}, 0.18)`,
                border: `1px solid rgba(${hexToRgb(game.color)}, 0.40)`,
                color: game.color,
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.8'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
            >
              ▶ Play
            </button>
            <button
              onClick={() => onUninstall(game.id as string)}
              className="text-[10px] transition-all"
              style={{ color: 'var(--text-muted)', opacity: 0.5 }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '0.5'}
            >
              Uninstall
            </button>
          </div>
        </GameRow>
      ))}
    </div>
  )
}

// ── Store tab (available games) ───────────────────────────────────────────────

function StoreTab({
  games,
  installing,
  progress,
  onInstall,
}: {
  games: GameEntry[]
  installing: string | null
  progress: number
  onInstall: (id: string) => void
}) {
  if (games.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-center">
        <div>
          <p className="text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>All games installed!</p>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Check My Games to play</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {games.map(game => {
        const isInstalling = installing === game.id
        return (
          <GameRow key={game.id} game={game}>
            <div className="flex flex-col items-end gap-1 flex-shrink-0" style={{ minWidth: 80 }}>
              {isInstalling ? (
                <div style={{ width: 80 }}>
                  <div
                    className="rounded-full overflow-hidden"
                    style={{ height: 5, background: 'rgba(0,0,0,0.3)' }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${progress}%`,
                        background: `linear-gradient(90deg, ${game.color}, #5bc8f5)`,
                        boxShadow: `0 0 8px ${game.color}80`,
                        transition: 'width 0.05s linear',
                      }}
                    />
                  </div>
                  <p
                    className="text-[9px] font-semibold mt-1 text-right"
                    style={{ color: game.color }}
                  >
                    Installing…
                  </p>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => game.id && onInstall(game.id as string)}
                    disabled={installing !== null}
                    className="rounded-xl px-3 py-2 text-xs font-bold transition-all"
                    style={{
                      background: `rgba(${hexToRgb(game.color)}, 0.12)`,
                      border: `1px solid rgba(${hexToRgb(game.color)}, 0.30)`,
                      color: game.color,
                      opacity: installing !== null ? 0.4 : 1,
                      cursor: installing !== null ? 'default' : 'pointer',
                    }}
                  >
                    ⬇ Install
                  </button>
                  <p
                    className="text-[9px] text-right"
                    style={{ color: 'var(--text-muted)', opacity: 0.6 }}
                  >
                    {game.size}
                  </p>
                </>
              )}
            </div>
          </GameRow>
        )
      })}
    </div>
  )
}

// ── Game Hub ─────────────────────────────────────────────────────────────────

function GameHub({
  installedGames,
  onInstalled,
  onUninstalled,
}: {
  installedGames: string[]
  onInstalled: (id: string) => void
  onUninstalled: (id: string) => void
}) {
  const { closeGameView, selectGame } = useCornerStore()
  const { openLobby } = useChessStore()
  const user = useAuthStore(s => s.user)

  const [activeTab, setActiveTab] = useState<'library' | 'store'>('library')
  const [installing, setInstalling] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }, [])

  function handlePlay(gameId: SelectedGame) {
    if (!gameId) return
    if (gameId === 'chess') { selectGame('chess'); openLobby(); return }
    selectGame(gameId)
  }

  function handleUninstall(gameId: string) {
    if (!user) return
    uninstallGame(user.id, gameId)
    onUninstalled(gameId)
  }

  function handleInstall(gameId: string) {
    if (installing || !user) return
    setInstalling(gameId)
    setProgress(0)
    const start = Date.now()
    const DURATION = 1500
    const tick = () => {
      const p = Math.min(100, ((Date.now() - start) / DURATION) * 100)
      setProgress(p)
      if (p < 100) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        installGame(user.id, gameId)
        onInstalled(gameId)
        setInstalling(null)
        setProgress(0)
        setActiveTab('library')
      }
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  const libraryGames = GAMES.filter(g => g.id && installedGames.includes(g.id as string))
  const storeGames   = GAMES.filter(g => g.id && !installedGames.includes(g.id as string))

  return (
    <div className="flex h-full flex-col">

      {/* Header */}
      <div
        className="flex items-center gap-3 px-6 py-5 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--panel-divider)' }}
      >
        <button
          onClick={closeGameView}
          className="flex h-8 w-8 items-center justify-center rounded-xl transition-all flex-shrink-0"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.10)',
            color: 'var(--text-muted)',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.12)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0"
          style={{ background: 'rgba(0,212,255,0.15)', border: '1px solid rgba(0,212,255,0.30)' }}
        >
          <Gamepad2 className="h-5 w-5" style={{ color: '#00d4ff' }} />
        </div>

        <div className="flex-1">
          <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Games Corner</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Mini-games while you chat</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 flex-shrink-0">
          {(['library', 'store'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="rounded-full px-4 py-1.5 text-xs font-bold transition-all"
              style={{
                background: activeTab === tab ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.04)',
                border: activeTab === tab ? '1px solid rgba(0,212,255,0.40)' : '1px solid rgba(255,255,255,0.09)',
                color: activeTab === tab ? '#00d4ff' : 'var(--text-muted)',
              }}
            >
              {tab === 'library'
                ? `My Games (${libraryGames.length})`
                : `Store (${storeGames.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-aero p-5">
        {activeTab === 'library' ? (
          <LibraryTab
            games={libraryGames}
            onPlay={handlePlay}
            onUninstall={handleUninstall}
          />
        ) : (
          <StoreTab
            games={storeGames}
            installing={installing}
            progress={progress}
            onInstall={handleInstall}
          />
        )}
      </div>

    </div>
  )
}

// ── Games strip (shown below any active game) ─────────────────────────────────

function GamesStrip({ installedGames }: { installedGames: string[] }) {
  const { selectedGame, selectGame } = useCornerStore();

  return (
    <div
      className="flex-shrink-0"
      style={{ borderTop: '1px solid var(--panel-divider)', background: 'rgba(0,0,0,0.18)' }}
    >
      <div
        className="flex items-center gap-1 overflow-x-auto px-3 py-2.5"
        style={{ scrollbarWidth: 'none' }}
      >
        <span
          className="flex-shrink-0 text-[10px] uppercase tracking-widest pr-2"
          style={{ color: 'var(--text-muted)', opacity: 0.6, borderRight: '1px solid rgba(255,255,255,0.10)', marginRight: 4 }}
        >
          More
        </span>
        {GAMES.filter(g => g.id && installedGames.includes(g.id as string)).map(game => {
          const isActive = game.id === selectedGame;
          const IconEl = typeof game.icon !== 'string' ? game.icon : null;
          return (
            <button
              key={game.label}
              onClick={() => game.id && selectGame(game.id)}
              className="flex-shrink-0 flex flex-col items-center gap-1.5 rounded-xl px-3 py-2 transition-all"
              style={{
                minWidth: 72,
                background: isActive
                  ? `rgba(${hexToRgb(game.color)}, 0.18)`
                  : 'rgba(255,255,255,0.04)',
                border: isActive
                  ? `1px solid rgba(${hexToRgb(game.color)}, 0.45)`
                  : '1px solid rgba(255,255,255,0.09)',
                cursor: 'pointer',
                boxShadow: isActive ? `0 0 12px rgba(${hexToRgb(game.color)}, 0.25)` : 'none',
              }}
              onMouseEnter={e => {
                if (!isActive)
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)';
              }}
              onMouseLeave={e => {
                if (!isActive)
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
              }}
            >
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{
                  background: `rgba(${hexToRgb(game.color)}, 0.15)`,
                  border: `1px solid rgba(${hexToRgb(game.color)}, 0.28)`,
                  fontSize: typeof game.icon === 'string' ? 16 : undefined,
                }}
              >
                {typeof game.icon === 'string'
                  ? game.icon
                  : IconEl && <IconEl className="h-4 w-4" style={{ color: game.color }} />
                }
              </div>
              <span className="text-[10px] font-semibold leading-tight text-center" style={{ color: isActive ? game.color : 'var(--text-muted)', maxWidth: 64 }}>
                {game.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

export function GamesCorner() {
  const { selectedGame } = useCornerStore();
  const user = useAuthStore(s => s.user);
  const [installedGames, setInstalledGames] = useState<string[]>(() =>
    user ? getInstalledGames(user.id) : ['bubblepop']
  );

  useEffect(() => {
    if (user) setInstalledGames(getInstalledGames(user.id));
  }, [user?.id]);

  return (
    <div
      className="flex h-full flex-col"
      style={{
        background: 'var(--sidebar-bg)',
        overflow: 'hidden',
      }}
    >
      {selectedGame ? (
        <>
          <div className="flex-1 min-h-0">
            {selectedGame === 'bubblepop' && (
              <Suspense fallback={<GameLoadingSpinner />}><BubblePop /></Suspense>
            )}
            {selectedGame === 'tropico' && (
              <Suspense fallback={<GameLoadingSpinner />}><Tropico /></Suspense>
            )}
            {selectedGame === 'twentyfortyeight' && (
              <Suspense fallback={<GameLoadingSpinner />}><TwentyFortyEight /></Suspense>
            )}
            {selectedGame === 'typingtest' && (
              <Suspense fallback={<GameLoadingSpinner />}><TypingTest /></Suspense>
            )}
            {selectedGame === 'wordle' && (
              <Suspense fallback={<GameLoadingSpinner />}><Wordle /></Suspense>
            )}
            {selectedGame === 'chess' && (
              <Suspense fallback={
                <div className="flex h-full items-center justify-center" style={{ color: 'rgba(0,212,255,0.7)', fontSize: 13 }}>
                  Loading chess…
                </div>
              }>
                <AeroChess />
              </Suspense>
            )}
          </div>
          {selectedGame !== 'chess' && <GamesStrip installedGames={installedGames} />}
        </>
      ) : (
        <GameHub
          installedGames={installedGames}
          onInstalled={id => setInstalledGames(prev => [...prev, id])}
          onUninstalled={id => setInstalledGames(prev => prev.filter(g => g !== id))}
        />
      )}
    </div>
  );
}

// ── Game loading fallback ─────────────────────────────────────────────────────

function GameLoadingSpinner() {
  return (
    <div className="flex h-full items-center justify-center" style={{ color: 'rgba(0,212,255,0.7)', fontSize: 13 }}>
      Loading…
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
