import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Trophy } from 'lucide-react';
import { useCornerStore } from '../../../store/cornerStore';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Bubble {
  id: number;
  x: number;        // % from left
  size: number;     // px
  duration: number; // ms to float up
  hue: number;      // HSL hue for tint
  points: number;
  popped: boolean;
  popX?: number;
  popY?: number;
}

interface FloatText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
}

type GameState = 'idle' | 'playing' | 'gameover';

const HS_KEY = 'aero_bubblepop_hs';
const MAX_LIVES = 5;

function getHighScore(): number {
  try { return parseInt(localStorage.getItem(HS_KEY) ?? '0', 10) || 0; } catch { return 0; }
}
function saveHighScore(s: number) {
  try { localStorage.setItem(HS_KEY, String(s)); } catch {}
}

function bubbleGradient(hue: number) {
  return `radial-gradient(
    circle at 32% 28%,
    hsla(${hue + 40},100%,98%,0.92) 0%,
    hsla(${hue},90%,82%,0.55)       28%,
    hsla(${hue - 30},80%,65%,0.22)  55%,
    hsla(${hue + 60},70%,55%,0.10)  75%,
    hsla(${hue},60%,40%,0.04)       100%
  )`;
}

const IDLE_BUBBLES = [
  { x: 15, size: 48, hue: 195, delay: 0 },
  { x: 32, size: 36, hue: 260, delay: 0.8 },
  { x: 50, size: 56, hue: 160, delay: 1.6 },
  { x: 65, size: 40, hue: 220, delay: 0.4 },
  { x: 78, size: 30, hue: 300, delay: 1.2 },
  { x: 88, size: 44, hue: 30, delay: 2.0 },
];

// ── Main component ─────────────────────────────────────────────────────────────

