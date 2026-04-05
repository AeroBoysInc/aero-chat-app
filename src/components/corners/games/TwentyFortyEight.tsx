import { useState, useCallback, useRef } from 'react';
import { ArrowLeft, RotateCcw, Trophy } from 'lucide-react';
import { useCornerStore } from '../../../store/cornerStore';

// ── Constants ─────────────────────────────────────────────────────────────────
const SIZE     = 4;
const CELL     = 80;
const GAP      = 10;
const BOARD    = SIZE * CELL + (SIZE + 1) * GAP;
const HS_KEY   = 'aero_2048_best';
const SLIDE_MS = 150;
const CLEANUP  = SLIDE_MS + 80;

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

// ── Game types ────────────────────────────────────────────────────────────────
type Dir    = 'up' | 'down' | 'left' | 'right';
type Status = 'playing' | 'won' | 'over';

let _tid = 1;

interface Tile {
  id:    number;
  value: number;
  r:     number;
  c:     number;
  /** idle = normal; new = spawn anim; merged = pop anim; dying = invisible, removed after CLEANUP */
  state: 'idle' | 'new' | 'merged' | 'dying';
}

// ── Pure helpers ──────────────────────────────────────────────────────────────
function tileLeft(c: number) { return GAP + c * (CELL + GAP); }
function tileTop(r: number)  { return GAP + r * (CELL + GAP); }

function adjacentCells(r: number, c: number): { r: number; c: number }[] {
  const out: { r: number; c: number }[] = [];
  if (r > 0)      out.push({ r: r - 1, c });
  if (r < SIZE-1) out.push({ r: r + 1, c });
  if (c > 0)      out.push({ r, c: c - 1 });
  if (c < SIZE-1) out.push({ r, c: c + 1 });
  return out;
}

function live(tiles: Tile[]) { return tiles.filter(t => t.state !== 'dying'); }

function buildGrid(tiles: Tile[]): (Tile | null)[][] {
  const g: (Tile | null)[][] = Array.from({ length: SIZE }, () => new Array(SIZE).fill(null));
  for (const t of tiles) g[t.r][t.c] = t;
  return g;
}

function emptySpots(tiles: Tile[]): { r: number; c: number }[] {
  const occ = new Set(live(tiles).map(t => `${t.r},${t.c}`));
  const out: { r: number; c: number }[] = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (!occ.has(`${r},${c}`)) out.push({ r, c });
  return out;
}

function spawnTile(tiles: Tile[]): Tile[] {
  const spots = emptySpots(tiles);
  if (!spots.length) return tiles;
  const pos = spots[Math.floor(Math.random() * spots.length)];
  return [...tiles, { id: _tid++, value: Math.random() < 0.88 ? 2 : 4, r: pos.r, c: pos.c, state: 'new' }];
}

function moveTiles(tiles: Tile[], dir: Dir): { result: Tile[]; gained: number; moved: boolean } {
  const liveTiles = live(tiles);
  const grid      = buildGrid(liveTiles);
  const survivors: Tile[] = [];
  const dying:     Tile[] = [];
  let gained = 0;

  // processLine: `line` is already ordered in the slide direction (leading edge first).
  // `pos(oi)` returns the destination grid coords for output index oi.
  const processLine = (
    line: (Tile | null)[],
    pos:  (oi: number) => { r: number; c: number },
  ) => {
    const ts = line.filter(Boolean) as Tile[];
    let oi = 0, i = 0;
    while (i < ts.length) {
      const dest = pos(oi);
      if (i + 1 < ts.length && ts[i].value === ts[i + 1].value) {
        // ts[i] = survivor (first in slide dir), ts[i+1] = dying (absorbed)
        survivors.push({ ...ts[i],     ...dest, value: ts[i].value * 2, state: 'merged' });
        dying.push(    { ...ts[i + 1],           state: 'dying' });   // keeps original r,c
        gained += ts[i].value * 2;
        i += 2;
      } else {
        survivors.push({ ...ts[i], ...dest, state: 'idle' });
        i++;
      }
      oi++;
    }
  };

  if (dir === 'left' || dir === 'right') {
    const fwd = dir === 'right';
    for (let r = 0; r < SIZE; r++) {
      const row = fwd ? [...grid[r]].reverse() : grid[r];
      processLine(row, oi => ({ r, c: fwd ? SIZE - 1 - oi : oi }));
    }
  } else {
    const fwd = dir === 'down';
    for (let c = 0; c < SIZE; c++) {
      const col  = grid.map(row => row[c]);
      const line = fwd ? [...col].reverse() : col;
      processLine(line, oi => ({ r: fwd ? SIZE - 1 - oi : oi, c }));
    }
  }

  // Detect if anything actually changed
  let moved = dying.length > 0;
  if (!moved) {
    for (const s of survivors) {
      const orig = liveTiles.find(t => t.id === s.id);
      if (orig && (orig.r !== s.r || orig.c !== s.c)) { moved = true; break; }
    }
  }

  return { result: [...survivors, ...dying], gained, moved };
}

