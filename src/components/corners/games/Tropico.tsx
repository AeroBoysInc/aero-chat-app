import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Lock, Star, Trophy } from 'lucide-react';
import { useCornerStore } from '../../../store/cornerStore';

// ── Constants ─────────────────────────────────────────────────────────────────
const CW = 800;       // canvas logical width
const CH = 420;       // canvas logical height
const PR = 14;        // player radius
const FLOOR_Y = 392;  // y of ground surface
const GRAVITY  = 860;
const JUMP_VEL = -410;
const MOVE_SPD = 210;
const MAX_FALL = 680;
const GAME_KEYS = new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyW','KeyA','KeyS','KeyD']);

// ── Types ─────────────────────────────────────────────────────────────────────
interface Moving { axis: 'x'|'y'; range: number; speed: number; }
interface Platform { x:number; y:number; w:number; h:number; moving?:Moving; _cx?:number; _cy?:number; _phase?:number; _prevCx?:number; _prevCy?:number; }
interface Spike    { x:number; y:number; w:number; h:number; moving?:Moving; _cx?:number; _cy?:number; _phase?:number; }
interface Goal     { x:number; y:number; }
interface LevelDef { worldWidth:number; startX:number; startY:number; hasFloor:boolean; floorGaps:Array<{x1:number;x2:number}>; platforms:Platform[]; spikes:Spike[]; goal:Goal; }
interface Player   { x:number; y:number; vx:number; vy:number; onGround:boolean; jumpsLeft:number; }
interface GState   { player:Player; cameraX:number; timer:number; }
interface LevelProgress { unlocked:boolean; completed:boolean; bestTime?:number; }

// ── Level data ────────────────────────────────────────────────────────────────
function mkPlat(x:number,y:number,w:number,h:number,m?:Moving): Platform { return {x,y,w,h,moving:m}; }
function mkSpike(x:number,y:number,w:number,h:number,m?:Moving): Spike   { return {x,y,w,h,moving:m}; }

