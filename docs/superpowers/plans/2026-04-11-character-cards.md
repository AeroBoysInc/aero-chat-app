# Character Cards — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Characters tab for the Dungeons & Servers toolkit — D&D Beyond character sync, manual character creation, compact sidebar cards with HP/XP bars, expanded character sheet popup, and real-time HP/XP updates.

**Architecture:** A new `dnd_characters` table stores one character per user per server. A dedicated Zustand store (`dndCharacterStore`) manages CRUD and Supabase Realtime subscriptions for live HP/XP updates. Characters can be linked from D&D Beyond (full mode with stats, AC, traits) or created manually (basic tracking only). The Characters tab replaces the placeholder in `ServerView` when `dndTab === 'characters'`.

**Tech Stack:** React 19, Zustand, Supabase (PostgreSQL + RLS + Realtime + Storage), TypeScript, Tailwind CSS with `--tk-*` custom properties.

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `supabase/migrations/033_dnd_characters.sql` | Database: `dnd_characters` table, RLS policies, realtime publication, `dnd-assets` storage bucket |
| `src/lib/dndbeyond.ts` | D&D Beyond API fetch + character JSON parser |
| `src/store/dndCharacterStore.ts` | Zustand store: character CRUD, realtime subscription, loading state |
| `src/components/servers/toolkits/HpBar.tsx` | Reusable HP bar with green→yellow→red gradient |
| `src/components/servers/toolkits/XpBar.tsx` | Reusable XP bar (gold) |
| `src/components/servers/toolkits/LinkCharacterModal.tsx` | Modal: D&D Beyond URL input + manual creation form |
| `src/components/servers/toolkits/CharacterCard.tsx` | Compact card: portrait, name, class, HP/XP bars |
| `src/components/servers/toolkits/CharacterSheet.tsx` | Expanded popup: full stat block, traits, sync info |
| `src/components/servers/toolkits/CharactersTab.tsx` | Main tab content: character list + "Link Character" button |

### Modified Files
| File | Changes |
|------|---------|
| `src/lib/serverTypes.ts` | Add `DndCharacter` interface |
| `src/components/servers/ServerView.tsx` | Replace Characters placeholder with `CharactersTab` |

---

### Task 1: Database Migration — `dnd_characters` Table + Storage Bucket

**Files:**
- Create: `supabase/migrations/033_dnd_characters.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- 033_dnd_characters.sql — DnD character cards + asset storage

-- ── 1. Characters table ──
CREATE TABLE dnd_characters (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id         UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source            TEXT NOT NULL CHECK (source IN ('dndbeyond', 'manual')),
  dndb_character_id TEXT,
  dndb_character_url TEXT,
  name              TEXT NOT NULL,
  race              TEXT NOT NULL DEFAULT '',
  class             TEXT NOT NULL DEFAULT '',
  level             INTEGER NOT NULL DEFAULT 1,
  portrait_url      TEXT,
  hp_current        INTEGER NOT NULL DEFAULT 0,
  hp_max            INTEGER NOT NULL DEFAULT 0,
  xp_current        INTEGER NOT NULL DEFAULT 0,
  xp_max            INTEGER NOT NULL DEFAULT 0,
  gold              INTEGER,
  stats             JSONB,
  armor_class       INTEGER,
  initiative        INTEGER,
  proficiency_bonus INTEGER,
  traits            TEXT[],
  last_synced_at    TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (server_id, user_id)
);

ALTER TABLE dnd_characters ENABLE ROW LEVEL SECURITY;

-- Server members can read all characters in their server
CREATE POLICY "char_select" ON dnd_characters
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM server_members
      WHERE server_members.server_id = dnd_characters.server_id
        AND server_members.user_id = auth.uid()
    )
  );

-- Users can insert their own character
CREATE POLICY "char_insert" ON dnd_characters
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM server_members
      WHERE server_members.server_id = dnd_characters.server_id
        AND server_members.user_id = auth.uid()
    )
  );

-- Users can update their own character
CREATE POLICY "char_update_own" ON dnd_characters
  FOR UPDATE USING (auth.uid() = user_id);

-- DMs can update any character (for HP adjustments during sessions)
CREATE POLICY "char_update_dm" ON dnd_characters
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM server_members sm
      JOIN server_role_permissions srp ON srp.role_id = sm.role_id
      WHERE sm.server_id = dnd_characters.server_id
        AND sm.user_id = auth.uid()
        AND srp.dungeon_master = true
    )
  );

-- Users can delete their own character
CREATE POLICY "char_delete" ON dnd_characters
  FOR DELETE USING (auth.uid() = user_id);

-- ── 2. Enable realtime for live HP/XP updates ──
ALTER TABLE dnd_characters REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE dnd_characters;

-- ── 3. Storage bucket for character portraits and map images ──
INSERT INTO storage.buckets (id, name, public) VALUES ('dnd-assets', 'dnd-assets', true);

CREATE POLICY "dnd_assets_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'dnd-assets');

CREATE POLICY "dnd_assets_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'dnd-assets' AND auth.role() = 'authenticated');

CREATE POLICY "dnd_assets_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'dnd-assets' AND auth.uid() = owner);
```

Create the file at `supabase/migrations/033_dnd_characters.sql`.

- [ ] **Step 2: Verify the SQL file is well-formed**

Run: `cat supabase/migrations/033_dnd_characters.sql`

Expected: The complete SQL above, no syntax errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/033_dnd_characters.sql
git commit -m "feat(db): add dnd_characters table, RLS, realtime, and dnd-assets bucket"
```

> **Note:** This migration must be run in the Supabase SQL editor before testing.

---

### Task 2: Type Definitions — `DndCharacter` Interface

**Files:**
- Modify: `src/lib/serverTypes.ts:91-96`

- [ ] **Step 1: Add `DndCharacter` interface**

In `src/lib/serverTypes.ts`, after the `ServerToolkit` interface (line 96), add:

```typescript
export interface DndCharacter {
  id: string;
  server_id: string;
  user_id: string;
  source: 'dndbeyond' | 'manual';
  dndb_character_id: string | null;
  dndb_character_url: string | null;
  name: string;
  race: string;
  class: string;
  level: number;
  portrait_url: string | null;
  hp_current: number;
  hp_max: number;
  xp_current: number;
  xp_max: number;
  gold: number | null;
  stats: { str: number; dex: number; con: number; int: number; wis: number; cha: number } | null;
  armor_class: number | null;
  initiative: number | null;
  proficiency_bonus: number | null;
  traits: string[] | null;
  last_synced_at: string | null;
  created_at: string;
}
```

- [ ] **Step 2: Build check**

Run: `cd aero-chat-app && pnpm build 2>&1 | tail -5`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/lib/serverTypes.ts
git commit -m "feat(types): add DndCharacter interface"
```

---

### Task 3: D&D Beyond API Helper

**Files:**
- Create: `src/lib/dndbeyond.ts`

This module fetches character data from D&D Beyond's public character JSON endpoint and transforms it into our `DndCharacter` shape. The API is unofficial and may fail (CORS, rate limits, private characters). All failures return a descriptive error string so the UI can prompt the user to use manual mode.

- [ ] **Step 1: Create the D&D Beyond helper**

