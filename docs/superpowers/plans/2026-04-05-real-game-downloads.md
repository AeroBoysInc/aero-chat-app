# Real Game Downloads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fake game install/uninstall system with real downloadable ES module bundles hosted on Supabase Storage, cached locally for offline play.

**Architecture:** Each of the 5 single-player games is built as a standalone `.mjs` that externalizes React, uploaded to a public Supabase Storage bucket, and loaded at runtime via dynamic `import()` from blob URLs. The Cache API provides offline support. Chess stays bundled.

**Tech Stack:** Vite library mode, Supabase Storage (public bucket), Cache API, dynamic `import()`, blob URLs.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `vite.games.config.ts` | Create | Builds each game as a standalone `.mjs` with React externalized |
| `scripts/upload-games.ts` | Create | Uploads built `.mjs` files to Supabase Storage |
| `src/lib/gameLoader.ts` | Create | Download, cache, load (blob URL → import), remove games |
| `src/components/corners/games/BubblePop.tsx` | Modify | Add default export |
| `src/components/corners/games/Tropico.tsx` | Modify | Add default export |
| `src/components/corners/games/Wordle.tsx` | Modify | Add default export |
| `src/components/corners/games/TypingTest.tsx` | Modify | Add default export |
| `src/components/corners/games/TwentyFortyEight.tsx` | Modify | Add default export |
| `src/components/corners/GamesCorner.tsx` | Modify | Remove lazy imports, use gameLoader, real progress, download prompt |
| `package.json` | Modify | Add `build:games` and `upload:games` scripts |

---

### Task 1: Add default exports to all 5 game files

**Files:**
- Modify: `src/components/corners/games/BubblePop.tsx`
- Modify: `src/components/corners/games/Tropico.tsx`
- Modify: `src/components/corners/games/Wordle.tsx`
- Modify: `src/components/corners/games/TypingTest.tsx`
- Modify: `src/components/corners/games/TwentyFortyEight.tsx`

These default exports are needed for the standalone build (library mode grabs the default export). The named exports stay so the current app build works until Task 6 switches to dynamic loading.

- [ ] **Step 1: Add default export to BubblePop.tsx**

At the very end of `src/components/corners/games/BubblePop.tsx`, add:

```tsx
export default BubblePop;
```

- [ ] **Step 2: Add default export to Tropico.tsx**

At the very end of `src/components/corners/games/Tropico.tsx`, add:

```tsx
export default Tropico;
```

- [ ] **Step 3: Add default export to Wordle.tsx**

At the very end of `src/components/corners/games/Wordle.tsx`, add:

```tsx
export default Wordle;
```

- [ ] **Step 4: Add default export to TypingTest.tsx**

At the very end of `src/components/corners/games/TypingTest.tsx`, add:

```tsx
export default TypingTest;
```

- [ ] **Step 5: Add default export to TwentyFortyEight.tsx**

At the very end of `src/components/corners/games/TwentyFortyEight.tsx`, add:

```tsx
export default TwentyFortyEight;
```

- [ ] **Step 6: Verify build passes**

Run: `cd aero-chat-app && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/components/corners/games/BubblePop.tsx src/components/corners/games/Tropico.tsx src/components/corners/games/Wordle.tsx src/components/corners/games/TypingTest.tsx src/components/corners/games/TwentyFortyEight.tsx
git commit -m "feat(games): add default exports to all 5 single-player games"
```

---

### Task 2: Create the standalone game build config

**Files:**
- Create: `vite.games.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Create `vite.games.config.ts`**

```ts
// vite.games.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

const games = ['bubblepop', 'tropico', 'wordle', 'typingtest', 'twentyfortyeight'];

