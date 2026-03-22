import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, RotateCcw, Trophy } from 'lucide-react';
import { useCornerStore } from '../../../store/cornerStore';

// ── Constants ─────────────────────────────────────────────────────────────────
const SIZE     = 4;
const CELL     = 80;
const GAP      = 10;
const BOARD    = SIZE * CELL + (SIZE + 1) * GAP;
const HS_KEY   = 'aero_2048_best';

// ── Tile visuals ──────────────────────────────────────────────────────────────
interface TileCfg { bg: string; color: string; glow: string; fs: number }

const TILE_CFG: Record<number, TileCfg> = {
  2:    { bg: 'rgba(255,255,255,0.82)',                                          color: '#1a3553', glow: 'none',                              fs: 30 },
  4:    { bg: 'rgba(188,234,255,0.84)',                                          color: '#1a3553', glow: '0 2px 12px rgba(0,180,255,0.16)',   fs: 30 },
  8:    { bg: 'rgba(0,202,248,0.80)',                                            color: '#fff',    glow: '0 4px 18px rgba(0,185,240,0.42)',   fs: 30 },
  16:   { bg: 'rgba(0,162,255,0.82)',                                            color: '#fff',    glow: '0 4px 20px rgba(0,140,255,0.44)',   fs: 30 },
  32:   { bg: 'rgba(0,212,158,0.82)',                                            color: '#fff',    glow: '0 4px 20px rgba(0,190,135,0.46)',   fs: 30 },
  64:   { bg: 'rgba(30,196,86,0.84)',                                            color: '#fff',    glow: '0 4px 22px rgba(0,168,55,0.46)',    fs: 30 },
  128:  { bg: 'rgba(252,210,0,0.90)',                                            color: '#5a3800', glow: '0 4px 22px rgba(212,155,0,0.50)',   fs: 28 },
  256:  { bg: 'rgba(255,148,38,0.90)',                                           color: '#fff',    glow: '0 4px 24px rgba(210,88,0,0.52)',    fs: 28 },
  512:  { bg: 'rgba(238,62,62,0.88)',                                            color: '#fff',    glow: '0 4px 26px rgba(180,18,18,0.54)',   fs: 28 },
  1024: { bg: 'rgba(162,78,248,0.88)',                                           color: '#fff',    glow: '0 4px 28px rgba(118,0,222,0.58)',   fs: 22 },
  2048: { bg: 'linear-gradient(135deg, #ffd700 0%, #ff9200 50%, #ff3800 100%)', color: '#fff',    glow: '0 6px 34px rgba(255,132,0,0.72)',   fs: 22 },
};

function getTile(v: number): TileCfg {
  return TILE_CFG[v] ?? { bg: 'rgba(100,0,200,0.88)', color: '#fff', glow: '0 6px 32px rgba(110,0,200,0.66)', fs: 18 };
}

// ── Pure game logic ────────────────────────────────────────────────────────────
type Grid = number[][];
type Dir  = 'up' | 'down' | 'left' | 'right';

function emptyGrid(): Grid {
  return Array.from({ length: SIZE }, () => new Array(SIZE).fill(0));
}

function emptyCells(g: Grid): { r: number; c: number }[] {
  const out: { r: number; c: number }[] = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (g[r][c] === 0) out.push({ r, c });
  return out;
}

function spawnTile(g: Grid): { grid: Grid; pos: { r: number; c: number } | null } {
  const cells = emptyCells(g);
  if (cells.length === 0) return { grid: g, pos: null };
  const pos = cells[Math.floor(Math.random() * cells.length)];
  const next = g.map(row => [...row]);
  next[pos.r][pos.c] = Math.random() < 0.88 ? 2 : 4;
  return { grid: next, pos };
}

function slideLine(line: number[]): { out: number[]; gained: number; mergeIdx: Set<number> } {
  const nums  = line.filter(n => n > 0);
  const out   = new Array(SIZE).fill(0);
  const mergeIdx = new Set<number>();
  let gained = 0, i = 0, oi = 0;
  while (i < nums.length) {
    if (i + 1 < nums.length && nums[i] === nums[i + 1]) {
      out[oi] = nums[i] * 2;
      mergeIdx.add(oi);
      gained += out[oi];
      i += 2;
    } else {
      out[oi] = nums[i++];
    }
    oi++;
  }
  return { out, gained, mergeIdx };
}

