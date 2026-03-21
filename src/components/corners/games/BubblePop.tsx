import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Trophy } from 'lucide-react';
import { useCornerStore } from '../../../store/cornerStore';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Bubble {
  id: number;
  col: number;       // 0–1 starting X fraction of area width
  size: number;      // diameter px
  hue: number;
  points: number;
  startTime: number; // performance.now()
  duration: number;  // ms to travel full height
  amplitude: number; // px of lateral sway
  phase: number;     // sine wave phase offset
}

interface RenderBubble extends Bubble {
  cx: number;      // center X in px (game area coords)
  cy: number;      // center Y in px (game area coords)
  opacity: number;
  sx: number;
  sy: number;
}

interface FloatText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
}

type GameState = 'idle' | 'playing' | 'gameover';

const HS_KEY    = 'aero_bubblepop_hs';
const MAX_LIVES = 5;
const HIT_PAD   = 14; // extra px forgiveness beyond bubble radius

const COMBO_COLORS = ['#ffffff', '#00d4ff', '#ffd700', '#ff8c00', '#ff4040'];

const IDLE_BUBBLES = [
  { col: 0.10, size: 52, hue: 195, delay: 0    },
  { col: 0.28, size: 36, hue: 260, delay: 0.9  },
  { col: 0.50, size: 60, hue: 160, delay: 1.7  },
  { col: 0.68, size: 42, hue: 220, delay: 0.5  },
  { col: 0.82, size: 32, hue: 300, delay: 1.3  },
  { col: 0.92, size: 46, hue: 30,  delay: 2.1  },
];

function getHS(): number  { try { return parseInt(localStorage.getItem(HS_KEY) ?? '0', 10) || 0; } catch { return 0; } }
function saveHS(s: number) { try { localStorage.setItem(HS_KEY, String(s)); } catch {} }

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

// ── Main component ─────────────────────────────────────────────────────────────

