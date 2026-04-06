# Avatar Display + Layering Engine — Design Spec

**Goal:** Replace the current simple AvatarCorner with a two-panel layout featuring a paper doll character display (Flutter) with cosmetic item layering, and an upgraded XP stat panel matching the Frutiger Aero concept art.

**Scope:** Sub-project 1 of the Avatar Corner system. This covers rendering and layout only — no inventory UI, no Supabase item tables, no unlock triggers, no payment.

---

## Two-Panel Layout

The AvatarCorner component is rewritten as a side-by-side layout inside the existing corner layer:

- **Left panel (~45%)** — Glass card containing:
  - The Aero Agent character rendered via the paper doll layering engine
  - "PREMIUM USER" / "AGENT: FLUTTER" labels below the character
  - Customize button (present but disabled — sub-project 2)
  - Badges button (present but disabled — future)

- **Right panel (~55%)** — Glass card titled "AERO AGENT STATUS" containing:
  - Overall level circle (top-right) — average of 3 bar levels
  - 3 XP progress bars with upgraded styling (taller, gradient fills, glow, uppercase labels)
  - Daily cap indicator for free users below each bar

Both panels use the Frutiger Aero glass aesthetic: translucent gradient backgrounds, gloss overlays, subtle borders with `var(--panel-divider)`.

---

## Paper Doll Layering Engine

A new `AeroAgent` component renders the character with equipped items.

### Layer Stack (back to front)

| z-index | Slot | Description |
|---------|------|-------------|
| 1 | Weapon | Backmost — strapped/held behind character |
| 2 | Wings/Cape | Behind character, flowing outward |
| 3 | Base Character | Always rendered (e.g. Flutter) |
| 4 | Armor | Overlays on body |
| 5 | Helmet | Topmost — on head |

### How It Works

- Container `<div>` with `position: relative` at the character's fixed aspect ratio (2816x1536 → ~1.83:1)
- Each layer is an absolute-positioned `<img>` with `width: 100%; height: 100%; object-fit: contain`
- **Critical constraint:** Every PNG (base characters + all item assets) shares the same canvas dimensions (2816x1536). Items are pre-positioned on the canvas by the artist. The code stacks them — zero positioning logic at runtime.
- Empty slots render nothing (no `<img>` tag emitted)

### Component Interface

```typescript
interface AeroAgentProps {
  base: string;       // image path for base character
  helmet?: string;    // image path or undefined
  armor?: string;
  weapon?: string;
  wings?: string;
}
```

---

## XP Bar Renames

Display labels change, internal keys stay the same (no migration):

| Internal key | Old label | New label | Color |
|-------------|-----------|-----------|-------|
| `chatter` | Chatter | Communication Skill | `#00d4ff` |
| `writer` | Writer | Creative Talent | `#a855f7` |
| `gamer` | Gamer | System Knowledge | `#3dd87a` |

Updated in `BAR_META` in `src/lib/xpConfig.ts`. All consumers (XpMiniBar, AvatarCorner, etc.) pick up the rename automatically.

---

## Overall Level

New pure function in `xpConfig.ts`:

```typescript
function deriveOverallLevel(chatterXp: number, gamerXp: number, writerXp: number): number {
  const c = deriveLevel(chatterXp).level;
  const g = deriveLevel(gamerXp).level;
  const w = deriveLevel(writerXp).level;
  return Math.floor((c + g + w) / 3);
}
```

Displayed in a circular badge in the right panel header.

---

## Asset Pipeline

### File structure

```
public/avatars/
  bases/flutter.png        ← moved from AvatarCornerAssets/AeroDude.png
  armor/                   ← empty, ready for item PNGs
  helmets/                 ← empty, ready for item PNGs
  weapons/                 ← empty, ready for item PNGs
  wings/                   ← empty, ready for item PNGs
```

Assets served as static files by Vite from `public/`.

### Config module — `src/lib/avatarConfig.ts`

```typescript
type AvatarBase = { id: string; label: string; src: string };
type EquippedItems = { helmet?: string; armor?: string; weapon?: string; wings?: string };
```

- `AVATAR_BASES` array — just Flutter for now
- `LAYER_ORDER` constant — `['weapon', 'wings', 'base', 'armor', 'helmet']`
- `ITEM_SLOTS` — `['helmet', 'armor', 'weapon', 'wings']` for UI iteration

### Local state — `src/store/avatarStore.ts`

Zustand store with `persist` middleware (localStorage). Stores:
- `selectedBase: string` (avatar id, defaults to `'flutter'`)
- `equipped: EquippedItems` (all slots initially empty)

No Supabase table in this sub-project. Supabase sync added in sub-project 2 when customize UI ships.

---

## Files Changed

| Action | Path | Responsibility |
|--------|------|----------------|
| CREATE | `src/lib/avatarConfig.ts` | Avatar types, base registry, layer order, item slots |
| CREATE | `src/store/avatarStore.ts` | Equipped items state (localStorage persist) |
| CREATE | `src/components/corners/AeroAgent.tsx` | Paper doll layering renderer |
| REWRITE | `src/components/corners/AvatarCorner.tsx` | Two-panel layout, upgraded XP bars, overall level |
| MODIFY | `src/lib/xpConfig.ts` | Rename BAR_META labels, add `deriveOverallLevel()` |
| MOVE | `AvatarCornerAssets/AeroDude.png` → `public/avatars/bases/flutter.png` | Asset relocation |
| CREATE | `public/avatars/armor/.gitkeep` | Empty dirs for future items |
| CREATE | `public/avatars/helmets/.gitkeep` | |
| CREATE | `public/avatars/weapons/.gitkeep` | |
| CREATE | `public/avatars/wings/.gitkeep` | |

---

## What This Does NOT Cover

- Customize button functionality (equip/unequip UI) — sub-project 2
- Supabase table for owned/equipped items — sub-project 2
- Unlock triggers (level-based, store, boxes) — sub-project 3
- Badges system — future, needs separate planning
- Payment / Aero Boxes — future
- Multiple avatar base characters — future (just Flutter for now)
- WebP optimization — future when more assets arrive