const LEVELS: LevelDef[] = [
  // ── L1 – Warm Welcome ─────────────────────────────────────────────────────
  { worldWidth:3000, startX:60, startY:FLOOR_Y-PR, hasFloor:true, floorGaps:[],
    platforms:[
      mkPlat(400,330,200,14), mkPlat(700,300,180,14), mkPlat(1000,270,160,14),
      mkPlat(1280,300,200,14), mkPlat(1580,330,220,14), mkPlat(1900,280,180,14),
      mkPlat(2200,310,160,14), mkPlat(2550,340,200,14),
    ],
    spikes:[], goal:{x:2900,y:370} },

  // ── L2 – Island Hop ───────────────────────────────────────────────────────
  { worldWidth:3200, startX:60, startY:FLOOR_Y-PR, hasFloor:true, floorGaps:[],
    platforms:[
      mkPlat(350,340,160,14), mkPlat(620,310,140,14), mkPlat(870,280,120,14),
      mkPlat(1080,310,130,14), mkPlat(1320,340,150,14), mkPlat(1580,290,120,14),
      mkPlat(1820,260,110,14), mkPlat(2050,300,140,14), mkPlat(2300,330,160,14),
      mkPlat(2580,300,130,14), mkPlat(2820,340,180,14),
    ],
    spikes:[mkSpike(820,376,42,14), mkSpike(1450,376,28,14), mkSpike(2150,376,42,14)],
    goal:{x:3100,y:370} },

  // ── L3 – Palm Canopy ──────────────────────────────────────────────────────
  { worldWidth:3400, startX:60, startY:FLOOR_Y-PR, hasFloor:true, floorGaps:[],
    platforms:[
      mkPlat(300,320,140,14), mkPlat(530,280,130,14), mkPlat(750,240,120,14),
      mkPlat(960,200,110,14), mkPlat(1160,240,130,14), mkPlat(1380,280,140,14),
      mkPlat(1620,310,150,14,{axis:'x',range:120,speed:80}),
      mkPlat(1950,290,130,14), mkPlat(2200,260,120,14), mkPlat(2440,300,140,14),
      mkPlat(2700,330,160,14), mkPlat(2960,290,130,14), mkPlat(3200,340,150,14),
    ],
    spikes:[mkSpike(700,376,28,14), mkSpike(1800,376,42,14), mkSpike(2350,376,28,14), mkSpike(2620,376,42,14)],
    goal:{x:3350,y:370} },

  // ── L4 – Coral Gauntlet ───────────────────────────────────────────────────
  { worldWidth:3600, startX:60, startY:FLOOR_Y-PR, hasFloor:true, floorGaps:[],
    platforms:[
      mkPlat(280,330,150,14), mkPlat(530,300,130,14), mkPlat(760,270,120,14),
      mkPlat(980,300,130,14), mkPlat(1220,270,110,14,{axis:'x',range:90,speed:70}),
      mkPlat(1500,300,140,14), mkPlat(1730,260,120,14), mkPlat(1960,300,130,14),
      mkPlat(2200,270,110,14,{axis:'y',range:80,speed:60}),
      mkPlat(2450,300,140,14), mkPlat(2700,330,160,14), mkPlat(2950,290,130,14),
      mkPlat(3200,310,150,14), mkPlat(3450,340,160,14),
    ],
    spikes:[
      mkSpike(650,376,42,14), mkSpike(870,376,42,14), mkSpike(1350,376,28,14),
      mkSpike(1630,376,28,14), mkSpike(2080,376,56,14), mkSpike(2330,376,42,14),
      mkSpike(2600,376,28,14), mkSpike(3000,376,28,14,{axis:'x',range:100,speed:90}),
    ],
    goal:{x:3550,y:370} },

  // ── L5 – Monsoon Descent ──────────────────────────────────────────────────
  { worldWidth:3800, startX:60, startY:FLOOR_Y-PR, hasFloor:true, floorGaps:[{x1:1700,x2:2700}],
    platforms:[
      mkPlat(250,240,160,14), mkPlat(490,260,140,14), mkPlat(720,220,120,14),
      mkPlat(940,250,110,14,{axis:'y',range:70,speed:55}),
      mkPlat(1180,230,130,14), mkPlat(1420,260,120,14,{axis:'x',range:110,speed:85}),
      mkPlat(1700,240,110,14),
      mkPlat(1950,280,100,14,{axis:'y',range:60,speed:50}),
      mkPlat(2180,300,120,14), mkPlat(2420,270,110,14,{axis:'x',range:100,speed:80}),
      mkPlat(2680,300,130,14), mkPlat(2920,270,120,14),
      mkPlat(3180,310,140,14), mkPlat(3440,330,160,14), mkPlat(3680,350,150,14),
    ],
    spikes:[
      mkSpike(600,376,42,14), mkSpike(840,376,42,14), mkSpike(1100,376,28,14),
      mkSpike(1310,376,56,14), mkSpike(2800,376,42,14), mkSpike(3050,376,28,14), mkSpike(3300,376,56,14),
    ],
    goal:{x:3760,y:370} },

  // ── L6 – Typhoon Towers ───────────────────────────────────────────────────
  { worldWidth:4000, startX:60, startY:FLOOR_Y-PR, hasFloor:true, floorGaps:[],
    platforms:[
      mkPlat(200,310,140,14), mkPlat(430,270,120,14), mkPlat(640,220,110,14),
      mkPlat(640,160,110,14,{axis:'x',range:80,speed:75}),
      mkPlat(840,280,120,14), mkPlat(1060,240,110,14), mkPlat(1270,200,100,14),
      mkPlat(1270,140,100,14,{axis:'y',range:50,speed:60}),
      mkPlat(1530,250,120,14), mkPlat(1780,210,110,14,{axis:'x',range:120,speed:90}),
      mkPlat(2050,240,120,14), mkPlat(2300,180,100,14), mkPlat(2520,220,110,14),
      mkPlat(2760,260,120,14), mkPlat(3000,200,100,14,{axis:'x',range:100,speed:85}),
      mkPlat(3280,240,120,14), mkPlat(3540,280,140,14), mkPlat(3790,330,160,14),
    ],
    spikes:[
      mkSpike(380,376,42,14), mkSpike(590,376,28,14), mkSpike(780,376,42,14),
      mkSpike(1000,376,42,14), mkSpike(1200,376,56,14), mkSpike(1460,376,42,14),
      mkSpike(1700,376,56,14), mkSpike(1950,376,42,14), mkSpike(2200,376,28,14),
      mkSpike(2440,376,56,14), mkSpike(2680,376,42,14), mkSpike(2920,376,56,14),
      mkSpike(3180,376,42,14), mkSpike(3440,376,28,14),
    ],
    goal:{x:3950,y:370} },

  // ── L7 – Volcanic Reef ────────────────────────────────────────────────────
  { worldWidth:4200, startX:60, startY:FLOOR_Y-PR, hasFloor:true, floorGaps:[{x1:1800,x2:3200}],
    platforms:[
      mkPlat(200,300,140,14), mkPlat(440,260,120,14), mkPlat(660,220,110,14),
      mkPlat(880,260,120,14), mkPlat(1100,290,130,14), mkPlat(1340,260,110,14),
      mkPlat(1560,230,100,14),
      mkPlat(1820,270,90,14,{axis:'y',range:80,speed:70}),
      mkPlat(2020,250,90,14,{axis:'x',range:90,speed:95}),
      mkPlat(2240,280,80,14,{axis:'y',range:70,speed:75}),
      mkPlat(2440,260,90,14,{axis:'x',range:100,speed:100}),
      mkPlat(2660,240,80,14,{axis:'y',range:80,speed:80}),
      mkPlat(2860,270,90,14,{axis:'x',range:90,speed:90}),
      mkPlat(3060,250,90,14,{axis:'y',range:70,speed:70}),
      mkPlat(3260,290,130,14), mkPlat(3510,310,150,14),
      mkPlat(3770,330,160,14), mkPlat(4020,350,160,14),
    ],
    spikes:[
      mkSpike(600,376,42,14), mkSpike(800,376,28,14), mkSpike(1020,376,56,14),
      mkSpike(1260,376,42,14), mkSpike(1470,376,42,14),
      mkSpike(3340,376,56,14), mkSpike(3620,376,42,14),
      mkSpike(3880,376,28,14,{axis:'x',range:120,speed:110}),
    ],
    goal:{x:4150,y:370} },

  // ── L8 – Tsunami Run ──────────────────────────────────────────────────────
  { worldWidth:4500, startX:60, startY:326, hasFloor:false, floorGaps:[],
    platforms:[
      mkPlat(40,340,200,14),
      mkPlat(340,310,120,14), mkPlat(560,270,100,14),
      mkPlat(760,230,90,14,{axis:'x',range:80,speed:80}),
      mkPlat(960,260,100,14), mkPlat(1160,290,110,14),
      mkPlat(1380,250,90,14,{axis:'y',range:70,speed:75}),
      mkPlat(1590,280,100,14),
      mkPlat(1810,240,90,14,{axis:'x',range:100,speed:95}),
      mkPlat(2030,270,100,14),
      mkPlat(2260,240,90,14,{axis:'y',range:80,speed:85}),
      mkPlat(2480,270,90,14,{axis:'x',range:90,speed:100}),
      mkPlat(2700,250,80,14),
      mkPlat(2900,220,80,14,{axis:'x',range:110,speed:105}),
      mkPlat(3120,250,90,14), mkPlat(3340,280,100,14),
      mkPlat(3570,250,80,14,{axis:'y',range:75,speed:90}),
      mkPlat(3800,270,90,14,{axis:'x',range:100,speed:110}),
      mkPlat(4050,300,100,14), mkPlat(4280,330,180,14),
    ],
    spikes:[
      mkSpike(380,296,28,14), mkSpike(1200,276,28,14),
      mkSpike(1640,266,28,14), mkSpike(2770,236,28,14),
    ],
    goal:{x:4430,y:310} },

  // ── L9 – Eye of the Storm ─────────────────────────────────────────────────
  { worldWidth:4800, startX:60, startY:336, hasFloor:false, floorGaps:[],
    platforms:[
      mkPlat(40,350,180,14),
      mkPlat(310,310,100,14), mkPlat(510,270,80,14,{axis:'x',range:70,speed:100}),
      mkPlat(700,240,80,14,{axis:'y',range:60,speed:95}),
      mkPlat(890,270,80,14), mkPlat(1080,230,70,14,{axis:'x',range:90,speed:105}),
      mkPlat(1280,260,80,14), mkPlat(1480,220,70,14,{axis:'y',range:80,speed:100}),
      mkPlat(1680,250,80,14,{axis:'x',range:100,speed:110}),
      mkPlat(1900,230,70,14), mkPlat(2110,200,70,14,{axis:'x',range:80,speed:115}),
      mkPlat(2320,230,80,14), mkPlat(2540,200,70,14,{axis:'y',range:70,speed:105}),
      mkPlat(2760,230,80,14,{axis:'x',range:90,speed:120}),
      mkPlat(2990,260,80,14), mkPlat(3210,230,70,14,{axis:'x',range:100,speed:115}),
      mkPlat(3440,260,80,14), mkPlat(3680,230,70,14,{axis:'y',range:80,speed:110}),
      mkPlat(3920,260,80,14,{axis:'x',range:90,speed:120}),
      mkPlat(4180,290,90,14), mkPlat(4440,320,120,14), mkPlat(4680,340,160,14),
    ],
    spikes:[
      mkSpike(350,296,28,14), mkSpike(930,256,28,14),
      mkSpike(1320,246,28,14), mkSpike(1720,236,28,14),
      mkSpike(1940,216,28,14), mkSpike(3050,246,28,14), mkSpike(4490,306,28,14),
    ],
    goal:{x:4760,y:320} },

  // ── L10 – Tropico Summit ──────────────────────────────────────────────────
  { worldWidth:5000, startX:60, startY:346, hasFloor:false, floorGaps:[],
    platforms:[
      mkPlat(40,360,200,14),
      mkPlat(340,320,120,14), mkPlat(560,280,110,14), mkPlat(760,240,100,14),
      mkPlat(950,200,90,14),
      mkPlat(1130,230,90,14,{axis:'x',range:80,speed:90}),
      mkPlat(1340,260,90,14), mkPlat(1550,230,80,14,{axis:'y',range:70,speed:85}),
      mkPlat(1760,260,80,14,{axis:'x',range:100,speed:100}),
      mkPlat(1990,280,70,14), mkPlat(2160,250,70,14,{axis:'x',range:80,speed:105}),
      mkPlat(2350,270,70,14,{axis:'y',range:75,speed:100}),
      mkPlat(2550,250,70,14),
      mkPlat(2760,300,180,14),
      mkPlat(3050,260,90,14), mkPlat(3270,230,80,14,{axis:'x',range:100,speed:110}),
      mkPlat(3490,200,70,14,{axis:'y',range:80,speed:105}),
      mkPlat(3700,230,80,14), mkPlat(3920,200,70,14,{axis:'x',range:90,speed:115}),
      mkPlat(4160,230,80,14), mkPlat(4370,260,90,14,{axis:'x',range:80,speed:120}),
      mkPlat(4590,290,100,14), mkPlat(4800,320,160,14),
    ],
    spikes:[
      mkSpike(440,376,42,14), mkSpike(660,376,42,14),
      mkSpike(596,266,28,14), mkSpike(990,186,28,14),
      mkSpike(1590,216,28,14), mkSpike(1800,246,28,14),
      mkSpike(2800,286,28,14), mkSpike(3090,246,28,14),
      mkSpike(3740,216,28,14), mkSpike(4200,216,28,14),
      mkSpike(4840,306,28,14),
      mkSpike(2100,360,28,14,{axis:'x',range:120,speed:110}),
      mkSpike(3600,360,28,14,{axis:'x',range:100,speed:120}),
    ],
    goal:{x:4930,y:300} },
];