```typescript
// src/lib/dndbeyond.ts

/**
 * Extract the numeric character ID from a D&D Beyond URL.
 * Supports: https://www.dndbeyond.com/characters/12345678
 *           https://www.dndbeyond.com/characters/12345678/some-name
 *           12345678 (bare ID)
 */
export function extractCharacterId(input: string): string | null {
  const trimmed = input.trim();
  // Bare numeric ID
  if (/^\d+$/.test(trimmed)) return trimmed;
  // URL pattern
  const match = trimmed.match(/dndbeyond\.com\/characters\/(\d+)/);
  return match ? match[1] : null;
}

/** D&D class color mapping — used for portrait borders and stat highlighting */
export const CLASS_COLORS: Record<string, string> = {
  barbarian: '#e53935',
  bard:      '#AB47BC',
  cleric:    '#FFD54F',
  druid:     '#66BB6A',
  fighter:   '#795548',
  monk:      '#00ACC1',
  paladin:   '#FFB74D',
  ranger:    '#4CAF50',
  rogue:     '#78909C',
  sorcerer:  '#EF5350',
  warlock:   '#7E57C2',
  wizard:    '#42A5F5',
  artificer: '#8D6E63',
  'blood hunter': '#C62828',
};

/** Get the class color for a character. Uses the first class for multiclass. */
export function getClassColor(className: string): string {
  const first = className.split(',')[0].split('/')[0].trim().toLowerCase();
  return CLASS_COLORS[first] ?? '#D2691E'; // fallback to medieval brown
}

interface DndbFetchResult {
  ok: true;
  data: {
    name: string;
    race: string;
    class: string;
    level: number;
    portraitUrl: string | null;
    hpCurrent: number;
    hpMax: number;
    xpCurrent: number;
    xpMax: number;
    stats: { str: number; dex: number; con: number; int: number; wis: number; cha: number };
    armorClass: number;
    initiative: number;
    proficiencyBonus: number;
    traits: string[];
  };
} | {
  ok: false;
  error: string;
};

/**
 * Fetch a character from D&D Beyond's public JSON endpoint.
 * This is an unofficial API — it may fail due to CORS, rate limits, or private characters.
 */
export async function fetchDndbCharacter(characterId: string): Promise<DndbFetchResult> {
  const url = `https://character-service.dndbeyond.com/character/v5/character/${characterId}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 404) return { ok: false, error: 'Character not found. Make sure sharing is enabled on D&D Beyond.' };
      if (res.status === 403) return { ok: false, error: 'Character is private. Enable sharing in D&D Beyond character settings.' };
      return { ok: false, error: `D&D Beyond returned status ${res.status}. Try again or use manual mode.` };
    }

    const json = await res.json();
    const char = json.data;
    if (!char) return { ok: false, error: 'Unexpected response format from D&D Beyond.' };

    // Parse classes (multiclass: "Fighter 5 / Rogue 3")
    const classes = (char.classes ?? [])
      .map((c: any) => `${c.definition?.name ?? 'Unknown'} ${c.level}`)
      .join(' / ');
    const totalLevel = (char.classes ?? []).reduce((sum: number, c: any) => sum + (c.level ?? 0), 0);

    // Parse race
    const race = char.race?.fullName ?? char.race?.baseName ?? '';

    // Parse stats
    const statMap = { 1: 'str', 2: 'dex', 3: 'con', 4: 'int', 5: 'wis', 6: 'cha' } as const;
    const stats = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    for (const s of char.stats ?? []) {
      const key = statMap[s.id as keyof typeof statMap];
      if (key) stats[key] = s.value ?? 10;
    }
    // Add racial + other bonuses
    for (const mod of char.modifiers?.race ?? []) {
      if (mod.type === 'bonus' && mod.subType?.endsWith('-score')) {
        const abbr = mod.subType.replace('-score', '').slice(0, 3) as keyof typeof stats;
        if (abbr in stats) stats[abbr] += mod.value ?? 0;
      }
    }

    // HP
    const hpMax = char.overrideHitPoints ?? (char.baseHitPoints ?? 0) + ((stats.con - 10) / 2 | 0) * totalLevel;
    const hpCurrent = hpMax - (char.removedHitPoints ?? 0);

    // XP
    const xpCurrent = char.currentXp ?? 0;
    // XP thresholds by level (5e)
    const XP_TABLE = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];
    const xpMax = XP_TABLE[totalLevel] ?? 355000;

    // AC — simplified: base 10 + DEX mod, or use overrideArmorClass
    const dexMod = (stats.dex - 10) / 2 | 0;
    const armorClass = char.overrideArmorClass ?? 10 + dexMod;

    // Initiative
    const initiative = dexMod;

    // Proficiency bonus (5e standard)
    const proficiencyBonus = Math.ceil(totalLevel / 4) + 1;

    // Traits — racial features + notable things
    const traits: string[] = [];
    for (const feat of char.race?.racialTraits ?? []) {
      if (feat.definition?.name) traits.push(feat.definition.name);
    }

    // Portrait
    const portraitUrl = char.decorations?.avatarUrl ?? char.avatarUrl ?? null;

    return {
      ok: true,
      data: {
        name: char.name ?? 'Unknown',
        race,
        class: classes || 'Unknown',
        level: totalLevel || 1,
        portraitUrl,
        hpCurrent: Math.max(0, hpCurrent),
        hpMax: Math.max(1, hpMax),
        xpCurrent,
        xpMax,
        stats,
        armorClass,
        initiative,
        proficiencyBonus,
        traits: traits.slice(0, 10),
      },
    };
  } catch (err) {
    // CORS errors, network failures, etc.
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      return { ok: false, error: 'Could not reach D&D Beyond. This may be a CORS restriction — try manual mode instead, or check your network connection.' };
    }
    return { ok: false, error: `Failed to fetch character: ${msg}` };
  }
}
```

- [ ] **Step 2: Build check**

Run: `cd aero-chat-app && pnpm build 2>&1 | tail -5`

Expected: Build succeeds (module created but not imported yet).

- [ ] **Step 3: Commit**

```bash
git add src/lib/dndbeyond.ts
git commit -m "feat: add D&D Beyond API fetch helper and class color map"
```

---

### Task 4: Character Store — `dndCharacterStore`

**Files:**
- Create: `src/store/dndCharacterStore.ts`

This Zustand store manages the character list for the currently selected server. It loads characters from Supabase, subscribes to realtime updates for live HP/XP changes, and provides insert/update/delete actions.

- [ ] **Step 1: Create the store**

```typescript
// src/store/dndCharacterStore.ts
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { DndCharacter } from '../lib/serverTypes';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface DndCharacterStoreState {
  characters: DndCharacter[];
  loading: boolean;
  loadCharacters: (serverId: string) => Promise<void>;
  upsertCharacter: (char: Omit<DndCharacter, 'id' | 'created_at'>) => Promise<{ error?: string }>;
  updateCharacter: (id: string, fields: Partial<DndCharacter>) => Promise<{ error?: string }>;
  deleteCharacter: (id: string) => Promise<{ error?: string }>;
  subscribeRealtime: (serverId: string) => () => void;
  reset: () => void;
}