const entryPoints: Record<string, string> = {
  bubblepop: resolve(__dirname, 'src/components/corners/games/BubblePop.tsx'),
  tropico: resolve(__dirname, 'src/components/corners/games/Tropico.tsx'),
  wordle: resolve(__dirname, 'src/components/corners/games/Wordle.tsx'),
  typingtest: resolve(__dirname, 'src/components/corners/games/TypingTest.tsx'),
  twentyfortyeight: resolve(__dirname, 'src/components/corners/games/TwentyFortyEight.tsx'),
};

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist-games',
    emptyDir: true,
    lib: {
      entry: entryPoints,
      formats: ['es'],
      fileName: (_, entryName) => `${entryName}.mjs`,
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        globals: {
          react: '__aero_react',
          'react-dom': '__aero_react_dom',
          'react/jsx-runtime': '__aero_jsx_runtime',
        },
      },
    },
    minify: 'esbuild',
    sourcemap: false,
  },
});
```

- [ ] **Step 2: Add build:games script to package.json**

In the `"scripts"` section of `package.json`, add these two entries after the existing `"test:ui"` line:

```json
"build:games": "vite build --config vite.games.config.ts",
"upload:games": "npx tsx scripts/upload-games.ts"
```

- [ ] **Step 3: Add `dist-games/` to `.gitignore`**

Append to `.gitignore`:

```
dist-games/
```

- [ ] **Step 4: Test the game build**

Run: `cd aero-chat-app && pnpm build:games`
Expected: builds 5 `.mjs` files in `dist-games/`. Check output:

```bash
ls -lh dist-games/
```

Expected: `bubblepop.mjs`, `tropico.mjs`, `wordle.mjs`, `typingtest.mjs`, `twentyfortyeight.mjs` — all present and non-zero.

- [ ] **Step 5: Verify the main app build still works**

Run: `cd aero-chat-app && pnpm build`
Expected: builds successfully (the game files still have named exports, so the existing lazy imports still work)

- [ ] **Step 6: Commit**

```bash
git add vite.games.config.ts package.json .gitignore
git commit -m "feat(games): add standalone game build config and build:games script"
```

---

### Task 3: Create the upload script

**Files:**
- Create: `scripts/upload-games.ts`

- [ ] **Step 1: Create `scripts/upload-games.ts`**

```ts
// scripts/upload-games.ts
import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing env vars: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const BUCKET = 'game-bundles';
const VERSION = 'v1';
const DIST_DIR = resolve(import.meta.dirname, '..', 'dist-games');

async function main() {
  const files = readdirSync(DIST_DIR).filter(f => f.endsWith('.mjs'));
  if (files.length === 0) {
    console.error('No .mjs files found in dist-games/. Run pnpm build:games first.');
    process.exit(1);
  }

  console.log(`Uploading ${files.length} game bundles to ${BUCKET}/${VERSION}/...\n`);

  for (const file of files) {
    const filePath = resolve(DIST_DIR, file);
    const fileBuffer = readFileSync(filePath);
    const remotePath = `${VERSION}/${file}`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(remotePath, fileBuffer, {
        contentType: 'application/javascript',
        upsert: true,
      });

    if (error) {
      console.error(`  ✗ ${file}: ${error.message}`);
    } else {
      const size = (fileBuffer.byteLength / 1024).toFixed(1);
      console.log(`  ✓ ${file} (${size} KB)`);
    }
  }

  console.log('\nDone.');
}

main();
```

- [ ] **Step 2: Verify it runs (dry check — no upload without the bucket existing)**

Run: `cd aero-chat-app && npx tsx scripts/upload-games.ts`
Expected: errors with "Missing env vars" if `SUPABASE_SERVICE_ROLE_KEY` is not set, which is fine. The script is structurally correct.

- [ ] **Step 3: Commit**

```bash
git add scripts/upload-games.ts
git commit -m "feat(games): add upload script for Supabase Storage"
```

---

### Task 4: Create the game loader runtime

**Files:**
- Create: `src/lib/gameLoader.ts`

This is the core module: download with progress, cache, load via blob URL + dynamic import, and remove.

- [ ] **Step 1: Create `src/lib/gameLoader.ts`**

```ts
// src/lib/gameLoader.ts
import React from 'react';
import ReactDOM from 'react-dom';
import * as jsxRuntime from 'react/jsx-runtime';

const CACHE_NAME = 'aero-games-v1';
const BUCKET_VERSION = 'v1';

function getBundleUrl(gameId: string): string {
  const base = import.meta.env.VITE_SUPABASE_URL as string;
  return `${base}/storage/v1/object/public/game-bundles/${BUCKET_VERSION}/${gameId}.mjs`;
}

function getCacheKey(gameId: string): string {
  return `aero-game:${gameId}`;
}

/** Ensure React globals are set so externalized game bundles can resolve imports. */
function ensureGlobals() {
  const w = window as any;
  if (!w.__aero_react) {
    w.__aero_react = React;
    w.__aero_react_dom = ReactDOM;
    w.__aero_jsx_runtime = jsxRuntime;
  }
}

