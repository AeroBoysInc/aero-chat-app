# Design Spec: Game Store + Animation Pause
**Date:** 2026-03-26
**Status:** Approved

---

## Overview

Two independent performance and UX features:

1. **Game Store** — Games are no longer immediately playable. The Games Corner gets a "My Games" / "Store" tab layout. Users browse, install, and uninstall games. Install state persists per user ID in localStorage. Under the hood, all game components are lazy-loaded (React.lazy + dynamic import), so no game JS is parsed at app startup until installed and launched.

2. **Animation Pause** — All CSS keyframe animations and canvas-based game loops are paused the moment the app window loses focus (via the Page Visibility API). They resume instantly when focus returns. Zero visual regression; the app just stops spending GPU/CPU cycles when the user switches to a game or another window.

---

## Feature 1: Game Store

### Data layer — `src/lib/gameInstalls.ts` (new file)

Thin localStorage helpers. All keys are scoped to the authenticated user's ID to prevent cross-user bleed.

```
Key: aero-installed-games-{userId}
Value: JSON array of game ID strings, e.g. ["bubblepop", "chess"]
```

Exports:
- `getInstalledGames(userId: string): string[]` — returns array, or `["bubblepop"]` if key is absent (Bubble Pop pre-installed for first-time users)
- `installGame(userId: string, gameId: string): void` — adds ID to the set
- `uninstallGame(userId: string, gameId: string): void` — removes ID from the set

**First-launch default:** Bubble Pop is pre-installed (returned by `getInstalledGames` when no key exists). This ensures the Library tab is never empty on first open.

### GAMES metadata — `src/components/corners/GamesCorner.tsx`

Two new fields added to every `GameEntry`:
- `size: string` — human-readable download size (e.g. `"~1 MB"`, `"~80 KB"`)
- `tags: string[]` — genre/mode labels (e.g. `["Strategy", "Multiplayer"]`)

Updated entries:

| Game | Size | Tags |
|------|------|------|
| Bubble Pop | ~80 KB | Casual, Single-player |
| Tropico | ~200 KB | Action, Single-player |
| Type Rush | ~60 KB | Typing, Speed |
| 2048 | ~50 KB | Puzzle, Single-player |
| Wordle | ~60 KB | Word, Daily |
| AeroChess | ~1 MB | Strategy, Multiplayer |

### Lazy-loading

Chess is already `React.lazy()`. The remaining five games are currently eager imports. They will all be converted to `React.lazy()` with `Suspense` wrappers. This means none of their JS is parsed until the user launches the game for the first time after installing.

```ts
const BubblePop        = lazy(() => import('./games/BubblePop').then(m => ({ default: m.BubblePop })))
const Tropico          = lazy(() => import('./games/Tropico').then(m => ({ default: m.Tropico })))
const TwentyFortyEight = lazy(() => import('./games/TwentyFortyEight').then(m => ({ default: m.TwentyFortyEight })))
const TypingTest       = lazy(() => import('./games/TypingTest').then(m => ({ default: m.TypingTest })))
const Wordle           = lazy(() => import('./games/Wordle').then(m => ({ default: m.Wordle })))
```

### GamesCorner component — refactored `GameHub`

`GameHub` gains two pieces of local state:
- `activeTab: 'library' | 'store'` — which tab is visible
- `installedGames: string[]` — initialized from `getInstalledGames(user.id)`, updated on install/uninstall

`user` is read from `useAuthStore`.

**Library tab** (My Games):
- Lists only games whose ID is in `installedGames`, using detail rows
- Each row: icon, name, description, genre tags — **▶ PLAY** button (launches the game via `selectGame()`) — faint **Uninstall** text link
- If empty (impossible after first-launch default): shows a hint pointing to the Store tab

**Store tab**:
- Lists only games whose ID is NOT in `installedGames`, using detail rows
- Each row: icon, name, description, size, genre tags — **⬇ Install** button
- Clicking Install: button disables, progress bar animates over ~1.5 s, then `installGame()` is called and the game moves to the Library tab (tab auto-switches)
- Only one install can be in progress at a time (subsequent buttons disabled during install)

