# Character Cards — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Characters tab for the Dungeons & Servers toolkit — PDF-based character import from D&D Beyond sheets, manual entry fallback, compact cards with HP/XP bars, expanded character sheet popup with background images, chat commands (`/give exp`, `/heal`, `/damage`), and call tile integration.

**Architecture:** A new `dnd_characters` table stores one character per user per server. A dedicated Zustand store (`dndCharacterStore`) manages CRUD and Supabase Realtime subscriptions for live HP/XP updates. Characters are created by uploading a D&D Beyond character sheet PDF (parsed with `pdfjs-dist`) or by manual entry — both paths produce the same data. All fields are editable after creation. Chat commands in bubbles update HP/XP and post styled system messages.

**Tech Stack:** React 19, Zustand, Supabase (PostgreSQL + RLS + Realtime + Storage), `pdfjs-dist` (PDF text extraction), TypeScript, Tailwind CSS with `--tk-*` custom properties.

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `supabase/migrations/033_dnd_characters.sql` | Database: `dnd_characters` table, RLS policies, realtime publication, `dnd-assets` storage bucket |
| `src/lib/parseCharacterPdf.ts` | PDF parsing: extracts character data from D&D Beyond character sheet PDFs using `pdfjs-dist` |
| `src/lib/classColors.ts` | D&D class-to-color mapping + helper |
| `src/store/dndCharacterStore.ts` | Zustand store: character CRUD, realtime subscription, loading state |
| `src/components/servers/toolkits/HpBar.tsx` | Reusable HP bar with green→yellow→red gradient |
| `src/components/servers/toolkits/XpBar.tsx` | Reusable XP bar (gold) |
| `src/components/servers/toolkits/CreateCharacterModal.tsx` | Modal: PDF upload + manual entry form, portrait/background upload |
| `src/components/servers/toolkits/CharacterCard.tsx` | Compact card: portrait, name, class, HP/XP bars |
| `src/components/servers/toolkits/CharacterSheet.tsx` | Expanded popup: stat grid, HP/XP, AC, gold, edit mode, background image |
| `src/components/servers/toolkits/CharactersTab.tsx` | Main tab content: character list + "Create Character" button |

### Modified Files
| File | Changes |
|------|---------|
| `src/lib/serverTypes.ts` | Add `DndCharacter` interface |
| `src/components/servers/BubbleChat.tsx` | Add `/give exp`, `/heal`, `/damage` command parsing before send |
| `src/components/servers/ServerView.tsx` | Replace Characters placeholder with `CharactersTab` |
| `src/components/call/ParticipantCard.tsx` | Overlay character info on call tiles |
| `src/components/call/GroupCallView.tsx` | Pass character data to ParticipantCard |

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
  name              TEXT NOT NULL,
  species           TEXT NOT NULL DEFAULT '',
  class             TEXT NOT NULL DEFAULT '',
  level             INTEGER NOT NULL DEFAULT 1,
  portrait_url      TEXT,
  background_url    TEXT,
  hp_current        INTEGER NOT NULL DEFAULT 0,
  hp_max            INTEGER NOT NULL DEFAULT 0,
  xp_current        INTEGER NOT NULL DEFAULT 0,
  xp_max            INTEGER NOT NULL DEFAULT 0,
  gold              INTEGER NOT NULL DEFAULT 0,
  stats             JSONB NOT NULL DEFAULT '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',
  armor_class       INTEGER NOT NULL DEFAULT 10,
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

-- ── 3. Storage bucket for character portraits, backgrounds, and map images ──
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
- Modify: `src/lib/serverTypes.ts` (after `ServerToolkit` interface, around line 96)

- [ ] **Step 1: Add `DndCharacter` interface**

In `src/lib/serverTypes.ts`, after the `ServerToolkit` interface, add:

```typescript
export interface DndCharacter {
  id: string;
  server_id: string;
  user_id: string;
  name: string;
  species: string;
  class: string;
  level: number;
  portrait_url: string | null;
  background_url: string | null;
  hp_current: number;
  hp_max: number;
  xp_current: number;
  xp_max: number;
  gold: number;
  stats: { str: number; dex: number; con: number; int: number; wis: number; cha: number };
  armor_class: number;
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

### Task 3: Class Colors Helper

**Files:**
- Create: `src/lib/classColors.ts`

Small utility mapping D&D class names to brand colors, used by CharacterCard and CharacterSheet for portrait borders and stat highlighting.

- [ ] **Step 1: Create the class colors helper**

```typescript
// src/lib/classColors.ts

/** D&D class → color mapping for portrait borders and stat highlighting */
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
```

- [ ] **Step 2: Build check**

Run: `cd aero-chat-app && pnpm build 2>&1 | tail -5`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/lib/classColors.ts
git commit -m "feat: add class color mapping for character card styling"
```

---

### Task 4: PDF Character Sheet Parser

**Files:**
- Create: `src/lib/parseCharacterPdf.ts`

Uses `pdfjs-dist` to extract text from a D&D Beyond character sheet PDF and map it to our `DndCharacter` fields. D&D Beyond PDFs have a consistent text layout — we extract all text items with their positions and use positional heuristics to identify fields.

- [ ] **Step 1: Install pdfjs-dist**

Run: `cd aero-chat-app && pnpm add pdfjs-dist`

- [ ] **Step 2: Create the PDF parser**