export function BubblePop() {
  const { selectGame } = useCornerStore();
  const onBack = () => selectGame(null);

  const [gameState,    setGameState]    = useState<GameState>('idle');
  const [score,        setScore]        = useState(0);
  const [lives,        setLives]        = useState(MAX_LIVES);
  const [level,        setLevel]        = useState(1);
  const [combo,        setCombo]        = useState(0);
  const [hits,         setHits]         = useState(0);
  const [misses,       setMisses]       = useState(0);
  const [renderBubs,   setRenderBubs]   = useState<RenderBubble[]>([]);
  const [floatTexts,   setFloatTexts]   = useState<FloatText[]>([]);
  const [highScore,    setHighScore]    = useState(getHS);

  // Canonical refs (used inside RAF / timeouts without stale closure issues)
  const bubblesRef    = useRef<Bubble[]>([]);
  const poppedRef     = useRef<Set<number>>(new Set());
  const rafRef        = useRef<number>(0);
  const spawnTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const levelTimer    = useRef<ReturnType<typeof setInterval> | null>(null);
  const comboTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const areaRef       = useRef<HTMLDivElement>(null);
  const renderBubsRef = useRef<RenderBubble[]>([]);
  const nextId        = useRef(0);
  const floatId       = useRef(0);
  const gameStartRef  = useRef(0); // performance.now() when game started

  // Sync hot refs
  const gsRef    = useRef<GameState>('idle');
  const livesRef = useRef(MAX_LIVES);
  const scoreRef = useRef(0);
  const levelRef = useRef(1);
  const comboRef = useRef(0);
  const hitsRef  = useRef(0);
  const missesRef = useRef(0);
  gsRef.current    = gameState;
  livesRef.current = lives;
  scoreRef.current = score;
  levelRef.current = level;
  comboRef.current = combo;
  hitsRef.current  = hits;
  missesRef.current = misses;
  renderBubsRef.current = renderBubs;

  // ── RAF loop ───────────────────────────────────────────────────────────────

  const tick = useCallback(() => {
    if (gsRef.current !== 'playing') return;
    const area = areaRef.current;
    if (!area) { rafRef.current = requestAnimationFrame(tick); return; }

    const W = area.clientWidth;
    const H = area.clientHeight;
    const now = performance.now();
    const rendered: RenderBubble[] = [];
    let escaped = 0;

    for (const b of bubblesRef.current) {
      if (poppedRef.current.has(b.id)) continue;
      const progress = (now - b.startTime) / b.duration;

      if (progress >= 1) {
        escaped++;
        continue;
      }

      // Y: starts at H + size/2 (below screen), rises to -size/2 (above screen)
      const cy = (H + b.size) * (1 - progress) - b.size / 2;
      // X: sinusoidal sway
      const cx = b.col * W + b.amplitude * Math.sin(progress * Math.PI * 2 + b.phase);
      // Opacity: fade in / fade out
      const opacity = progress < 0.05 ? progress / 0.05
                    : progress > 0.88 ? (1 - progress) / 0.12
                    : 1;
      // Subtle organic wobble
      const wobble = Math.sin(progress * Math.PI * 5 + b.phase);
      const sx = 1 + wobble * 0.018;
      const sy = 1 - wobble * 0.018;

      rendered.push({ ...b, cx, cy, opacity, sx, sy });
    }

    setRenderBubs(rendered);

    if (escaped > 0) {
      bubblesRef.current = bubblesRef.current.filter(b => {
        const progress = (now - b.startTime) / b.duration;
        return !(!poppedRef.current.has(b.id) && progress >= 1);
      });

      const newLives = Math.max(0, livesRef.current - escaped);
      livesRef.current = newLives;
      setLives(newLives);
      if (newLives <= 0) { endGame(); return; }
    }

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  // ── Spawn ──────────────────────────────────────────────────────────────────

  const scheduleSpawn = useCallback(() => {
    if (gsRef.current !== 'playing') return;
    // Time-based continuous difficulty curve:
    // t=0s  → ~1400ms between spawns (~3 bubbles on screen)
    // t=20s → ~950ms  (~5 bubbles)
    // t=40s → ~600ms  (~7-8 bubbles)
    // t=60s → ~350ms min (challenging)
    const elapsed = (performance.now() - gameStartRef.current) / 1000;
    const delay = Math.max(350, 1400 - elapsed * 17) + Math.random() * 200;
    spawnTimer.current = setTimeout(() => {
      if (gsRef.current !== 'playing') return;
      const id        = ++nextId.current;
      const size      = 30 + Math.random() * 44;
      const col       = 0.05 + Math.random() * 0.88;
      // Bubbles get slightly faster over time (start slow and floaty)
      const elapsedNow = (performance.now() - gameStartRef.current) / 1000;
      const duration  = Math.max(2800, 5200 - elapsedNow * 28) + Math.random() * 600;
      const hue       = Math.random() * 360;
      const points    = size < 42 ? 30 : size < 58 ? 20 : 10;
      const amplitude = 18 + Math.random() * 22;
      const phase     = Math.random() * Math.PI * 2;
      bubblesRef.current = [...bubblesRef.current, { id, col, size, hue, points, startTime: performance.now(), duration, amplitude, phase }];
      scheduleSpawn();
    }, delay);
  }, []);

  // ── Game control ───────────────────────────────────────────────────────────

  function startGame() {
    bubblesRef.current = [];
    poppedRef.current.clear();
    setRenderBubs([]); setFloatTexts([]);
    setScore(0);     scoreRef.current  = 0;
    setLives(MAX_LIVES); livesRef.current = MAX_LIVES;
    setLevel(1);     levelRef.current  = 1;
    setCombo(0);     comboRef.current  = 0;
    setHits(0);      hitsRef.current   = 0;
    setMisses(0);    missesRef.current = 0;
    gameStartRef.current = performance.now();
    gsRef.current = 'playing';
    setGameState('playing');
  }

  function endGame() {
    gsRef.current = 'gameover';
    setGameState('gameover');
    cancelAnimationFrame(rafRef.current);
    if (spawnTimer.current) clearTimeout(spawnTimer.current);
    if (levelTimer.current) clearInterval(levelTimer.current);
    setHighScore(prev => { const f = Math.max(prev, scoreRef.current); saveHS(f); return f; });
  }

  useEffect(() => {
    if (gameState !== 'playing') return;
    rafRef.current = requestAnimationFrame(tick);
    scheduleSpawn();
    levelTimer.current = setInterval(() => {
      setLevel(l => { const n = Math.min(9, l + 1); levelRef.current = n; return n; });
    }, 8_000);
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (spawnTimer.current) clearTimeout(spawnTimer.current);
      if (levelTimer.current) clearInterval(levelTimer.current);
    };
  }, [gameState, tick, scheduleSpawn]);

  // ── Click handling ─────────────────────────────────────────────────────────

  function handleAreaClick(e: React.MouseEvent<HTMLDivElement>) {
    if (gsRef.current !== 'playing') return;
    const rect = areaRef.current!.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    // Find nearest bubble within hit radius
    let best: RenderBubble | null = null;
    let bestDist = Infinity;
    for (const rb of renderBubsRef.current) {
      if (poppedRef.current.has(rb.id)) continue;
      const d = Math.sqrt((cx - rb.cx) ** 2 + (cy - rb.cy) ** 2);
      if (d <= rb.size / 2 + HIT_PAD && d < bestDist) { bestDist = d; best = rb; }
    }

    if (best) {
      popBubble(best, cx, cy);
    } else {
      const m = missesRef.current + 1;
      missesRef.current = m;
      setMisses(m);
    }
  }

  function popBubble(rb: RenderBubble, clickX: number, clickY: number) {
    poppedRef.current.add(rb.id);
    bubblesRef.current = bubblesRef.current.filter(b => b.id !== rb.id);

    const newCombo = comboRef.current + 1;
    comboRef.current = newCombo;
    setCombo(newCombo);
    if (comboTimer.current) clearTimeout(comboTimer.current);
    comboTimer.current = setTimeout(() => { comboRef.current = 0; setCombo(0); }, 1200);

    const multiplier = Math.min(newCombo, 5);
    const earned     = rb.points * multiplier;
    const newScore   = scoreRef.current + earned;
    scoreRef.current = newScore;
    setScore(newScore);

    const newHits = hitsRef.current + 1;
    hitsRef.current = newHits;
    setHits(newHits);

    // Float text
    const fid   = ++floatId.current;
    const color = COMBO_COLORS[Math.min(newCombo - 1, 4)];
    const text  = multiplier > 1 ? `×${multiplier} +${earned}` : `+${earned}`;
    setFloatTexts(prev => [...prev, { id: fid, x: clickX, y: clickY, text, color }]);
    setTimeout(() => setFloatTexts(prev => prev.filter(f => f.id !== fid)), 700);
  }

  // Derived
  const totalShots = hits + misses;
  const accuracy   = totalShots > 0 ? Math.round(hits / totalShots * 100) : 100;
  const comboColor = combo > 0 ? COMBO_COLORS[Math.min(combo - 1, 4)] : '#fff';

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col" style={{ userSelect: 'none' }}>

      {/* Header */}
      <div
        className="flex items-center gap-4 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--panel-divider)', paddingLeft: 24, paddingRight: 24 }}
      >
        <button
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded-xl transition-all flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text-muted)' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.12)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2 flex-1">
          <span style={{ fontSize: 20 }}>🫧</span>
          <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Bubble Pop</p>
        </div>

        {/* HUD */}
        {gameState === 'playing' && (
          <div className="flex items-center gap-5">
            {[
              { label: 'Level',    value: String(level),                    color: '#00d4ff' },
              { label: 'Score',    value: score.toLocaleString(),           color: 'var(--text-primary)' },
              { label: 'Accuracy', value: `${accuracy}%`,                  color: accuracy >= 80 ? '#00d4ff' : accuracy >= 55 ? '#ffd700' : '#ff6060' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex flex-col items-center" style={{ minWidth: 44 }}>
                <span className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</span>
                <span className="text-base font-bold tabular-nums" style={{ color }}>{value}</span>
              </div>
            ))}
            <div className="flex items-center gap-0.5 ml-1">
              {Array.from({ length: MAX_LIVES }, (_, i) => (
                <span key={i} style={{ opacity: i < lives ? 1 : 0.18, fontSize: 18, transition: 'opacity 0.25s' }}>🫧</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Game area */}
      <div
        ref={areaRef}
        className="relative flex-1 overflow-hidden"
        style={{ cursor: gameState === 'playing' ? 'crosshair' : 'default' }}
        onClick={handleAreaClick}
      >

        {/* ── Frutiger Aero background ── */}
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
          {/* Deep navy base */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(165deg, #020d24 0%, #041533 45%, #071f42 100%)' }} />
          {/* Cyan glow — top right */}
          <div style={{
            position: 'absolute', top: '-20%', right: '-10%',
            width: '60%', height: '60%', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0,190,255,0.22) 0%, transparent 68%)',
            filter: 'blur(55px)',
          }} />
          {/* Royal blue — bottom left */}
          <div style={{
            position: 'absolute', bottom: '-20%', left: '-12%',
            width: '65%', height: '65%', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0,80,230,0.28) 0%, transparent 68%)',
            filter: 'blur(65px)',
          }} />
          {/* Teal accent — mid */}
          <div style={{
            position: 'absolute', top: '30%', left: '28%',
            width: '40%', height: '40%', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0,220,195,0.13) 0%, transparent 65%)',
            filter: 'blur(70px)',
          }} />
          {/* Subtle grid */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'linear-gradient(rgba(0,180,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,180,255,0.04) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }} />
          {/* Bottom shimmer line */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 1,
            background: 'linear-gradient(90deg, transparent 0%, rgba(0,212,255,0.25) 50%, transparent 100%)',
          }} />
        </div>

        {/* ── Idle screen ── */}
        {gameState === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-8 text-center" style={{ zIndex: 5 }}>
            {IDLE_BUBBLES.map(b => (
              <div
                key={b.col}
                className="absolute rounded-full pointer-events-none"
                style={{
                  width: b.size, height: b.size,
                  left: `${b.col * 100}%`,
                  bottom: '-8%',
                  background: bubbleGradient(b.hue),
                  border: '1px solid rgba(255,255,255,0.65)',
                  boxShadow: 'inset 0 0 8px rgba(255,255,255,0.45)',
                  animation: `bubble-idle 3.5s ${b.delay}s ease-in-out infinite`,
                }}
              />
            ))}

            <div className="relative z-10 flex flex-col items-center gap-5">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl"
                style={{ background: 'rgba(0,212,255,0.12)', border: '1px solid rgba(0,212,255,0.30)', boxShadow: '0 0 40px rgba(0,212,255,0.20)', fontSize: 42 }}>
                🫧
              </div>
              <div>
                <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Bubble Pop</p>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-muted)', maxWidth: 340 }}>
                  Pop bubbles before they float away!<br />
                  Small bubbles = more points. Chain for combos.
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
                style={{ background: 'linear-gradient(135deg, #00d4ff, #0099cc)', color: '#000', boxShadow: '0 6px 24px rgba(0,212,255,0.40)' }}
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

        {/* ── Live bubbles (RAF positioned) ── */}
        {gameState === 'playing' && renderBubs.map(rb => (
          <div
            key={rb.id}
            style={{
              position: 'absolute',
              left: 0, top: 0,
              width: rb.size,
              height: rb.size,
              borderRadius: '50%',
              background: bubbleGradient(rb.hue),
              border: '1px solid rgba(255,255,255,0.72)',
              boxShadow: `inset 0 0 ${rb.size * 0.28}px rgba(255,255,255,0.55), inset -2px -3px 6px rgba(120,190,255,0.30), 0 3px 14px rgba(0,100,200,0.22)`,
              opacity: rb.opacity,
              // Single GPU-composited transform — also what the hit zone matches
              transform: `translate(${rb.cx - rb.size / 2}px, ${rb.cy - rb.size / 2}px) scale(${rb.sx}, ${rb.sy})`,
              willChange: 'transform, opacity',
              pointerEvents: 'none',
              zIndex: 5,
            }}
          >
            <div style={{ position: 'absolute', top: '16%', left: '20%', width: '30%', height: '20%', borderRadius: '50%', background: 'rgba(255,255,255,0.80)', filter: 'blur(2px)', pointerEvents: 'none' }} />
          </div>
        ))}

        {/* ── Combo display ── */}
        {gameState === 'playing' && combo > 0 && (
          <div
            key={combo}
            className="absolute pointer-events-none"
            style={{ top: '22%', left: '50%', zIndex: 20, animation: 'combo-pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}
          >
            <div style={{
              transform: 'translateX(-50%)',
              fontSize: Math.min(56 + combo * 7, 96),
              fontWeight: 900,
              lineHeight: 1,
              color: comboColor,
              textShadow: `0 0 24px ${comboColor}, 0 0 50px ${comboColor}77`,
              whiteSpace: 'nowrap',
            }}>
              ×{combo}
            </div>
            {combo >= 3 && (
              <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: comboColor, marginTop: 5, transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>
                {combo >= 5 ? '🔥 ULTRA COMBO!' : '✨ COMBO!'}
              </div>
            )}
          </div>
        )}

        {/* ── Float texts ── */}
        {floatTexts.map(ft => (
          <div
            key={ft.id}
            style={{
              position: 'absolute',
              left: ft.x - 22, top: ft.y - 12,
              pointerEvents: 'none',
              fontWeight: 800, fontSize: 14,
              color: ft.color,
              textShadow: `0 0 8px ${ft.color}`,
              animation: 'score-float 0.7s ease-out forwards',
              zIndex: 30, whiteSpace: 'nowrap',
            }}
          >
            {ft.text}
          </div>
        ))}

        {/* ── Game over ── */}
        {gameState === 'gameover' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5"
            style={{ background: 'rgba(2,13,36,0.72)', backdropFilter: 'blur(8px)', zIndex: 40 }}>
            <div style={{ fontSize: 52 }}>💥</div>
            <div className="text-center">
              <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Game Over</p>
              <p className="mt-1 text-4xl font-bold tabular-nums" style={{ color: '#00d4ff' }}>{score.toLocaleString()}</p>
              {score > 0 && score >= highScore && (
                <p className="mt-2 text-sm font-bold" style={{ color: '#ffd700' }}>🏆 New High Score!</p>
              )}
            </div>
            {/* Stats row */}
            <div className="flex items-center gap-8 text-sm">
              {[
                { label: 'Accuracy', value: `${accuracy}%` },
                { label: 'Hits',     value: hits.toString() },
                { label: 'Misses',   value: misses.toString() },
              ].map(({ label, value }) => (
                <div key={label} className="flex flex-col items-center gap-0.5">
                  <span style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
                  <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{value}</span>
                </div>
              ))}
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
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-secondary)' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.13)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'}
              >
                Back to Hub
              </button>
              <button
                onClick={startGame}
                className="rounded-aero-lg px-8 py-2.5 text-sm font-bold transition-all active:scale-95 hover:brightness-110"
                style={{ background: 'linear-gradient(135deg, #00d4ff, #0099cc)', color: '#000', boxShadow: '0 4px 18px rgba(0,212,255,0.35)' }}
              >
                Play Again
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer — size legend */}
      {gameState === 'playing' && (
        <div
          className="px-6 py-2.5 flex items-center justify-center gap-5 flex-shrink-0 text-[11px]"
          style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--panel-divider)' }}
        >
          {[
            { size: 10, color: '#4fc3f7', label: 'Large = 10pts' },
            { size: 8,  color: '#ffd54f', label: 'Medium = 20pts' },
            { size: 6,  color: '#ef9a9a', label: 'Small = 30pts' },
          ].map(({ size, color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="inline-block rounded-full flex-shrink-0"
                style={{ width: size, height: size, background: color, border: '1px solid rgba(255,255,255,0.35)' }} />
              <span>{label}</span>
            </div>
          ))}
          <span style={{ opacity: 0.3 }}>·</span>
          <span>Chain pops = combo ×</span>
        </div>
      )}
    </div>
  );
}
