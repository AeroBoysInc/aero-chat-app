# Game Store + Animation Pause Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-user game install library to the Games Corner, and pause all animations/game loops when the app window loses focus.

**Architecture:** Feature 2 (animation pause) is 4 small isolated changes that can be applied independently. Feature 1 (game store) refactors `GamesCorner.tsx` into a tabbed Library/Store UI backed by a new `gameInstalls.ts` localStorage module and converts all non-chess game imports to `React.lazy()`. Both features are independent and can be committed separately.

**Tech Stack:** React 19, TypeScript, Zustand v5, Vite, Vitest, `@react-three/fiber`, Tailwind CSS (utility-only), inline styles for dynamic theming.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/gameInstalls.ts` | **Create** | Per-user install state: get/install/uninstall, localStorage scoped to userId |
| `src/lib/gameInstalls.test.ts` | **Create** | Unit tests for the install helpers |
| `src/index.css` | **Modify** | Add `.paused *` rule |
| `src/App.tsx` | **Modify** | Add `visibilitychange` listener — toggles `.paused` class + dispatches custom event |
| `src/components/chess/ChessBoard3D.tsx` | **Modify** | Add `frameloop` prop to `<Canvas>` driven by `isHidden` state |
| `src/components/corners/games/BubblePop.tsx` | **Modify** | Add `visPaused` state hooked to `aerochat:visibilitychange` event |
| `src/components/corners/games/Tropico.tsx` | **Modify** | Same pattern as BubblePop |
| `src/components/corners/GamesCorner.tsx` | **Refactor** | Convert imports to lazy, add size/tags metadata, refactor GameHub into Library+Store tabs, update GamesStrip to filter by installed |

---

## Task 1 — `gameInstalls.ts` data layer

**Files:**
- Create: `src/lib/gameInstalls.ts`
- Create: `src/lib/gameInstalls.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/gameInstalls.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { getInstalledGames, installGame, uninstallGame } from './gameInstalls'

const USER_A = 'user-aaa'
const USER_B = 'user-bbb'

beforeEach(() => {
  localStorage.clear()
})

describe('getInstalledGames', () => {
  it('returns ["bubblepop"] by default for a new user', () => {
    expect(getInstalledGames(USER_A)).toEqual(['bubblepop'])
  })

  it('is scoped per user — user B does not see user A installs', () => {
    installGame(USER_A, 'chess')
    expect(getInstalledGames(USER_B)).toEqual(['bubblepop'])
  })
})

describe('installGame', () => {
  it('adds a game to the user library', () => {
    installGame(USER_A, 'chess')
    expect(getInstalledGames(USER_A)).toContain('chess')
  })

  it('does not duplicate if installed twice', () => {
    installGame(USER_A, 'chess')
    installGame(USER_A, 'chess')
    const games = getInstalledGames(USER_A)
    expect(games.filter(g => g === 'chess')).toHaveLength(1)
  })
})