```typescript
// src/lib/parseCharacterPdf.ts
import * as pdfjsLib from 'pdfjs-dist';

// Set worker to bundled version
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export interface ParsedCharacter {
  name: string;
  species: string;
  class: string;
  level: number;
  hp_current: number;
  hp_max: number;
  xp_current: number;
  xp_max: number;
  gold: number;
  armor_class: number;
  stats: { str: number; dex: number; con: number; int: number; wis: number; cha: number };
}

/**
 * Parse a D&D character sheet PDF and extract character data.
 * Works with D&D Beyond exported PDFs. Returns best-effort extracted data.
 * Fields that cannot be parsed get default values.
 */
export async function parseCharacterPdf(file: File): Promise<ParsedCharacter> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  // Extract all text items from page 1 (character summary page)
  const page = await pdf.getPage(1);
  const textContent = await page.getTextContent();
  const items = textContent.items
    .filter((item): item is { str: string; transform: number[] } => 'str' in item && item.str.trim() !== '')
    .map(item => ({
      text: item.str.trim(),
      x: item.transform[4],
      y: item.transform[5],
    }))
    .sort((a, b) => b.y - a.y || a.x - b.x); // top-to-bottom, left-to-right

  const allText = items.map(i => i.text);

  // ── Name: typically the largest/first text item at the top
  const name = allText[0] ?? 'Unknown';

  // ── Helper: find a number near a label
  function findNumberNear(label: string): number {
    const idx = allText.findIndex(t => t.toLowerCase().includes(label.toLowerCase()));
    if (idx === -1) return 0;
    // Check surrounding items for a number
    for (let offset = -2; offset <= 2; offset++) {
      const candidate = allText[idx + offset];
      if (candidate && /^\d+$/.test(candidate)) return parseInt(candidate, 10);
    }
    return 0;
  }

  // ── Helper: find text near a label
  function findTextNear(label: string): string {
    const idx = allText.findIndex(t => t.toLowerCase().includes(label.toLowerCase()));
    if (idx === -1) return '';
    // The value is often the item just before or after the label
    for (const offset of [1, -1, 2, -2]) {
      const candidate = allText[idx + offset];
      if (candidate && !/^\d+$/.test(candidate) && candidate.toLowerCase() !== label.toLowerCase()) {
        return candidate;
      }
    }
    return '';
  }

  // ── Stats (D&D Beyond PDFs list these as label + score pairs)
  const stats = {
    str: findNumberNear('strength') || findNumberNear('str') || 10,
    dex: findNumberNear('dexterity') || findNumberNear('dex') || 10,
    con: findNumberNear('constitution') || findNumberNear('con') || 10,
    int: findNumberNear('intelligence') || findNumberNear('int') || 10,
    wis: findNumberNear('wisdom') || findNumberNear('wis') || 10,
    cha: findNumberNear('charisma') || findNumberNear('cha') || 10,
  };

  // ── Class & Level — often formatted as "Fighter 5" or "Level 5 Fighter"
  let charClass = '';
  let level = 1;
  const classLevelMatch = allText.find(t => /^[A-Z][a-z]+\s+\d+/.test(t));
  if (classLevelMatch) {
    const parts = classLevelMatch.match(/^([A-Za-z\s/]+?)\s+(\d+)$/);
    if (parts) {
      charClass = parts[1].trim();
      level = parseInt(parts[2], 10) || 1;
    }
  }
  if (!charClass) {
    charClass = findTextNear('class') || 'Unknown';
    level = findNumberNear('level') || 1;
  }

  // ── Species
  const species = findTextNear('race') || findTextNear('species') || '';

  // ── HP
  const hpMax = findNumberNear('hit point maximum') || findNumberNear('hp') || 0;
  const hpCurrent = findNumberNear('current hit points') || hpMax;

  // ── AC
  const armorClass = findNumberNear('armor class') || findNumberNear('ac') || 10;

  // ── XP
  const xpCurrent = findNumberNear('experience points') || findNumberNear('xp') || 0;

  // XP thresholds by level (5e)
  const XP_TABLE = [0, 0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];
  const xpMax = XP_TABLE[level + 1] ?? 355000;

  // ── Gold — may not be on the first page
  const gold = findNumberNear('gold') || findNumberNear('gp') || 0;

  return {
    name,
    species,
    class: charClass,
    level,
    hp_current: hpCurrent,
    hp_max: hpMax,
    xp_current: xpCurrent,
    xp_max: xpMax,
    gold,
    armor_class: armorClass,
    stats,
  };
}
```

- [ ] **Step 3: Build check**