export const useDndCharacterStore = create<DndCharacterStoreState>()((set, get) => {
  let channel: RealtimeChannel | null = null;

  return {
    characters: [],
    loading: false,

    loadCharacters: async (serverId) => {
      set({ loading: true });
      const { data } = await supabase
        .from('dnd_characters')
        .select('*')
        .eq('server_id', serverId)
        .order('created_at', { ascending: true });
      set({ characters: data ?? [], loading: false });
    },

    upsertCharacter: async (char) => {
      const { error } = await supabase
        .from('dnd_characters')
        .upsert(char, { onConflict: 'server_id,user_id' });
      if (error) return { error: error.message };
      // Reload to get the server-generated id + created_at
      await get().loadCharacters(char.server_id);
      return {};
    },

    updateCharacter: async (id, fields) => {
      const { error } = await supabase
        .from('dnd_characters')
        .update(fields)
        .eq('id', id);
      if (error) return { error: error.message };
      // Optimistic local update
      set(s => ({
        characters: s.characters.map(c => c.id === id ? { ...c, ...fields } : c),
      }));
      return {};
    },

    deleteCharacter: async (id) => {
      const { error } = await supabase
        .from('dnd_characters')
        .delete()
        .eq('id', id);
      if (error) return { error: error.message };
      set(s => ({ characters: s.characters.filter(c => c.id !== id) }));
      return {};
    },

    subscribeRealtime: (serverId) => {
      // Unsubscribe from previous channel if any
      if (channel) { supabase.removeChannel(channel); channel = null; }

      channel = supabase
        .channel(`dnd-chars:${serverId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'dnd_characters', filter: `server_id=eq.${serverId}` },
          (payload) => {
            const { eventType } = payload;
            if (eventType === 'INSERT') {
              const newChar = payload.new as DndCharacter;
              set(s => {
                if (s.characters.some(c => c.id === newChar.id)) return s;
                return { characters: [...s.characters, newChar] };
              });
            } else if (eventType === 'UPDATE') {
              const updated = payload.new as DndCharacter;
              set(s => ({
                characters: s.characters.map(c => c.id === updated.id ? updated : c),
              }));
            } else if (eventType === 'DELETE') {
              const old = payload.old as { id: string };
              set(s => ({
                characters: s.characters.filter(c => c.id !== old.id),
              }));
            }
          }
        )
        .subscribe();

      return () => {
        if (channel) { supabase.removeChannel(channel); channel = null; }
      };
    },

    reset: () => {
      if (channel) { supabase.removeChannel(channel); channel = null; }
      set({ characters: [], loading: false });
    },
  };
});
```

- [ ] **Step 2: Build check**

Run: `cd aero-chat-app && pnpm build 2>&1 | tail -5`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/store/dndCharacterStore.ts
git commit -m "feat: add dndCharacterStore with CRUD and realtime subscription"
```

---

### Task 5: HP Bar and XP Bar Components

**Files:**
- Create: `src/components/servers/toolkits/HpBar.tsx`
- Create: `src/components/servers/toolkits/XpBar.tsx`

- [ ] **Step 1: Create the HpBar component**

```typescript
// src/components/servers/toolkits/HpBar.tsx
import { memo } from 'react';

/**
 * HP bar with color gradient: green (100–60%) → yellow (60–30%) → red (30–0%).
 * Spec: #4CAF50 at 100%, #FFA000 at mid, #e53935 at 0%.
 */
function hpColor(pct: number): string {
  if (pct >= 60) return '#4CAF50';
  if (pct >= 30) return '#FFA000';
  return '#e53935';
}

export const HpBar = memo(function HpBar({
  current,
  max,
  height = 6,
  showLabel = false,
}: {
  current: number;
  max: number;
  height?: number;
  showLabel?: boolean;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  const color = hpColor(pct);

  return (
    <div>
      {showLabel && (
        <div className="flex justify-between mb-0.5" style={{ fontSize: 9, color: 'var(--tk-text-muted, var(--text-muted))' }}>
          <span>HP</span>
          <span>{current}/{max}</span>
        </div>
      )}
      <div style={{
        width: '100%', height, borderRadius: height / 2,
        background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: height / 2,
          background: color,
          boxShadow: `0 0 6px ${color}40`,
          transition: 'width 0.4s ease, background 0.4s ease',
        }} />
      </div>
    </div>
  );
});
```

- [ ] **Step 2: Create the XpBar component**

```typescript
// src/components/servers/toolkits/XpBar.tsx
import { memo } from 'react';

/**
 * XP bar — always gold (#FFD700 / --tk-gold).
 */
export const XpBar = memo(function XpBar({
  current,
  max,
  height = 4,
  showLabel = false,
}: {
  current: number;
  max: number;
  height?: number;
  showLabel?: boolean;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;

  return (
    <div>
      {showLabel && (
        <div className="flex justify-between mb-0.5" style={{ fontSize: 9, color: 'var(--tk-text-muted, var(--text-muted))' }}>
          <span>XP</span>
          <span>{current}/{max}</span>
        </div>
      )}
      <div style={{
        width: '100%', height, borderRadius: height / 2,
        background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: height / 2,
          background: 'var(--tk-gold, #FFD700)',
          boxShadow: '0 0 6px rgba(255,215,0,0.3)',
          transition: 'width 0.4s ease',
        }} />
      </div>
    </div>
  );
});
```

- [ ] **Step 3: Build check**

Run: `cd aero-chat-app && pnpm build 2>&1 | tail -5`

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/servers/toolkits/HpBar.tsx src/components/servers/toolkits/XpBar.tsx
git commit -m "feat: add HpBar and XpBar components with color gradients"
```

---

### Task 6: Character Compact Card

**Files:**
- Create: `src/components/servers/toolkits/CharacterCard.tsx`

The compact card is displayed in the Characters tab list. It shows the portrait, name, race/class/level, HP bar, XP bar, and a DM badge for dungeon masters.

- [ ] **Step 1: Create the CharacterCard component**

```typescript
// src/components/servers/toolkits/CharacterCard.tsx
import { memo } from 'react';
import type { DndCharacter, ServerMember } from '../../../lib/serverTypes';
import { getClassColor } from '../../../lib/dndbeyond';
import { HpBar } from './HpBar';
import { XpBar } from './XpBar';

export const CharacterCard = memo(function CharacterCard({
  character,
  member,
  isDm,
  onClick,
}: {
  character: DndCharacter;
  member: ServerMember | undefined;
  isDm: boolean;
  onClick: () => void;
}) {
  const classColor = getClassColor(character.class);
  const lowHp = character.hp_max > 0 && character.hp_current / character.hp_max < 0.25;

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99]"
      style={{
        padding: 12, border: '1px solid var(--tk-border, var(--panel-divider))',
        background: 'var(--tk-panel, rgba(0,180,255,0.04))',
        cursor: 'pointer',
      }}
    >
      <div className="flex items-center gap-3">
        {/* Portrait */}
        <div style={{
          width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
          border: `2px solid ${classColor}`,
          background: character.portrait_url
            ? `url(${character.portrait_url}) center/cover`
            : `linear-gradient(135deg, ${classColor}40, ${classColor}15)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, color: classColor,
          position: 'relative',
        }}>
          {!character.portrait_url && '🛡️'}
          {lowHp && (
            <div style={{
              position: 'absolute', top: -2, right: -2,
              width: 14, height: 14, borderRadius: '50%',
              background: '#e53935', color: '#fff',
              fontSize: 9, fontWeight: 800, lineHeight: '14px', textAlign: 'center',
            }}>!</div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-xs font-bold" style={{ color: 'var(--tk-text, var(--text-primary))' }}>
              {character.name}
            </span>
            {isDm && (
              <span style={{
                fontSize: 8, padding: '1px 5px', borderRadius: 4, flexShrink: 0,
                background: 'rgba(255,215,0,0.12)', border: '1px solid rgba(255,215,0,0.25)',
                color: 'var(--tk-gold, #FFD700)', fontWeight: 700,
              }}>DM</span>
            )}
          </div>
          <p className="truncate" style={{ fontSize: 10, color: 'var(--tk-text-muted, var(--text-muted))', marginTop: 1 }}>
            {character.race} {character.class} · Lv {character.level}
          </p>
          {member && (
            <p className="truncate" style={{ fontSize: 9, color: 'var(--tk-text-muted, var(--text-muted))', opacity: 0.7, marginTop: 1 }}>
              @{member.username}
            </p>
          )}
        </div>
      </div>

      {/* Bars */}
      <div className="mt-2.5 flex flex-col gap-1">
        <HpBar current={character.hp_current} max={character.hp_max} height={5} />
        <XpBar current={character.xp_current} max={character.xp_max} height={3} />
      </div>
    </button>
  );
});
```

- [ ] **Step 2: Build check**

Run: `cd aero-chat-app && pnpm build 2>&1 | tail -5`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/servers/toolkits/CharacterCard.tsx
git commit -m "feat: add CharacterCard — compact card with portrait, HP/XP bars"
```

---

### Task 7: Character Sheet — Expanded Popup

**Files:**
- Create: `src/components/servers/toolkits/CharacterSheet.tsx`

The expanded popup shows full character details: larger portrait, stat grid (D&D Beyond mode), HP/XP with labels, quick-info badges, and sync footer. DMs see an "Edit HP" button.

- [ ] **Step 1: Create the CharacterSheet component**

```typescript
// src/components/servers/toolkits/CharacterSheet.tsx
import { memo, useState } from 'react';
import { X, RefreshCw, Trash2 } from 'lucide-react';
import type { DndCharacter, ServerMember } from '../../../lib/serverTypes';
import { getClassColor, fetchDndbCharacter } from '../../../lib/dndbeyond';
import { useDndCharacterStore } from '../../../store/dndCharacterStore';
import { HpBar } from './HpBar';
import { XpBar } from './XpBar';

const STAT_LABELS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const;
const STAT_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;

export const CharacterSheet = memo(function CharacterSheet({
  character,
  member,
  isDm,
  isOwn,
  onClose,
}: {
  character: DndCharacter;
  member: ServerMember | undefined;
  isDm: boolean;
  isOwn: boolean;
  onClose: () => void;
}) {
  const { updateCharacter, deleteCharacter } = useDndCharacterStore();
  const classColor = getClassColor(character.class);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [editingHp, setEditingHp] = useState(false);
  const [hpVal, setHpVal] = useState(String(character.hp_current));

  const canEdit = isOwn || isDm;

  const handleSync = async () => {
    if (!character.dndb_character_id) return;
    setSyncing(true);
    setSyncError('');
    const result = await fetchDndbCharacter(character.dndb_character_id);
    if (!result.ok) {
      setSyncError(result.error);
      setSyncing(false);
      return;
    }
    const d = result.data;
    await updateCharacter(character.id, {
      name: d.name, race: d.race, class: d.class, level: d.level,
      portrait_url: d.portraitUrl, hp_current: d.hpCurrent, hp_max: d.hpMax,
      xp_current: d.xpCurrent, xp_max: d.xpMax, stats: d.stats,
      armor_class: d.armorClass, initiative: d.initiative,
      proficiency_bonus: d.proficiencyBonus, traits: d.traits,
      last_synced_at: new Date().toISOString(),
    });
    setSyncing(false);
  };

  const handleHpSave = async () => {
    const val = parseInt(hpVal, 10);
    if (!isNaN(val)) {
      await updateCharacter(character.id, { hp_current: Math.max(0, Math.min(val, character.hp_max)) });
    }
    setEditingHp(false);
  };

  const handleDelete = async () => {
    await deleteCharacter(character.id);
    onClose();
  };

  const timeSinceSync = character.last_synced_at
    ? `${Math.round((Date.now() - new Date(character.last_synced_at).getTime()) / 60000)} min ago`
    : null;

  return (
    <div
      className="animate-fade-in"
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        backdropFilter: 'blur(20px)', background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 420, maxHeight: '85vh', borderRadius: 20, overflow: 'hidden',
          background: 'var(--sidebar-bg)', border: `1px solid ${classColor}30`,
          boxShadow: `0 24px 80px rgba(0,0,0,0.5), 0 0 40px ${classColor}15`,
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--tk-border, var(--panel-divider))' }}>
          <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--tk-text, var(--text-primary))' }}>
            Character Sheet
          </span>
          <div className="flex items-center gap-2">
            {isOwn && (
              <button onClick={handleDelete} style={{ color: '#cc4444', background: 'none', border: 'none', cursor: 'pointer' }} title="Delete character">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            <button onClick={onClose} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Portrait + name */}
          <div className="flex items-center gap-4 mb-4">
            <div style={{
              width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
              border: `3px solid ${classColor}`,
              boxShadow: `0 0 16px ${classColor}30`,
              background: character.portrait_url
                ? `url(${character.portrait_url}) center/cover`
                : `linear-gradient(135deg, ${classColor}40, ${classColor}15)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, color: classColor,
            }}>
              {!character.portrait_url && '🛡️'}
            </div>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--tk-text, var(--text-primary))', margin: 0 }}>
                {character.name}
              </h3>
              <p style={{ fontSize: 12, color: 'var(--tk-text-muted, var(--text-muted))', margin: '2px 0 0' }}>
                {character.race} {character.class} · Level {character.level}
              </p>
              {member && (
                <p style={{ fontSize: 11, color: 'var(--tk-text-muted, var(--text-muted))', opacity: 0.7, margin: '2px 0 0' }}>
                  Played by @{member.username}
                </p>
              )}
            </div>
          </div>

          {/* Stat grid — D&D Beyond only */}
          {character.source === 'dndbeyond' && character.stats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 16 }}>
              {STAT_LABELS.map((label, i) => {
                const val = character.stats![STAT_KEYS[i]];
                const mod = ((val - 10) / 2) | 0;
                const isHigh = val >= 14;
                const isLow = val <= 8;
                return (
                  <div key={label} style={{
                    padding: '8px 6px', borderRadius: 10, textAlign: 'center',
                    background: 'var(--tk-panel, rgba(0,180,255,0.04))',
                    border: `1px solid ${isHigh ? classColor + '40' : 'var(--tk-border, var(--panel-divider))'}`,
                    opacity: isLow ? 0.5 : 1,
                  }}>
                    <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--tk-text-muted, var(--text-muted))', letterSpacing: '0.05em' }}>{label}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: isHigh ? classColor : 'var(--tk-text, var(--text-primary))' }}>{val}</div>
                    <div style={{ fontSize: 10, color: 'var(--tk-text-muted, var(--text-muted))' }}>{mod >= 0 ? '+' : ''}{mod}</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* HP bar */}
          <div style={{ marginBottom: 12 }}>
            <div className="flex items-center justify-between mb-1">
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--tk-text-muted, var(--text-muted))' }}>HP</span>
              <div className="flex items-center gap-2">
                {editingHp ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={hpVal}
                      onChange={e => setHpVal(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleHpSave(); if (e.key === 'Escape') setEditingHp(false); }}
                      autoFocus
                      style={{
                        width: 50, padding: '2px 4px', borderRadius: 4, fontSize: 11, textAlign: 'center',
                        background: 'rgba(255,255,255,0.06)', border: '1px solid var(--tk-border, var(--panel-divider))',
                        color: 'var(--tk-text, var(--text-primary))', outline: 'none',
                      }}
                    />
                    <span style={{ fontSize: 10, color: 'var(--tk-text-muted, var(--text-muted))' }}>/ {character.hp_max}</span>
                    <button onClick={handleHpSave} style={{ fontSize: 10, color: '#4CAF50', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Save</button>
                  </div>
                ) : (
                  <>
                    <span style={{ fontSize: 11, color: 'var(--tk-text, var(--text-primary))' }}>{character.hp_current}/{character.hp_max}</span>
                    {canEdit && (
                      <button onClick={() => { setHpVal(String(character.hp_current)); setEditingHp(true); }}
                        style={{ fontSize: 9, color: 'var(--tk-accent-light, #00d4ff)', background: 'none', border: 'none', cursor: 'pointer' }}>
                        Edit
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
            <HpBar current={character.hp_current} max={character.hp_max} height={8} />
          </div>

          {/* XP bar */}
          <div style={{ marginBottom: 16 }}>
            <XpBar current={character.xp_current} max={character.xp_max} height={6} showLabel />
          </div>

          {/* Quick-info badges — D&D Beyond only */}
          {character.source === 'dndbeyond' && (
            <div className="flex flex-wrap gap-1.5" style={{ marginBottom: 16 }}>
              {character.armor_class != null && (
                <span style={badgeStyle}>🛡️ AC {character.armor_class}</span>
              )}
              {character.initiative != null && (
                <span style={badgeStyle}>⚡ Init {character.initiative >= 0 ? '+' : ''}{character.initiative}</span>
              )}
              {character.proficiency_bonus != null && (
                <span style={badgeStyle}>🎯 Prof +{character.proficiency_bonus}</span>
              )}
              {character.traits?.map(t => (
                <span key={t} style={badgeStyle}>✦ {t}</span>
              ))}
            </div>
          )}

          {/* Gold */}
          {character.gold != null && character.gold > 0 && (
            <p style={{ fontSize: 11, color: 'var(--tk-gold, #FFD700)', marginBottom: 12 }}>
              💰 {character.gold.toLocaleString()} gold
            </p>
          )}

          {/* Sync error */}
          {syncError && (
            <p style={{ fontSize: 11, color: '#e53935', marginBottom: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(229,57,53,0.08)' }}>
              {syncError}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderTop: '1px solid var(--tk-border, var(--panel-divider))' }}>
          <span style={{ fontSize: 10, color: 'var(--tk-text-muted, var(--text-muted))' }}>
            {character.source === 'dndbeyond'
              ? `Synced from D&D Beyond${timeSinceSync ? ` · ${timeSinceSync}` : ''}`
              : 'Manual character'}
          </span>
          {character.source === 'dndbeyond' && isOwn && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-1 text-xs font-medium transition-opacity disabled:opacity-50"
              style={{ color: 'var(--tk-accent-light, #00d4ff)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing…' : 'Refresh'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

const badgeStyle: React.CSSProperties = {
  padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 500,
  background: 'var(--tk-panel, rgba(0,180,255,0.06))',
  border: '1px solid var(--tk-border, var(--panel-divider))',
  color: 'var(--tk-text-muted, var(--text-muted))',
  whiteSpace: 'nowrap',
};
```

- [ ] **Step 2: Build check**

Run: `cd aero-chat-app && pnpm build 2>&1 | tail -5`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/servers/toolkits/CharacterSheet.tsx
git commit -m "feat: add CharacterSheet — expanded character popup with stat grid and HP editing"
```

---

### Task 8: Link Character Modal — D&D Beyond + Manual Mode

**Files:**
- Create: `src/components/servers/toolkits/LinkCharacterModal.tsx`

This modal has two tabs: "D&D Beyond" (paste a URL, fetch + preview) and "Manual" (fill in basic info). A warning banner is shown before manual creation.

- [ ] **Step 1: Create the LinkCharacterModal component**

```typescript
// src/components/servers/toolkits/LinkCharacterModal.tsx
import { memo, useState, useRef } from 'react';
import { X, Upload } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { useServerStore } from '../../../store/serverStore';
import { useDndCharacterStore } from '../../../store/dndCharacterStore';
import { supabase } from '../../../lib/supabase';
import { extractCharacterId, fetchDndbCharacter } from '../../../lib/dndbeyond';

type Mode = 'dndbeyond' | 'manual';

export const LinkCharacterModal = memo(function LinkCharacterModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const user = useAuthStore(s => s.user);
  const selectedServerId = useServerStore(s => s.selectedServerId);
  const { upsertCharacter } = useDndCharacterStore();

  const [mode, setMode] = useState<Mode>('dndbeyond');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // D&D Beyond state
  const [url, setUrl] = useState('');

  // Manual state
  const [name, setName] = useState('');
  const [race, setRace] = useState('');
  const [charClass, setCharClass] = useState('');
  const [level, setLevel] = useState('1');
  const [hpMax, setHpMax] = useState('');
  const [hpCurrent, setHpCurrent] = useState('');
  const [xpMax, setXpMax] = useState('');
  const [xpCurrent, setXpCurrent] = useState('');
  const [gold, setGold] = useState('');
  const [portraitFile, setPortraitFile] = useState<File | null>(null);
  const [portraitPreview, setPortraitPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePortraitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPortraitFile(file);
    setPortraitPreview(URL.createObjectURL(file));
  };

  const handleDndbSubmit = async () => {
    if (!user || !selectedServerId) return;
    const charId = extractCharacterId(url);
    if (!charId) { setError('Invalid D&D Beyond URL or character ID.'); return; }

    setLoading(true);
    setError('');
    const result = await fetchDndbCharacter(charId);
    if (!result.ok) { setError(result.error); setLoading(false); return; }

    const d = result.data;
    const res = await upsertCharacter({
      server_id: selectedServerId,
      user_id: user.id,
      source: 'dndbeyond',
      dndb_character_id: charId,
      dndb_character_url: url.trim(),
      name: d.name,
      race: d.race,
      class: d.class,
      level: d.level,
      portrait_url: d.portraitUrl,
      hp_current: d.hpCurrent,
      hp_max: d.hpMax,
      xp_current: d.xpCurrent,
      xp_max: d.xpMax,
      gold: null,
      stats: d.stats,
      armor_class: d.armorClass,
      initiative: d.initiative,
      proficiency_bonus: d.proficiencyBonus,
      traits: d.traits,
      last_synced_at: new Date().toISOString(),
    });
    setLoading(false);
    if (res.error) { setError(res.error); return; }
    onClose();
  };

  const handleManualSubmit = async () => {
    if (!user || !selectedServerId || !name.trim()) { setError('Character name is required.'); return; }
    setLoading(true);
    setError('');

    // Upload portrait if provided
    let portrait_url: string | null = null;
    if (portraitFile) {
      const path = `${user.id}/${Date.now()}-portrait`;
      const { error: upErr } = await supabase.storage.from('dnd-assets').upload(path, portraitFile);
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('dnd-assets').getPublicUrl(path);
        portrait_url = urlData.publicUrl;
      }
    }

    const res = await upsertCharacter({
      server_id: selectedServerId,
      user_id: user.id,
      source: 'manual',
      dndb_character_id: null,
      dndb_character_url: null,
      name: name.trim(),
      race: race.trim(),
      class: charClass.trim(),
      level: parseInt(level, 10) || 1,
      portrait_url,
      hp_current: parseInt(hpCurrent, 10) || 0,
      hp_max: parseInt(hpMax, 10) || 0,
      xp_current: parseInt(xpCurrent, 10) || 0,
      xp_max: parseInt(xpMax, 10) || 0,
      gold: gold ? parseInt(gold, 10) : null,
      stats: null,
      armor_class: null,
      initiative: null,
      proficiency_bonus: null,
      traits: null,
      last_synced_at: null,
    });
    setLoading(false);
    if (res.error) { setError(res.error); return; }
    onClose();
  };

  return (
    <div
      className="animate-fade-in"
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        backdropFilter: 'blur(20px)', background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 460, maxHeight: '85vh', borderRadius: 20, overflow: 'hidden',
          background: 'var(--sidebar-bg)', border: '1px solid var(--tk-border, var(--panel-divider))',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--tk-border, var(--panel-divider))' }}>
          <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--tk-text, var(--text-primary))' }}>
            Link Character
          </span>
          <button onClick={onClose} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1 px-5 py-2" style={{ borderBottom: '1px solid var(--tk-border, var(--panel-divider))' }}>
          {(['dndbeyond', 'manual'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); }}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
              style={{
                background: mode === m ? 'var(--tk-accent-glow, rgba(0,212,255,0.12))' : 'transparent',
                color: mode === m ? 'var(--tk-accent-light, #00d4ff)' : 'var(--tk-text-muted, var(--text-muted))',
                border: 'none', cursor: 'pointer',
              }}
            >
              {m === 'dndbeyond' ? '🎲 D&D Beyond' : '✏️ Manual'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {mode === 'dndbeyond' ? (
            <div>
              <p style={{ fontSize: 12, color: 'var(--tk-text-muted, var(--text-muted))', marginBottom: 12, lineHeight: 1.5 }}>
                Paste your D&D Beyond character URL or ID. Make sure sharing is enabled on your character.
              </p>
              <input
                type="text"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://www.dndbeyond.com/characters/12345678"
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 10, fontSize: 13,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid var(--tk-border, var(--panel-divider))',
                  color: 'var(--tk-text, var(--text-primary))', outline: 'none',
                }}
              />
            </div>
          ) : (
            <div>
              {/* Manual mode warning */}
              <div style={{
                padding: '10px 14px', borderRadius: 10, marginBottom: 14,
                background: 'rgba(255,160,0,0.08)', border: '1px solid rgba(255,160,0,0.20)',
              }}>
                <p style={{ fontSize: 11, color: '#FFA000', lineHeight: 1.5, margin: 0 }}>
                  Dungeons & Servers is designed to sync with D&D Beyond for the full experience. Manual mode is for players using other platforms (Foundry VTT, Roll20, pen & paper). You'll only be able to track basic info — this won't build a character sheet for you.
                </p>
              </div>

              {/* Portrait upload */}
              <div className="flex items-center gap-3 mb-3">
                <button
                  onClick={() => fileRef.current?.click()}
                  style={{
                    width: 56, height: 56, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
                    background: portraitPreview ? `url(${portraitPreview}) center/cover` : 'rgba(255,255,255,0.04)',
                    border: '2px dashed var(--tk-border, var(--panel-divider))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--tk-text-muted, var(--text-muted))',
                  }}
                >
                  {!portraitPreview && <Upload className="h-4 w-4" />}
                </button>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={handlePortraitChange} />
                <span style={{ fontSize: 11, color: 'var(--tk-text-muted, var(--text-muted))' }}>
                  {portraitFile ? portraitFile.name : 'Upload portrait (optional)'}
                </span>
              </div>

              {/* Form fields */}
              <div className="flex flex-col gap-2.5">
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Character name *" style={inputStyle} />
                <div className="flex gap-2">
                  <input value={race} onChange={e => setRace(e.target.value)} placeholder="Race" style={{ ...inputStyle, flex: 1 }} />
                  <input value={charClass} onChange={e => setCharClass(e.target.value)} placeholder="Class" style={{ ...inputStyle, flex: 1 }} />
                </div>
                <div className="flex gap-2">
                  <input type="number" value={level} onChange={e => setLevel(e.target.value)} placeholder="Level" style={{ ...inputStyle, flex: 1 }} />
                  <input type="number" value={gold} onChange={e => setGold(e.target.value)} placeholder="Gold" style={{ ...inputStyle, flex: 1 }} />
                </div>
                <div className="flex gap-2">
                  <input type="number" value={hpCurrent} onChange={e => setHpCurrent(e.target.value)} placeholder="HP current" style={{ ...inputStyle, flex: 1 }} />
                  <input type="number" value={hpMax} onChange={e => setHpMax(e.target.value)} placeholder="HP max" style={{ ...inputStyle, flex: 1 }} />
                </div>
                <div className="flex gap-2">
                  <input type="number" value={xpCurrent} onChange={e => setXpCurrent(e.target.value)} placeholder="XP current" style={{ ...inputStyle, flex: 1 }} />
                  <input type="number" value={xpMax} onChange={e => setXpMax(e.target.value)} placeholder="XP max" style={{ ...inputStyle, flex: 1 }} />
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <p style={{ fontSize: 11, color: '#e53935', marginTop: 10, padding: '6px 10px', borderRadius: 8, background: 'rgba(229,57,53,0.08)' }}>
              {error}
            </p>
          )}
        </div>

        {/* Submit */}
        <div className="px-5 py-3 flex-shrink-0" style={{ borderTop: '1px solid var(--tk-border, var(--panel-divider))' }}>
          <button
            onClick={mode === 'dndbeyond' ? handleDndbSubmit : handleManualSubmit}
            disabled={loading || (mode === 'dndbeyond' ? !url.trim() : !name.trim())}
            className="w-full transition-all active:scale-[0.98] disabled:opacity-50"
            style={{
              padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              background: 'linear-gradient(135deg, #8B4513, #D2691E)',
              border: 'none', color: '#fff',
            }}
          >
            {loading ? (mode === 'dndbeyond' ? 'Fetching character…' : 'Creating…')
              : mode === 'dndbeyond' ? 'Link Character' : 'Create Character'}
          </button>
        </div>
      </div>
    </div>
  );
});

const inputStyle: React.CSSProperties = {
  padding: '9px 12px', borderRadius: 8, fontSize: 12,
  background: 'rgba(255,255,255,0.04)', border: '1px solid var(--tk-border, var(--panel-divider))',
  color: 'var(--tk-text, var(--text-primary))', outline: 'none', width: '100%',
};
```

- [ ] **Step 2: Build check**

Run: `cd aero-chat-app && pnpm build 2>&1 | tail -5`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/servers/toolkits/LinkCharacterModal.tsx
git commit -m "feat: add LinkCharacterModal — D&D Beyond sync and manual character creation"
```

---

### Task 9: Characters Tab — Main Tab Content

**Files:**
- Create: `src/components/servers/toolkits/CharactersTab.tsx`

This is the content component rendered when `dndTab === 'characters'` in ServerView. It shows the character list as compact cards, a "Link Character" button (if the user hasn't linked one yet), and opens the expanded CharacterSheet on card click.

- [ ] **Step 1: Create the CharactersTab component**

```typescript
// src/components/servers/toolkits/CharactersTab.tsx
import { memo, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { useServerStore } from '../../../store/serverStore';
import { useServerRoleStore } from '../../../store/serverRoleStore';
import { useDndCharacterStore } from '../../../store/dndCharacterStore';
import type { DndCharacter } from '../../../lib/serverTypes';
import { CharacterCard } from './CharacterCard';
import { CharacterSheet } from './CharacterSheet';
import { LinkCharacterModal } from './LinkCharacterModal';

export const CharactersTab = memo(function CharactersTab() {
  const user = useAuthStore(s => s.user);
  const { selectedServerId, members } = useServerStore();
  const { hasPermission } = useServerRoleStore();
  const { characters, loading, loadCharacters, subscribeRealtime } = useDndCharacterStore();
  const [linkOpen, setLinkOpen] = useState(false);
  const [inspecting, setInspecting] = useState<DndCharacter | null>(null);

  // Load characters and subscribe to realtime
  useEffect(() => {
    if (!selectedServerId) return;
    loadCharacters(selectedServerId);
    const unsub = subscribeRealtime(selectedServerId);
    return unsub;
  }, [selectedServerId]);

  const myChar = characters.find(c => c.user_id === user?.id);
  const isDm = user && selectedServerId
    ? hasPermission(selectedServerId, user.id, members, 'dungeon_master')
    : false;

  return (
    <div className="flex h-full flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--tk-border, var(--panel-divider))' }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--tk-text, var(--text-primary))', margin: 0 }}>
            Characters
          </h3>
          <p style={{ fontSize: 10, color: 'var(--tk-text-muted, var(--text-muted))', margin: '2px 0 0' }}>
            {characters.length} character{characters.length !== 1 ? 's' : ''} in this server
          </p>
        </div>
        {!myChar && (
          <button
            onClick={() => setLinkOpen(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.97]"
            style={{
              background: 'linear-gradient(135deg, #8B4513, #D2691E)',
              border: 'none', color: '#fff', cursor: 'pointer',
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Link Character
          </button>
        )}
      </div>

      {/* Character list */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading && characters.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p style={{ fontSize: 12, color: 'var(--tk-text-muted, var(--text-muted))' }}>Loading characters…</p>
          </div>
        ) : characters.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div style={{ fontSize: 48, marginBottom: 8, opacity: 0.3 }}>🃏</div>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--tk-text, var(--text-primary))', marginBottom: 4 }}>
              No characters yet
            </p>
            <p style={{ fontSize: 11, color: 'var(--tk-text-muted, var(--text-muted))', maxWidth: 260, marginBottom: 16 }}>
              Link your D&D Beyond character or create a manual tracking card to get started.
            </p>
            <button
              onClick={() => setLinkOpen(true)}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-all active:scale-[0.97]"
              style={{
                background: 'linear-gradient(135deg, #8B4513, #D2691E)',
                border: 'none', color: '#fff', cursor: 'pointer',
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Link Character
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {characters.map(char => {
              const member = members.find(m => m.user_id === char.user_id);
              const charIsDm = char.user_id && selectedServerId
                ? hasPermission(selectedServerId, char.user_id, members, 'dungeon_master')
                : false;
              return (
                <CharacterCard
                  key={char.id}
                  character={char}
                  member={member}
                  isDm={charIsDm}
                  onClick={() => setInspecting(char)}
                />
              );
            })}

            {/* "Link your character" button at bottom if user hasn't linked yet */}
            {!myChar && (
              <button
                onClick={() => setLinkOpen(true)}
                className="w-full rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99]"
                style={{
                  padding: 14, border: '2px dashed var(--tk-border, var(--panel-divider))',
                  background: 'transparent', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, color: 'var(--tk-text-muted, var(--text-muted))',
                }}
              >
                + Link your character
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {linkOpen && <LinkCharacterModal onClose={() => setLinkOpen(false)} />}
      {inspecting && (
        <CharacterSheet
          character={inspecting}
          member={members.find(m => m.user_id === inspecting.user_id)}
          isDm={isDm}
          isOwn={inspecting.user_id === user?.id}
          onClose={() => setInspecting(null)}
        />
      )}
    </div>
  );
});
```

- [ ] **Step 2: Build check**

Run: `cd aero-chat-app && pnpm build 2>&1 | tail -5`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/servers/toolkits/CharactersTab.tsx
git commit -m "feat: add CharactersTab — character list with link/inspect flow"
```

---

### Task 10: Wire Into ServerView — Replace Characters Placeholder

**Files:**
- Modify: `src/components/servers/ServerView.tsx`

Replace the "Coming soon" placeholder for the characters tab with the actual `CharactersTab` component.

- [ ] **Step 1: Add import**

In `src/components/servers/ServerView.tsx`, after the `DndTabBar` import (line 16), add:

```typescript
import { CharactersTab } from './toolkits/CharactersTab';
```

- [ ] **Step 2: Replace the placeholder content for characters tab**

In the content area where the placeholder renders (the `else` branch of `(!activeToolkit || dndTab === 'bubbles')`), replace the entire placeholder block:

```typescript
        ) : (
          /* Toolkit tab placeholder — sub-projects 2–6 will replace these */
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div style={{ fontSize: 48, marginBottom: 8, opacity: 0.3 }}>
                {dndTab === 'characters' ? '🃏' : dndTab === 'worldmap' ? '🗺️' : dndTab === 'quests' ? '📜' : '📖'}
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--tk-text, var(--text-primary))', marginBottom: 4 }}>
                {dndTab === 'characters' ? 'Characters' : dndTab === 'worldmap' ? 'World Map' : dndTab === 'quests' ? 'Quests' : 'DM Notes'}
              </p>
              <p style={{ fontSize: 11, color: 'var(--tk-text-muted, var(--text-muted))' }}>Coming soon</p>
            </div>
          </div>
```

With:

```typescript
        ) : dndTab === 'characters' ? (
          <CharactersTab />
        ) : (
          /* Toolkit tab placeholder — sub-projects 3–6 will replace these */
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div style={{ fontSize: 48, marginBottom: 8, opacity: 0.3 }}>
                {dndTab === 'worldmap' ? '🗺️' : dndTab === 'quests' ? '📜' : '📖'}
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--tk-text, var(--text-primary))', marginBottom: 4 }}>
                {dndTab === 'worldmap' ? 'World Map' : dndTab === 'quests' ? 'Quests' : 'DM Notes'}
              </p>
              <p style={{ fontSize: 11, color: 'var(--tk-text-muted, var(--text-muted))' }}>Coming soon</p>
            </div>
          </div>
```

- [ ] **Step 3: Build check**

Run: `cd aero-chat-app && pnpm build 2>&1 | tail -5`

Expected: `✓ built in Xs` — no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/servers/ServerView.tsx
git commit -m "feat: wire CharactersTab into ServerView — replace placeholder"
```

---

### Task 11: Call Tile Integration — Character Overlay on Participant Cards

**Files:**
- Modify: `src/components/call/ParticipantCard.tsx`

When in a voice/video call on a toolkit-enabled server, participant tiles show character info overlaid: character portrait, name/class/level, mini HP bar, DM badge, and a low-HP warning indicator.

- [ ] **Step 1: Add character props to ParticipantCard**

In `src/components/call/ParticipantCard.tsx`, add the import and extend the props interface:

```typescript
import type { DndCharacter } from '../../lib/serverTypes';
import { getClassColor } from '../../lib/dndbeyond';
import { HpBar } from '../servers/toolkits/HpBar';
```

Extend the `ParticipantCardProps` interface:

```typescript
interface ParticipantCardProps {
  username: string;
  avatarUrl: string | null;
  isMuted: boolean;
  isSpeaking: boolean;
  audioLevel: number;
  isMe: boolean;
  compact?: boolean;
  character?: DndCharacter | null;
  isDm?: boolean;
}
```

- [ ] **Step 2: Update the compact card render**

In the `compact` branch, after the username `<p>`, add character info when available:

```typescript
if (compact) {
  const classColor = character ? getClassColor(character.class) : undefined;
  const lowHp = character && character.hp_max > 0 && character.hp_current / character.hp_max < 0.25;
  return (
    <div
      className="flex items-center gap-2.5 rounded-2xl px-3 py-2"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: classColor ? `1px solid ${classColor}30` : '1px solid rgba(255,255,255,0.08)',
        minWidth: 110,
      }}
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {character?.portrait_url ? (
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            border: `2px solid ${classColor}`,
            background: `url(${character.portrait_url}) center/cover`,
          }} />
        ) : (
          <AvatarImage username={username} avatarUrl={avatarUrl} size="sm" />
        )}
        {isMuted && (
          <div style={{
            position: 'absolute', bottom: -1, right: -1, width: 14, height: 14, borderRadius: '50%',
            background: 'rgba(239,68,68,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1.5px solid var(--bg-primary)',
          }}>
            <MicOff className="h-2 w-2 text-white" />
          </div>
        )}
        {lowHp && !isMuted && (
          <div style={{
            position: 'absolute', top: -2, right: -2, width: 12, height: 12, borderRadius: '50%',
            background: '#e53935', color: '#fff', fontSize: 8, fontWeight: 800,
            lineHeight: '12px', textAlign: 'center',
          }}>!</div>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.70)' }}>
          {character ? character.name : username}
        </p>
        {character && (
          <p className="truncate" style={{ fontSize: 8, color: 'rgba(255,255,255,0.40)', marginTop: 1 }}>
            {character.class} · Lv {character.level}
          </p>
        )}
        {character && <HpBar current={character.hp_current} max={character.hp_max} height={3} />}
        {!character && <AudioBars level={isMuted ? 0 : audioLevel} active={isSpeaking} barCount={5} height={8} />}
      </div>
      {isDm && (
        <span style={{
          fontSize: 7, padding: '1px 4px', borderRadius: 3, flexShrink: 0,
          background: 'rgba(255,215,0,0.12)', border: '1px solid rgba(255,215,0,0.25)',
          color: '#FFD700', fontWeight: 700,
        }}>DM</span>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Update the full-size card render**

In the full-size (non-compact) branch, overlay character info:

```typescript
const classColor = character ? getClassColor(character.class) : undefined;
const lowHp = character && character.hp_max > 0 && character.hp_current / character.hp_max < 0.25;

return (
  <div
    className="flex flex-col items-center gap-2 rounded-2xl p-5 text-center"
    style={{
      background: 'rgba(255,255,255,0.03)',
      border: classColor ? `1px solid ${classColor}20` : '1px solid rgba(255,255,255,0.10)',
      backdropFilter: 'blur(12px)',
      position: 'relative',
      overflow: 'hidden',
    }}
  >
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {character?.portrait_url ? (
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          border: `3px solid ${classColor}`,
          boxShadow: `0 0 12px ${classColor}25`,
          background: `url(${character.portrait_url}) center/cover`,
        }} />
      ) : (
        <AvatarImage username={username} avatarUrl={avatarUrl} size="xl" />
      )}
      {isMuted && (
        <div style={{
          position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderRadius: '50%',
          background: 'rgba(239,68,68,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '2px solid var(--bg-primary)',
        }}>
          <MicOff className="h-2.5 w-2.5 text-white" />
        </div>
      )}
      {lowHp && !isMuted && (
        <div style={{
          position: 'absolute', top: -2, right: -2, width: 16, height: 16, borderRadius: '50%',
          background: '#e53935', color: '#fff', fontSize: 10, fontWeight: 800,
          lineHeight: '16px', textAlign: 'center',
        }}>!</div>
      )}
    </div>

    <div>
      <span className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.80)' }}>
        {character ? character.name : username}
      </span>
      {isMe && (
        <span className="ml-1.5 text-[9px] font-semibold rounded px-1.5 py-0.5"
          style={{ background: 'rgba(0,212,255,0.10)', color: 'rgba(0,212,255,0.70)' }}>You</span>
      )}
      {isDm && (
        <span className="ml-1.5 text-[8px] font-bold rounded px-1.5 py-0.5"
          style={{ background: 'rgba(255,215,0,0.12)', border: '1px solid rgba(255,215,0,0.25)', color: '#FFD700' }}>DM</span>
      )}
    </div>

    {character && (
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.40)', margin: '-2px 0 2px' }}>
        {character.class} · Level {character.level}
      </p>
    )}

    {character ? (
      <div style={{ width: '80%' }}>
        <HpBar current={character.hp_current} max={character.hp_max} height={5} />
      </div>
    ) : (
      <AudioBars level={isMuted ? 0 : audioLevel} active={isSpeaking} barCount={AUDIO_BAR_COUNT} height={20} />
    )}
  </div>
);
```

- [ ] **Step 4: Pass character data from GroupCallView**

In `src/components/call/GroupCallView.tsx`, import the character store and pass character/DM props to `ParticipantCard`:

```typescript
import { useDndCharacterStore } from '../../store/dndCharacterStore';
import { useServerStore } from '../../store/serverStore';
import { useServerRoleStore } from '../../store/serverRoleStore';
```

Near the top of the component, add:

```typescript
const { characters } = useDndCharacterStore();
const { selectedServerId, activeToolkit, members } = useServerStore();
const { hasPermission } = useServerRoleStore();
```

Then where `<ParticipantCard>` is rendered, add the new props:

```typescript
<ParticipantCard
  key={p.peerId}
  username={p.username}
  avatarUrl={p.avatarUrl}
  isMuted={p.isMuted}
  isSpeaking={p.isSpeaking}
  audioLevel={p.audioLevel}
  isMe={p.isMe}
  compact={compact}
  character={activeToolkit ? characters.find(c => c.user_id === p.peerId) ?? null : null}
  isDm={activeToolkit && selectedServerId ? hasPermission(selectedServerId, p.peerId, members, 'dungeon_master') : false}
/>
```

- [ ] **Step 5: Build check**

Run: `cd aero-chat-app && pnpm build 2>&1 | tail -5`

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/call/ParticipantCard.tsx src/components/call/GroupCallView.tsx
git commit -m "feat: overlay character cards on call participant tiles"
```

---

## Verification Checklist

After all tasks are complete and the migration has been run in Supabase:

1. **Characters tab** — Navigate to a toolkit-enabled server. Click "Characters" tab. Should show empty state with "Link Character" button.
2. **D&D Beyond linking** — Click "Link Character". Paste a D&D Beyond URL. Click "Link Character". If the API is accessible, a card should appear with full stats. If CORS blocks it, an error message should suggest manual mode.
3. **Manual character creation** — Switch to "Manual" tab. See warning banner. Fill in basic info (name required). Optionally upload a portrait. Click "Create Character". Card appears in the list.
4. **Compact card** — Shows portrait with class-color border, name, race/class/level, HP bar (green/yellow/red), XP bar (gold). DM users get a gold "DM" badge.
5. **Low HP indicator** — Set HP below 25%. Red "!" badge appears on portrait.
6. **Expanded sheet (click card)** — Shows larger portrait, full name/race/class/level, "Played by @username". D&D Beyond characters show stat grid (3x2), AC/Initiative/Proficiency badges, traits. Manual characters omit these sections.
7. **HP editing** — DMs and character owners see "Edit" button on HP bar in expanded sheet. Click to inline-edit. Save updates the bar in real-time for all members.
8. **Refresh (D&D Beyond)** — Character owner sees "Refresh" button in sheet footer. Clicking re-fetches from D&D Beyond.
9. **Delete** — Character owner sees trash icon. Clicking removes the character.
10. **Realtime** — Open two browser tabs logged in as different server members. When one updates HP, the other sees the change within seconds.
11. **Theme adaptation** — All `--tk-*` variables render correctly in Day and Night themes. Borders, text, badges use the medieval palette.
12. **One character per user** — Linking a second character replaces the first (upsert on `server_id, user_id`).
13. **Call tile integration** — Start a group call in a toolkit-enabled server. Participant tiles should show character portrait (if set), character name/class/level, mini HP bar, DM badge. Low HP (<25%) shows red "!" indicator.