function moveGrid(g: Grid, dir: Dir): { grid: Grid; gained: number; moved: boolean; mergedAt: Set<string> } {
  const next     = emptyGrid();
  const mergedAt = new Set<string>();
  let gained = 0, moved = false;

  if (dir === 'left' || dir === 'right') {
    for (let r = 0; r < SIZE; r++) {
      const fwd   = dir === 'right';
      const line  = fwd ? [...g[r]].reverse() : [...g[r]];
      const { out, gained: g2, mergeIdx } = slideLine(line);
      gained += g2;
      for (let c = 0; c < SIZE; c++) {
        const pc = fwd ? SIZE - 1 - c : c;
        next[r][pc] = fwd ? out[SIZE - 1 - c] : out[c];
        if (mergeIdx.has(c)) mergedAt.add(`${r},${pc}`);
        if (next[r][pc] !== g[r][pc]) moved = true;
      }
    }
  } else {
    for (let c = 0; c < SIZE; c++) {
      const fwd  = dir === 'down';
      const col  = g.map(row => row[c]);
      const line = fwd ? [...col].reverse() : col;
      const { out, gained: g2, mergeIdx } = slideLine(line);
      gained += g2;
      for (let r = 0; r < SIZE; r++) {
        const pr = fwd ? SIZE - 1 - r : r;
        next[pr][c] = fwd ? out[SIZE - 1 - r] : out[r];
        if (mergeIdx.has(r)) mergedAt.add(`${pr},${c}`);
        if (next[pr][c] !== g[pr][c]) moved = true;
      }
    }
  }

  return { grid: next, gained, moved, mergedAt };
}

function canMove(g: Grid): boolean {
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      if (g[r][c] === 0) return true;
      if (c + 1 < SIZE && g[r][c] === g[r][c + 1]) return true;
      if (r + 1 < SIZE && g[r][c] === g[r + 1][c]) return true;
    }
  return false;
}

function hasWon(g: Grid): boolean {
  return g.some(row => row.some(v => v >= 2048));
}

// ── Tile animation record ─────────────────────────────────────────────────────
let _uid = 1;

interface TileAnim {
  key:      number;
  value:    number;
  r:        number;
  c:        number;
  isNew:    boolean;
  isMerged: boolean;
}

function gridToAnims(g: Grid, mergedAt: Set<string>, newAt: Set<string>): TileAnim[] {
  const out: TileAnim[] = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (g[r][c] > 0)
        out.push({ key: _uid++, value: g[r][c], r, c,
          isNew:    newAt.has(`${r},${c}`),
          isMerged: mergedAt.has(`${r},${c}`),
        });
  return out;
}

// ── Component ─────────────────────────────────────────────────────────────────
type Status = 'playing' | 'won' | 'over';