**Detail row layout** (used in both tabs):
```
[Icon 42×42] [Name / description / tags]  [Action button]
                                           [Uninstall link — Library only]
```

### No changes to `cornerStore.ts`

`selectGame()`, `closeGameView()`, and all existing game navigation remain unchanged.

### GamesStrip

The strip shown below active games lists all installed games (not all games). It reads from the same `installedGames` state passed down from `GamesCorner`.

---

## Feature 2: Animation Pause on Focus Loss

### CSS — `src/index.css`

One rule added to the global stylesheet:

```css
.paused * {
  animation-play-state: paused !important;
}
```

This freezes every `@keyframes` animation in the entire app with zero per-component changes: orb-drift, aura-pulse, bubble-float, typing-bounce, score-float, etc.

### App.tsx — visibility listener

One `useEffect` (no deps, runs once on mount):

```ts
useEffect(() => {
  const handler = () =>
    document.documentElement.classList.toggle('paused', document.hidden)
  document.addEventListener('visibilitychange', handler)
  return () => document.removeEventListener('visibilitychange', handler)
}, [])
```

### R3F / Three.js — `ChessBoard3D.tsx`

Chess has 6 active `useFrame` hooks. When the window is hidden, the Three.js render loop must be stopped at the GL level, not just at the CSS level.

Inside `ChessBoard3D`, add a `useEffect` that uses `useThree` to get `gl`:

```ts
const { gl } = useThree()
useEffect(() => {
  const handler = () => {
    if (document.hidden) gl.setAnimationLoop(null)
    else gl.setAnimationLoop(gl.render)  // restore — verify exact R3F API against installed version
  }
  document.addEventListener('visibilitychange', handler)
  return () => document.removeEventListener('visibilitychange', handler)
}, [gl])
```

Chess is only mounted when the Games Corner is open and chess is selected, so this listener only exists when relevant.

### Canvas game loops — BubblePop and Tropico

Both games already have a `gamePaused` state that halts their `requestAnimationFrame` loops via a `pausedRef`. We hook into this mechanism by dispatching a custom DOM event `aerochat:visibilitychange` from the App.tsx listener, which each game subscribes to:

```ts
// App.tsx (add to existing handler)
document.dispatchEvent(new CustomEvent('aerochat:visibilitychange', { detail: { hidden: document.hidden } }))

// BubblePop.tsx / Tropico.tsx (add useEffect)
useEffect(() => {
  const handler = (e: CustomEvent) => setGamePaused(e.detail.hidden)
  document.addEventListener('aerochat:visibilitychange', handler as EventListener)
  return () => document.removeEventListener('aerochat:visibilitychange', handler as EventListener)
}, [])
```

This means if a user is mid-game in BubblePop and alt-tabs, the game freezes instantly and resumes exactly where they left off.

---

## Files touched

| File | Change |
|------|--------|
| `src/lib/gameInstalls.ts` | **New** — per-user install state helpers |
| `src/components/corners/GamesCorner.tsx` | **Refactor** — tabs, lazy imports, install flow, strip update |
| `src/index.css` | **+1 rule** — `.paused *` |
| `src/App.tsx` | **+1 useEffect** — visibilitychange listener |
| `src/components/chess/ChessBoard3D.tsx` | **+1 useEffect** — gl.setAnimationLoop pause |
| `src/components/corners/games/BubblePop.tsx` | **+1 useEffect** — aerochat:visibilitychange hook |
| `src/components/corners/games/Tropico.tsx` | **+1 useEffect** — aerochat:visibilitychange hook |

---

## Out of scope

- No backend changes — install state is local only
- No Supabase syncing of installed games across devices
- TypingTest and TwentyFortyEight and Wordle use no persistent RAF loops; the CSS pause rule handles their animations
- No uninstall confirmation dialog — single click is sufficient for a ~60–80 KB "game"