function canMove(tiles: Tile[]): boolean {
  const lt = live(tiles);
  if (lt.length < SIZE * SIZE) return true;
  const g = buildGrid(lt);
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      if (c + 1 < SIZE && g[r][c]?.value === g[r][c + 1]?.value) return true;
      if (r + 1 < SIZE && g[r][c]?.value === g[r + 1][c]?.value) return true;
    }
  return false;
}

function hasWon(tiles: Tile[]): boolean {
  return live(tiles).some(t => t.value >= 2048);
}

function freshTiles(): Tile[] {
  return spawnTile(spawnTile([]));
}

// ── Component ─────────────────────────────────────────────────────────────────
export function TwentyFortyEight() {
  const { selectGame } = useCornerStore();

  const [tiles,  setTiles]  = useState<Tile[]>(freshTiles);
  const [score,  setScore]  = useState(0);
  const [best,   setBest]   = useState(() => Number(localStorage.getItem(HS_KEY) ?? '0'));
  const [status, setStatus] = useState<Status>('playing');

  const tilesRef  = useRef(tiles);
  const statusRef = useRef(status);
  tilesRef.current  = tiles;
  statusRef.current = status;

  const animTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const move = useCallback((dir: Dir) => {
    if (statusRef.current === 'over') return;
    const { result, gained, moved } = moveTiles(tilesRef.current, dir);
    if (!moved) return;

    const withNew = spawnTile(result);
    setTiles(withNew);

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

    // Remove dying tiles + reset animation states after slide finishes
    if (animTimer.current) clearTimeout(animTimer.current);
    animTimer.current = setTimeout(() => {
      setTiles(prev =>
        prev
          .filter(t => t.state !== 'dying')
          .map(t => ({ ...t, state: 'idle' })),
      );
    }, CLEANUP);
  }, []);

  // ── Per-tile drag ─────────────────────────────────────────────────────────
  interface DragState { tileId: number; tileRow: number; tileCol: number; x: number; y: number }
  const [drag, setDrag] = useState<DragState | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  function nearestCell(bx: number, by: number) {
    const c = Math.max(0, Math.min(SIZE - 1, Math.round((bx - GAP - CELL / 2) / (CELL + GAP))));
    const r = Math.max(0, Math.min(SIZE - 1, Math.round((by - GAP - CELL / 2) / (CELL + GAP))));
    return { r, c };
  }

  function onTilePointerDown(e: React.PointerEvent, tile: Tile) {
    e.preventDefault();
    e.stopPropagation();
    if (statusRef.current === 'over' || tile.state === 'dying') return;
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDrag({
      tileId: tile.id, tileRow: tile.r, tileCol: tile.c,
      x: e.clientX - rect.left - CELL / 2,
      y: e.clientY - rect.top  - CELL / 2,
    });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onBoardPointerMove(e: React.PointerEvent) {
    if (!drag) return;
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDrag(d => d ? {
      ...d,
      x: e.clientX - rect.left - CELL / 2,
      y: e.clientY - rect.top  - CELL / 2,
    } : null);
  }

  function onBoardPointerUp(e: React.PointerEvent) {
    if (!drag) return;
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const { r: tr, c: tc } = nearestCell(e.clientX - rect.left, e.clientY - rect.top);
    const dr = tr - drag.tileRow;
    const dc = tc - drag.tileCol;
    setDrag(null);
    if (dr === 0 && dc === 0) return;
    const dir: Dir = Math.abs(dc) >= Math.abs(dr)
      ? (dc > 0 ? 'right' : 'left')
      : (dr > 0 ? 'down'  : 'up');
    move(dir);
  }

  function restart() {
    if (animTimer.current) clearTimeout(animTimer.current);
    setTiles(freshTiles());
    setScore(0);
    setStatus('playing');
  }

  function keepPlaying() { setStatus('playing'); }

  // Drop-target hint cells (4 adjacent to the dragged tile)
  const hintCells = drag ? adjacentCells(drag.tileRow, drag.tileCol) : [];

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
          ref={boardRef}
          onPointerMove={onBoardPointerMove}
          onPointerUp={onBoardPointerUp}
          onPointerLeave={onBoardPointerUp}
          style={{ position: 'relative', width: BOARD, height: BOARD, flexShrink: 0, touchAction: 'none' }}
        >

          {/* Cell backgrounds */}
          {Array.from({ length: SIZE }, (_, r) =>
            Array.from({ length: SIZE }, (_, c) => (
              <div
                key={`bg-${r}-${c}`}
                style={{
                  position: 'absolute',
                  left: tileLeft(c), top: tileTop(r),
                  width: CELL, height: CELL,
                  borderRadius: 14,
                  background: 'rgba(0,0,0,0.10)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
              />
            ))
          )}

          {/* Drop-target hint cells — shown when a tile is held */}
          {hintCells.map(({ r, c }) => (
            <div
              key={`hint-${r}-${c}`}
              style={{
                position: 'absolute',
                left: tileLeft(c), top: tileTop(r),
                width: CELL, height: CELL,
                borderRadius: 14,
                border: '2px solid rgba(0,212,255,0.80)',
                boxShadow: '0 0 16px rgba(0,212,255,0.45), inset 0 0 12px rgba(0,212,255,0.12)',
                background: 'rgba(0,212,255,0.07)',
                pointerEvents: 'none',
                zIndex: 2,
              }}
            />
          ))}

          {/* Tiles */}
          {tiles.map(tile => {
            const cfg        = getTile(tile.value);
            const isDragging = drag?.tileId === tile.id;
            const isDying    = tile.state === 'dying';

            const gloss = (
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                background: 'linear-gradient(168deg, rgba(255,255,255,0.58) 0%, rgba(255,255,255,0.20) 42%, rgba(255,255,255,0) 65%)',
                borderRadius: 14,
              }} />
            );

            // Slide transition for all live, non-new tiles
            const slideTransition = (tile.state === 'new' || isDying)
              ? 'none'
              : `left ${SLIDE_MS}ms ease, top ${SLIDE_MS}ms ease`;

            return (
              <div key={tile.id}>

                {/* Grid tile (ghost while dragging) */}
                <div
                  onPointerDown={e => onTilePointerDown(e, tile)}
                  style={{
                    position: 'absolute',
                    left: tileLeft(tile.c),
                    top:  tileTop(tile.r),
                    width: CELL, height: CELL,
                    borderRadius: 14,
                    background: cfg.bg,
                    boxShadow: cfg.glow !== 'none' ? cfg.glow : undefined,
                    border: `1px solid ${isDying ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.38)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, color: cfg.color,
                    fontFamily: 'Inter, system-ui, sans-serif',
                    overflow: 'hidden',
                    cursor: isDying ? 'default' : isDragging ? 'grabbing' : 'grab',
                    zIndex: isDying ? 1 : isDragging ? 5 : 10,
                    opacity: isDying ? 0 : isDragging ? 0.25 : 1,
                    transform: isDragging ? 'scale(0.90)' : undefined,
                    transition: isDragging
                      ? `opacity 0.08s, transform 0.08s, ${slideTransition}`
                      : slideTransition,
                    animation: (!isDragging && !isDying)
                      ? (tile.state === 'new'    ? 'tile2048-spawn 0.20s cubic-bezier(0.34,1.56,0.64,1) both'
                       : tile.state === 'merged' ? 'tile2048-merge 0.18s cubic-bezier(0.34,1.56,0.64,1) both'
                       : 'none')
                      : 'none',
                    pointerEvents: isDying ? 'none' : 'auto',
                  }}
                >
                  {gloss}
                  <span style={{ position: 'relative', zIndex: 1, lineHeight: 1, letterSpacing: '-0.5px', fontSize: cfg.fs }}>
                    {tile.value}
                  </span>
                </div>

                {/* Floating copy that follows the cursor while dragging */}
                {isDragging && drag && (
                  <div style={{
                    position: 'absolute',
                    left: drag.x, top: drag.y,
                    width: CELL, height: CELL,
                    borderRadius: 14,
                    background: cfg.bg,
                    boxShadow: `${cfg.glow !== 'none' ? cfg.glow + ', ' : ''}0 16px 40px rgba(0,0,0,0.40)`,
                    border: '1px solid rgba(255,255,255,0.55)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, color: cfg.color,
                    fontFamily: 'Inter, system-ui, sans-serif',
                    overflow: 'hidden',
                    transform: 'scale(1.12)',
                    zIndex: 50,
                    pointerEvents: 'none',
                    animation: 'tile2048-spawn 0.12s cubic-bezier(0.34,1.56,0.64,1) both',
                  }}>
                    {gloss}
                    <span style={{ position: 'relative', zIndex: 1, lineHeight: 1, letterSpacing: '-0.5px', fontSize: cfg.fs * 1.05 }}>
                      {tile.value}
                    </span>
                  </div>
                )}

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
              zIndex: 100,
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
              zIndex: 100,
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
        Drag any tile — highlighted cells show valid moves
      </p>
    </div>
  );
}

export default TwentyFortyEight;