describe('uninstallGame', () => {
  it('removes a game from the user library', () => {
    installGame(USER_A, 'chess')
    uninstallGame(USER_A, 'chess')
    expect(getInstalledGames(USER_A)).not.toContain('chess')
  })

  it('does not error if game was not installed', () => {
    expect(() => uninstallGame(USER_A, 'chess')).not.toThrow()
  })

  it('does not affect bubblepop default', () => {
    uninstallGame(USER_A, 'bubblepop')
    expect(getInstalledGames(USER_A)).not.toContain('bubblepop')
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd "aero-chat-app" && pnpm test --run src/lib/gameInstalls.test.ts
```
Expected: FAIL — `gameInstalls` module not found.

- [ ] **Step 3: Create `src/lib/gameInstalls.ts`**

```typescript
// src/lib/gameInstalls.ts

const KEY = (userId: string) => `aero-installed-games-${userId}`
const DEFAULT: string[] = ['bubblepop']

export function getInstalledGames(userId: string): string[] {
  try {
    const raw = localStorage.getItem(KEY(userId))
    return raw ? (JSON.parse(raw) as string[]) : [...DEFAULT]
  } catch {
    return [...DEFAULT]
  }
}

export function installGame(userId: string, gameId: string): void {
  try {
    const current = getInstalledGames(userId)
    if (!current.includes(gameId)) {
      localStorage.setItem(KEY(userId), JSON.stringify([...current, gameId]))
    }
  } catch {}
}

export function uninstallGame(userId: string, gameId: string): void {
  try {
    const current = getInstalledGames(userId)
    localStorage.setItem(KEY(userId), JSON.stringify(current.filter(g => g !== gameId)))
  } catch {}
}
```

- [ ] **Step 4: Run tests — all must pass**

```bash
cd "aero-chat-app" && pnpm test --run src/lib/gameInstalls.test.ts
```
Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
cd "aero-chat-app" && git add src/lib/gameInstalls.ts src/lib/gameInstalls.test.ts
git commit -m "feat: add per-user game install state helpers (gameInstalls.ts)"
```

---

## Task 2 — CSS + App.tsx animation pause

**Files:**
- Modify: `src/index.css` (add 3 lines at the end)
- Modify: `src/App.tsx` (add one `useEffect` near the top of the component)

- [ ] **Step 1: Add the CSS pause rule to `src/index.css`**

Add at the very end of the file:

```css
/* ── Global animation pause when app loses focus ── */
.paused * {
  animation-play-state: paused !important;
}
```

- [ ] **Step 2: Add visibility listener to `src/App.tsx`**

Add this `useEffect` directly after the existing `useEffect` for notification permission (or as the first useEffect in the component — before the auth subscription). It has no deps and runs once on mount.

```typescript
// Add after the other top-level useEffects, before the auth subscription block
useEffect(() => {
  const handler = () => {
    document.documentElement.classList.toggle('paused', document.hidden)
    document.dispatchEvent(
      new CustomEvent('aerochat:visibilitychange', { detail: { hidden: document.hidden } })
    )
  }
  document.addEventListener('visibilitychange', handler)
  return () => document.removeEventListener('visibilitychange', handler)
}, [])
```

- [ ] **Step 3: Build check**

```bash
cd "aero-chat-app" && pnpm build 2>&1 | tail -8
```
Expected: `✓ built in` — no TypeScript errors.

- [ ] **Step 4: Manual test**
  1. Run `pnpm dev`, open the app
  2. Open DevTools → Elements tab
  3. Switch to another window (or press Win/Cmd+D to show desktop)
  4. Confirm `<html>` gains class `paused`
  5. Return to AeroChat — `paused` class removed, orbs resume drifting

- [ ] **Step 5: Commit**

```bash
cd "aero-chat-app" && git add src/index.css src/App.tsx
git commit -m "feat: pause all CSS animations on focus loss via visibilitychange"
```

---

## Task 3 — ChessBoard3D R3F frameloop pause

**Files:**
- Modify: `src/components/chess/ChessBoard3D.tsx`

The `<Canvas>` component at line ~657 accepts a `frameloop` prop. Setting it to `'never'` tells R3F to stop all `useFrame` hooks and the WebGL render loop entirely. We drive it with local state updated by a `visibilitychange` listener.

- [ ] **Step 1: Add `useState` import to ChessBoard3D.tsx**

The file already imports `useRef, useState, useCallback, useMemo, useEffect` from React — confirm `useState` and `useEffect` are already present. If not, add them.

- [ ] **Step 2: Add `isHidden` state and listener inside the `ChessBoard3D` component**

Locate the `ChessBoard3D` function (it wraps the `<Canvas>`). Add these lines before the `return` statement:

```typescript
const [isHidden, setIsHidden] = useState(() => document.hidden)

useEffect(() => {
  const handler = () => setIsHidden(document.hidden)
  document.addEventListener('visibilitychange', handler)
  return () => document.removeEventListener('visibilitychange', handler)
}, [])
```

- [ ] **Step 3: Add `frameloop` prop to `<Canvas>`**

Find the `<Canvas` JSX (around line 657). Add the `frameloop` prop:

```tsx
<Canvas
  frameloop={isHidden ? 'never' : 'always'}
  shadows={highQuality}
  dpr={[1, 1.5]}
  camera={{ position: [0, 9, 7.5], fov: 48 }}
  gl={{
    antialias: true,
    alpha: false,
    toneMapping: THREE.ACESFilmicToneMapping,
    toneMappingExposure: 1.15,
  }}
>
  <BoardScene {...props} highQuality={highQuality} />
</Canvas>
```

- [ ] **Step 4: Build check**

```bash
cd "aero-chat-app" && pnpm build 2>&1 | tail -8
```
Expected: `✓ built in` — no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
cd "aero-chat-app" && git add src/components/chess/ChessBoard3D.tsx
git commit -m "perf: stop R3F render loop when window loses focus (frameloop=never)"
```

---

## Task 4 — BubblePop + Tropico visibility pause

**Files:**
- Modify: `src/components/corners/games/BubblePop.tsx`
- Modify: `src/components/corners/games/Tropico.tsx`

Both games read `gamePaused` from `useCornerStore` (checks if chat overlay is open) and mirror it to `pausedRef`. We add a separate `visPaused` local state, update `pausedRef` to combine both conditions.

### BubblePop.tsx

- [ ] **Step 1: Add `visPaused` state (BubblePop)**

Find these lines in `BubblePop.tsx` (~line 199):
```typescript
const gamePaused = useCornerStore(s => s.gameChatOverlay !== null);
const pausedRef  = useRef(false);
pausedRef.current = gamePaused;
```

Replace with:
```typescript
const gamePaused = useCornerStore(s => s.gameChatOverlay !== null);
const [visPaused, setVisPaused] = useState(false);
const pausedRef  = useRef(false);
pausedRef.current = gamePaused || visPaused;
```

- [ ] **Step 2: Add visibility event listener (BubblePop)**

Add a new `useEffect` near the other effects in BubblePop (before the RAF-based game loop effects):

```typescript
useEffect(() => {
  const handler = (e: Event) =>
    setVisPaused((e as CustomEvent<{ hidden: boolean }>).detail.hidden)
  document.addEventListener('aerochat:visibilitychange', handler)
  return () => document.removeEventListener('aerochat:visibilitychange', handler)
}, [])
```

### Tropico.tsx

- [ ] **Step 3: Add `visPaused` state (Tropico)**

Find these lines in `Tropico.tsx` (~line 316):
```typescript
const gamePaused = useCornerStore(s => s.gameChatOverlay !== null);
const pausedRef  = useRef(false);
pausedRef.current = gamePaused;
```

Replace with:
```typescript
const gamePaused = useCornerStore(s => s.gameChatOverlay !== null);
const [visPaused, setVisPaused] = useState(false);
const pausedRef  = useRef(false);
pausedRef.current = gamePaused || visPaused;
```

- [ ] **Step 4: Add visibility event listener (Tropico)**

Add a new `useEffect` near the other effects in Tropico:

```typescript
useEffect(() => {
  const handler = (e: Event) =>
    setVisPaused((e as CustomEvent<{ hidden: boolean }>).detail.hidden)
  document.addEventListener('aerochat:visibilitychange', handler)
  return () => document.removeEventListener('aerochat:visibilitychange', handler)
}, [])
```

- [ ] **Step 5: Build check**

```bash
cd "aero-chat-app" && pnpm build 2>&1 | tail -8
```
Expected: `✓ built in` — no errors.

- [ ] **Step 6: Commit**

```bash
cd "aero-chat-app" && git add src/components/corners/games/BubblePop.tsx src/components/corners/games/Tropico.tsx
git commit -m "perf: pause BubblePop and Tropico RAF loops on window focus loss"
```

---

## Task 5 — GamesCorner: lazy imports + GAMES metadata

**Files:**
- Modify: `src/components/corners/GamesCorner.tsx` (imports + GAMES array only)

This task only changes the import block and the GAMES constant. No UI changes yet.

- [ ] **Step 1: Replace eager imports with `React.lazy()` in GamesCorner.tsx**

Find the top of `GamesCorner.tsx`. Replace:
```typescript
import { BubblePop } from './games/BubblePop';
import { Tropico } from './games/Tropico';
import { TwentyFortyEight } from './games/TwentyFortyEight';
import { TypingTest } from './games/TypingTest';
import { Wordle } from './games/Wordle';
```

With:
```typescript
const BubblePop        = lazy(() => import('./games/BubblePop').then(m => ({ default: m.BubblePop })))
const Tropico          = lazy(() => import('./games/Tropico').then(m => ({ default: m.Tropico })))
const TwentyFortyEight = lazy(() => import('./games/TwentyFortyEight').then(m => ({ default: m.TwentyFortyEight })))
const TypingTest       = lazy(() => import('./games/TypingTest').then(m => ({ default: m.TypingTest })))
const Wordle           = lazy(() => import('./games/Wordle').then(m => ({ default: m.Wordle })))
```

Confirm that `lazy` is already imported from React (it's used for AeroChess). If not, add it: `import { lazy, Suspense } from 'react'`.

- [ ] **Step 2: Add `size` and `tags` fields to the `GameEntry` interface**

Find:
```typescript
interface GameEntry {
  id: SelectedGame;
  icon: string | React.FC<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  desc: string;
  available: boolean;
  color: string;
}
```

Replace with:
```typescript
interface GameEntry {
  id: SelectedGame;
  icon: string | React.FC<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  desc: string;
  available: boolean;
  color: string;
  size: string;
  tags: string[];
}
```

- [ ] **Step 3: Update the GAMES array with size and tags**

Replace the `GAMES` constant with:

```typescript
const GAMES: GameEntry[] = [
  {
    id: 'bubblepop',
    icon: '🫧',
    label: 'Bubble Pop',
    desc: 'Pop bubbles before they escape!',
    available: true,
    color: '#00d4ff',
    size: '~80 KB',
    tags: ['Casual', 'Single-player'],
  },
  {
    id: 'tropico',
    icon: '🌴',
    label: 'Tropico',
    desc: 'Jump through 10 tropical levels!',
    available: true,
    color: '#34d399',
    size: '~200 KB',
    tags: ['Action', 'Single-player'],
  },
  {
    id: 'typingtest',
    icon: '⌨️',
    label: 'Type Rush',
    desc: 'Race the clock — WPM test!',
    available: true,
    color: '#00d4ff',
    size: '~60 KB',
    tags: ['Typing', 'Speed'],
  },
  {
    id: 'twentyfortyeight',
    icon: '🔢',
    label: '2048',
    desc: 'Slide tiles to reach 2048!',
    available: true,
    color: '#fb923c',
    size: '~50 KB',
    tags: ['Puzzle', 'Single-player'],
  },
  {
    id: 'wordle',
    icon: '🟩',
    label: 'Wordle',
    desc: 'Guess the word in 6 tries!',
    available: true,
    color: '#a855f7',
    size: '~60 KB',
    tags: ['Word', 'Daily'],
  },
  {
    id: 'chess' as SelectedGame,
    icon: '♟️',
    label: 'AeroChess',
    desc: 'Real-time 1v1 — 🔵 Blue vs 🟢 Green',
    available: true,
    color: '#00d4ff',
    size: '~1 MB',
    tags: ['Strategy', 'Multiplayer'],
  },
]
```

Note: remove the "Rock Paper Scissors" and "Trivia" entries with `available: false` — they'll be handled in the future when ready. The `soon` display will also be removed.

- [ ] **Step 4: Wrap all lazy game renders in `GamesCorner` with `<Suspense>`**

In the `GamesCorner` root component, the game rendering block currently uses bare conditionals. Wrap each non-chess lazy component the same way chess is wrapped. Find:

```tsx
{selectedGame === 'bubblepop'        && <BubblePop />}
{selectedGame === 'tropico'          && <Tropico />}
{selectedGame === 'twentyfortyeight' && <TwentyFortyEight />}
{selectedGame === 'typingtest'       && <TypingTest />}
{selectedGame === 'wordle'           && <Wordle />}
```

Replace with:
```tsx
{selectedGame === 'bubblepop' && (
  <Suspense fallback={<GameLoadingSpinner />}><BubblePop /></Suspense>
)}
{selectedGame === 'tropico' && (
  <Suspense fallback={<GameLoadingSpinner />}><Tropico /></Suspense>
)}
{selectedGame === 'twentyfortyeight' && (
  <Suspense fallback={<GameLoadingSpinner />}><TwentyFortyEight /></Suspense>
)}
{selectedGame === 'typingtest' && (
  <Suspense fallback={<GameLoadingSpinner />}><TypingTest /></Suspense>
)}
{selectedGame === 'wordle' && (
  <Suspense fallback={<GameLoadingSpinner />}><Wordle /></Suspense>
)}
```

Add the `GameLoadingSpinner` helper function before `GamesCorner`:

```tsx
function GameLoadingSpinner() {
  return (
    <div className="flex h-full items-center justify-center" style={{ color: 'rgba(0,212,255,0.7)', fontSize: 13 }}>
      Loading…
    </div>
  )
}
```

- [ ] **Step 5: Build check**

```bash
cd "aero-chat-app" && pnpm build 2>&1 | tail -8
```
Expected: `✓ built in` — no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
cd "aero-chat-app" && git add src/components/corners/GamesCorner.tsx
git commit -m "refactor: lazy-load all game components + add size/tags metadata"
```

---

## Task 6 — GameHub Library tab

**Files:**
- Modify: `src/components/corners/GamesCorner.tsx` — GameHub function only

This task replaces the current `GameHub` grid with the new tabbed layout. We implement the Library tab first.

- [ ] **Step 1: Add imports to GamesCorner.tsx**

At the top of the file, add:
```typescript
import { useAuthStore } from '../../store/authStore'
import { getInstalledGames, installGame, uninstallGame } from '../../lib/gameInstalls'
```

- [ ] **Step 2: Replace the `GameHub` function**

Replace the entire `GameHub` function with the following. This implements the full Library + Store UI.

```tsx
function GameHub() {
  const { closeGameView, selectGame } = useCornerStore()
  const { openLobby } = useChessStore()
  const user = useAuthStore(s => s.user)

  const [activeTab, setActiveTab] = useState<'library' | 'store'>('library')
  const [installedGames, setInstalledGames] = useState<string[]>(() =>
    user ? getInstalledGames(user.id) : ['bubblepop']
  )
  const [installing, setInstalling] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const rafRef = useRef<number | null>(null)

  // Re-sync if user changes
  useEffect(() => {
    if (user) setInstalledGames(getInstalledGames(user.id))
  }, [user?.id])

  // Cleanup RAF on unmount
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }, [])

  function handlePlay(gameId: SelectedGame) {
    if (!gameId) return
    if (gameId === 'chess') { selectGame('chess'); openLobby(); return }
    selectGame(gameId)
  }

  function handleUninstall(gameId: string) {
    if (!user) return
    uninstallGame(user.id, gameId)
    setInstalledGames(getInstalledGames(user.id))
  }

  function handleInstall(gameId: string) {
    if (installing || !user) return
    setInstalling(gameId)
    setProgress(0)
    const start = Date.now()
    const DURATION = 1500
    const tick = () => {
      const p = Math.min(100, ((Date.now() - start) / DURATION) * 100)
      setProgress(p)
      if (p < 100) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        installGame(user.id, gameId)
        setInstalledGames(getInstalledGames(user.id))
        setInstalling(null)
        setProgress(0)
        setActiveTab('library')
      }
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  const libraryGames = GAMES.filter(g => g.id && installedGames.includes(g.id as string))
  const storeGames   = GAMES.filter(g => g.id && !installedGames.includes(g.id as string))

  return (
    <div className="flex h-full flex-col">

      {/* Header */}
      <div
        className="flex items-center gap-3 px-6 py-5 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--panel-divider)' }}
      >
        <button
          onClick={closeGameView}
          className="flex h-8 w-8 items-center justify-center rounded-xl transition-all flex-shrink-0"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.10)',
            color: 'var(--text-muted)',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.12)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0"
          style={{ background: 'rgba(0,212,255,0.15)', border: '1px solid rgba(0,212,255,0.30)' }}
        >
          <Gamepad2 className="h-5 w-5" style={{ color: '#00d4ff' }} />
        </div>

        <div className="flex-1">
          <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Games Corner</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Mini-games while you chat</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 flex-shrink-0">
          {(['library', 'store'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="rounded-full px-4 py-1.5 text-xs font-bold transition-all"
              style={{
                background: activeTab === tab ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.04)',
                border: activeTab === tab ? '1px solid rgba(0,212,255,0.40)' : '1px solid rgba(255,255,255,0.09)',
                color: activeTab === tab ? '#00d4ff' : 'var(--text-muted)',
              }}
            >
              {tab === 'library'
                ? `My Games (${libraryGames.length})`
                : `Store (${storeGames.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-aero p-5">
        {activeTab === 'library' ? (
          <LibraryTab
            games={libraryGames}
            onPlay={handlePlay}
            onUninstall={handleUninstall}
          />
        ) : (
          <StoreTab
            games={storeGames}
            installing={installing}
            progress={progress}
            onInstall={handleInstall}
          />
        )}
      </div>

    </div>
  )
}
```

- [ ] **Step 3: Add the `LibraryTab` component** (add before `GameHub`)

```tsx
function LibraryTab({
  games,
  onPlay,
  onUninstall,
}: {
  games: GameEntry[]
  onPlay: (id: SelectedGame) => void
  onUninstall: (id: string) => void
}) {
  if (games.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-center">
        <div>
          <p className="text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>No games installed</p>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Browse the Store tab to add games</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {games.map(game => (
        <GameRow key={game.label} game={game}>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <button
              onClick={() => onPlay(game.id)}
              className="rounded-xl px-4 py-2 text-xs font-bold transition-all"
              style={{
                background: `rgba(${hexToRgb(game.color)}, 0.18)`,
                border: `1px solid rgba(${hexToRgb(game.color)}, 0.40)`,
                color: game.color,
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.8'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
            >
              ▶ Play
            </button>
            <button
              onClick={() => onUninstall(game.id as string)}
              className="text-[10px] transition-all"
              style={{ color: 'var(--text-muted)', opacity: 0.5 }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '0.5'}
            >
              Uninstall
            </button>
          </div>
        </GameRow>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Add the shared `GameRow` component** (add before `LibraryTab`)

```tsx
function GameRow({ game, children }: { game: GameEntry; children: React.ReactNode }) {
  return (
    <div
      className="flex items-center gap-3 rounded-2xl p-3"
      style={{
        background: `rgba(${hexToRgb(game.color)}, 0.06)`,
        border: `1px solid rgba(${hexToRgb(game.color)}, 0.20)`,
      }}
    >
      {/* Icon */}
      <div
        className="flex h-11 w-11 items-center justify-center rounded-xl flex-shrink-0"
        style={{
          background: `rgba(${hexToRgb(game.color)}, 0.15)`,
          border: `1px solid rgba(${hexToRgb(game.color)}, 0.30)`,
          fontSize: typeof game.icon === 'string' ? 22 : undefined,
          boxShadow: `0 0 16px rgba(${hexToRgb(game.color)}, 0.15)`,
        }}
      >
        {typeof game.icon === 'string' ? game.icon : null}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{game.label}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{game.desc}</p>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {game.tags.map(tag => (
            <span
              key={tag}
              className="rounded text-[9px] font-semibold px-1.5 py-0.5"
              style={{
                background: `rgba(${hexToRgb(game.color)}, 0.12)`,
                border: `1px solid rgba(${hexToRgb(game.color)}, 0.20)`,
                color: game.color,
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Action slot */}
      {children}
    </div>
  )
}
```

- [ ] **Step 5: Build check**

```bash
cd "aero-chat-app" && pnpm build 2>&1 | tail -8
```
Expected: `✓ built in` — no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
cd "aero-chat-app" && git add src/components/corners/GamesCorner.tsx
git commit -m "feat: add Games Corner library tab with detail rows and uninstall"
```

---

## Task 7 — GameHub Store tab + install flow

**Files:**
- Modify: `src/components/corners/GamesCorner.tsx` — add `StoreTab` component

- [ ] **Step 1: Add the `StoreTab` component** (add after `LibraryTab`, before `GameHub`)

```tsx
function StoreTab({
  games,
  installing,
  progress,
  onInstall,
}: {
  games: GameEntry[]
  installing: string | null
  progress: number
  onInstall: (id: string) => void
}) {
  if (games.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-center">
        <div>
          <p className="text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>All games installed!</p>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Check My Games to play</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {games.map(game => {
        const isInstalling = installing === game.id
        return (
          <GameRow key={game.label} game={game}>
            <div className="flex flex-col items-end gap-1 flex-shrink-0" style={{ minWidth: 80 }}>
              {isInstalling ? (
                <div style={{ width: 80 }}>
                  {/* Progress bar */}
                  <div
                    className="rounded-full overflow-hidden"
                    style={{ height: 5, background: 'rgba(0,0,0,0.3)' }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${progress}%`,
                        background: `linear-gradient(90deg, ${game.color}, #5bc8f5)`,
                        boxShadow: `0 0 8px ${game.color}80`,
                        transition: 'width 0.05s linear',
                      }}
                    />
                  </div>
                  <p
                    className="text-[9px] font-semibold mt-1 text-right"
                    style={{ color: game.color }}
                  >
                    Installing…
                  </p>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => game.id && onInstall(game.id as string)}
                    disabled={installing !== null}
                    className="rounded-xl px-3 py-2 text-xs font-bold transition-all"
                    style={{
                      background: `rgba(${hexToRgb(game.color)}, 0.12)`,
                      border: `1px solid rgba(${hexToRgb(game.color)}, 0.30)`,
                      color: game.color,
                      opacity: installing !== null ? 0.4 : 1,
                      cursor: installing !== null ? 'default' : 'pointer',
                    }}
                  >
                    ⬇ Install
                  </button>
                  <p
                    className="text-[9px] text-right"
                    style={{ color: 'var(--text-muted)', opacity: 0.6 }}
                  >
                    {game.size}
                  </p>
                </>
              )}
            </div>
          </GameRow>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Build check**

```bash
cd "aero-chat-app" && pnpm build 2>&1 | tail -8
```
Expected: `✓ built in` — no TypeScript errors.

- [ ] **Step 3: Manual test the full install flow**
  1. Run `pnpm dev`
  2. Open Games Corner
  3. Confirm My Games tab shows Bubble Pop pre-installed
  4. Switch to Store — confirm all other games listed with size
  5. Click Install on any game — progress bar animates for ~1.5 s — tab auto-switches to My Games
  6. Installed game appears in My Games with Play + Uninstall
  7. Clicking Uninstall removes it, game reappears in Store

- [ ] **Step 4: Commit**

```bash
cd "aero-chat-app" && git add src/components/corners/GamesCorner.tsx
git commit -m "feat: add Game Store tab with install progress bar and per-user library"
```

---

## Task 8 — GamesStrip: installed-only filter + final build

**Files:**
- Modify: `src/components/corners/GamesCorner.tsx` — `GamesStrip` + `GamesCorner` root

Currently `GamesStrip` renders all entries from the global `GAMES` array. It should only show installed games.

- [ ] **Step 1: Add `installedGames` prop to `GamesStrip`**

Find:
```tsx
function GamesStrip() {
  const { selectedGame, selectGame } = useCornerStore();
```

Replace with:
```tsx
function GamesStrip({ installedGames }: { installedGames: string[] }) {
  const { selectedGame, selectGame } = useCornerStore();
```

- [ ] **Step 2: Filter the rendered games in GamesStrip**

Inside `GamesStrip`, find the `{GAMES.map(game => {` call. Replace it with:

```tsx
{GAMES.filter(g => g.id && installedGames.includes(g.id as string)).map(game => {
```

- [ ] **Step 3: Pass `installedGames` from `GamesCorner` to `GamesStrip`**

In the `GamesCorner` root component, `GamesStrip` is rendered without props. We need to lift installed state up. Since `GamesCorner` currently reads `selectedGame` from `useCornerStore`, add `installedGames` state here too:

Find the `GamesCorner` function:
```tsx
export function GamesCorner() {
  const { selectedGame } = useCornerStore();
```

Replace with:
```tsx
export function GamesCorner() {
  const { selectedGame } = useCornerStore();
  const user = useAuthStore(s => s.user);
  const [installedGames, setInstalledGames] = useState<string[]>(() =>
    user ? getInstalledGames(user.id) : ['bubblepop']
  );

  // Re-sync when user switches
  useEffect(() => {
    if (user) setInstalledGames(getInstalledGames(user.id));
  }, [user?.id]);
```

Then pass it down where `GamesStrip` is rendered:
```tsx
{selectedGame !== 'chess' && <GamesStrip installedGames={installedGames} />}
```

And update `GameHub` to receive `onInstalled` callback so it can notify `GamesCorner` when installs happen — OR, simpler: read state from localStorage inside `GamesCorner` after each install. Since `GameHub` already manages its own `installedGames` state, the cleanest sync is to have `GamesCorner` re-read from localStorage on a storage event, or simply pass a shared setter down.

**Simplest approach — lift `installedGames` state fully into `GamesCorner` and pass down to both `GameHub` and `GamesStrip`:**

Update `GameHub` to receive and use external state:

```tsx
function GameHub({
  installedGames,
  onInstalled,
  onUninstalled,
}: {
  installedGames: string[]
  onInstalled: (id: string) => void
  onUninstalled: (id: string) => void
}) {
  const { closeGameView, selectGame } = useCornerStore()
  const { openLobby } = useChessStore()
  const user = useAuthStore(s => s.user)

  const [activeTab, setActiveTab] = useState<'library' | 'store'>('library')
  const [installing, setInstalling] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }, [])

  function handlePlay(gameId: SelectedGame) {
    if (!gameId) return
    if (gameId === 'chess') { selectGame('chess'); openLobby(); return }
    selectGame(gameId)
  }

  function handleUninstall(gameId: string) {
    if (!user) return
    uninstallGame(user.id, gameId)
    onUninstalled(gameId)
  }

  function handleInstall(gameId: string) {
    if (installing || !user) return
    setInstalling(gameId)
    setProgress(0)
    const start = Date.now()
    const DURATION = 1500
    const tick = () => {
      const p = Math.min(100, ((Date.now() - start) / DURATION) * 100)
      setProgress(p)
      if (p < 100) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        installGame(user.id, gameId)
        onInstalled(gameId)
        setInstalling(null)
        setProgress(0)
        setActiveTab('library')
      }
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  const libraryGames = GAMES.filter(g => g.id && installedGames.includes(g.id as string))
  const storeGames   = GAMES.filter(g => g.id && !installedGames.includes(g.id as string))

  // ... rest of JSX unchanged, just uses the props above
```

And in `GamesCorner`, call `GameHub` with callbacks:

```tsx
{selectedGame ? (
  <>
    <div className="flex-1 min-h-0">
      {selectedGame === 'bubblepop' && (
        <Suspense fallback={<GameLoadingSpinner />}><BubblePop /></Suspense>
      )}
      {/* ... other games ... */}
    </div>
    {selectedGame !== 'chess' && <GamesStrip installedGames={installedGames} />}
  </>
) : (
  <GameHub
    installedGames={installedGames}
    onInstalled={id => setInstalledGames(prev => [...prev, id])}
    onUninstalled={id => setInstalledGames(prev => prev.filter(g => g !== id))}
  />
)}
```

- [ ] **Step 4: Full build + test run**

```bash
cd "aero-chat-app" && pnpm build 2>&1 | tail -10
pnpm test --run
```
Expected: build `✓`, all tests pass.

- [ ] **Step 5: Final manual checks**
  - Install a game, switch to another game from GamesStrip — only installed games appear in the strip
  - Uninstall a game — it disappears from the strip immediately
  - Switch users — each user has their own library

- [ ] **Step 6: Final commit**

```bash
cd "aero-chat-app" && git add src/components/corners/GamesCorner.tsx
git commit -m "feat: GamesStrip shows only installed games; lift state to GamesCorner"
```

---

## Deploy

```bash
cd "aero-chat-app" && git push && vercel --prod --yes
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| `gameInstalls.ts` with get/install/uninstall per userId | Task 1 ✓ |
| Default `["bubblepop"]` for new users | Task 1 ✓ |
| GAMES array with `size` + `tags` | Task 5 ✓ |
| All 5 non-chess games lazy-loaded | Task 5 ✓ |
| My Games / Store tab layout | Task 6 + 7 ✓ |
| Detail rows in both tabs | Task 6 + 7 ✓ |
| 1.5 s install progress bar | Task 7 ✓ |
| Auto-switch to library after install | Task 7 ✓ |
| Only one install at a time | Task 7 ✓ (disabled button during install) |
| Uninstall link in library | Task 6 ✓ |
| GamesStrip shows only installed games | Task 8 ✓ |
| CSS `.paused *` rule | Task 2 ✓ |
| `visibilitychange` → toggle class + dispatch custom event | Task 2 ✓ |
| R3F frameloop stops when hidden | Task 3 ✓ |
| BubblePop pauses on focus loss | Task 4 ✓ |
| Tropico pauses on focus loss | Task 4 ✓ |

**No placeholders found.**

**Type consistency:** `SelectedGame`, `GameEntry`, `installedGames: string[]`, `installing: string | null`, `progress: number` — all consistent across tasks.