/**
 * Download a game bundle from Supabase Storage and cache it.
 * Reports real download progress via onProgress(0–100).
 */
export async function downloadGame(
  gameId: string,
  onProgress?: (pct: number) => void,
): Promise<void> {
  const url = getBundleUrl(gameId);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download ${gameId}: ${response.status}`);

  const contentLength = Number(response.headers.get('content-length') || 0);
  const reader = response.body?.getReader();

  if (!reader || !contentLength) {
    // Fallback: no streaming progress, just cache the whole response
    const cache = await caches.open(CACHE_NAME);
    await cache.put(getCacheKey(gameId), response);
    onProgress?.(100);
    return;
  }

  // Stream the response to track progress
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    onProgress?.(Math.min(100, Math.round((received / contentLength) * 100)));
  }

  // Reconstruct the response and cache it
  const blob = new Blob(chunks, { type: 'application/javascript' });
  const cachedResponse = new Response(blob, {
    status: 200,
    headers: { 'Content-Type': 'application/javascript' },
  });
  const cache = await caches.open(CACHE_NAME);
  await cache.put(getCacheKey(gameId), cachedResponse);
  onProgress?.(100);
}

/**
 * Load a game component from cache (or network fallback).
 * Returns the default-exported React component.
 */
export async function loadGame(gameId: string): Promise<React.ComponentType> {
  ensureGlobals();

  const cache = await caches.open(CACHE_NAME);
  let response = await cache.match(getCacheKey(gameId));

  if (!response) {
    // Cache miss — fetch, cache, then load
    const url = getBundleUrl(gameId);
    const fetched = await fetch(url);
    if (!fetched.ok) throw new Error(`Failed to fetch ${gameId}: ${fetched.status}`);
    await cache.put(getCacheKey(gameId), fetched.clone());
    response = fetched;
  }

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);

  try {
    const mod = await import(/* @vite-ignore */ blobUrl);
    return mod.default as React.ComponentType;
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

/**
 * Remove a cached game bundle.
 */
export async function removeGame(gameId: string): Promise<void> {
  const cache = await caches.open(CACHE_NAME);
  await cache.delete(getCacheKey(gameId));
}

/**
 * Check whether a game bundle is in the local cache.
 */
export async function isGameCached(gameId: string): Promise<boolean> {
  const cache = await caches.open(CACHE_NAME);
  const match = await cache.match(getCacheKey(gameId));
  return match !== undefined;
}
```

- [ ] **Step 2: Verify build passes**

Run: `cd aero-chat-app && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/gameLoader.ts
git commit -m "feat(games): create gameLoader — download, cache, load, remove"
```

---

### Task 5: Rewrite GamesCorner to use dynamic loading

**Files:**
- Modify: `src/components/corners/GamesCorner.tsx`

This is the biggest task. It removes the 5 lazy imports, replaces the fake install animation with real downloads, adds the play-on-uninstalled prompt, and renders dynamically loaded game components.

- [ ] **Step 1: Replace the import block and add new imports**

Remove these 5 lazy import lines at the top of `GamesCorner.tsx`:

```tsx
const BubblePop        = lazy(() => import('./games/BubblePop').then(m => ({ default: m.BubblePop })))
const Tropico          = lazy(() => import('./games/Tropico').then(m => ({ default: m.Tropico })))
const TwentyFortyEight = lazy(() => import('./games/TwentyFortyEight').then(m => ({ default: m.TwentyFortyEight })))
const TypingTest       = lazy(() => import('./games/TypingTest').then(m => ({ default: m.TypingTest })))
const Wordle           = lazy(() => import('./games/Wordle').then(m => ({ default: m.Wordle })))
```

In the React import at line 1, remove `lazy` from the import (keep `Suspense`):

```tsx
import { Suspense, useState, useEffect, useRef } from 'react';
```

Add this import after the existing imports:

```tsx
import { downloadGame, loadGame, removeGame } from '../../lib/gameLoader';
```

- [ ] **Step 2: Replace the fake `handleInstall` with real download**

In the `GameHub` component, replace the entire `handleInstall` function (lines ~319–338) with:

```tsx
  async function handleInstall(gameId: string) {
    if (installing || !user) return;
    setInstalling(gameId);
    setProgress(0);
    try {
      await downloadGame(gameId, (pct) => setProgress(pct));
      installGame(user.id, gameId);
      onInstalled(gameId);
      setActiveTab('library');
    } catch (err) {
      console.error('[GameInstall] Download failed:', err);
    } finally {
      setInstalling(null);
      setProgress(0);
    }
  }
```

Also remove the `rafRef` useRef and its cleanup useEffect since the requestAnimationFrame loop is gone:

Remove:
```tsx
  const rafRef = useRef<number | null>(null)
  // ...
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }, [])
```

- [ ] **Step 3: Replace the fake `handleUninstall` with real removal**

In the `GameHub` component, replace `handleUninstall`:

```tsx
  async function handleUninstall(gameId: string) {
    if (!user) return;
    await removeGame(gameId);
    uninstallGame(user.id, gameId);
    onUninstalled(gameId);
  }
```

- [ ] **Step 4: Replace the static game rendering switch with dynamic loading**

In the root `GamesCorner` component, add state for the dynamically loaded component and a loading flag:

```tsx
  const [LoadedGame, setLoadedGame] = useState<React.ComponentType | null>(null);
  const [gameLoading, setGameLoading] = useState(false);
  const [downloadPrompt, setDownloadPrompt] = useState<SelectedGame | null>(null);
```

Add a `playGame` function that handles loading:

```tsx
  async function playGame(gameId: SelectedGame) {
    if (!gameId || !user) return;
    // Check if installed
    if (!installedGames.includes(gameId as string)) {
      setDownloadPrompt(gameId);
      return;
    }
    setGameLoading(true);
    try {
      const Component = await loadGame(gameId as string);
      setLoadedGame(() => Component);
    } catch (err) {
      console.error('[GameLoader] Failed to load:', err);
    } finally {
      setGameLoading(false);
    }
  }
```

Add a handler for when the user confirms the download prompt:

```tsx
  async function handlePromptConfirm() {
    if (!downloadPrompt || !user) return;
    const gameId = downloadPrompt as string;
    setDownloadPrompt(null);
    setGameLoading(true);
    try {
      await downloadGame(gameId, () => {});
      installGame(user.id, gameId);
      setInstalledGames(prev => [...prev, gameId]);
      const Component = await loadGame(gameId);
      setLoadedGame(() => Component);
    } catch (err) {
      console.error('[GameLoader] Download+load failed:', err);
    } finally {
      setGameLoading(false);
    }
  }
```

When `selectedGame` changes, trigger playGame (but NOT for chess, which stays bundled). Add a useEffect:

```tsx
  useEffect(() => {
    if (!selectedGame || selectedGame === 'chess') {
      setLoadedGame(null);
      return;
    }
    playGame(selectedGame);
  }, [selectedGame]);
```

- [ ] **Step 5: Replace the game rendering JSX**

Replace the entire `{selectedGame ? (...)` block in the return JSX with:

```tsx
      {selectedGame ? (
        <>
          <div className="flex-1 min-h-0">
            {selectedGame === 'chess' && (
              <Suspense fallback={
                <div className="flex h-full items-center justify-center" style={{ color: 'rgba(0,212,255,0.7)', fontSize: 13 }}>
                  Loading chess…
                </div>
              }>
                <AeroChess />
              </Suspense>
            )}
            {selectedGame !== 'chess' && gameLoading && <GameLoadingSpinner />}
            {selectedGame !== 'chess' && !gameLoading && LoadedGame && <LoadedGame />}
            {selectedGame !== 'chess' && !gameLoading && !LoadedGame && (
              <div className="flex h-full items-center justify-center text-center">
                <div>
                  <p className="text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>Failed to load game</p>
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Try reinstalling from the Store</p>
                </div>
              </div>
            )}
          </div>
          {selectedGame !== 'chess' && <GamesStrip installedGames={installedGames} />}
        </>
      ) : downloadPrompt ? (
        <DownloadPrompt
          game={GAMES.find(g => g.id === downloadPrompt)!}
          onConfirm={handlePromptConfirm}
          onCancel={() => setDownloadPrompt(null)}
          loading={gameLoading}
        />
      ) : (
        <GameHub
          installedGames={installedGames}
          onInstalled={id => setInstalledGames(prev => [...prev, id])}
          onUninstalled={id => setInstalledGames(prev => prev.filter(g => g !== id))}
        />
      )}
```

- [ ] **Step 6: Add the DownloadPrompt component**

Add this component above the root `GamesCorner` component:

```tsx
function DownloadPrompt({
  game,
  onConfirm,
  onCancel,
  loading,
}: {
  game: GameEntry;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center gap-4 p-8">
      <div
        className="flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
        style={{
          background: `rgba(${hexToRgb(game.color)}, 0.12)`,
          border: `1px solid rgba(${hexToRgb(game.color)}, 0.30)`,
        }}
      >
        {typeof game.icon === 'string' ? game.icon : '🎮'}
      </div>
      <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
        {game.label} isn't installed yet
      </p>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Download {game.size} to play?
      </p>
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          disabled={loading}
          className="rounded-xl px-5 py-2 text-xs font-bold transition-all"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'var(--text-muted)',
            opacity: loading ? 0.5 : 1,
          }}
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="rounded-xl px-5 py-2 text-xs font-bold transition-all"
          style={{
            background: `rgba(${hexToRgb(game.color)}, 0.18)`,
            border: `1px solid rgba(${hexToRgb(game.color)}, 0.40)`,
            color: game.color,
            opacity: loading ? 0.5 : 1,
          }}
        >
          {loading ? 'Downloading…' : `⬇ Download & Play`}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Update the GameHub `handlePlay` to go through the parent**

The `GameHub` already calls `selectGame(gameId)` which triggers the `selectedGame` state change in the store. The `useEffect` in step 4 picks this up and calls `playGame`. However, for chess the existing path (`selectGame('chess'); openLobby()`) stays unchanged. No changes needed in `handlePlay`.

- [ ] **Step 8: Verify build passes**

Run: `cd aero-chat-app && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 9: Run full Vite build**

Run: `cd aero-chat-app && pnpm build`
Expected: builds successfully. The 5 game chunks (`BubblePop-*.js`, `Tropico-*.js`, etc.) should NO LONGER appear in `dist/assets/` since they're no longer lazy-imported. The `AeroChess-*.js` chunk should still be there.

Verify: `ls dist/assets/*.js | grep -i -E 'bubble|tropico|wordle|typing|twenty'`
Expected: no output (games are gone from the main build)

- [ ] **Step 10: Commit**

```bash
git add src/components/corners/GamesCorner.tsx
git commit -m "feat(games): dynamic loading via gameLoader, real downloads, download prompt

Remove 5 lazy game imports. Games are now loaded at runtime from
Cache API / Supabase Storage. Chess stays bundled. Uninstalled games
show a download prompt before playing."
```

---

### Task 6: Create Supabase bucket, build games, upload, and verify

**Files:** none (infrastructure + deploy step)

- [ ] **Step 1: Create the `game-bundles` bucket in Supabase**

Go to the Supabase dashboard → Storage → New bucket:
- Name: `game-bundles`
- Public: **Yes**

- [ ] **Step 2: Build the game bundles**

```bash
cd aero-chat-app && pnpm build:games
```

Verify output:
```bash
ls -lh dist-games/
```

Expected: 5 `.mjs` files, each 15–50 KB.

- [ ] **Step 3: Upload to Supabase Storage**

Set the service role key and run:

```bash
cd aero-chat-app && SUPABASE_SERVICE_ROLE_KEY=<your-key> pnpm upload:games
```

Expected: 5 lines of `✓ filename.mjs (XX.X KB)`.

- [ ] **Step 4: Verify bundles are publicly accessible**

Open in a browser or curl:
```bash
curl -I "${VITE_SUPABASE_URL}/storage/v1/object/public/game-bundles/v1/bubblepop.mjs"
```

Expected: HTTP 200 with `content-type: application/javascript`.

- [ ] **Step 5: Push to GitHub and deploy**

```bash
cd aero-chat-app && git push origin main
cd aero-chat-app && vercel --prod --yes
```

- [ ] **Step 6: End-to-end verification**

On the deployed app:
1. Open Games Corner → Store tab → click Install on any game → verify real progress bar (not a timer)
2. Switch to My Games → click Play → verify game loads and runs
3. Uninstall a game → verify it disappears from My Games
4. Click Play on an uninstalled game from the game strip → verify download prompt appears
5. Confirm download → verify game downloads and launches
6. Disconnect network → verify an installed game still loads from cache (offline)
7. Chess → verify it still loads normally via the bundled lazy import