// ── Persistence ───────────────────────────────────────────────────────────────
const LS_KEY = 'aero_tropico_progress';
function loadProgress(): LevelProgress[] {
  try {
    const s = JSON.parse(localStorage.getItem(LS_KEY) ?? 'null');
    if (Array.isArray(s) && s.length === 10) return s;
  } catch {}
  return Array.from({ length: 10 }, (_, i) => ({ unlocked: i === 0, completed: false }));
}
function saveProgress(p: LevelProgress[]) { try { localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch {} }
function fmtTime(s: number) { const m = Math.floor(s/60); return `${m}:${String(Math.floor(s%60)).padStart(2,'0')}`; }

// ── Canvas helpers ─────────────────────────────────────────────────────────────
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const R = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+R,y); ctx.lineTo(x+w-R,y); ctx.quadraticCurveTo(x+w,y,x+w,y+R);
  ctx.lineTo(x+w,y+h-R); ctx.quadraticCurveTo(x+w,y+h,x+w-R,y+h);
  ctx.lineTo(x+R,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-R);
  ctx.lineTo(x,y+R); ctx.quadraticCurveTo(x,y,x+R,y); ctx.closePath();
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, pts: number, ro: number, ri: number) {
  ctx.beginPath();
  for (let i = 0; i < pts*2; i++) {
    const a = (i*Math.PI)/pts - Math.PI/2;
    const r = i%2===0 ? ro : ri;
    i===0 ? ctx.moveTo(cx+Math.cos(a)*r, cy+Math.sin(a)*r) : ctx.lineTo(cx+Math.cos(a)*r, cy+Math.sin(a)*r);
  }
  ctx.closePath(); ctx.fill();
}

