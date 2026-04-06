# Avatar Display + Layering Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the simple AvatarCorner with a two-panel layout featuring a paper doll character (Flutter) with cosmetic item layering, renamed XP bars, and an overall level badge.

**Architecture:** A pure config module defines avatar bases, item slots, and layer order. A Zustand store with localStorage persist tracks equipped items. An `AeroAgent` component renders stacked `<img>` layers at fixed z-indices. The rewritten `AvatarCorner` arranges this into a side-by-side glass layout with an upgraded XP stat panel.

**Tech Stack:** React 19, Zustand (with persist middleware), TypeScript, Vite (static assets from `public/`)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| MOVE | `AvatarCornerAssets/AeroDude.png` → `public/avatars/bases/flutter.png` | Asset relocation |
| CREATE | `public/avatars/armor/.gitkeep` | Empty dir placeholder |
| CREATE | `public/avatars/helmets/.gitkeep` | Empty dir placeholder |
| CREATE | `public/avatars/weapons/.gitkeep` | Empty dir placeholder |
| CREATE | `public/avatars/wings/.gitkeep` | Empty dir placeholder |
| MODIFY | `src/lib/xpConfig.ts` | Rename BAR_META labels, add `deriveOverallLevel()` |
| CREATE | `src/lib/avatarConfig.ts` | Avatar types, base registry, layer order constants |
| CREATE | `src/store/avatarStore.ts` | Equipped items state (localStorage persist) |
| CREATE | `src/components/corners/AeroAgent.tsx` | Paper doll layering renderer |
| REWRITE | `src/components/corners/AvatarCorner.tsx` | Two-panel layout with upgraded XP bars |

---

### Task 1: Move assets to public/ and create directory structure

**Files:**
- Move: `AvatarCornerAssets/AeroDude.png` → `public/avatars/bases/flutter.png`
- Create: `public/avatars/armor/.gitkeep`
- Create: `public/avatars/helmets/.gitkeep`
- Create: `public/avatars/weapons/.gitkeep`
- Create: `public/avatars/wings/.gitkeep`

- [ ] **Step 1: Create the directory structure and move the asset**

```bash
cd /home/dejanandovski/Code\ Repo/aero-chat-app
mkdir -p public/avatars/bases public/avatars/armor public/avatars/helmets public/avatars/weapons public/avatars/wings
cp AvatarCornerAssets/AeroDude.png public/avatars/bases/flutter.png
touch public/avatars/armor/.gitkeep public/avatars/helmets/.gitkeep public/avatars/weapons/.gitkeep public/avatars/wings/.gitkeep
```

- [ ] **Step 2: Verify the file exists**

Run: `ls -la public/avatars/bases/flutter.png`

Expected: The file is listed with size ~1.25MB.

- [ ] **Step 3: Commit**

```bash
git add public/avatars/
git commit -m "feat: move Flutter avatar to public/avatars and create item directories"
```

---

### Task 2: Rename XP bar labels and add overall level function

**Files:**
- Modify: `src/lib/xpConfig.ts:97-101`

- [ ] **Step 1: Update BAR_META labels**

In `src/lib/xpConfig.ts`, replace the BAR_META block (lines 97-101):

```typescript
export const BAR_META: Record<XpBar, { label: string; color: string; icon: string }> = {
  chatter: { label: 'Chatter', color: '#00d4ff', icon: 'MessageCircle' },
  gamer:   { label: 'Gamer',   color: '#3dd87a', icon: 'Gamepad2' },
  writer:  { label: 'Writer',  color: '#a855f7', icon: 'PenTool' },
};
```

With:

```typescript
export const BAR_META: Record<XpBar, { label: string; color: string; icon: string }> = {
  chatter: { label: 'Communication Skill', color: '#00d4ff', icon: 'MessageCircle' },
  gamer:   { label: 'System Knowledge',    color: '#3dd87a', icon: 'Gamepad2' },
  writer:  { label: 'Creative Talent',     color: '#a855f7', icon: 'PenTool' },
};
```

- [ ] **Step 2: Add deriveOverallLevel function**

Add after the `deriveLevel` function (after line 39), before the rank tables section:

