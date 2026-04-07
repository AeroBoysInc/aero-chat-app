# Master Theme — Design Spec

## Overview

A premium "Master" theme (€5) for AeroChat that replaces the standard sidebar + chat + corner rail layout with a **3D parallax tile dashboard**. The theme uses a hacker-luxe aesthetic: emerald green (#00e676) on near-black (#050505), frosted bubble glassmorphism, and a Metro Mosaic tile grid as the primary navigation paradigm.

**Price:** €5 one-time (requires `is_premium = true`)

---

## Visual Identity

### Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| Primary (Emerald) | `#00e676` | Accents, labels, active states, glows |
| Deep Emerald | `#00c853` | Pressed states, stronger accents |
| Mint | `#69f0ae` | Subtle highlights, hover states |
| Background | `#050505` | Body, flat (no gradient orbs) |
| Surface | `#0a1a10` | Elevated dark surfaces |
| Glass fill | `rgba(0,230,118,0.08)` | Tile backgrounds, panels |
| Glass border | `rgba(0,230,118,0.18)` | Tile/panel borders |
| Text primary | `rgba(255,255,255,0.70)` | Headings, names |
| Text secondary | `rgba(255,255,255,0.45)` | Body text, messages |
| Text muted | `rgba(255,255,255,0.22)` | Timestamps, placeholders |

### Frosted Bubble Tile Style

- `border-radius: 18px`
- `backdrop-filter: blur(16px)`
- Background: `linear-gradient(145deg, rgba(0,230,118,0.08), rgba(0,30,18,0.92))`
- Top-half gloss (convex bubble): `linear-gradient(180deg, rgba(0,230,118,0.08) 0%, transparent 50%)` via `::before`
- Inner glow: `box-shadow: inset 0 0 40px rgba(0,230,118,0.04)` via `::after`
- Border: `1px solid rgba(0,230,118,0.18)`
- Hover glow: `box-shadow: 0 8px 32px rgba(0,230,118,0.10)`

### No Ambient Background

The Master Theme uses a flat `#050505` body. No orbs, no clouds, no ambient elements. The parallax tiles provide all visual motion. This keeps GPU usage minimal.

### Scrollbar

- Track: transparent
- Thumb: `rgba(0,230,118,0.15)`, hover: `rgba(0,230,118,0.25)`
- Width: 6px

---

## Architecture

### Top-Level Swap

```
ChatLayout (existing, ~line 177 desktop layout)
  └─ if theme === 'master' → <MasterThemeDashboard />
  └─ else → existing sidebar + chat + corners layout
```

`MasterThemeDashboard` is a new component that replaces the entire desktop layout content when the master theme is active. It imports and uses `useCornerStore` for state management (shared with the rest of the app).

### Component Tree

```
MasterThemeDashboard
  ├─ MasterHeader              (logo, bell, logout, theme switcher)
  ├─ TileGrid                  (6 parallax tiles, Metro Mosaic)
  │   ├─ HomeTile              (friend list preview, unread counts)
  │   ├─ GamesTile             (game icon thumbnails)
  │   ├─ WritersTile           (draft text previews)
  │   ├─ CalendarTile          (today's date, event count)
  │   ├─ AvatarTile            (user avatar, level)
  │   └─ ServersTile           (server icons, unread badge)
  └─ FullscreenView            (FLIP-expanded tile content)
      ├─ BackBar               ("← Dashboard" + tile title)
      └─ [tile content with .master-compact wrapper]
```

### State

- `useCornerStore` — reused for corner active states (games, writers, calendar, avatar, servers)
- Local state in `MasterThemeDashboard`:
  - `expandedTile: 'home' | 'games' | 'writers' | 'calendar' | 'avatar' | 'servers' | null`
  - `flipRect: DOMRect | null` (captured before FLIP expand)
  - `collapsing: boolean` (true during reverse FLIP)

### No CornerRail

The CornerRail is not rendered in the Master Theme. The tile grid IS the navigation. To switch sections, the user returns to the dashboard first (via "← Dashboard" button or Escape key).

### Header Bar

A themed header bar renders above the tile grid on the dashboard. It contains:
- Left: AeroChat logo + "MASTER" label
- Right: friend request bell, logout button, theme switcher

The header hides when a tile is expanded to fullscreen. The fullscreen view has its own BackBar.

---

## Tile Dashboard

### Metro Mosaic Layout

```
┌─────────────────┬──────────┬──────────┐
│                  │  Games   │ Writers  │
│      HOME        │          │          │
│   (2 row span)  ├──────────┼──────────┤
│                  │ Calendar │  Avatar  │
│                  │          │          │
├─────────────────┴──────────┴──────────┤
│              SERVERS (wide bar)        │
└────────────────────────────────────────┘
```

CSS Grid:
```css
grid-template-columns: 2.2fr 1fr 1fr;
grid-template-rows: 1fr 1fr;
gap: 10px;
```
Home: `grid-row: 1 / 3`
Servers: separate row below the grid, full width, shorter height (~62px).

### Tile Preview Content

All tiles render real data. CSS animations inside tiles are paused via:
```css
.tile-paused * { animation-play-state: paused !important; }
```

**Home (tall):** Compact friend list — 24px avatar, name, last message snippet (truncated), unread badge, relative time. Max 6-7 visible rows. Online friends sorted first. Data: `useFriendStore`, `useMessageStore`, `useUnreadStore`.

**Games:** Grid of game icon thumbnails (34x34 rounded squares). Active match indicator dot. Data: static game list + `useChessStore`.

**Writers:** 4-5 text preview lines (story titles/content). Draft count sublabel. Data: `useWriterStore`.

**Calendar:** Large date number, month, year. Small bars for today's events. Data: calendar store or static.

**Avatar:** Centered 48px avatar circle (user's actual image or initial letter). "Customize" sublabel. Data: `useAuthStore`.

**Servers (wide):** Row of server icons (34px), total unread badge. Data: `useServerStore`.

---

## Parallax System

### `useParallax(ref)` Hook

- Listens to `mousemove` on the referenced element
- Computes mouse offset from center as percentage (-0.5 to 0.5)
- Returns `{ style }` object with:
  - `transform: perspective(800px) rotateY(${rX}deg) rotateX(${rY}deg)`
  - `rX`, `rY` capped at ±15deg
- Background content inside tile shifts opposite: `transform: translateX(${-bgX}px) translateY(${-bgY}px)` with bgX/bgY at ±20px
- Uses `requestAnimationFrame` for smooth updates
- On `mouseleave`: returns to `(0, 0)` over 600ms with `cubic-bezier(0.445, 0.05, 0.55, 0.95)`
- On `mouseenter`: clears return timeout
- Tiles get `will-change: transform` while being tracked

---

## FLIP Expand/Collapse Animation

### Expand (tile → fullscreen)

1. User clicks tile → capture `getBoundingClientRect()` as `firstRect`
2. Set `expandedTile` → fullscreen element renders at viewport size
3. Next frame: capture fullscreen rect as `lastRect`
4. Apply inverse transform so fullscreen looks like it's at tile position:
   ```
   scaleX(first.width / last.width)
   scaleY(first.height / last.height)
   translate(deltaX, deltaY)
   ```
5. Remove transform with `transition: transform 0.45s cubic-bezier(0.23, 1, 0.32, 1)`
6. Other tiles: `opacity → 0` over 200ms
7. Header bar: fades out over 200ms

### Collapse (fullscreen → tile)

1. Escape key or "← Dashboard" click
2. Capture current fullscreen rect
3. Set `collapsing = true`, compute target tile rect
4. Apply transform to animate fullscreen back to tile position over 350ms with `cubic-bezier(0.445, 0.05, 0.55, 0.95)`
5. On `transitionend`: set `expandedTile = null`, `collapsing = false`
6. Dashboard tiles fade back in over 200ms

### Performance

- Only `transform` and `opacity` animated (compositor-only, no layout)
- `will-change: transform` added only during animation, removed on `transitionend`

---

## Fullscreen View Content

### BackBar (shared)

- Height: ~36px
- Left: `← Dashboard` frosted glass pill button
- Center: tile name
- Escape key: triggers collapse
- Styled: frosted glass background matching tile aesthetic

### Home (fullscreen)

1. **Glass Banner Profile** at top:
   - 42px avatar (rendered at 84px native for 2x displays, `object-fit: cover`, no upscaling of low-res sources — falls back to styled initial letter if avatar is low quality)
   - Username, status dot + label, activity text ("Playing AeroChess")
   - @tag below name
   - Bell, gear, status dropdown buttons on right
   - Decorative emerald orb in top-right corner (blur(12px))
   - Gradient glass background: `linear-gradient(135deg, rgba(0,230,118,0.06), rgba(0,230,118,0.02))`

2. **Compact Split** below profile:
   - Left: 200px contact list (24px avatars, 10px font, 7px row padding)
   - Right: ChatWindow with compact styling
   - Active contact highlighted with left emerald border
   - Calls render inside chat area normally

### Other Tiles (fullscreen)

Each wraps the existing component in a `.master-compact` div:
- `<GamesCorner />` — tighter card grid (8px gaps), smaller padding
- `<WritersCorner />` — denser story list, editor full-width
- `<CalendarCorner />` — smaller grid cells, denser task list
- `<AvatarCorner />` — tighter customization panels
- `<ServerOverlay />` / `<ServerView />` — compacted server cards, no ultra server pickers (cloud/sun)

### `.master-compact` CSS Overrides

Applied as a wrapper class. Reduces spacing, font sizes, and border radii across all child components:

```css
.master-compact { /* base adjustments */ }
.master-compact .glass-sidebar { padding: 6px; }
.master-compact .glass-chat { /* tighter message gaps */ }
.master-compact .rounded-aero-lg { border-radius: 12px; }
.master-compact input,
.master-compact textarea { height: 28px; font-size: 12px; }
/* ... additional overrides per component as needed */
```

This avoids modifying existing component internals — pure CSS overrides.

---

## CSS Pause System

### Tile Preview State (paused)

```css
.tile-paused,
.tile-paused * {
  animation-play-state: paused !important;
}
```

Applied to all tiles in the dashboard grid. Prevents any CSS animations from running inside tile previews, saving GPU cycles.

### Fullscreen State (unpaused)

When a tile expands to fullscreen, the `.tile-paused` class is removed from that tile's content. Animations resume (aura pulses, typing indicators, etc.).

### App Idle State

The existing `.paused` idle system (applied when `document.hidden || !document.hasFocus()`) still applies on top. So even fullscreen content pauses when the app loses focus.

---

## Theme Store Integration

### Type Extension

```ts
export type Theme = 'day' | 'night' | 'ocean' | 'sunset' | 'aurora' | 'sakura'
  | 'john-frutiger' | 'golden-hour' | 'master';

export const MASTER_THEMES: Theme[] = ['master'];

export function isMasterTheme(t: Theme): boolean {
  return MASTER_THEMES.includes(t);
}
```

### ThemeStore Additions

- `ownsMaster: boolean` — loaded from Supabase
- `loadOwnership` fetches `owns_master` alongside existing ultra columns
- `purchaseTheme` handles `'master'` case

### Supabase Migration (027)

```sql
ALTER TABLE profiles ADD COLUMN owns_master BOOLEAN NOT NULL DEFAULT false;
```

### ThemeSwitcher UI

New "Master" section below "Ultra Themes":
- Emerald/gold gradient section label: "MASTER"
- Single row for the Master Theme
- Price: "€5"
- Lock/purchase/select states matching ultra theme pattern
- Requires `is_premium`

### Premium Fallback

Same as ultra themes: if `is_premium` becomes false while on master theme, fall back to `'day'`.

### TransitionWipe

Master theme returns `null` variant — no wipe animation. The existing logic in `TransitionWipe` already handles this: `theme === 'master'` doesn't match any variant, so no wipe renders. Clean fade handled by the FLIP animation instead.

---

## Performance Considerations

- **No ambient background** — flat black body, no GPU-heavy orb layers
- **Parallax** — `requestAnimationFrame`-throttled, `will-change: transform` only while tracking
- **FLIP** — compositor-only properties (`transform`, `opacity`), `will-change` removed after transition
- **Tile pausing** — all CSS animations frozen in dashboard state
- **Existing rules apply:** max 3 blur orbs, `.paused` idle system, scoped localStorage keys
- **Backdrop-filter** on tiles: 6 tiles × `blur(16px)` is within budget since tiles are static (not animating) in dashboard state

---

## Files to Create/Modify

### New Files
- `src/components/master/MasterThemeDashboard.tsx` — main dashboard component
- `src/components/master/TileGrid.tsx` — tile grid layout + parallax tiles
- `src/components/master/FullscreenView.tsx` — FLIP animation + fullscreen content wrapper
- `src/components/master/BackBar.tsx` — shared back navigation bar
- `src/components/master/GlassBannerProfile.tsx` — profile card for Home fullscreen
- `src/components/master/CompactSidebar.tsx` — 200px contact list for Home fullscreen
- `src/hooks/useParallax.ts` — parallax mouse tracking hook
- `src/hooks/useFlip.ts` — FLIP animation hook
- `supabase/migrations/027_master_theme.sql` — ownership column

### Modified Files
- `src/index.css` — `[data-theme="master"]` variables + `.master-compact` overrides + `.tile-paused` class
- `src/store/themeStore.ts` — `Theme` type, `MASTER_THEMES`, `isMasterTheme()`, `ownsMaster`, purchase logic
- `src/components/chat/ChatLayout.tsx` — master theme detection, render `<MasterThemeDashboard />` instead of normal layout
- `src/components/ui/ThemeSwitcher.tsx` — Master section in picker
- `src/components/ui/TransitionWipe.tsx` — master returns null variant (may already work with no changes)