// ── Main component ─────────────────────────────────────────────────────────────
export function Tropico() {
  const { selectGame } = useCornerStore();

  const [screen,        setScreen]        = useState<'select'|'playing'|'dead'|'complete'>('select');
  const [currentLevel,  setCurrentLevel]  = useState(0);
  const [levelProgress, setLevelProgress] = useState<LevelProgress[]>(loadProgress);

  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const rafRef         = useRef<number>(0);
  const bgRef          = useRef<HTMLImageElement | null>(null);
  const keysRef        = useRef<Set<string>>(new Set());
  const jumpPressedRef = useRef(false);
  const curLvlRef      = useRef(0);
  const screenRef      = useRef<'select'|'playing'|'dead'|'complete'>('select');
  const gsRef          = useRef<GState>({ player:{x:60,y:370,vx:0,vy:0,onGround:false,jumpsLeft:2}, cameraX:0, timer:0 });
  curLvlRef.current = currentLevel;
  screenRef.current = screen;

  // ── Level init ──────────────────────────────────────────────────────────────
  function initLevel(idx: number) {
    const lv = LEVELS[idx];
    for (const p of lv.platforms) { p._cx=p.x; p._cy=p.y; p._phase=0; p._prevCx=p.x; p._prevCy=p.y; }
    for (const s of lv.spikes)    { s._cx=s.x; s._cy=s.y; s._phase=0; }
    gsRef.current = {
      player: { x:lv.startX, y:lv.startY, vx:0, vy:0, onGround:false, jumpsLeft:2 },
      cameraX: 0, timer: 0,
    };
  }

  function startLevel(idx: number) {
    initLevel(idx);
    setCurrentLevel(idx);
    curLvlRef.current = idx;
    setScreen('playing');
  }

  function markComplete(idx: number, time: number) {
    setLevelProgress(prev => {
      const next = prev.map((p,i) =>
        i === idx   ? { ...p, completed:true, bestTime: Math.min(p.bestTime ?? Infinity, time) } :
        i === idx+1 ? { ...p, unlocked:true } : p
      );
      saveProgress(next);
      return next;
    });
  }

  // ── Physics ─────────────────────────────────────────────────────────────────
  function isInGap(x: number, gaps: Array<{x1:number;x2:number}>) {
    return gaps.some(g => x > g.x1 && x < g.x2);
  }

  function tickMoving(obj: Platform|Spike, dt: number) {
    if (!obj.moving) return;
    obj._phase = ((obj._phase ?? 0) + dt * obj.moving.speed / obj.moving.range);
    const offset = Math.sin(obj._phase * Math.PI) * obj.moving.range;
    if (obj.moving.axis === 'x') { obj._cx = obj.x + offset; }
    else                         { obj._cy = obj.y + offset; }
  }

  function resolveCollisions(pl: Player, platforms: Platform[]) {
    for (const plat of platforms) {
      const px = plat._cx ?? plat.x;
      const py = plat._cy ?? plat.y;
      const l = pl.x - PR, r = pl.x + PR, t = pl.y - PR, b = pl.y + PR;
      if (r < px || l > px+plat.w || b < py || t > py+plat.h) continue;
      const oTop    = b - py;
      const oBottom = (py+plat.h) - t;
      const oLeft   = r - px;
      const oRight  = (px+plat.w) - l;
      const min = Math.min(oTop, oBottom, oLeft, oRight);
      if (min === oTop && pl.vy >= 0) {
        pl.y = py - PR; pl.vy = 0; pl.onGround = true; pl.jumpsLeft = 2;
        // carry horizontally
        if (plat.moving?.axis === 'x' && plat._prevCx !== undefined) {
          pl.x += (plat._cx ?? plat.x) - plat._prevCx;
        }
      } else if (min === oBottom && pl.vy < 0) { pl.y = py+plat.h+PR; pl.vy = 0; }
      else if (min === oLeft)  { pl.x = px-PR; pl.vx = 0; }
      else if (min === oRight) { pl.x = px+plat.w+PR; pl.vx = 0; }
    }
  }

  function overlapsSpike(pl: Player, sp: Spike) {
    const sx = sp._cx ?? sp.x, sy = sp._cy ?? sp.y;
    const cols = Math.max(1, Math.floor(sp.w / 14));
    for (let i = 0; i < cols; i++) {
      const tx = sx + i*14 + 7, ty = sy; // tip
      const bl_x = sx + i*14, bl_y = sy + sp.h;
      const br_x = sx + i*14 + 14;
      // Simple AABB against spike bounding box with shrink
      if (pl.x+PR-4 > sx+i*14 && pl.x-PR+4 < sx+i*14+14 && pl.y+PR-4 > sy && pl.y-PR+4 < sy+sp.h) {
        // Refine: distance from player center to closest point on triangle
        const cx = Math.max(sx+i*14, Math.min(pl.x, sx+i*14+14));
        const cy = Math.max(sy, Math.min(pl.y, sy+sp.h));
        if (Math.hypot(pl.x-cx, pl.y-cy) < PR-4) { void tx; void ty; void bl_x; void bl_y; void br_x; return true; }
      }
    }
    return false;
  }

  function update(dt: number) {
    if (screenRef.current !== 'playing') return;
    const gs = gsRef.current;
    const pl = gs.player;
    const lv = LEVELS[curLvlRef.current];
    const keys = keysRef.current;
    gs.timer += dt;

    // Store prev positions for moving platforms before tick
    for (const p of lv.platforms) { p._prevCx = p._cx ?? p.x; p._prevCy = p._cy ?? p.y; }

    // Tick movers
    for (const p of lv.platforms) tickMoving(p, dt);
    for (const s of lv.spikes)    tickMoving(s, dt);

    // Horizontal
    const left  = keys.has('ArrowLeft')  || keys.has('KeyA');
    const right = keys.has('ArrowRight') || keys.has('KeyD');
    pl.vx = right ? MOVE_SPD : left ? -MOVE_SPD : 0;

    // Jump (edge-triggered)
    const wantsJump = keys.has('Space') || keys.has('ArrowUp') || keys.has('KeyW');
    if (wantsJump && !jumpPressedRef.current && pl.jumpsLeft > 0) {
      pl.vy = JUMP_VEL; pl.jumpsLeft--; pl.onGround = false;
      jumpPressedRef.current = true;
      playJump();
    }
    if (!wantsJump) jumpPressedRef.current = false;

    // Gravity
    pl.vy = Math.min(pl.vy + GRAVITY * dt, MAX_FALL);

    // Integrate
    pl.x += pl.vx * dt;
    pl.y += pl.vy * dt;

    // Collision
    pl.onGround = false;
    resolveCollisions(pl, lv.platforms);

    // Floor
    const onSolidFloor = lv.hasFloor && !isInGap(pl.x, lv.floorGaps);
    if (onSolidFloor && pl.y + PR >= FLOOR_Y) {
      pl.y = FLOOR_Y - PR; pl.vy = 0; pl.onGround = true; pl.jumpsLeft = 2;
    }

    // Left wall
    pl.x = Math.max(PR, pl.x);

    // Spike collision
    for (const s of lv.spikes) {
      if (overlapsSpike(pl, s)) { setScreen('dead'); return; }
    }

    // Fall death
    if (pl.y > CH + 80) { setScreen('dead'); return; }

    // Goal
    if (Math.hypot(pl.x - lv.goal.x, pl.y - lv.goal.y) < PR + 24) {
      markComplete(curLvlRef.current, gs.timer);
      setScreen('complete'); return;
    }

    // Camera
    const targetCam = pl.x - CW * 0.35;
    gs.cameraX = Math.max(0, Math.min(lv.worldWidth - CW, targetCam));
  }

  // ── Rendering ────────────────────────────────────────────────────────────────
  function render() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const gs  = gsRef.current;
    const lv  = LEVELS[curLvlRef.current];
    const cam = gs.cameraX;

    // Background
    const bg = bgRef.current;
    if (bg && bg.complete && bg.naturalWidth > 0) {
      const scale  = CH / bg.naturalHeight;
      const scaledW = bg.naturalWidth * scale;
      const offX   = -(cam * 0.28) % scaledW;
      for (let i = -1; i <= 3; i++) ctx.drawImage(bg, offX + i*scaledW, 0, scaledW, CH);
    } else {
      const grad = ctx.createLinearGradient(0,0,0,CH);
      grad.addColorStop(0,'#87d5f0'); grad.addColorStop(1,'#1a8fc4');
      ctx.fillStyle = grad; ctx.fillRect(0,0,CW,CH);
    }

    // Dim overlay for depth
    ctx.fillStyle = 'rgba(0,20,60,0.18)';
    ctx.fillRect(0,0,CW,CH);

    ctx.save();
    ctx.translate(-cam, 0);

    // Floor
    if (lv.hasFloor) {
      const floorGrad = ctx.createLinearGradient(0,FLOOR_Y,0,CH);
      floorGrad.addColorStop(0,'rgba(0,210,255,0.35)');
      floorGrad.addColorStop(1,'rgba(0,100,180,0.15)');
      ctx.fillStyle = floorGrad;
      if (lv.floorGaps.length === 0) {
        ctx.fillRect(0, FLOOR_Y, lv.worldWidth, CH - FLOOR_Y);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(0, FLOOR_Y, lv.worldWidth, 2);
      } else {
        // Draw floor with gaps
        let cursor = 0;
        for (const gap of lv.floorGaps) {
          ctx.fillStyle = floorGrad;
          ctx.fillRect(cursor, FLOOR_Y, gap.x1 - cursor, CH - FLOOR_Y);
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.fillRect(cursor, FLOOR_Y, gap.x1 - cursor, 2);
          cursor = gap.x2;
        }
        ctx.fillStyle = floorGrad;
        ctx.fillRect(cursor, FLOOR_Y, lv.worldWidth - cursor, CH - FLOOR_Y);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(cursor, FLOOR_Y, lv.worldWidth - cursor, 2);
      }
    }

    // Platforms
    for (const p of lv.platforms) {
      const px = p._cx ?? p.x, py = p._cy ?? p.y;
      rr(ctx, px, py, p.w, p.h, 5);
      ctx.fillStyle = 'rgba(0,210,255,0.28)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.40)'; ctx.lineWidth = 1; ctx.stroke();
      // Top gloss
      rr(ctx, px+1, py+1, p.w-2, p.h*0.55, 4);
      const g = ctx.createLinearGradient(px, py, px, py+p.h*0.55);
      g.addColorStop(0,'rgba(255,255,255,0.60)'); g.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fill();
    }

    // Spikes
    for (const s of lv.spikes) {
      const sx = s._cx ?? s.x, sy = s._cy ?? s.y;
      const cols = Math.max(1, Math.floor(s.w / 14));
      for (let i = 0; i < cols; i++) {
        ctx.beginPath();
        ctx.moveTo(sx+i*14+7, sy);
        ctx.lineTo(sx+i*14,   sy+s.h);
        ctx.lineTo(sx+i*14+14,sy+s.h);
        ctx.closePath();
        const sg = ctx.createLinearGradient(sx+i*14+7, sy, sx+i*14+7, sy+s.h);
        sg.addColorStop(0,'#ff7040'); sg.addColorStop(1,'#cc2200');
        ctx.fillStyle = sg; ctx.fill();
        ctx.strokeStyle='rgba(255,120,0,0.45)'; ctx.lineWidth=0.8; ctx.stroke();
      }
    }

    // Goal portal
    const { x:gx, y:gy } = lv.goal;
    const pulse = 0.82 + 0.18 * Math.sin(gs.timer * 4.2);
    const gr = 22 * pulse;
    const outerG = ctx.createRadialGradient(gx,gy,gr*0.3,gx,gy,gr*1.9);
    outerG.addColorStop(0,`rgba(0,255,200,${0.45*pulse})`); outerG.addColorStop(1,'rgba(0,255,200,0)');
    ctx.beginPath(); ctx.arc(gx,gy,gr*1.9,0,Math.PI*2); ctx.fillStyle=outerG; ctx.fill();
    const innerG = ctx.createRadialGradient(gx,gy,0,gx,gy,gr);
    innerG.addColorStop(0,'rgba(255,255,255,0.95)'); innerG.addColorStop(0.4,'rgba(0,255,200,0.80)'); innerG.addColorStop(1,'rgba(0,180,140,0.35)');
    ctx.beginPath(); ctx.arc(gx,gy,gr,0,Math.PI*2); ctx.fillStyle=innerG; ctx.fill();
    ctx.save(); ctx.translate(gx,gy); ctx.rotate(gs.timer*1.1);
    ctx.fillStyle=`rgba(255,255,255,${0.65*pulse})`; drawStar(ctx,0,0,5,gr*0.58,gr*0.24); ctx.restore();

    // Player
    const pl = gs.player;
    // Glow
    const plGlow = ctx.createRadialGradient(pl.x,pl.y,PR*0.5,pl.x,pl.y,PR*2.5);
    plGlow.addColorStop(0,'rgba(0,220,255,0.38)'); plGlow.addColorStop(1,'rgba(0,220,255,0)');
    ctx.beginPath(); ctx.arc(pl.x,pl.y,PR*2.5,0,Math.PI*2); ctx.fillStyle=plGlow; ctx.fill();
    // Body
    const body = ctx.createRadialGradient(pl.x-PR*0.3,pl.y-PR*0.3,PR*0.05,pl.x,pl.y,PR);
    body.addColorStop(0,'rgba(255,255,255,0.96)');
    body.addColorStop(0.25,'rgba(160,240,255,0.88)');
    body.addColorStop(0.65,'rgba(0,185,255,0.72)');
    body.addColorStop(1,'rgba(0,100,200,0.55)');
    ctx.beginPath(); ctx.arc(pl.x,pl.y,PR,0,Math.PI*2); ctx.fillStyle=body; ctx.fill();
    // Shine
    const shine = ctx.createRadialGradient(pl.x-PR*0.33,pl.y-PR*0.33,0,pl.x-PR*0.33,pl.y-PR*0.33,PR*0.52);
    shine.addColorStop(0,'rgba(255,255,255,0.92)'); shine.addColorStop(1,'rgba(255,255,255,0)');
    ctx.beginPath(); ctx.arc(pl.x,pl.y,PR,0,Math.PI*2); ctx.fillStyle=shine; ctx.fill();
    ctx.beginPath(); ctx.arc(pl.x,pl.y,PR,0,Math.PI*2);
    ctx.strokeStyle='rgba(255,255,255,0.65)'; ctx.lineWidth=1.5; ctx.stroke();

    ctx.restore();

    // HUD
    ctx.fillStyle='rgba(0,0,0,0.42)'; rr(ctx,10,10,195,34,9); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.88)'; ctx.font='bold 12px Inter,system-ui,sans-serif';
    ctx.fillText(`🌴 Tropico · Level ${curLvlRef.current+1}`, 20, 28);
    ctx.fillStyle='#00ffcc'; ctx.font='bold 12px monospace';
    ctx.fillText(fmtTime(gs.timer), 178, 28);
  }

  // ── Game loop ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'playing') return;

    if (!bgRef.current) {
      const img = new Image(); img.src = '/games/platformer-bg.png'; bgRef.current = img;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      keysRef.current.add(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.code);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup',   onKeyUp);

    let last = performance.now();
    function loop(now: number) {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      update(dt);
      render();
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup',   onKeyUp);
      keysRef.current.clear();
      jumpPressedRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  // ── Audio ────────────────────────────────────────────────────────────────────
  let audioCtx: AudioContext | null = null;
  function getACtx() { try { return audioCtx ?? (audioCtx = new AudioContext()); } catch { return null; } }
  function playJump() {
    try {
      const ctx = getACtx(); if (!ctx) return;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type='sine'; o.frequency.setValueAtTime(320,ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(640,ctx.currentTime+0.08);
      g.gain.setValueAtTime(0.12,ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.15);
      o.start(); o.stop(ctx.currentTime+0.15);
    } catch {}
  }

  // ── Level select ─────────────────────────────────────────────────────────────
  if (screen === 'select') {
    return (
      <div className="flex h-full flex-col" style={{ userSelect:'none', background:'linear-gradient(160deg,#020d24,#041533,#071f42)', color:'#fff' }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 flex-shrink-0" style={{ borderBottom:'1px solid rgba(255,255,255,0.10)' }}>
          <button
            onClick={() => selectGame(null)}
            className="flex h-8 w-8 items-center justify-center rounded-xl transition-all"
            style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)', color:'rgba(255,255,255,0.6)' }}
            onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.13)'}
            onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.07)'}
          ><ArrowLeft className="h-4 w-4"/></button>
          <span style={{fontSize:22}}>🌴</span>
          <div>
            <p className="font-bold text-base">Tropico</p>
            <p style={{fontSize:11,color:'rgba(255,255,255,0.45)'}}>10 levels · jump &amp; dodge</p>
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid gap-4" style={{gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))'}}>
            {LEVELS.map((_,idx) => {
              const prog = levelProgress[idx];
              const locked = !prog.unlocked;
              return (
                <button
                  key={idx}
                  disabled={locked}
                  onClick={() => !locked && startLevel(idx)}
                  className="flex flex-col items-center gap-2 rounded-2xl py-5 px-3 transition-all"
                  style={{
                    background: prog.completed ? 'rgba(0,255,150,0.10)' : locked ? 'rgba(255,255,255,0.03)' : 'rgba(0,200,255,0.08)',
                    border: prog.completed ? '1px solid rgba(0,255,150,0.30)' : locked ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,200,255,0.22)',
                    cursor: locked ? 'default' : 'pointer',
                    opacity: locked ? 0.45 : 1,
                  }}
                  onMouseEnter={e=>{ if(!locked) (e.currentTarget as HTMLElement).style.background = prog.completed?'rgba(0,255,150,0.16)':'rgba(0,200,255,0.14)'; }}
                  onMouseLeave={e=>{ if(!locked) (e.currentTarget as HTMLElement).style.background = prog.completed?'rgba(0,255,150,0.10)':'rgba(0,200,255,0.08)'; }}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full text-xl font-black"
                    style={{ background: prog.completed?'rgba(0,255,150,0.18)':locked?'rgba(255,255,255,0.06)':'rgba(0,200,255,0.15)',
                      border: `2px solid ${prog.completed?'rgba(0,255,150,0.50)':locked?'rgba(255,255,255,0.10)':'rgba(0,200,255,0.35)'}` }}>
                    {locked ? <Lock className="h-4 w-4" style={{color:'rgba(255,255,255,0.35)'}}/> :
                     prog.completed ? <Star className="h-5 w-5" style={{color:'#00ff96'}}/> :
                     <span style={{color:'#00d4ff',fontSize:16}}>{idx+1}</span>}
                  </div>
                  <p className="text-xs font-bold" style={{color: locked?'rgba(255,255,255,0.30)':prog.completed?'#00ff96':'rgba(255,255,255,0.85)'}}>
                    Level {idx+1}
                  </p>
                  {prog.bestTime !== undefined && (
                    <p style={{fontSize:9,color:'rgba(255,255,255,0.40)'}}>{fmtTime(prog.bestTime)}</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Dead / Complete overlays over canvas ──────────────────────────────────────
  return (
    <div className="relative flex h-full flex-col" style={{userSelect:'none', background:'#020d24'}}>
      <canvas
        ref={canvasRef}
        width={CW} height={CH}
        style={{width:'100%', height:'100%', display:'block'}}
      />

      {/* Controls hint */}
      {screen==='playing' && (
        <div style={{position:'absolute',bottom:8,left:'50%',transform:'translateX(-50%)',
          background:'rgba(0,0,0,0.40)',borderRadius:8,padding:'3px 10px',
          fontSize:10,color:'rgba(255,255,255,0.45)',pointerEvents:'none',whiteSpace:'nowrap'}}>
          ← → move &nbsp;·&nbsp; Space / ↑ jump &nbsp;·&nbsp; double-jump allowed
        </div>
      )}

      {/* Dead screen */}
      {screen==='dead' && (
        <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',
          justifyContent:'center',gap:16,background:'rgba(2,8,24,0.78)',backdropFilter:'blur(6px)'}}>
          <div style={{fontSize:52}}>💀</div>
          <div style={{textAlign:'center'}}>
            <p style={{fontWeight:800,fontSize:20,color:'#fff'}}>Wipeout!</p>
            <p style={{fontSize:13,color:'rgba(255,255,255,0.5)',marginTop:4}}>Level {currentLevel+1}</p>
          </div>
          <div style={{display:'flex',gap:10}}>
            <button onClick={()=>startLevel(currentLevel)} style={btnStyle('#00d4ff')}>Try Again</button>
            <button onClick={()=>setScreen('select')} style={btnStyle('rgba(255,255,255,0.15)')}>Level Select</button>
          </div>
        </div>
      )}

      {/* Complete screen */}
      {screen==='complete' && (
        <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',
          justifyContent:'center',gap:16,background:'rgba(0,10,30,0.80)',backdropFilter:'blur(6px)'}}>
          <div style={{fontSize:52}}>🌴</div>
          <div style={{textAlign:'center'}}>
            <p style={{fontWeight:800,fontSize:20,color:'#00ffcc'}}>Level {currentLevel+1} Clear!</p>
            <p style={{fontSize:13,color:'rgba(255,255,255,0.55)',marginTop:4}}>
              Time: <strong style={{color:'#00d4ff'}}>{fmtTime(gsRef.current.timer)}</strong>
            </p>
            {levelProgress[currentLevel]?.bestTime !== undefined && (
              <div style={{display:'flex',alignItems:'center',gap:6,justifyContent:'center',marginTop:6,fontSize:11,color:'#ffd700'}}>
                <Trophy style={{width:12,height:12}}/> Best: {fmtTime(levelProgress[currentLevel].bestTime!)}
              </div>
            )}
          </div>
          <div style={{display:'flex',gap:10}}>
            {currentLevel < 9 && (
              <button onClick={()=>startLevel(currentLevel+1)} style={btnStyle('#00d4ff')}>Next Level →</button>
            )}
            <button onClick={()=>setScreen('select')} style={btnStyle('rgba(255,255,255,0.15)')}>Level Select</button>
          </div>
        </div>
      )}
    </div>
  );
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    background: bg, color: bg.startsWith('rgba') ? 'rgba(255,255,255,0.85)' : '#000',
    border:'none', borderRadius:12, padding:'10px 22px', fontWeight:700, fontSize:13,
    cursor:'pointer', transition:'opacity 0.15s',
  };
}
