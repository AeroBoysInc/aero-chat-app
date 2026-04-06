// src/lib/xpConfig.ts
// Pure XP system configuration — level formulas, rank tables, cap constants.

export type XpBar = 'chatter' | 'gamer' | 'writer';

export const DAILY_XP_CAP = 100; // per bar, per day (free users only)

// ── Level formula ──
// Level N→N+1 costs: 50 + (N * 25) XP
// Total to reach level 100: ~128,800 XP per bar.

/** XP required to go from `level` to `level + 1`. */
export function xpForLevel(level: number): number {
  return 50 + level * 25;
}

/** Total cumulative XP required to reach a given level. */
export function totalXpForLevel(level: number): number {
  // Sum of (50 + n*25) for n = 1..level-1
  // = 50*(level-1) + 25 * (level-1)*level/2
  if (level <= 1) return 0;
  const n = level - 1;
  return 50 * n + 25 * n * (n + 1) / 2;
}

/** Derive current level + progress from cumulative XP. */
export function deriveLevel(totalXp: number): { level: number; currentXp: number; nextXp: number } {
  let level = 1;
  let spent = 0;
  while (level < 100) {
    const needed = xpForLevel(level);
    if (spent + needed > totalXp) {
      return { level, currentXp: totalXp - spent, nextXp: needed };
    }
    spent += needed;
    level++;
  }
  return { level: 100, currentXp: 0, nextXp: 0 }; // max level
}

// ── Rank tables ──

interface RankEntry {
  minLevel: number;
  maxLevel: number;
  title: string;
}

const CHATTER_RANKS: RankEntry[] = [
  { minLevel: 1,  maxLevel: 4,   title: 'Newcomer' },
  { minLevel: 5,  maxLevel: 9,   title: 'Talker' },
  { minLevel: 10, maxLevel: 19,  title: 'Chatterbox' },
  { minLevel: 20, maxLevel: 34,  title: 'Socialite' },
  { minLevel: 35, maxLevel: 49,  title: 'Messenger' },
  { minLevel: 50, maxLevel: 74,  title: 'Orator' },
  { minLevel: 75, maxLevel: 99,  title: 'Legend' },
  { minLevel: 100, maxLevel: 100, title: 'Aero Voice' },
];

const GAMER_RANKS: RankEntry[] = [
  { minLevel: 1,  maxLevel: 4,   title: 'Rookie' },
  { minLevel: 5,  maxLevel: 9,   title: 'Player' },
  { minLevel: 10, maxLevel: 19,  title: 'Competitor' },
  { minLevel: 20, maxLevel: 34,  title: 'Strategist' },
  { minLevel: 35, maxLevel: 49,  title: 'Veteran' },
  { minLevel: 50, maxLevel: 74,  title: 'Master' },
  { minLevel: 75, maxLevel: 99,  title: 'Grandmaster' },
  { minLevel: 100, maxLevel: 100, title: 'Aero Champion' },
];

const WRITER_RANKS: RankEntry[] = [
  { minLevel: 1,  maxLevel: 4,   title: 'Scribbler' },
  { minLevel: 5,  maxLevel: 9,   title: 'Wordsmith' },
  { minLevel: 10, maxLevel: 19,  title: 'Author' },
  { minLevel: 20, maxLevel: 34,  title: 'Storyteller' },
  { minLevel: 35, maxLevel: 49,  title: 'Novelist' },
  { minLevel: 50, maxLevel: 74,  title: 'Virtuoso' },
  { minLevel: 75, maxLevel: 99,  title: 'Luminary' },
  { minLevel: 100, maxLevel: 100, title: 'Aero Muse' },
];

const RANK_TABLES: Record<XpBar, RankEntry[]> = {
  chatter: CHATTER_RANKS,
  gamer: GAMER_RANKS,
  writer: WRITER_RANKS,
};

/** Get the rank title for a given bar and level. */
export function getRank(bar: XpBar, level: number): string {
  const table = RANK_TABLES[bar];
  const entry = table.find(r => level >= r.minLevel && level <= r.maxLevel);
  return entry?.title ?? table[0].title;
}

// ── Bar display metadata ──

export const BAR_META: Record<XpBar, { label: string; color: string; icon: string }> = {
  chatter: { label: 'Chatter', color: '#00d4ff', icon: 'MessageCircle' },
  gamer:   { label: 'Gamer',   color: '#3dd87a', icon: 'Gamepad2' },
  writer:  { label: 'Writer',  color: '#a855f7', icon: 'PenTool' },
};