export function BubblePop() {
  const { selectGame } = useCornerStore();
  const onBack = () => selectGame(null);

  const [gameState, setGameState] = useState<GameState>('idle');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [level, setLevel] = useState(1);
  const [combo, setCombo] = useState(0);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [floatTexts, setFloatTexts] = useState<FloatText[]>([]);
  const [highScore, setHighScore] = useState(getHighScore);

  const nextId = useRef(0);
  const floatId = useRef(0);
  const poppedRef = useRef<Set<number>>(new Set());
  const spawnRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const levelRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const areaRef = useRef<HTMLDivElement>(null);

  const comboRef = useRef(combo);
  comboRef.current = combo;
  const scoreRef = useRef(score);
  scoreRef.current = score;
  const levelRef2 = useRef(level);
  levelRef2.current = level;

  // ── Spawn ──────────────────────────────────────────────────────────────────

  const spawnBubble = useCallback(() => {
    const id = ++nextId.current;
    const size = 30 + Math.random() * 44;
    const x = 4 + Math.random() * 88;
    const duration = 3800 - (levelRef2.current - 1) * 210 + Math.random() * 600;
    const hue = Math.random() * 360;
    const points = size < 42 ? 30 : size < 58 ? 20 : 10;

    setBubbles(prev => [...prev, { id, x, size, duration, hue, points, popped: false }]);

    setTimeout(() => {
      if (!poppedRef.current.has(id)) {
        setBubbles(prev => prev.filter(b => b.id !== id));
        setLives(l => {
          const next = l - 1;
          if (next <= 0) endGame();
          return Math.max(0, next);
        });
      }
    }, duration + 200);
  }, []);

  // ── Game control ───────────────────────────────────────────────────────────

  function startGame() {
    poppedRef.current.clear();
    setBubbles([]);
    setFloatTexts([]);
    setScore(0);
    setLives(MAX_LIVES);
    setLevel(1);
    setCombo(0);
    setGameState('playing');
  }

  function endGame() {
    setGameState('gameover');
    if (spawnRef.current) clearInterval(spawnRef.current);
    if (levelRef.current) clearInterval(levelRef.current);
    spawnRef.current = null;
    levelRef.current = null;
    setHighScore(prev => {
      const final = Math.max(prev, scoreRef.current);
      saveHighScore(final);
      return final;
    });
  }

  // ── Spawn & level intervals ────────────────────────────────────────────────

  useEffect(() => {
    if (gameState !== 'playing') return;

    function startSpawner() {
      if (spawnRef.current) clearInterval(spawnRef.current);
      const interval = Math.max(500, 1600 - (levelRef2.current - 1) * 120);
      spawnRef.current = setInterval(spawnBubble, interval);
    }

    startSpawner();
    levelRef.current = setInterval(() => {
      setLevel(l => {
        const next = Math.min(9, l + 1);
        levelRef2.current = next;
        startSpawner();
        return next;
      });
    }, 15_000);

    spawnBubble();

    return () => {
      if (spawnRef.current) clearInterval(spawnRef.current);
      if (levelRef.current) clearInterval(levelRef.current);
    };
  }, [gameState, spawnBubble]);

  // ── Pop handler ────────────────────────────────────────────────────────────

  function popBubble(bubble: Bubble, e: React.MouseEvent) {
    if (bubble.popped) return;
    e.stopPropagation();

    poppedRef.current.add(bubble.id);

    const newCombo = comboRef.current + 1;
    setCombo(newCombo);
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    comboTimerRef.current = setTimeout(() => setCombo(0), 1200);

    const multiplier = newCombo >= 5 ? 5 : newCombo >= 3 ? 3 : 1;
    const earned = bubble.points * multiplier;
    setScore(s => s + earned);

    const rect = areaRef.current?.getBoundingClientRect();
    const fx = rect ? e.clientX - rect.left : e.clientX;
    const fy = rect ? e.clientY - rect.top : e.clientY;
    const ftId = ++floatId.current;
    const color = multiplier >= 5 ? '#ff8c00' : multiplier >= 3 ? '#00d4ff' : '#ffffff';
    const text = multiplier > 1 ? `${multiplier}× ${earned}` : `+${earned}`;
    setFloatTexts(prev => [...prev, { id: ftId, x: fx, y: fy, text, color }]);
    setTimeout(() => setFloatTexts(prev => prev.filter(f => f.id !== ftId)), 700);

    setBubbles(prev => prev.map(b =>
      b.id === bubble.id ? { ...b, popped: true, popX: fx, popY: fy } : b
    ));
    setTimeout(() => {
      setBubbles(prev => prev.filter(b => b.id !== bubble.id));
    }, 350);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col" style={{ userSelect: 'none' }}>

      {/* Header — extra right padding to clear the fixed ThemeSwitcher */}
      <div
        className="flex items-center gap-4 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--panel-divider)', paddingLeft: 24, paddingRight: 72 }}
      >
        <button
          onClick={onBack}
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

        <div className="flex items-center gap-2.5 flex-1">
          <span style={{ fontSize: 22 }}>🫧</span>
          <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Bubble Pop</p>
        </div>

        {/* HUD — spread out on the right */}
        {gameState === 'playing' && (
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Level</span>
              <span className="text-lg font-bold" style={{ color: '#00d4ff' }}>{level}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Score</span>
              <span className="text-lg font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                {score.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {Array.from({ length: MAX_LIVES }, (_, i) => (
                <span
                  key={i}
                  style={{ opacity: i < lives ? 1 : 0.2, fontSize: 20, transition: 'opacity 0.2s' }}
                >
                  🫧
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Game area */}
      <div
        ref={areaRef}
        className="relative flex-1 overflow-hidden"
        style={{ background: 'linear-gradient(180deg, rgba(0,8,30,0.97) 0%, rgba(0,16,50,0.95) 100%)' }}
      >

        {/* ── Idle screen ── */}
        {gameState === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-8 text-center">
            {/* Preview bubbles */}
            {IDLE_BUBBLES.map(b => (
              <div
                key={b.x}
                className="absolute rounded-full pointer-events-none"
                style={{
                  width: b.size, height: b.size,
                  left: `${b.x}%`,
                  bottom: '-8%',
                  background: bubbleGradient(b.hue),
                  border: '1px solid rgba(255,255,255,0.65)',
                  boxShadow: 'inset 0 0 8px rgba(255,255,255,0.45), inset -2px -2px 5px rgba(120,190,255,0.25)',
                  animation: `bubble-idle 3.5s ${b.delay}s ease-in-out infinite`,
                }}
              />
            ))}

            <div className="relative z-10 flex flex-col items-center gap-5">
              <div
                className="flex h-20 w-20 items-center justify-center rounded-3xl"
                style={{
                  background: 'rgba(0,212,255,0.12)',
                  border: '1px solid rgba(0,212,255,0.30)',
                  boxShadow: '0 0 36px rgba(0,212,255,0.18)',
                  fontSize: 42,
                }}
              >
                🫧
              </div>

              <div>
                <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Bubble Pop</p>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-muted)', maxWidth: 340 }}>
                  Pop bubbles before they float away!
                  Small bubbles are worth more points. Chain pops for combo multipliers.
                </p>
              </div>

              {highScore > 0 && (
                <div className="flex items-center gap-2 text-sm" style={{ color: '#00d4ff' }}>
                  <Trophy className="h-4 w-4" />
                  Best: {highScore.toLocaleString()}
                </div>
              )}

              <button
                onClick={startGame}
                className="rounded-aero-lg px-12 py-3 text-base font-bold transition-all active:scale-95 hover:brightness-110"
                style={{
                  background: 'linear-gradient(135deg, #00d4ff, #0099cc)',
                  color: '#000',
                  boxShadow: '0 6px 24px rgba(0,212,255,0.40)',
                }}
              >
                Play
              </button>

              <div className="flex items-center gap-6 text-xs" style={{ color: 'var(--text-muted)' }}>
                <span>🔵 Large = 10pts</span>
                <span>🟡 Medium = 20pts</span>
                <span>🔴 Small = 30pts</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Playing: bubbles ── */}
        {gameState === 'playing' && bubbles.map(bubble => (
          <div
            key={bubble.id}
            onClick={bubble.popped ? undefined : (e) => popBubble(bubble, e)}
            style={{
              position: 'absolute',
              bottom: '-5%',
              left: `${bubble.x}%`,
              width: bubble.size,
              height: bubble.size,
              borderRadius: '50%',
              cursor: bubble.popped ? 'default' : 'pointer',
              background: bubbleGradient(bubble.hue),
              border: '1px solid rgba(255,255,255,0.72)',
              boxShadow: `inset 0 0 ${bubble.size * 0.3}px rgba(255,255,255,0.50), inset -2px -3px 6px rgba(120,190,255,0.30), 0 2px 8px rgba(0,100,180,0.12)`,
              animation: bubble.popped
                ? 'bubble-pop 0.32s ease-out forwards'
                : `bubble-float-up ${bubble.duration}ms linear forwards`,
              transformOrigin: 'center center',
              willChange: 'transform, opacity',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '18%', left: '22%',
                width: '28%', height: '18%',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.75)',
                filter: 'blur(2px)',
                pointerEvents: 'none',
              }}
            />
          </div>
        ))}

        {/* Combo banner */}
        {gameState === 'playing' && combo >= 3 && (
          <div
            className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full px-5 py-1.5 text-sm font-bold animate-fade-in"
            style={{
              background: combo >= 5 ? 'rgba(255,140,0,0.90)' : 'rgba(0,212,255,0.90)',
              color: '#000',
              boxShadow: combo >= 5 ? '0 0 18px rgba(255,140,0,0.55)' : '0 0 18px rgba(0,212,255,0.55)',
              zIndex: 20,
            }}
          >
            {combo >= 5 ? `🔥 ${combo}× COMBO!` : `✨ ${combo}× Combo`}
          </div>
        )}

        {/* Float texts */}
        {floatTexts.map(ft => (
          <div
            key={ft.id}
            style={{
              position: 'absolute',
              left: ft.x - 20,
              top: ft.y - 10,
              pointerEvents: 'none',
              fontWeight: 700,
              fontSize: 14,
              color: ft.color,
              textShadow: `0 0 8px ${ft.color}`,
              animation: 'score-float 0.7s ease-out forwards',
              zIndex: 30,
              whiteSpace: 'nowrap',
            }}
          >
            {ft.text}
          </div>
        ))}

        {/* ── Game over ── */}
        {gameState === 'gameover' && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-5"
            style={{ background: 'rgba(0,0,0,0.60)', backdropFilter: 'blur(6px)' }}
          >
            <div style={{ fontSize: 52 }}>💥</div>

            <div className="text-center">
              <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Game Over</p>
              <p className="mt-1 text-4xl font-bold tabular-nums" style={{ color: '#00d4ff' }}>
                {score.toLocaleString()}
              </p>
              {score > 0 && score >= highScore && (
                <p className="mt-2 text-sm font-bold" style={{ color: '#ffd700' }}>🏆 New High Score!</p>
              )}
            </div>

            {highScore > 0 && (
              <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                <Trophy className="h-4 w-4" />
                Best: {highScore.toLocaleString()}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="rounded-aero-lg px-6 py-2.5 text-sm font-semibold transition-all active:scale-95"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: 'var(--text-secondary)',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.13)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'}
              >
                Back to Hub
              </button>
              <button
                onClick={startGame}
                className="rounded-aero-lg px-8 py-2.5 text-sm font-bold transition-all active:scale-95 hover:brightness-110"
                style={{
                  background: 'linear-gradient(135deg, #00d4ff, #0099cc)',
                  color: '#000',
                  boxShadow: '0 4px 18px rgba(0,212,255,0.35)',
                }}
              >
                Play Again
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer — size legend + hint */}
      {gameState === 'playing' && (
        <div
          className="px-6 py-2.5 flex items-center justify-center gap-5 flex-shrink-0 text-[11px]"
          style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--panel-divider)' }}
        >
          <div className="flex items-center gap-1.5">
            <span className="inline-block rounded-full" style={{ width: 10, height: 10, background: '#4fc3f7', border: '1px solid rgba(255,255,255,0.4)', flexShrink: 0 }} />
            <span>Large = 10pts</span>
          </div>
          <span style={{ opacity: 0.3 }}>·</span>
          <div className="flex items-center gap-1.5">
            <span className="inline-block rounded-full" style={{ width: 8, height: 8, background: '#ffd54f', border: '1px solid rgba(255,255,255,0.4)', flexShrink: 0 }} />
            <span>Medium = 20pts</span>
          </div>
          <span style={{ opacity: 0.3 }}>·</span>
          <div className="flex items-center gap-1.5">
            <span className="inline-block rounded-full" style={{ width: 6, height: 6, background: '#ef9a9a', border: '1px solid rgba(255,255,255,0.4)', flexShrink: 0 }} />
            <span>Small = 30pts</span>
          </div>
          <span style={{ opacity: 0.3 }}>·</span>
          <span>Chain pops = combo ×</span>
        </div>
      )}
    </div>
  );
}