Run: `cd aero-chat-app && pnpm build 2>&1 | tail -5`

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/lib/parseCharacterPdf.ts
git commit -m "feat: add PDF character sheet parser using pdfjs-dist"
```

---

### Task 5: Character Store — `dndCharacterStore`

**Files:**
- Create: `src/store/dndCharacterStore.ts`

Zustand store managing the character list for the currently selected server. Loads from Supabase, subscribes to realtime for live HP/XP changes, provides insert/update/delete.

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

### Task 6: HP Bar and XP Bar Components

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

### Task 7: Character Compact Card

**Files:**
- Create: `src/components/servers/toolkits/CharacterCard.tsx`

Compact card displayed in the Characters tab list. Shows portrait with class-color border, name, species/class/level, HP bar, XP bar, DM badge, and optional background image as a subtle card backdrop.

- [ ] **Step 1: Create the CharacterCard component**

```typescript
// src/components/servers/toolkits/CharacterCard.tsx
import { memo } from 'react';
import type { DndCharacter, ServerMember } from '../../../lib/serverTypes';
import { getClassColor } from '../../../lib/classColors';
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
        cursor: 'pointer', position: 'relative', overflow: 'hidden',
      }}
    >
      {/* Background image if set */}
      {character.background_url && (
        <div style={{
          position: 'absolute', inset: 0,
          background: `url(${character.background_url}) center/cover`,
          opacity: 0.08, pointerEvents: 'none',
        }} />
      )}

      <div className="relative flex items-center gap-3">
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
            {character.species} {character.class} · Lv {character.level}
          </p>
          {member && (
            <p className="truncate" style={{ fontSize: 9, color: 'var(--tk-text-muted, var(--text-muted))', opacity: 0.7, marginTop: 1 }}>
              @{member.username}
            </p>
          )}
        </div>
      </div>

      {/* Bars */}
      <div className="relative mt-2.5 flex flex-col gap-1">
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
git commit -m "feat: add CharacterCard — compact card with portrait, HP/XP bars, background"
```

---

### Task 8: Character Sheet — Expanded Popup

**Files:**
- Create: `src/components/servers/toolkits/CharacterSheet.tsx`

Expanded popup showing full character details: background image as backdrop, larger portrait, stat grid (3×2), HP/XP with labels, AC and gold badges. Character owner and DMs see an "Edit" button that enables inline editing of all fields.

- [ ] **Step 1: Create the CharacterSheet component**

```typescript
// src/components/servers/toolkits/CharacterSheet.tsx
import { memo, useState } from 'react';
import { X, Trash2, Pencil, Check } from 'lucide-react';
import type { DndCharacter, ServerMember } from '../../../lib/serverTypes';
import { getClassColor } from '../../../lib/classColors';
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
  const canEdit = isOwn || isDm;

  // ── Edit mode state ──
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: character.name,
    species: character.species,
    class: character.class,
    level: String(character.level),
    hp_current: String(character.hp_current),
    hp_max: String(character.hp_max),
    xp_current: String(character.xp_current),
    xp_max: String(character.xp_max),
    gold: String(character.gold),
    armor_class: String(character.armor_class),
    str: String(character.stats.str),
    dex: String(character.stats.dex),
    con: String(character.stats.con),
    int: String(character.stats.int),
    wis: String(character.stats.wis),
    cha: String(character.stats.cha),
  });

  const setField = (key: keyof typeof form, value: string) => setForm(f => ({ ...f, [key]: value }));

  const handleSave = async () => {
    await updateCharacter(character.id, {
      name: form.name.trim() || character.name,
      species: form.species,
      class: form.class,
      level: parseInt(form.level, 10) || character.level,
      hp_current: Math.max(0, Math.min(parseInt(form.hp_current, 10) || 0, parseInt(form.hp_max, 10) || character.hp_max)),
      hp_max: parseInt(form.hp_max, 10) || character.hp_max,
      xp_current: parseInt(form.xp_current, 10) || 0,
      xp_max: parseInt(form.xp_max, 10) || character.xp_max,
      gold: parseInt(form.gold, 10) || 0,
      armor_class: parseInt(form.armor_class, 10) || 10,
      stats: {
        str: parseInt(form.str, 10) || 10,
        dex: parseInt(form.dex, 10) || 10,
        con: parseInt(form.con, 10) || 10,
        int: parseInt(form.int, 10) || 10,
        wis: parseInt(form.wis, 10) || 10,
        cha: parseInt(form.cha, 10) || 10,
      },
    });
    setEditing(false);
  };

  const handleDelete = async () => {
    await deleteCharacter(character.id);
    onClose();
  };

  // ── Edit field helper ──
  const editInput = (key: keyof typeof form, width: number, type: 'text' | 'number' = 'number') => (
    <input
      type={type}
      value={form[key]}
      onChange={e => setField(key, e.target.value)}
      style={{
        width, padding: '2px 4px', borderRadius: 4, fontSize: 12, textAlign: 'center',
        background: 'rgba(255,255,255,0.06)', border: '1px solid var(--tk-border, var(--panel-divider))',
        color: 'var(--tk-text, var(--text-primary))', outline: 'none',
      }}
    />
  );

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
          display: 'flex', flexDirection: 'column', position: 'relative',
        }}
      >
        {/* Background image */}
        {character.background_url && (
          <div style={{
            position: 'absolute', inset: 0,
            background: `url(${character.background_url}) center/cover`,
            opacity: 0.12, pointerEvents: 'none',
          }} />
        )}

        {/* Header */}
        <div className="relative flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--tk-border, var(--panel-divider))' }}>
          <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--tk-text, var(--text-primary))' }}>
            Character Sheet
          </span>
          <div className="flex items-center gap-2">
            {canEdit && !editing && (
              <button onClick={() => setEditing(true)} style={{ color: 'var(--tk-accent-light, #00d4ff)', background: 'none', border: 'none', cursor: 'pointer' }} title="Edit character">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {editing && (
              <button onClick={handleSave} style={{ color: '#4CAF50', background: 'none', border: 'none', cursor: 'pointer' }} title="Save changes">
                <Check className="h-3.5 w-3.5" />
              </button>
            )}
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
        <div className="relative flex-1 overflow-y-auto px-5 py-4">
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
              {editing ? (
                <>
                  {editInput('name', 160, 'text')}
                  <div className="flex gap-1.5 mt-1">
                    {editInput('species', 75, 'text')}
                    {editInput('class', 75, 'text')}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <span style={{ fontSize: 10, color: 'var(--tk-text-muted, var(--text-muted))' }}>Level</span>
                    {editInput('level', 40)}
                  </div>
                </>
              ) : (
                <>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--tk-text, var(--text-primary))', margin: 0 }}>
                    {character.name}
                  </h3>
                  <p style={{ fontSize: 12, color: 'var(--tk-text-muted, var(--text-muted))', margin: '2px 0 0' }}>
                    {character.species} {character.class} · Level {character.level}
                  </p>
                </>
              )}
              {member && (
                <p style={{ fontSize: 11, color: 'var(--tk-text-muted, var(--text-muted))', opacity: 0.7, margin: '2px 0 0' }}>
                  Played by @{member.username}
                </p>
              )}
            </div>
          </div>

          {/* Stat grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 16 }}>
            {STAT_LABELS.map((label, i) => {
              const key = STAT_KEYS[i];
              const val = character.stats[key];
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
                  {editing ? (
                    editInput(key as keyof typeof form, 40)
                  ) : (
                    <>
                      <div style={{ fontSize: 20, fontWeight: 800, color: isHigh ? classColor : 'var(--tk-text, var(--text-primary))' }}>{val}</div>
                      <div style={{ fontSize: 10, color: 'var(--tk-text-muted, var(--text-muted))' }}>{mod >= 0 ? '+' : ''}{mod}</div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* HP bar */}
          <div style={{ marginBottom: 12 }}>
            <div className="flex items-center justify-between mb-1">
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--tk-text-muted, var(--text-muted))' }}>HP</span>
              {editing ? (
                <div className="flex items-center gap-1">
                  {editInput('hp_current', 45)}
                  <span style={{ fontSize: 10, color: 'var(--tk-text-muted, var(--text-muted))' }}>/</span>
                  {editInput('hp_max', 45)}
                </div>
              ) : (
                <span style={{ fontSize: 11, color: 'var(--tk-text, var(--text-primary))' }}>{character.hp_current}/{character.hp_max}</span>
              )}
            </div>
            <HpBar current={character.hp_current} max={character.hp_max} height={8} />
          </div>

          {/* XP bar */}
          <div style={{ marginBottom: 16 }}>
            <div className="flex items-center justify-between mb-1">
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--tk-text-muted, var(--text-muted))' }}>XP</span>
              {editing ? (
                <div className="flex items-center gap-1">
                  {editInput('xp_current', 55)}
                  <span style={{ fontSize: 10, color: 'var(--tk-text-muted, var(--text-muted))' }}>/</span>
                  {editInput('xp_max', 55)}
                </div>
              ) : (
                <span style={{ fontSize: 11, color: 'var(--tk-text, var(--text-primary))' }}>{character.xp_current}/{character.xp_max}</span>
              )}
            </div>
            <XpBar current={character.xp_current} max={character.xp_max} height={6} />
          </div>

          {/* AC + Gold badges */}
          <div className="flex flex-wrap gap-1.5" style={{ marginBottom: 12 }}>
            <span style={badgeStyle}>
              {editing ? <>{editInput('armor_class', 35)}</> : <>🛡️ AC {character.armor_class}</>}
            </span>
            <span style={badgeStyle}>
              {editing ? <>{editInput('gold', 50)}</> : <>💰 {character.gold.toLocaleString()} gp</>}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="relative flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderTop: '1px solid var(--tk-border, var(--panel-divider))' }}>
          <span style={{ fontSize: 10, color: 'var(--tk-text-muted, var(--text-muted))' }}>
            All fields are editable
          </span>
          {editing && (
            <button onClick={() => setEditing(false)} style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
              Cancel
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
  display: 'inline-flex', alignItems: 'center', gap: 4,
};
```

- [ ] **Step 2: Build check**

Run: `cd aero-chat-app && pnpm build 2>&1 | tail -5`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/servers/toolkits/CharacterSheet.tsx
git commit -m "feat: add CharacterSheet — expanded popup with stat grid, edit mode, background"
```

---

### Task 9: Create Character Modal — PDF Upload + Manual Entry

**Files:**
- Create: `src/components/servers/toolkits/CreateCharacterModal.tsx`

Single modal with two paths: upload a PDF (parsed and previewed) or fill in manually. Both paths end with portrait and optional background image upload.

- [ ] **Step 1: Create the CreateCharacterModal component**

```typescript
// src/components/servers/toolkits/CreateCharacterModal.tsx
import { memo, useState, useRef } from 'react';
import { X, Upload, FileText } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { useServerStore } from '../../../store/serverStore';
import { useDndCharacterStore } from '../../../store/dndCharacterStore';
import { supabase } from '../../../lib/supabase';
import { parseCharacterPdf } from '../../../lib/parseCharacterPdf';
import type { ParsedCharacter } from '../../../lib/parseCharacterPdf';

type Step = 'import' | 'review' | 'images';

export const CreateCharacterModal = memo(function CreateCharacterModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const user = useAuthStore(s => s.user);
  const selectedServerId = useServerStore(s => s.selectedServerId);
  const { upsertCharacter } = useDndCharacterStore();

  const [step, setStep] = useState<Step>('import');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Parsed / manual form data ──
  const [form, setForm] = useState<ParsedCharacter>({
    name: '', species: '', class: '', level: 1,
    hp_current: 0, hp_max: 0, xp_current: 0, xp_max: 0,
    gold: 0, armor_class: 10,
    stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  });

  // ── Image state ──
  const [portraitFile, setPortraitFile] = useState<File | null>(null);
  const [portraitPreview, setPortraitPreview] = useState<string | null>(null);
  const [bgFile, setBgFile] = useState<File | null>(null);
  const [bgPreview, setBgPreview] = useState<string | null>(null);
  const portraitRef = useRef<HTMLInputElement>(null);
  const bgRef = useRef<HTMLInputElement>(null);

  const setField = (key: string, value: string | number) =>
    setForm(f => ({ ...f, [key]: value }));
  const setStat = (key: string, value: number) =>
    setForm(f => ({ ...f, stats: { ...f.stats, [key]: value } }));

  // ── PDF upload handler ──
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const parsed = await parseCharacterPdf(file);
      setForm(parsed);
      setStep('review');
    } catch (err) {
      setError('Could not parse this PDF. You can fill in the fields manually instead.');
      console.error('[CreateCharacterModal] PDF parse error:', err);
    }
    setLoading(false);
  };

  // ── Image handlers ──
  const handlePortraitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPortraitFile(file);
    setPortraitPreview(URL.createObjectURL(file));
  };
  const handleBgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBgFile(file);
    setBgPreview(URL.createObjectURL(file));
  };

  // ── Upload image helper ──
  async function uploadImage(file: File, suffix: string): Promise<string | null> {
    if (!user) return null;
    const path = `${user.id}/${Date.now()}-${suffix}`;
    const { error: upErr } = await supabase.storage.from('dnd-assets').upload(path, file);
    if (upErr) { console.error('[CreateCharacterModal] Upload error:', upErr); return null; }
    const { data } = supabase.storage.from('dnd-assets').getPublicUrl(path);
    return data.publicUrl;
  }

  // ── Final submit ──
  const handleSubmit = async () => {
    if (!user || !selectedServerId || !form.name.trim()) { setError('Character name is required.'); return; }
    setLoading(true);
    setError('');

    const portrait_url = portraitFile ? await uploadImage(portraitFile, 'portrait') : null;
    const background_url = bgFile ? await uploadImage(bgFile, 'background') : null;

    const res = await upsertCharacter({
      server_id: selectedServerId,
      user_id: user.id,
      name: form.name.trim(),
      species: form.species,
      class: form.class,
      level: form.level,
      portrait_url,
      background_url,
      hp_current: form.hp_current,
      hp_max: form.hp_max,
      xp_current: form.xp_current,
      xp_max: form.xp_max,
      gold: form.gold,
      stats: form.stats,
      armor_class: form.armor_class,
    });
    setLoading(false);
    if (res.error) { setError(res.error); return; }
    onClose();
  };

  // ── Shared input style ──
  const inp = (value: string | number, onChange: (v: string) => void, placeholder: string, type: 'text' | 'number' = 'text', flex?: number): JSX.Element => (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        padding: '9px 12px', borderRadius: 8, fontSize: 12, flex,
        background: 'rgba(255,255,255,0.04)', border: '1px solid var(--tk-border, var(--panel-divider))',
        color: 'var(--tk-text, var(--text-primary))', outline: 'none', width: flex ? undefined : '100%',
      }}
    />
  );

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
          width: 480, maxHeight: '85vh', borderRadius: 20, overflow: 'hidden',
          background: 'var(--sidebar-bg)', border: '1px solid var(--tk-border, var(--panel-divider))',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--tk-border, var(--panel-divider))' }}>
          <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--tk-text, var(--text-primary))' }}>
            {step === 'import' ? 'Create Character' : step === 'review' ? 'Review Character Info' : 'Character Images'}
          </span>
          <button onClick={onClose} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* ── Step 1: Import ── */}
          {step === 'import' && (
            <div>
              <p style={{ fontSize: 12, color: 'var(--tk-text-muted, var(--text-muted))', marginBottom: 16, lineHeight: 1.5 }}>
                Upload your D&D Beyond character sheet PDF to auto-fill your card, or skip to enter details manually.
              </p>

              {/* PDF upload area */}
              <label
                className="flex flex-col items-center justify-center gap-2 rounded-xl cursor-pointer transition-all hover:scale-[1.01]"
                style={{
                  padding: 28, border: '2px dashed var(--tk-border, var(--panel-divider))',
                  background: 'var(--tk-panel, rgba(0,180,255,0.04))',
                  marginBottom: 12,
                }}
              >
                <FileText className="h-8 w-8" style={{ color: 'var(--tk-accent-light, #D2691E)', opacity: 0.6 }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tk-text, var(--text-primary))' }}>
                  {loading ? 'Parsing PDF…' : 'Upload Character Sheet PDF'}
                </span>
                <span style={{ fontSize: 10, color: 'var(--tk-text-muted, var(--text-muted))' }}>
                  D&D Beyond exported PDFs work best
                </span>
                <input type="file" accept=".pdf" hidden onChange={handlePdfUpload} disabled={loading} />
              </label>

              {/* Skip to manual */}
              <button
                onClick={() => setStep('review')}
                className="w-full text-center transition-opacity hover:opacity-80"
                style={{
                  padding: '10px 0', fontSize: 12, fontWeight: 500,
                  color: 'var(--tk-accent-light, #00d4ff)', background: 'none', border: 'none', cursor: 'pointer',
                }}
              >
                Skip — I'll enter details manually
              </button>
            </div>
          )}

          {/* ── Step 2: Review / Edit ── */}
          {step === 'review' && (
            <div className="flex flex-col gap-2.5">
              {inp(form.name, v => setField('name', v), 'Character name *')}
              <div className="flex gap-2">
                {inp(form.species, v => setField('species', v), 'Species', 'text', 1)}
                {inp(form.class, v => setField('class', v), 'Class', 'text', 1)}
              </div>
              <div className="flex gap-2">
                {inp(form.level, v => setField('level', parseInt(v, 10) || 1), 'Level', 'number', 1)}
                {inp(form.armor_class, v => setField('armor_class', parseInt(v, 10) || 10), 'AC', 'number', 1)}
                {inp(form.gold, v => setField('gold', parseInt(v, 10) || 0), 'Gold', 'number', 1)}
              </div>

              {/* HP / XP */}
              <div className="flex gap-2">
                {inp(form.hp_current, v => setField('hp_current', parseInt(v, 10) || 0), 'HP current', 'number', 1)}
                {inp(form.hp_max, v => setField('hp_max', parseInt(v, 10) || 0), 'HP max', 'number', 1)}
              </div>
              <div className="flex gap-2">
                {inp(form.xp_current, v => setField('xp_current', parseInt(v, 10) || 0), 'XP current', 'number', 1)}
                {inp(form.xp_max, v => setField('xp_max', parseInt(v, 10) || 0), 'XP max', 'number', 1)}
              </div>

              {/* Stat grid */}
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--tk-text-muted, var(--text-muted))', marginTop: 4 }}>Ability Scores</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map(key => (
                  <div key={key} className="flex items-center gap-1.5">
                    <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--tk-text-muted, var(--text-muted))', width: 28, textTransform: 'uppercase' }}>{key}</span>
                    <input
                      type="number"
                      value={form.stats[key]}
                      onChange={e => setStat(key, parseInt(e.target.value, 10) || 10)}
                      style={{
                        width: '100%', padding: '6px 8px', borderRadius: 6, fontSize: 12, textAlign: 'center',
                        background: 'rgba(255,255,255,0.04)', border: '1px solid var(--tk-border, var(--panel-divider))',
                        color: 'var(--tk-text, var(--text-primary))', outline: 'none',
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 3: Images ── */}
          {step === 'images' && (
            <div>
              <p style={{ fontSize: 12, color: 'var(--tk-text-muted, var(--text-muted))', marginBottom: 16, lineHeight: 1.5 }}>
                Upload a portrait for your character and optionally a background image for the card.
              </p>

              {/* Portrait */}
              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={() => portraitRef.current?.click()}
                  style={{
                    width: 64, height: 64, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
                    background: portraitPreview ? `url(${portraitPreview}) center/cover` : 'rgba(255,255,255,0.04)',
                    border: '2px dashed var(--tk-border, var(--panel-divider))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--tk-text-muted, var(--text-muted))',
                  }}
                >
                  {!portraitPreview && <Upload className="h-5 w-5" />}
                </button>
                <input ref={portraitRef} type="file" accept="image/*" hidden onChange={handlePortraitChange} />
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--tk-text, var(--text-primary))' }}>Portrait</p>
                  <p style={{ fontSize: 10, color: 'var(--tk-text-muted, var(--text-muted))' }}>
                    {portraitFile ? portraitFile.name : 'Click to upload (optional)'}
                  </p>
                </div>
              </div>

              {/* Background */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => bgRef.current?.click()}
                  style={{
                    width: 64, height: 40, borderRadius: 8, flexShrink: 0, cursor: 'pointer',
                    background: bgPreview ? `url(${bgPreview}) center/cover` : 'rgba(255,255,255,0.04)',
                    border: '2px dashed var(--tk-border, var(--panel-divider))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--tk-text-muted, var(--text-muted))',
                  }}
                >
                  {!bgPreview && <Upload className="h-4 w-4" />}
                </button>
                <input ref={bgRef} type="file" accept="image/*" hidden onChange={handleBgChange} />
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--tk-text, var(--text-primary))' }}>Background</p>
                  <p style={{ fontSize: 10, color: 'var(--tk-text-muted, var(--text-muted))' }}>
                    {bgFile ? bgFile.name : 'Optional — decorates your card'}
                  </p>
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

        {/* Footer buttons */}
        <div className="flex gap-2.5 px-5 py-3 flex-shrink-0" style={{ borderTop: '1px solid var(--tk-border, var(--panel-divider))' }}>
          {step === 'review' && (
            <button
              onClick={() => setStep('import')}
              className="flex-1 transition-all active:scale-[0.98]"
              style={{
                padding: '10px 0', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: 'rgba(255,255,255,0.04)', border: '1px solid var(--tk-border, var(--panel-divider))',
                color: 'var(--tk-text-muted, var(--text-muted))',
              }}
            >
              Back
            </button>
          )}
          {step === 'images' && (
            <button
              onClick={() => setStep('review')}
              className="flex-1 transition-all active:scale-[0.98]"
              style={{
                padding: '10px 0', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: 'rgba(255,255,255,0.04)', border: '1px solid var(--tk-border, var(--panel-divider))',
                color: 'var(--tk-text-muted, var(--text-muted))',
              }}
            >
              Back
            </button>
          )}
          {step === 'review' && (
            <button
              onClick={() => { if (!form.name.trim()) { setError('Character name is required.'); return; } setError(''); setStep('images'); }}
              className="flex-1 transition-all active:scale-[0.98]"
              style={{
                padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                background: 'linear-gradient(135deg, #8B4513, #D2691E)',
                border: 'none', color: '#fff',
              }}
            >
              Next — Add Images
            </button>
          )}
          {step === 'images' && (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 transition-all active:scale-[0.98] disabled:opacity-50"
              style={{
                padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                background: 'linear-gradient(135deg, #8B4513, #D2691E)',
                border: 'none', color: '#fff',
              }}
            >
              {loading ? 'Creating…' : 'Create Character'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
```

- [ ] **Step 2: Build check**

Run: `cd aero-chat-app && pnpm build 2>&1 | tail -5`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/servers/toolkits/CreateCharacterModal.tsx
git commit -m "feat: add CreateCharacterModal — PDF import + manual entry + image upload"
```

---

### Task 10: Characters Tab — Main Tab Content

**Files:**
- Create: `src/components/servers/toolkits/CharactersTab.tsx`

Content component rendered when `dndTab === 'characters'` in ServerView. Shows the character list as compact cards, a "Create Character" button (if the user hasn't created one yet), and opens the expanded CharacterSheet on card click.

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
import { CreateCharacterModal } from './CreateCharacterModal';

export const CharactersTab = memo(function CharactersTab() {
  const user = useAuthStore(s => s.user);
  const { selectedServerId, members } = useServerStore();
  const { hasPermission } = useServerRoleStore();
  const { characters, loading, loadCharacters, subscribeRealtime } = useDndCharacterStore();
  const [createOpen, setCreateOpen] = useState(false);
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
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.97]"
            style={{
              background: 'linear-gradient(135deg, #8B4513, #D2691E)',
              border: 'none', color: '#fff', cursor: 'pointer',
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Create Character
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
              Upload your D&D Beyond character sheet PDF or create a character manually to get started.
            </p>
            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-all active:scale-[0.97]"
              style={{
                background: 'linear-gradient(135deg, #8B4513, #D2691E)',
                border: 'none', color: '#fff', cursor: 'pointer',
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Create Character
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

            {!myChar && (
              <button
                onClick={() => setCreateOpen(true)}
                className="w-full rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99]"
                style={{
                  padding: 14, border: '2px dashed var(--tk-border, var(--panel-divider))',
                  background: 'transparent', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, color: 'var(--tk-text-muted, var(--text-muted))',
                }}
              >
                + Create your character
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {createOpen && <CreateCharacterModal onClose={() => setCreateOpen(false)} />}
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
git commit -m "feat: add CharactersTab — character list with create/inspect flow"
```

---

### Task 11: Chat Commands — `/give exp`, `/heal`, `/damage`

**Files:**
- Modify: `src/components/servers/BubbleChat.tsx`

Intercept messages starting with `/give exp`, `/heal`, or `/damage` before they hit the database. Parse the number, update the sender's `dnd_characters` row, and insert a styled system message instead of the raw command text.

- [ ] **Step 1: Add imports**

At the top of `src/components/servers/BubbleChat.tsx`, add:

```typescript
import { useDndCharacterStore } from '../../store/dndCharacterStore';
import { useServerStore as useServerStoreForToolkit } from '../../store/serverStore';
```

Note: `useServerStore` may already be imported. If so, just add the character store import.

- [ ] **Step 2: Add command parsing helper**

After the existing helper functions (after the `parseGifMessage` helper near line 41), add:

```typescript
interface DndCommand {
  type: 'give_exp' | 'heal' | 'damage';
  value: number;
}

function parseDndCommand(text: string): DndCommand | null {
  const lower = text.toLowerCase().trim();
  let match: RegExpMatchArray | null;

  match = lower.match(/^\/give\s+exp\s+(\d+)$/);
  if (match) return { type: 'give_exp', value: parseInt(match[1], 10) };

  match = lower.match(/^\/heal\s+(\d+)$/);
  if (match) return { type: 'heal', value: parseInt(match[1], 10) };

  match = lower.match(/^\/damage\s+(\d+)$/);
  if (match) return { type: 'damage', value: parseInt(match[1], 10) };

  return null;
}

function isDndCommandMessage(content: string): boolean {
  try { return JSON.parse(content)._dndCmd === true; } catch { return false; }
}

function parseDndCommandMessage(content: string): { text: string; emoji: string } | null {
  try {
    const p = JSON.parse(content);
    if (p._dndCmd) return { text: p.text, emoji: p.emoji };
    return null;
  } catch { return null; }
}
```

- [ ] **Step 3: Add command handling to the send flow**

Inside the `BubbleChat` component, add store selectors near the other selectors:

```typescript
const { characters } = useDndCharacterStore();
const activeToolkit = useServerStoreForToolkit(s => s.activeToolkit);
```

Then modify the `handleSend` callback. Replace the existing `handleSend`:

```typescript
const handleSend = useCallback(async () => {
  if (!input.trim() || !user || !selectedBubbleId || sending) return;
  const text = input.trim();
  setInput('');
  setMentionQuery(null);

  // ── DnD command interception ──
  if (activeToolkit) {
    const cmd = parseDndCommand(text);
    if (cmd) {
      const myChar = characters.find(c => c.user_id === user.id);
      if (!myChar) {
        setSendError('You need a character card to use DnD commands. Create one in the Characters tab.');
        return;
      }

      let sysText = '';
      let emoji = '';
      let updateFields: Record<string, number> = {};

      if (cmd.type === 'give_exp') {
        const newXp = myChar.xp_current + cmd.value;
        updateFields = { xp_current: newXp };
        emoji = '✨';
        sysText = `${myChar.name} gained ${cmd.value} XP (${myChar.xp_current} → ${newXp})`;
      } else if (cmd.type === 'heal') {
        const newHp = Math.min(myChar.hp_current + cmd.value, myChar.hp_max);
        updateFields = { hp_current: newHp };
        emoji = '💚';
        sysText = `${myChar.name} healed ${cmd.value} HP (${myChar.hp_current} → ${newHp})`;
      } else if (cmd.type === 'damage') {
        const newHp = Math.max(myChar.hp_current - cmd.value, 0);
        updateFields = { hp_current: newHp };
        emoji = '⚔️';
        sysText = `${myChar.name} took ${cmd.value} damage (${myChar.hp_current} → ${newHp} HP)`;
      }

      // Update character in DB
      const { error: updateErr } = await useDndCharacterStore.getState().updateCharacter(myChar.id, updateFields);
      if (updateErr) { setSendError('Failed to update character.'); return; }

      // Send styled system message
      await sendContent(JSON.stringify({ _dndCmd: true, text: sysText, emoji }));
      setTimeout(() => inputRef.current?.focus(), 0);
      return;
    }
  }

  await sendContent(text);
  setTimeout(() => inputRef.current?.focus(), 0);
}, [input, user, selectedBubbleId, sending, activeToolkit, characters]);
```

- [ ] **Step 4: Add command message rendering**

In the message rendering section of BubbleChat (where `isVoiceMessage`, `isFileMessage`, `isGifMessage` are checked), add a new check for DnD command messages. After the existing GIF rendering check, add:

```typescript
{isDndCommandMessage(msg.content) ? (() => {
  const cmd = parseDndCommandMessage(msg.content);
  if (!cmd) return null;
  return (
    <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{
      background: 'var(--tk-accent-glow, rgba(139,69,19,0.10))',
      border: '1px solid var(--tk-border, rgba(139,69,19,0.15))',
    }}>
      <span style={{ fontSize: 16 }}>{cmd.emoji}</span>
      <span style={{ fontSize: 12, color: 'var(--tk-text, var(--text-secondary))', fontStyle: 'italic' }}>
        {cmd.text}
      </span>
    </div>
  );
})() : /* ... existing content rendering ... */}
```

- [ ] **Step 5: Build check**

Run: `cd aero-chat-app && pnpm build 2>&1 | tail -5`

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/servers/BubbleChat.tsx
git commit -m "feat: add /give exp, /heal, /damage chat commands for character cards"
```

---

### Task 12: Wire Into ServerView — Replace Characters Placeholder

**Files:**
- Modify: `src/components/servers/ServerView.tsx`

Replace the "Coming soon" placeholder for the characters tab with the actual `CharactersTab` component.

- [ ] **Step 1: Add import**

In `src/components/servers/ServerView.tsx`, add:

```typescript
import { CharactersTab } from './toolkits/CharactersTab';
```

- [ ] **Step 2: Replace the placeholder content for characters tab**

In the content area, replace the placeholder that renders for the characters tab. Change the `else` branch from:

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

To:

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

### Task 13: Call Tile Integration — Character Overlay on Participant Cards

**Files:**
- Modify: `src/components/call/ParticipantCard.tsx`
- Modify: `src/components/call/GroupCallView.tsx`

When in a voice/video call on a toolkit-enabled server, participant tiles show character info: portrait, name/class/level, mini HP bar, DM badge, and low-HP warning.

- [ ] **Step 1: Add character props to ParticipantCard**

In `src/components/call/ParticipantCard.tsx`, add imports:

```typescript
import type { DndCharacter } from '../../lib/serverTypes';
import { getClassColor } from '../../lib/classColors';
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

In the `compact` branch, add character overlay logic. Before the `return` in the `if (compact)` block, add:

```typescript
const classColor = character ? getClassColor(character.class) : undefined;
const lowHp = character && character.hp_max > 0 && character.hp_current / character.hp_max < 0.25;
```

Then update the compact render to show character portrait (if available) instead of AvatarImage, character name instead of username, class/level subtitle, mini HP bar, DM badge, and low-HP indicator. Follow the same pattern as the existing compact layout but conditionally swap in character data.

- [ ] **Step 3: Update the full-size card render**

Same approach for the non-compact branch: character portrait, name, class/level, HP bar, DM badge, low-HP indicator. Only when `character` prop is provided.

- [ ] **Step 4: Pass character data from GroupCallView**

In `src/components/call/GroupCallView.tsx`, import:

```typescript
import { useDndCharacterStore } from '../../store/dndCharacterStore';
import { useServerStore } from '../../store/serverStore';
import { useServerRoleStore } from '../../store/serverRoleStore';
```

Add selectors near top of component:

```typescript
const { characters } = useDndCharacterStore();
const { selectedServerId, activeToolkit, members } = useServerStore();
const { hasPermission } = useServerRoleStore();
```

Where `<ParticipantCard>` is rendered, add the new props:

```typescript
character={activeToolkit ? characters.find(c => c.user_id === p.peerId) ?? null : null}
isDm={activeToolkit && selectedServerId ? hasPermission(selectedServerId, p.peerId, members, 'dungeon_master') : false}
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

1. **Characters tab** — Navigate to a toolkit-enabled server. Click "Characters" tab. Should show empty state with "Create Character" button.
2. **PDF import** — Click "Create Character". Upload a D&D Beyond character sheet PDF. Fields should auto-populate. Review/edit, then add images.
3. **Manual entry** — Click "Skip — I'll enter details manually". Fill in fields. Create character.
4. **Compact card** — Shows portrait with class-color border, name, species/class/level, HP bar (green/yellow/red), XP bar (gold), background image as subtle backdrop. DM users get gold "DM" badge.
5. **Low HP indicator** — Set HP below 25%. Red "!" badge appears on portrait.
6. **Expanded sheet (click card)** — Shows background image, larger portrait, stat grid (3×2), HP/XP with labels, AC and gold badges. "Played by @username".
7. **Edit mode** — Character owner and DMs see pencil icon. Click to enable inline editing of ALL fields (name, species, class, level, stats, HP, XP, AC, gold). Save persists to DB.
8. **Delete** — Character owner sees trash icon. Clicking removes the character.
9. **Chat commands** — In a bubble, type `/give exp 500`. Should see styled message "✨ CharName gained 500 XP (100 → 600)". Type `/heal 20` and `/damage 15` — similar styled messages with HP changes.
10. **Realtime** — Open two browser tabs. When one updates HP (via edit or chat command), the other sees the change within seconds.
11. **Theme adaptation** — All `--tk-*` variables render correctly in Day and Night themes.
12. **One character per user** — Creating a second character replaces the first (upsert on `server_id, user_id`).
13. **Call tile integration** — Start a group call in a toolkit-enabled server. Participant tiles show character portrait, name/class/level, mini HP bar, DM badge, low HP warning.