export function TwentyFortyEight() {
  const { selectGame } = useCornerStore();

  function freshGame() {
    let g = emptyGrid();
    g = spawnTile(g).grid;
    g = spawnTile(g).grid;
    return g;
  }

  const [grid,   setGrid]   = useState<Grid>(freshGame);
  const [score,  setScore]  = useState(0);
  const [best,   setBest]   = useState(() => Number(localStorage.getItem(HS_KEY) ?? '0'));
  const [status, setStatus] = useState<Status>('playing');
  const [anims,  setAnims]  = useState<TileAnim[]>([]);

  const gridRef   = useRef(grid);
  const statusRef = useRef(status);
  gridRef.current   = grid;
  statusRef.current = status;

  const animTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function applyAnims(g: Grid, mergedAt: Set<string>, newAt: Set<string>) {
    setAnims(gridToAnims(g, mergedAt, newAt));
    if (animTimer.current) clearTimeout(animTimer.current);
    animTimer.current = setTimeout(
      () => setAnims(prev => prev.map(t => ({ ...t, isNew: false, isMerged: false }))),
      220,
    );
  }

  // Initial board
  useEffect(() => {
    const allNew = new Set<string>();
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (grid[r][c] > 0) allNew.add(`${r},${c}`);
    applyAnims(grid, new Set(), allNew);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const move = useCallback((dir: Dir) => {
    if (statusRef.current === 'over') return;

    const cur = gridRef.current;
    const { grid: next, gained, moved, mergedAt } = moveGrid(cur, dir);
    if (!moved) return;

    const { grid: withNew, pos } = spawnTile(next);
    const newAt = new Set<string>();
    if (pos) newAt.add(`${pos.r},${pos.c}`);

    setGrid(withNew);
    applyAnims(withNew, mergedAt, newAt);

    setScore(s => {
      const ns = s + gained;
      setBest(b => {
        const nb = Math.max(b, ns);
        localStorage.setItem(HS_KEY, String(nb));
        return nb;
      });
      return ns;
    });

    if (hasWon(withNew) && statusRef.current === 'playing') setStatus('won');
    else if (!canMove(withNew))                              setStatus('over');
  }, []);

  // Mouse / touch drag
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    dragStart.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    dragStart.current = null;
    const THRESHOLD = 24;
    if (Math.abs(dx) < THRESHOLD && Math.abs(dy) < THRESHOLD) return;
    const dir: Dir = Math.abs(dx) >= Math.abs(dy)
      ? (dx > 0 ? 'right' : 'left')
      : (dy > 0 ? 'down'  : 'up');
    move(dir);
  }

  function restart() {
    const g = freshGame();
    setGrid(g);
    setScore(0);
    setStatus('playing');
    const allNew = new Set<string>();
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (g[r][c] > 0) allNew.add(`${r},${c}`);
    applyAnims(g, new Set(), allNew);
  }

  function keepPlaying() { setStatus('playing'); }

  return (
    <div className="flex h-full flex-col select-none">

      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-5 py-3.5 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--panel-divider)' }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => selectGame(null)}
            className="flex h-8 w-8 items-center justify-center rounded-xl transition-all"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.12)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>2048</p>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Merge tiles, reach 2048!</p>
          </div>
        </div>

        {/* Score chips + restart */}
        <div className="flex items-center gap-2">
          {([{ label: 'SCORE', value: score }, { label: 'BEST', value: best }] as const).map(chip => (
            <div
              key={chip.label}
              className="flex flex-col items-center rounded-aero px-3 py-1.5"
              style={{ background: 'rgba(0,212,255,0.10)', border: '1px solid rgba(0,212,255,0.22)', minWidth: 62 }}
            >
              <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.10em' }}>
                {chip.label}
              </span>
              <span style={{ fontSize: 17, color: 'var(--text-primary)', fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
                {chip.value}
              </span>
            </div>
          ))}
          <button
            onClick={restart}
            className="flex h-8 w-8 items-center justify-center rounded-xl transition-all"
            style={{ background: 'rgba(0,212,255,0.10)', border: '1px solid rgba(0,212,255,0.22)', color: '#00d4ff' }}
            title="New game"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Board ── */}
      <div className="flex flex-1 items-center justify-center overflow-hidden p-4">
        <div
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          style={{ position: 'relative', width: BOARD, height: BOARD, flexShrink: 0, cursor: 'grab', touchAction: 'none' }}
        >

          {/* Grid cell backgrounds */}
          {Array.from({ length: SIZE }, (_, r) =>
            Array.from({ length: SIZE }, (_, c) => (
              <div
                key={`bg-${r}-${c}`}
                style={{
                  position: 'absolute',
                  left: GAP + c * (CELL + GAP),
                  top:  GAP + r * (CELL + GAP),
                  width: CELL, height: CELL,
                  borderRadius: 14,
                  background: 'rgba(0,0,0,0.10)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
              />
            ))
          )}

          {/* Tiles */}
          {anims.map(tile => {
            const cfg = getTile(tile.value);
            return (
              <div
                key={tile.key}
                style={{
                  position: 'absolute',
                  left: GAP + tile.c * (CELL + GAP),
                  top:  GAP + tile.r * (CELL + GAP),
                  width: CELL, height: CELL,
                  borderRadius: 14,
                  background: cfg.bg,
                  boxShadow: cfg.glow !== 'none' ? cfg.glow : undefined,
                  border: '1px solid rgba(255,255,255,0.38)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: cfg.fs,
                  color: cfg.color,
                  fontFamily: 'Inter, system-ui, sans-serif',
                  overflow: 'hidden',
                  animation: tile.isNew
                    ? 'tile2048-spawn 0.20s cubic-bezier(0.34,1.56,0.64,1) both'
                    : tile.isMerged
                    ? 'tile2048-merge 0.18s cubic-bezier(0.34,1.56,0.64,1) both'
                    : 'none',
                }}
              >
                {/* Gloss sheen */}
                <div style={{
                  position: 'absolute', inset: 0, pointerEvents: 'none',
                  background: 'linear-gradient(168deg, rgba(255,255,255,0.58) 0%, rgba(255,255,255,0.20) 42%, rgba(255,255,255,0) 65%)',
                  borderRadius: 14,
                }} />
                <span style={{ position: 'relative', zIndex: 1, lineHeight: 1, letterSpacing: '-0.5px' }}>
                  {tile.value}
                </span>
              </div>
            );
          })}

          {/* Win overlay */}
          {status === 'won' && (
            <div style={{
              position: 'absolute', inset: 0, borderRadius: 16,
              background: 'rgba(255,210,0,0.88)',
              backdropFilter: 'blur(6px)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 14,
              animation: 'tile2048-spawn 0.25s cubic-bezier(0.34,1.20,0.64,1) both',
            }}>
              <Trophy className="h-14 w-14" style={{ color: '#7a4200', filter: 'drop-shadow(0 4px 8px rgba(100,40,0,0.35))' }} />
              <p style={{ fontSize: 32, fontWeight: 900, color: '#5a3000', letterSpacing: '-1px' }}>You Win!</p>
              <p style={{ fontSize: 13, color: '#7a4800', opacity: 0.80 }}>Score: {score}</p>
              <div className="flex gap-2">
                <button
                  onClick={keepPlaying}
                  className="rounded-aero px-4 py-2 font-bold text-sm transition-all"
                  style={{ background: 'rgba(120,60,0,0.15)', border: '1px solid rgba(120,60,0,0.40)', color: '#5a3000' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(120,60,0,0.25)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(120,60,0,0.15)'}
                >
                  Keep Going
                </button>
                <button
                  onClick={restart}
                  className="rounded-aero px-4 py-2 font-bold text-sm transition-all"
                  style={{ background: 'rgba(120,60,0,0.28)', border: '1px solid rgba(120,60,0,0.55)', color: '#5a3000' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(120,60,0,0.40)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(120,60,0,0.28)'}
                >
                  New Game
                </button>
              </div>
            </div>
          )}

          {/* Game over overlay */}
          {status === 'over' && (
            <div style={{
              position: 'absolute', inset: 0, borderRadius: 16,
              background: 'rgba(8,18,50,0.90)',
              backdropFilter: 'blur(6px)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 14,
              animation: 'tile2048-spawn 0.25s cubic-bezier(0.34,1.20,0.64,1) both',
            }}>
              <p style={{ fontSize: 32, fontWeight: 900, color: '#dce8ff', letterSpacing: '-1px' }}>Game Over</p>
              <p style={{ fontSize: 13, color: '#8aabde' }}>Score: {score}</p>
              <button
                onClick={restart}
                className="rounded-aero px-5 py-2 font-bold text-sm transition-all"
                style={{ background: 'rgba(0,212,255,0.14)', border: '1px solid rgba(0,212,255,0.40)', color: '#00d4ff' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(0,212,255,0.24)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(0,212,255,0.14)'}
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Footer hint ── */}
      <p className="pb-4 text-center flex-shrink-0" style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.65 }}>
        Click and drag on the board to move tiles
      </p>
    </div>
  );
}
