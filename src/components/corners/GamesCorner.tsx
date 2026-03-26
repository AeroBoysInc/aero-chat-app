import { lazy, Suspense } from 'react';
import { Gamepad2, ArrowLeft } from 'lucide-react';
import { useCornerStore, type SelectedGame } from '../../store/cornerStore';
import { useChessStore } from '../../store/chessStore';

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
    id: 'chess' as SelectedGame,
    icon: '♟️',
    label: 'AeroChess',
    desc: 'Real-time 1v1 — 🔵 Blue vs 🟢 Green',
    available: true,
    color: '#00d4ff',
    size: '~1 MB',
    tags: ['Strategy', 'Multiplayer'],
  },
];

// ── Game Hub ─────────────────────────────────────────────────────────────────

function GameHub() {
  const { closeGameView, selectGame } = useCornerStore();
  const { openLobby } = useChessStore();

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

        <div>
          <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Games Corner</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Mini-games while you chat</p>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto scrollbar-aero p-6">
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
          {GAMES.map(game => {
            const IconEl = typeof game.icon !== 'string' ? game.icon : null;

            return (
              <button
                key={game.label}
                disabled={!game.available}
                onClick={() => {
                  if (!game.available || !game.id) return;
                  if (game.id === 'chess') { selectGame('chess'); openLobby(); return; }
                  selectGame(game.id);
                }}
                className="flex flex-col items-center justify-center gap-3 rounded-aero-lg p-5 text-center transition-all"
                style={{
                  minHeight: 172,
                  background: game.available
                    ? `rgba(${hexToRgb(game.color)}, 0.07)`
                    : 'rgba(255,255,255,0.03)',
                  border: game.available
                    ? `1px solid rgba(${hexToRgb(game.color)}, 0.25)`
                    : '1px solid rgba(255,255,255,0.07)',
                  cursor: game.available ? 'pointer' : 'default',
                  opacity: game.available ? 1 : 0.55,
                }}
                onMouseEnter={e => {
                  if (game.available)
                    (e.currentTarget as HTMLElement).style.background = `rgba(${hexToRgb(game.color)}, 0.13)`;
                }}
                onMouseLeave={e => {
                  if (game.available)
                    (e.currentTarget as HTMLElement).style.background = `rgba(${hexToRgb(game.color)}, 0.07)`;
                }}
              >
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-2xl"
                  style={{
                    background: `rgba(${hexToRgb(game.color)}, 0.15)`,
                    border: `1px solid rgba(${hexToRgb(game.color)}, 0.30)`,
                    boxShadow: game.available ? `0 0 20px rgba(${hexToRgb(game.color)}, 0.15)` : 'none',
                    fontSize: typeof game.icon === 'string' ? 28 : undefined,
                  }}
                >
                  {typeof game.icon === 'string'
                    ? game.icon
                    : IconEl && <IconEl className="h-7 w-7" style={{ color: game.color }} />
                  }
                </div>

                <div>
                  <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{game.label}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>{game.desc}</p>
                </div>

                <span
                  className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
                  style={{
                    background: game.available
                      ? `rgba(${hexToRgb(game.color)}, 0.20)`
                      : 'rgba(255,255,255,0.06)',
                    color: game.available ? game.color : 'var(--text-muted)',
                    border: `1px solid rgba(${hexToRgb(game.color)}, ${game.available ? 0.35 : 0.12})`,
                  }}
                >
                  {game.available ? 'Play' : 'Soon'}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Games strip (shown below any active game) ─────────────────────────────────

function GamesStrip() {
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
        {GAMES.map(game => {
          const isActive = game.id === selectedGame;
          const IconEl = typeof game.icon !== 'string' ? game.icon : null;
          return (
            <button
              key={game.label}
              disabled={!game.available}
              onClick={() => game.available && game.id && selectGame(game.id)}
              className="flex-shrink-0 flex flex-col items-center gap-1.5 rounded-xl px-3 py-2 transition-all"
              style={{
                minWidth: 72,
                background: isActive
                  ? `rgba(${hexToRgb(game.color)}, 0.18)`
                  : game.available ? 'rgba(255,255,255,0.04)' : 'transparent',
                border: isActive
                  ? `1px solid rgba(${hexToRgb(game.color)}, 0.45)`
                  : game.available ? '1px solid rgba(255,255,255,0.09)' : '1px solid transparent',
                cursor: game.available ? 'pointer' : 'default',
                opacity: game.available ? 1 : 0.38,
                boxShadow: isActive ? `0 0 12px rgba(${hexToRgb(game.color)}, 0.25)` : 'none',
              }}
              onMouseEnter={e => {
                if (game.available && !isActive)
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)';
              }}
              onMouseLeave={e => {
                if (game.available && !isActive)
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
              {!game.available && (
                <span className="text-[9px]" style={{ color: 'var(--text-muted)', opacity: 0.55 }}>Soon</span>
              )}
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

  return (
    <div
      className="flex h-full flex-col"
      style={{
        background: 'var(--sidebar-bg)',
        borderRadius: 16,
        border: '1px solid var(--sidebar-border)',
        boxShadow: 'var(--sidebar-shadow)',
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
            {selectedGame === 'chess'            && (
              <Suspense fallback={
                <div className="flex h-full items-center justify-center" style={{ color: 'rgba(0,212,255,0.7)', fontSize: 13 }}>
                  Loading chess…
                </div>
              }>
                <AeroChess />
              </Suspense>
            )}
          </div>
          {selectedGame !== 'chess' && <GamesStrip />}
        </>
      ) : (
        <GameHub />
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
