# Real Game Downloads: Standalone Bundles via Supabase Storage

## Overview

Replace the fake install/uninstall system (localStorage flags + bundled lazy chunks) with real downloadable game bundles hosted on Supabase Storage. Games are fetched on demand, cached locally via the Cache API for offline play, and truly removed on uninstall.

**Scope:** 5 single-player games — BubblePop, Tropico, Wordle, TypingTest, TwentyFortyEight.

**Out of scope:** AeroChess stays bundled with the app (multiplayer, shared store, Three.js dependency tree).

## Decisions

| Question | Decision |
|----------|----------|
| Where do bundles live? | Supabase Storage (`game-bundles` public bucket) |
| Chess handling? | Stays bundled — too integrated (multiplayer, stores, Three.js) |
| Play uninstalled game? | Prompt: "This game isn't installed. Download (~X KB)?" → confirm → download + launch |
| Offline support? | Yes — Cache API, cache-first for all single-player games |
| Architecture? | Dynamic `import()` via blob URLs from cached/fetched bundles |

## Build Pipeline

### Standalone game build

A new Vite config (`vite.games.config.ts`) builds each game as a self-contained ES module. It uses the library build mode with one entry per game.

**Externals:** `react`, `react-dom`, `react/jsx-runtime` — these are provided by the host app at runtime. Everything else (lucide-react icons, any game-specific deps) gets bundled into the `.mjs`.

**Output:**

```
dist-games/
  bubblepop.mjs
  tropico.mjs
  wordle.mjs
  typingtest.mjs
  twentyfortyeight.mjs
```

**Entry points:** The existing source files (`src/components/corners/games/*.tsx`), each of which must have a `default` export of its root React component.

### Upload script

`scripts/upload-games.ts` reads each `.mjs` from `dist-games/` and uploads to Supabase Storage:

```bash
pnpm build:games     # vite build --config vite.games.config.ts
pnpm upload:games    # node scripts/upload-games.ts
```

The script uses the Supabase JS client with the service role key (from env) to upsert files into the `game-bundles/v1/` path.

## Supabase Storage

### Bucket: `game-bundles`

- **Public** bucket (no RLS needed — game code is not sensitive)
- Created manually in the Supabase dashboard (one-time setup)

### File structure

```
game-bundles/
  v1/
    bubblepop.mjs
    tropico.mjs
    wordle.mjs
    typingtest.mjs
    twentyfortyeight.mjs
```

### URL pattern

```
{VITE_SUPABASE_URL}/storage/v1/object/public/game-bundles/v1/{gameId}.mjs
```

### Versioning

The `v1/` prefix is a version namespace. To update a game: overwrite the file in `v1/` (the app handles cache-busting by re-downloading on install). For breaking changes to the module contract, bump to `v2/`.

## Game Loader Runtime

### New file: `src/lib/gameLoader.ts`

Handles the full lifecycle: download, cache, load, and uninstall.

### Cache layer

Uses the browser Cache API with cache name `aero-games-v1`.

### API

```ts
async function downloadGame(gameId: string, onProgress?: (pct: number) => void): Promise<void>
async function loadGame(gameId: string): Promise<React.ComponentType>
async function removeGame(gameId: string): Promise<void>
async function isGameCached(gameId: string): Promise<boolean>
```

### Flows

**Install (download):**

1. `fetch()` the bundle URL from Supabase Storage
2. Read the response stream via `Response.body.getReader()` to report real download progress (percentage) to the UI via `onProgress` callback
3. `cache.put(gameId, response.clone())` to store in Cache API
4. Update localStorage via existing `installGame()` from `gameInstalls.ts`

**Play (load):**

1. `cache.match(gameId)` — check local cache
2. If cache hit: read response as blob
3. If cache miss: fetch from Supabase, cache it, read as blob
4. Create blob URL: `URL.createObjectURL(blob)`
5. `import(blobUrl)` — dynamic ES module import
6. Return `module.default` (the React component)

**Uninstall (remove):**