```typescript
/** Overall agent level = average of the three bar levels. */
export function deriveOverallLevel(chatterXp: number, gamerXp: number, writerXp: number): number {
  const c = deriveLevel(chatterXp).level;
  const g = deriveLevel(gamerXp).level;
  const w = deriveLevel(writerXp).level;
  return Math.floor((c + g + w) / 3);
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /home/dejanandovski/Code\ Repo/aero-chat-app && npx tsc --noEmit 2>&1 | head -10`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/xpConfig.ts
git commit -m "feat: rename XP bar labels and add deriveOverallLevel function"
```

---

### Task 3: Avatar config module

**Files:**
- Create: `src/lib/avatarConfig.ts`

- [ ] **Step 1: Create the avatar config module**

```typescript
// src/lib/avatarConfig.ts
// Avatar system configuration — base characters, item slots, layer order.

export interface AvatarBase {
  id: string;
  label: string;
  src: string; // path relative to public/, e.g. '/avatars/bases/flutter.png'
}

export const AVATAR_BASES: AvatarBase[] = [
  { id: 'flutter', label: 'Flutter', src: '/avatars/bases/flutter.png' },
];

export type ItemSlot = 'helmet' | 'armor' | 'weapon' | 'wings';

export interface EquippedItems {
  helmet?: string; // image path or undefined
  armor?: string;
  weapon?: string;
  wings?: string;
}

/** Layer order from back (index 0) to front (last). Base character is at index 2. */
export const LAYER_ORDER: readonly (ItemSlot | 'base')[] = [
  'weapon',  // z-index 1 — backmost
  'wings',   // z-index 2 — behind character
  'base',    // z-index 3 — the character itself
  'armor',   // z-index 4 — over body
  'helmet',  // z-index 5 — topmost
] as const;

/** Item slots only (excludes 'base'), for UI iteration. */
export const ITEM_SLOTS: readonly ItemSlot[] = ['helmet', 'armor', 'weapon', 'wings'] as const;

/** Get an AvatarBase by id, falling back to the first entry. */
export function getAvatarBase(id: string): AvatarBase {
  return AVATAR_BASES.find(b => b.id === id) ?? AVATAR_BASES[0];
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /home/dejanandovski/Code\ Repo/aero-chat-app && npx tsc --noEmit 2>&1 | head -10`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/avatarConfig.ts
git commit -m "feat: add avatar config module with base registry and layer order"
```

---

### Task 4: Avatar store (equipped items, localStorage persist)

**Files:**
- Create: `src/store/avatarStore.ts`

- [ ] **Step 1: Create the avatar store**

```typescript
// src/store/avatarStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type EquippedItems } from '../lib/avatarConfig';

interface AvatarState {
  selectedBase: string; // avatar base id, e.g. 'flutter'
  equipped: EquippedItems;
}

interface AvatarActions {
  setBase: (id: string) => void;
  equipItem: (slot: keyof EquippedItems, src: string) => void;
  unequipItem: (slot: keyof EquippedItems) => void;
}

type AvatarStore = AvatarState & AvatarActions;

export const useAvatarStore = create<AvatarStore>()(
  persist(
    (set) => ({
      selectedBase: 'flutter',
      equipped: {},

      setBase: (id) => set({ selectedBase: id }),

      equipItem: (slot, src) =>
        set((s) => ({ equipped: { ...s.equipped, [slot]: src } })),

      unequipItem: (slot) =>
        set((s) => {
          const next = { ...s.equipped };
          delete next[slot];
          return { equipped: next };
        }),
    }),
    { name: 'aero-avatar' },
  ),
);
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /home/dejanandovski/Code\ Repo/aero-chat-app && npx tsc --noEmit 2>&1 | head -10`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/store/avatarStore.ts
git commit -m "feat: add avatar store with equipped items and localStorage persist"
```

---

### Task 5: AeroAgent component (paper doll renderer)

**Files:**
- Create: `src/components/corners/AeroAgent.tsx`

- [ ] **Step 1: Create the AeroAgent component**

```tsx
// src/components/corners/AeroAgent.tsx
// Paper doll character renderer — stacks base + equipped item layers.

import { LAYER_ORDER } from '../../lib/avatarConfig';

interface AeroAgentProps {
  base: string;       // image src for the base character
  helmet?: string;
  armor?: string;
  weapon?: string;
  wings?: string;
}

/** Maps a layer name to its image src from props. */
function getLayerSrc(layer: string, props: AeroAgentProps): string | undefined {
  if (layer === 'base') return props.base;
  return props[layer as keyof Omit<AeroAgentProps, 'base'>];
}

export function AeroAgent({ base, helmet, armor, weapon, wings }: AeroAgentProps) {
  const props: AeroAgentProps = { base, helmet, armor, weapon, wings };

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      aspectRatio: '2816 / 1536',
    }}>
      {LAYER_ORDER.map((layer, i) => {
        const src = getLayerSrc(layer, props);
        if (!src) return null;
        return (
          <img
            key={layer}
            src={src}
            alt={layer}
            draggable={false}
            style={{
              position: i === 0 ? 'relative' : 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              zIndex: i + 1,
              pointerEvents: 'none',
            }}
          />
        );
      })}
    </div>
  );
}
```

Note: The first layer uses `position: relative` to establish the aspect-ratio container's height. All subsequent layers are `position: absolute` stacked on top.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /home/dejanandovski/Code\ Repo/aero-chat-app && npx tsc --noEmit 2>&1 | head -10`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/corners/AeroAgent.tsx
git commit -m "feat: add AeroAgent paper doll layering component"
```

---

### Task 6: Rewrite AvatarCorner — two-panel layout with upgraded XP bars

**Files:**
- Rewrite: `src/components/corners/AvatarCorner.tsx`

- [ ] **Step 1: Rewrite the entire AvatarCorner component**

Replace the entire contents of `src/components/corners/AvatarCorner.tsx` with:

```tsx
// src/components/corners/AvatarCorner.tsx
import { useEffect } from 'react';
import { MessageCircle, Gamepad2, PenTool, Palette, Award } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useXpStore } from '../../store/xpStore';
import { useAvatarStore } from '../../store/avatarStore';
import { type XpBar, BAR_META, DAILY_XP_CAP, deriveLevel, deriveOverallLevel, getRank } from '../../lib/xpConfig';
import { getAvatarBase } from '../../lib/avatarConfig';
import { AeroAgent } from './AeroAgent';

