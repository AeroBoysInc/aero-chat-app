// src/store/xpStore.ts
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { type XpBar, DAILY_XP_CAP, deriveLevel, getRank } from '../lib/xpConfig';

export interface XpGain {
  bar: XpBar;
  amount: number;
  ts: number; // Date.now() — lets UI detect new gains
}

interface XpState {
  chatter_xp: number;
  gamer_xp: number;
  writer_xp: number;
  chatter_daily: number;
  gamer_daily: number;
  writer_daily: number;
  daily_date: string; // YYYY-MM-DD
  last_message_hash: string;
  streak_days: number;
  streak_date: string | null;
  loaded: boolean;
  lastGain: XpGain | null; // most recent XP award — drives UI animation
}

interface XpActions {
  loadXp: (userId: string) => Promise<void>;
  awardXp: (bar: XpBar, amount: number, userId: string, isPremium: boolean, messageHash?: string) => Promise<void>;
  /** Derived helpers — call these with a bar's total XP */
  getBarState: (bar: XpBar) => { totalXp: number; level: number; currentXp: number; nextXp: number; rank: string; dailyUsed: number };
}

type XpStore = XpState & XpActions;

// Rate-limit map: bar -> last award timestamp
const lastAwardTime: Record<string, number> = {};
const RATE_LIMIT_MS = 5000; // 5 seconds per bar

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export const useXpStore = create<XpStore>()((set, get) => ({
  chatter_xp: 0,
  gamer_xp: 0,
  writer_xp: 0,
  chatter_daily: 0,
  gamer_daily: 0,
  writer_daily: 0,
  daily_date: todayStr(),
  last_message_hash: '',
  streak_days: 0,
  streak_date: null,
  loaded: false,
  lastGain: null,

  loadXp: async (userId: string) => {
    const { data } = await supabase
      .from('user_xp')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (data) {
      // Reset daily counters if date has changed
      const today = todayStr();
      const isNewDay = data.daily_date !== today;
      set({
        chatter_xp: data.chatter_xp,
        gamer_xp: data.gamer_xp,
        writer_xp: data.writer_xp,
        chatter_daily: isNewDay ? 0 : data.chatter_daily,
        gamer_daily: isNewDay ? 0 : data.gamer_daily,
        writer_daily: isNewDay ? 0 : data.writer_daily,
        daily_date: today,
        last_message_hash: data.last_message_hash ?? '',
        streak_days: data.streak_days,
        streak_date: data.streak_date,
        loaded: true,
      });
      // Persist the daily reset if day changed
      if (isNewDay) {
        supabase.from('user_xp').update({
          chatter_daily: 0, gamer_daily: 0, writer_daily: 0, daily_date: today,
        }).eq('user_id', userId);
      }
    } else {
      // First time — create the row
      await supabase.from('user_xp').insert({ user_id: userId });
      set({ loaded: true });
    }
  },

  awardXp: async (bar, amount, userId, isPremium, messageHash) => {
    const s = get();
    if (!s.loaded) return;

    // ── Anti-abuse: rate limit (1 award per bar per 5s) ──
    const key = bar;
    const now = Date.now();
    if (lastAwardTime[key] && now - lastAwardTime[key] < RATE_LIMIT_MS) return;

    // ── Anti-abuse: duplicate message detection ──
    if (bar === 'chatter' && messageHash) {
      if (messageHash === s.last_message_hash) return;
    }

    // ── Daily cap check (free users only) ──
    const today = todayStr();
    const isNewDay = s.daily_date !== today;
    const dailyKey = `${bar}_daily` as const;
    const currentDaily = isNewDay ? 0 : s[dailyKey];
    if (!isPremium && currentDaily >= DAILY_XP_CAP) return;

    // Clamp amount to remaining cap (free users)
    const effectiveAmount = isPremium ? amount : Math.min(amount, DAILY_XP_CAP - currentDaily);
    if (effectiveAmount <= 0) return;

    // Record the award time
    lastAwardTime[key] = now;

    // ── Optimistic update ──
    const xpKey = `${bar}_xp` as const;
    const updates: Partial<XpState> = {
      [xpKey]: s[xpKey] + effectiveAmount,
      [dailyKey]: currentDaily + effectiveAmount,
      daily_date: today,
    };
    if (bar === 'chatter' && messageHash) {
      updates.last_message_hash = messageHash;
    }
    // Reset daily counters if new day
    if (isNewDay) {
      updates.chatter_daily = bar === 'chatter' ? effectiveAmount : 0;
      updates.gamer_daily = bar === 'gamer' ? effectiveAmount : 0;
      updates.writer_daily = bar === 'writer' ? effectiveAmount : 0;
    }
    set(updates);

    // Emit gain event for UI animation (separate set so React sees a new object ref)
    set({ lastGain: { bar, amount: effectiveAmount, ts: now } });

    // ── Persist to Supabase ──
    const dbUpdates: Record<string, unknown> = {
      [xpKey]: s[xpKey] + effectiveAmount,
      [dailyKey]: (isNewDay && bar !== dailyKey.replace('_daily', '') as XpBar) ? 0 : currentDaily + effectiveAmount,
      daily_date: today,
      updated_at: new Date().toISOString(),
    };
    // For daily reset on other bars
    if (isNewDay) {
      dbUpdates.chatter_daily = bar === 'chatter' ? effectiveAmount : 0;
      dbUpdates.gamer_daily = bar === 'gamer' ? effectiveAmount : 0;
      dbUpdates.writer_daily = bar === 'writer' ? effectiveAmount : 0;
    }
    if (bar === 'chatter' && messageHash) {
      dbUpdates.last_message_hash = messageHash;
    }
    supabase.from('user_xp').update(dbUpdates).eq('user_id', userId);
  },

  getBarState: (bar) => {
    const s = get();
    const xpKey = `${bar}_xp` as const;
    const dailyKey = `${bar}_daily` as const;
    const totalXp = s[xpKey];
    const { level, currentXp, nextXp } = deriveLevel(totalXp);
    const rank = getRank(bar, level);
    return { totalXp, level, currentXp, nextXp, rank, dailyUsed: s[dailyKey] };
  },
}));