1. `cache.delete(gameId)` — remove from Cache API
2. Remove from localStorage via existing `uninstallGame()` from `gameInstalls.ts`

**Cache check:**

1. `cache.match(gameId)` — returns boolean for UI state

### External dependency injection

The standalone game bundles externalize React. At runtime, before importing a game bundle, the loader must make React available on the global scope so the externalized imports resolve:

```ts
window.__aero_react = React;
window.__aero_react_dom = ReactDOM;
window.__aero_jsx_runtime = jsxRuntime;
```

The Vite game build config maps the externals to these global references.

## GamesCorner Changes

### Removed

- 5 `React.lazy(() => import(...))` lines for single-player games
- Fake 1.5s `requestAnimationFrame` progress animation in `handleInstall`

### Game rendering

The static switch statement mapping game IDs to lazy components is replaced with dynamic loading:

```
User clicks Play
  → set loading state
  → GameComponent = await loadGame(gameId)
  → render <GameComponent />
```

The loaded component is held in React state. When the user switches games or goes back to the hub, the state is cleared.

### Play-on-uninstalled prompt

If the user clicks Play on a game that isn't installed (e.g. from the game strip), show a confirmation prompt:

- Text: "This game isn't installed yet. Download (~X KB)?"
- Confirm button triggers `downloadGame()` → `loadGame()` → render
- Cancel returns to the hub

### Real install progress

`handleInstall` calls `downloadGame(gameId, onProgress)` where `onProgress` updates the existing progress bar state with real download percentage from the fetch stream reader.

### Real uninstall

`handleUninstall` calls `removeGame(gameId)` then updates localStorage and local state.

### GAMES array

The `size` field is updated to reflect actual built bundle sizes.

## Game Source File Changes

Each of the 5 game files gets a default export added:

```tsx
// At the bottom of each file
export default BubblePop;  // (or Tropico, Wordle, etc.)
```

The existing named export stays for backwards compatibility during the transition.

No other changes to game source files — lucide-react icons and any other non-React deps get bundled into the standalone `.mjs` by the game build.

## File Map

### New files

| File | Responsibility |
|------|----------------|
| `vite.games.config.ts` | Standalone game build config (library mode, externalize React) |
| `scripts/upload-games.ts` | Upload built `.mjs` files to Supabase Storage |
| `src/lib/gameLoader.ts` | Download, cache (Cache API), load (blob URL + dynamic import), remove |

### Modified files

| File | Changes |
|------|---------|
| `src/components/corners/GamesCorner.tsx` | Remove 5 lazy imports, dynamic loading via gameLoader, real progress, play-on-uninstalled prompt |
| `src/components/corners/games/BubblePop.tsx` | Add `export default BubblePop` |
| `src/components/corners/games/Tropico.tsx` | Add `export default Tropico` |
| `src/components/corners/games/Wordle.tsx` | Add `export default Wordle` |
| `src/components/corners/games/TypingTest.tsx` | Add `export default TypingTest` |
| `src/components/corners/games/TwentyFortyEight.tsx` | Add `export default TwentyFortyEight` |
| `src/lib/gameInstalls.ts` | Wire `removeGame()` into uninstall flow |
| `package.json` | Add `build:games` and `upload:games` scripts |

### Unchanged

| File | Reason |
|------|--------|
| Chess files (AeroChess, ChessGame, ChessBoard3D, chessStore) | Stays bundled — multiplayer, shared store |
| All stores, Supabase client, crypto | No changes |
| EventModal, CalendarCorner, ChatWindow, etc. | Unrelated |

## Workflow

### First-time setup (one-time)

1. Create `game-bundles` public bucket in Supabase dashboard
2. Set `SUPABASE_SERVICE_ROLE_KEY` in local env for the upload script

### Updating games

```bash
pnpm build:games     # builds 5 standalone .mjs files to dist-games/
pnpm upload:games    # uploads to Supabase Storage game-bundles/v1/
```

### App deployment

Normal `pnpm build && vercel --prod` — the main app bundle no longer contains the 5 game chunks. Chess chunk remains.