const BAR_ICONS: Record<XpBar, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  chatter: MessageCircle,
  gamer: Gamepad2,
  writer: PenTool,
};

// ── XP Bar (upgraded style) ─────────────────────────────────────────────────

function StatBar({ bar, isPremium }: { bar: XpBar; isPremium: boolean }) {
  const totalXp = useXpStore(s => s[`${bar}_xp`]);
  const dailyUsed = useXpStore(s => s[`${bar}_daily`]);
  const { level, currentXp, nextXp } = deriveLevel(totalXp);
  const rank = getRank(bar, level);
  const meta = BAR_META[bar];
  const Icon = BAR_ICONS[bar];
  const progress = level >= 100 ? 100 : nextXp > 0 ? Math.round((currentXp / nextXp) * 100) : 0;
  const dailyProgress = isPremium ? 0 : Math.min(dailyUsed / DAILY_XP_CAP, 1);

  return (
    <div style={{ marginBottom: 14 }}>
      {/* Label row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon style={{ width: 12, height: 12, color: meta.color, opacity: 0.8 }} />
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
            color: 'var(--text-secondary)', textTransform: 'uppercase',
          }}>
            {meta.label}
          </span>
        </div>
        <span style={{ fontSize: 11, fontWeight: 800, color: meta.color }}>
          LEVEL {level}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{
        height: 10, borderRadius: 6,
        background: 'rgba(255,255,255,0.06)',
        overflow: 'hidden',
        position: 'relative',
      }}>
        <div style={{
          height: '100%', borderRadius: 6,
          background: `linear-gradient(90deg, ${meta.color}99, ${meta.color})`,
          width: `${progress}%`,
          transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: `0 0 10px ${meta.color}40`,
        }} />
      </div>

      {/* EXP counter */}
      <div style={{
        fontSize: 9, color: 'var(--text-muted)', textAlign: 'right', marginTop: 3,
        fontWeight: 500, letterSpacing: '0.02em',
      }}>
        {level >= 100
          ? 'MAX LEVEL'
          : `EXP ${currentXp.toLocaleString()} / ${nextXp.toLocaleString()}`}
      </div>

      {/* Daily cap (free users only) */}
      {!isPremium && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <div style={{
            flex: 1, height: 3, borderRadius: 2,
            background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 2,
              background: dailyProgress >= 1 ? 'rgba(255,80,50,0.6)' : `${meta.color}44`,
              width: `${Math.round(dailyProgress * 100)}%`,
              transition: 'width 0.3s ease',
            }} />
          </div>
          <span style={{ fontSize: 8, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {dailyUsed}/{DAILY_XP_CAP} daily
          </span>
        </div>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function AvatarCorner() {
  const user = useAuthStore(s => s.user);
  const loadXp = useXpStore(s => s.loadXp);
  const loaded = useXpStore(s => s.loaded);
  const chatterXp = useXpStore(s => s.chatter_xp);
  const gamerXp = useXpStore(s => s.gamer_xp);
  const writerXp = useXpStore(s => s.writer_xp);
  const { selectedBase, equipped } = useAvatarStore();
  const isPremium = user?.is_premium === true;

  const avatarBase = getAvatarBase(selectedBase);
  const overallLevel = deriveOverallLevel(chatterXp, gamerXp, writerXp);

  useEffect(() => {
    if (user?.id && !loaded) {
      loadXp(user.id);
    }
  }, [user?.id, loaded, loadXp]);

  if (!user) return null;

  return (
    <div
      className="flex h-full"
      style={{
        background: 'var(--chat-bg)',
        border: '1px solid var(--chat-border)',
        borderRadius: 16,
        boxShadow: 'var(--chat-shadow)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Gloss overlay */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 80,
        background: 'var(--chat-gloss)', pointerEvents: 'none', borderRadius: 'inherit',
        zIndex: 10,
      }} />

      {/* ── LEFT PANEL: Character ── */}
      <div style={{
        flex: '0 0 45%',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px 20px',
        borderRight: '1px solid var(--panel-divider)',
        position: 'relative',
      }}>
        {/* Decorative corner orb */}
        <div className="pointer-events-none absolute" style={{
          width: 100, height: 100, top: -30, left: -30,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,212,255,0.12) 0%, transparent 70%)',
          filter: 'blur(16px)',
        }} />

        {/* Character display */}
        <div style={{ width: '80%', maxWidth: 240, position: 'relative' }}>
          <AeroAgent
            base={avatarBase.src}
            helmet={equipped.helmet}
            armor={equipped.armor}
            weapon={equipped.weapon}
            wings={equipped.wings}
          />
        </div>

        {/* Agent label */}
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <div style={{
            fontSize: 9, fontWeight: 600, letterSpacing: '0.08em',
            color: 'var(--text-muted)', textTransform: 'uppercase',
          }}>
            {isPremium ? 'Premium User' : 'Free User'}
          </div>
          <div style={{
            fontSize: 13, fontWeight: 800, color: 'var(--text-primary)',
            marginTop: 2, fontFamily: 'Inter, system-ui, sans-serif',
          }}>
            AGENT: {avatarBase.label.toUpperCase()}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button
            disabled
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 14px', borderRadius: 10,
              background: 'rgba(168,85,247,0.12)',
              border: '1px solid rgba(168,85,247,0.25)',
              color: 'rgba(168,85,247,0.5)',
              fontSize: 11, fontWeight: 700,
              cursor: 'not-allowed', opacity: 0.6,
            }}
          >
            <Palette style={{ width: 13, height: 13 }} />
            Customize
          </button>
          <button
            disabled
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 14px', borderRadius: 10,
              background: 'rgba(255,180,0,0.10)',
              border: '1px solid rgba(255,180,0,0.22)',
              color: 'rgba(255,180,0,0.5)',
              fontSize: 11, fontWeight: 700,
              cursor: 'not-allowed', opacity: 0.6,
            }}
          >
            <Award style={{ width: 13, height: 13 }} />
            Badges
          </button>
        </div>
      </div>

      {/* ── RIGHT PANEL: Stats ── */}
      <div style={{
        flex: 1,
        display: 'flex', flexDirection: 'column',
        padding: '24px 20px 20px',
        position: 'relative',
        overflow: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
              color: 'var(--text-muted)', textTransform: 'uppercase',
            }}>
              Current Level:
            </div>
            <h2 style={{
              fontSize: 16, fontWeight: 800, color: 'var(--text-primary)',
              fontFamily: 'Inter, system-ui, sans-serif',
              margin: '2px 0 0',
              letterSpacing: '-0.3px',
            }}>
              AERO AGENT STATUS
            </h2>
            {isPremium && (
              <span style={{
                display: 'inline-block', marginTop: 4,
                padding: '2px 8px', borderRadius: 10,
                fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
                background: 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,165,0,0.10))',
                color: '#FFD700',
                border: '1px solid rgba(255,215,0,0.28)',
              }}>
                Aero Chat+
              </span>
            )}
          </div>

          {/* Overall level circle */}
          <div style={{
            width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(0,120,255,0.08))',
            border: '2px solid rgba(0,212,255,0.35)',
            boxShadow: '0 0 12px rgba(0,212,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              fontSize: 18, fontWeight: 800, color: '#00d4ff',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}>
              {overallLevel}
            </span>
          </div>
        </div>

        {/* XP Bars */}
        {!loaded ? (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)', fontSize: 13,
          }}>
            Loading XP data...
          </div>
        ) : (
          <div style={{ flex: 1 }}>
            <StatBar bar="chatter" isPremium={isPremium} />
            <StatBar bar="writer" isPremium={isPremium} />
            <StatBar bar="gamer" isPremium={isPremium} />
          </div>
        )}

        {/* Tip */}
        <div style={{
          marginTop: 'auto', padding: '10px 14px', borderRadius: 10,
          background: 'var(--popup-item-bg)',
          border: '1px solid var(--panel-divider)',
          fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5,
        }}>
          {isPremium
            ? 'Aero Chat+ \u2014 No daily XP cap. Earn unlimited XP!'
            : 'Free users earn up to 100 XP per bar per day. Upgrade to Aero Chat+ to remove the cap!'}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /home/dejanandovski/Code\ Repo/aero-chat-app && npx tsc --noEmit 2>&1 | head -20`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/corners/AvatarCorner.tsx
git commit -m "feat: rewrite AvatarCorner with two-panel layout, paper doll, upgraded stat bars"
```

---

### Task 7: Full build verification

- [ ] **Step 1: Run TypeScript check**

Run: `cd /home/dejanandovski/Code\ Repo/aero-chat-app && npx tsc --noEmit 2>&1`

Expected: No errors.

- [ ] **Step 2: Run production build**

Run: `cd /home/dejanandovski/Code\ Repo/aero-chat-app && pnpm build 2>&1 | tail -15`

Expected: `built in Xs` with no TypeScript errors. AvatarCorner chunk should appear in the output. Chunk size warnings on the main bundle are pre-existing and acceptable.

- [ ] **Step 3: Verify Flutter image is served**

Run: `ls -la /home/dejanandovski/Code\ Repo/aero-chat-app/public/avatars/bases/flutter.png`

Expected: File exists, ~1.25MB.

- [ ] **Step 4: Final commit if any files were missed**

```bash
git status
# If clean, nothing to do. Otherwise:
# git add -A && git commit -m "chore: avatar display layer cleanup"
```

---

## Post-Implementation Notes

**The Customize and Badges buttons are disabled.** They render visually but do nothing. Sub-project 2 will enable them with the equip/unequip UI.

**No item PNGs exist yet.** The `public/avatars/{armor,helmets,weapons,wings}/` directories are empty. When the user drops PNGs there, the `AeroAgent` component will render them automatically — just pass the path to `useAvatarStore.equipItem()`.

**All item PNGs must be 2816x1536.** This is the critical constraint — items are pre-positioned on the canvas by the artist and the code does pure z-stacking.

**The `AvatarCornerAssets/` folder still exists** with the original AeroDude.png. It can be deleted manually or kept as a working directory for asset creation. It is not committed to git (should be in .gitignore or left untracked).

**XP bar renames propagate everywhere** — the Sidebar's XpMiniBar, the GamesCorner header strip, and the AvatarCorner stat panel all read from `BAR_META` and will show the new labels automatically.
