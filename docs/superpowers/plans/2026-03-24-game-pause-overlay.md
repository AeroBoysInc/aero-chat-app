# Game Pause & Chat Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When users click a message notification mid-game, open a chat overlay panel over the game instead of navigating away — pausing the game until the overlay is closed.

**Architecture:** New `gameChatOverlay` discriminated-union state in `cornerStore` drives a `GameChatOverlay` component (sender picker + embedded ChatWindow) that slides over the game layer. Each game with timers/loops reads a `gamePaused` derived flag and freezes accordingly.

**Tech Stack:** React 19, TypeScript, Zustand, Tailwind CSS, Lucide icons (all already in project)

**Spec:** `docs/superpowers/specs/2026-03-24-game-pause-overlay-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/store/cornerStore.ts` | Add `gameChatOverlay` state + actions; update `closeGameView` to reset overlay |
| Modify | `src/components/ui/GameNotification.tsx` | Route notification click to overlay actions instead of `closeGameView()` |
| Create | `src/components/corners/GameChatOverlay.tsx` | Sender picker, embedded ChatWindow, pause dim layer, slide animation, keyboard isolation |
| Modify | `src/components/chat/ChatLayout.tsx` | Render `GameChatOverlay` inside the game layer |
| Modify | `src/components/chat/ChatWindow.tsx` | Update unread-clearing logic to work inside overlay |
| Modify | `src/components/corners/games/BubblePop.tsx` | Pause/resume rAF loop + spawn/level/combo timers |
| Modify | `src/components/corners/games/Tropico.tsx` | Pause/resume rAF loop + guard keyboard handlers |
| Modify | `src/components/corners/games/TypingTest.tsx` | Pause/resume countdown interval |

---

## Task 1: Extend `cornerStore` with overlay state

**Files:**
- Modify: `src/store/cornerStore.ts`

- [ ] **Step 1: Add the overlay type and state to the store**

Replace the entire file with:

```ts
import { create } from 'zustand';

export type SelectedGame = 'bubblepop' | 'tropico' | 'twentyfortyeight' | 'typingtest' | 'wordle' | 'chess' | null;

export type GameChatOverlay = null | { mode: 'picker' } | { mode: 'conversation'; senderId: string };

interface CornerStore {
  gameViewActive: boolean;
  devViewActive: boolean;
  selectedGame: SelectedGame;
  gameChatOverlay: GameChatOverlay;
  openGameHub: () => void;
  closeGameView: () => void;
  selectGame: (game: SelectedGame) => void;
  openDevView: () => void;
  closeDevView: () => void;
  openGameChat: () => void;
  openGameChatFor: (senderId: string) => void;
  closeGameChat: () => void;
}

export const useCornerStore = create<CornerStore>()((set) => ({
  gameViewActive: false,
  devViewActive: false,
  selectedGame: null,
  gameChatOverlay: null,
  openGameHub:      () => set({ gameViewActive: true,  devViewActive: false }),
  closeGameView:    () => set({ gameViewActive: false, selectedGame: null, gameChatOverlay: null }),
  selectGame:       (selectedGame) => set({ selectedGame }),
  openDevView:      () => set({ devViewActive: true,   gameViewActive: false, selectedGame: null, gameChatOverlay: null }),
  closeDevView:     () => set({ devViewActive: false }),
  openGameChat:     () => set({ gameChatOverlay: { mode: 'picker' } }),
  openGameChatFor:  (senderId) => set({ gameChatOverlay: { mode: 'conversation', senderId } }),
  closeGameChat:    () => set({ gameChatOverlay: null }),
}));
```

- [ ] **Step 2: Verify build**

Run: `cd "/home/dejanandovski/Code Repo/aero-chat-app" && pnpm build 2>&1 | tail -10`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app"
git add src/store/cornerStore.ts
git commit -m "feat: add gameChatOverlay state to cornerStore"
```

---

## Task 2: Update `GameNotification` to open overlay instead of closing game

**Files:**
- Modify: `src/components/ui/GameNotification.tsx`

- [ ] **Step 1: Replace the full component**

Replace the entire file with:

```tsx
import { createPortal } from 'react-dom';
import { useCornerStore } from '../../store/cornerStore';
import { useUnreadStore } from '../../store/unreadStore';
import { useFriendStore } from '../../store/friendStore';

export function GameNotification() {
  const { gameViewActive, gameChatOverlay, openGameChat, openGameChatFor } = useCornerStore();
  const { counts } = useUnreadStore();
  const { friends } = useFriendStore();

  const totalUnread = Object.values(counts).reduce((s, n) => s + n, 0);

  // Hide if not in game, no unreads, or overlay already open
  if (!gameViewActive || totalUnread === 0 || gameChatOverlay !== null) return null;

  // Build sender list for display
  const senders = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => {
      const friend = friends.find(f => f.id === id);
      return { id, count: n, username: friend?.username ?? '?' };
    });

  const label = senders.length === 1
    ? senders[0].username
    : `${senders.length} chats`;

  const handleClick = () => {
    if (senders.length === 1) {
      openGameChatFor(senders[0].id);
    } else {
      openGameChat();
    }
  };

  return createPortal(
    <button
      key={totalUnread}
      onClick={handleClick}
      style={{
        position: 'fixed',
        bottom: 28,
        right: 28,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 16px 10px 12px',
        borderRadius: 999,
        border: '1px solid rgba(255,255,255,0.55)',
        background: 'radial-gradient(circle at 30% 28%, rgba(255,255,255,0.25) 0%, rgba(0,180,255,0.20) 35%, rgba(0,100,220,0.14) 70%, rgba(0,60,180,0.08) 100%)',
        boxShadow: '0 0 24px rgba(0,180,255,0.45), inset 0 0 14px rgba(255,255,255,0.20)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        cursor: 'pointer',
        animation: 'bubble-notify-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards, bubble-notify-pulse 2.2s 0.5s ease-in-out infinite',
        outline: 'none',
      }}
    >
      {/* Glass highlight spot */}
      <div style={{
        position: 'absolute', top: '12%', left: '8%',
        width: '26%', height: '36%',
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.55)',
        filter: 'blur(3px)',
        pointerEvents: 'none',
      }} />

      {/* Avatar initials */}
      <div style={{ position: 'relative', flexShrink: 0, width: 32, height: 32 }}>
        {senders.slice(0, 2).map((s, i) => (
          <div
            key={s.id}
            style={{
              position: 'absolute',
              top: i * 5, left: i * 5,
              width: 26 - i * 4, height: 26 - i * 4,
              borderRadius: '50%',
              background: `hsl(${(s.username.charCodeAt(0) * 47) % 360}, 60%, 55%)`,
              border: '1.5px solid rgba(255,255,255,0.65)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11 - i, fontWeight: 700, color: '#fff',
              zIndex: 2 - i,
            }}
          >
            {s.username[0].toUpperCase()}
          </div>
        ))}
      </div>

      {/* Text */}
      <div style={{ lineHeight: 1.3, position: 'relative' }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.95)', whiteSpace: 'nowrap' }}>
          {label}
        </p>
        <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.65)', whiteSpace: 'nowrap' }}>
          {totalUnread} new {totalUnread === 1 ? 'message' : 'messages'} · click to view
        </p>
      </div>

      {/* Red badge */}
      <div style={{
        position: 'absolute', top: -5, right: -5,
        minWidth: 19, height: 19,
        borderRadius: 10,
        background: '#ff4757',
        border: '2px solid #020d1e',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 800, color: '#fff',
        padding: '0 4px',
      }}>
        {totalUnread > 99 ? '99+' : totalUnread}
      </div>
    </button>,
    document.body
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd "/home/dejanandovski/Code Repo/aero-chat-app" && pnpm build 2>&1 | tail -10`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app"
git add src/components/ui/GameNotification.tsx
git commit -m "feat: route GameNotification click to overlay instead of closeGameView"
```

---

## Task 3: Create `GameChatOverlay` component

**Files:**
- Create: `src/components/corners/GameChatOverlay.tsx`

- [ ] **Step 1: Create the full component**

```tsx
import { useCornerStore } from '../../store/cornerStore';
import { useUnreadStore } from '../../store/unreadStore';
import { useFriendStore } from '../../store/friendStore';
import { ChatWindow } from '../chat/ChatWindow';
import { X, ArrowLeft, MessageCircle } from 'lucide-react';
import type { Profile } from '../../store/authStore';

export function GameChatOverlay() {
  const { gameChatOverlay, openGameChat, openGameChatFor, closeGameChat } = useCornerStore();
  const { counts } = useUnreadStore();
  const { friends } = useFriendStore();

  const isOpen = gameChatOverlay !== null;

  // Build sender list from unread counts
  const senders = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => {
      const friend = friends.find(f => f.id === id);
      return { id, count: n, username: friend?.username ?? '?', avatar_url: friend?.avatar_url ?? null, status: friend?.status ?? 'offline' };
    });

  // Resolve the contact for conversation mode
  const contact: Profile | null =
    gameChatOverlay?.mode === 'conversation'
      ? (friends.find(f => f.id === gameChatOverlay.senderId) as Profile) ?? null
      : null;

  const handleBack = () => {
    // If there were multiple senders, go back to picker; otherwise close
    if (senders.length > 1) {
      openGameChat();
    } else {
      closeGameChat();
    }
  };

  return (
    <>
      {/* Pause dim layer — covers entire game area */}
      <div
        onClick={closeGameChat}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 10,
          background: 'rgba(0,0,0,0.3)',
          backdropFilter: 'blur(2px)',
          WebkitBackdropFilter: 'blur(2px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.3s ease',
        }}
      >
        <p
          style={{
            fontSize: 32,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: 6,
            color: 'rgba(255,255,255,0.55)',
            textShadow: '0 2px 12px rgba(0,0,0,0.4)',
            userSelect: 'none',
          }}
        >
          Paused
        </p>
      </div>

      {/* Chat overlay panel — slides in from right */}
      <div
        onKeyDown={e => e.stopPropagation()}
        onKeyUp={e => e.stopPropagation()}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: '38%',
          minWidth: 320,
          zIndex: 20,
          transform: isOpen ? 'translateX(0)' : 'translateX(102%)',
          opacity: isOpen ? 1 : 0,
          transition: 'transform 0.38s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.32s ease',
          pointerEvents: isOpen ? 'auto' : 'none',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--sidebar-bg)',
          borderLeft: '1px solid var(--sidebar-border)',
          boxShadow: '-4px 0 24px rgba(0,180,255,0.12), var(--sidebar-shadow)',
          borderRadius: '16px 0 0 16px',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--panel-divider)' }}
        >
          {gameChatOverlay?.mode === 'conversation' && (
            <button
              onClick={handleBack}
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-all"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text-muted)' }}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </button>
          )}

          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
              {gameChatOverlay?.mode === 'conversation' && contact
                ? contact.username
                : 'Messages'}
            </p>
          </div>

          <button
            onClick={closeGameChat}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-all hover:scale-110 active:scale-95"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text-muted)' }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {gameChatOverlay?.mode === 'picker' && (
            <div className="flex flex-col h-full">
              {senders.length === 0 ? (
                <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
                  <p className="text-sm">No new messages</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto scrollbar-aero">
                  {senders.map(s => (
                    <button
                      key={s.id}
                      onClick={() => openGameChatFor(s.id)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-all"
                      style={{ borderBottom: '1px solid var(--panel-divider)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* Avatar */}
                      <div
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
                        style={{
                          background: `hsl(${(s.username.charCodeAt(0) * 47) % 360}, 60%, 55%)`,
                          border: '1.5px solid rgba(255,255,255,0.35)',
                          fontSize: 14, fontWeight: 700, color: '#fff',
                        }}
                      >
                        {s.username[0].toUpperCase()}
                      </div>

                      {/* Name */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                          {s.username}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {s.count} new {s.count === 1 ? 'message' : 'messages'}
                        </p>
                      </div>

                      {/* Badge */}
                      <div
                        className="flex-shrink-0 flex items-center justify-center rounded-full"
                        style={{
                          minWidth: 22, height: 22, padding: '0 6px',
                          background: '#ff4757', fontSize: 11, fontWeight: 800, color: '#fff',
                        }}
                      >
                        {s.count > 99 ? '99+' : s.count}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {gameChatOverlay?.mode === 'conversation' && contact && (
            <ChatWindow contact={contact} onBack={handleBack} />
          )}
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd "/home/dejanandovski/Code Repo/aero-chat-app" && pnpm build 2>&1 | tail -10`

Expected: Build succeeds (component is created but not yet rendered anywhere).

- [ ] **Step 3: Commit**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app"
git add src/components/corners/GameChatOverlay.tsx
git commit -m "feat: create GameChatOverlay component with sender picker and embedded ChatWindow"
```

---

## Task 4: Wire `GameChatOverlay` into `ChatLayout`

**Files:**
- Modify: `src/components/chat/ChatLayout.tsx`

- [ ] **Step 1: Add import**

After the existing `GamesCorner` import (line 8), add:

```tsx
import { GameChatOverlay } from '../corners/GameChatOverlay';
```

- [ ] **Step 2: Render `GameChatOverlay` inside the game layer**

In the GAME LAYER div (around line 190-203), change:

```tsx
        >
          <GamesCorner />
        </div>
```

to:

```tsx
        >
          <GamesCorner />
          <GameChatOverlay />
        </div>
```

- [ ] **Step 3: Verify build**

Run: `cd "/home/dejanandovski/Code Repo/aero-chat-app" && pnpm build 2>&1 | tail -10`

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app"
git add src/components/chat/ChatLayout.tsx
git commit -m "feat: render GameChatOverlay inside game layer in ChatLayout"
```

---

## Task 5: Update ChatWindow unread-clearing logic for overlay

**Files:**
- Modify: `src/components/chat/ChatWindow.tsx`

- [ ] **Step 1: Update the store destructure**

Find the line (around line 182):

```tsx
  const { gameViewActive } = useCornerStore();
```

Replace with:

```tsx
  const { gameViewActive, gameChatOverlay } = useCornerStore();
```

- [ ] **Step 2: Update the unread-clearing useEffect**

Find the useEffect with the comment "Clear unread when this chat is opened or when returning from game view" (around line 217-220):

```tsx
  useEffect(() => {
    if (!gameViewActive) clear(contact.id);
  }, [contact.id, gameViewActive]);
```

Replace with:

```tsx
  useEffect(() => {
    if (!gameViewActive || gameChatOverlay?.mode === 'conversation') clear(contact.id);
  }, [contact.id, gameViewActive, gameChatOverlay]);
```

- [ ] **Step 3: Update the realtime message handler**

Find the line (around line 359):

```tsx
        if (!useCornerStore.getState().gameViewActive) {
```

Replace with:

```tsx
        if (!useCornerStore.getState().gameViewActive || useCornerStore.getState().gameChatOverlay?.mode === 'conversation') {
```

- [ ] **Step 4: Verify build**

Run: `cd "/home/dejanandovski/Code Repo/aero-chat-app" && pnpm build 2>&1 | tail -10`

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app"
git add src/components/chat/ChatWindow.tsx
git commit -m "feat: update ChatWindow unread-clearing to work inside game chat overlay"
```

---

## Task 6: Add pause logic to BubblePop

**Files:**
- Modify: `src/components/corners/games/BubblePop.tsx`

- [ ] **Step 1: Import the store selector**

At the top of the file (after the existing `useCornerStore` import on line 3), the import is already there. No new import needed — we'll use the existing `useCornerStore`.

- [ ] **Step 2: Add the `gamePaused` selector and pause ref**

Inside the `BubblePop` component, after the existing ref declarations (around line 197, after `lastMilestoneRef`), add:

```tsx
  const gamePaused = useCornerStore(s => s.gameChatOverlay !== null);
  const pausedRef  = useRef(false);
  pausedRef.current = gamePaused;
```

- [ ] **Step 3: Add pause guard to the `tick` function**

At the top of the `tick` callback (line 229, right after `const tick = useCallback(() => {`), add before the existing `gsRef` check:

```tsx
    if (pausedRef.current) return; // frozen — don't re-schedule rAF
```

- [ ] **Step 4: Add pause guard to `scheduleSpawn`**

At the top of the `scheduleSpawn` callback (line 280, right after `const scheduleSpawn = useCallback(() => {`), add before the existing `gsRef` check:

```tsx
    if (pausedRef.current) return;
```

- [ ] **Step 5: Add pause/resume useEffect**

After the existing `useEffect` that starts the game loop (around line 343, after the `}, [gameState, tick, scheduleSpawn]);` line), add:

```tsx
  // Pause / resume when game chat overlay opens / closes
  useEffect(() => {
    if (gameState !== 'playing') return;

    if (gamePaused) {
      // Stop rAF
      cancelAnimationFrame(rafRef.current);
      // Clear all timers
      if (spawnTimer.current) { clearTimeout(spawnTimer.current); spawnTimer.current = null; }
      if (levelTimer.current) { clearInterval(levelTimer.current); levelTimer.current = null; }
      if (comboTimer.current) { clearTimeout(comboTimer.current); comboTimer.current = null; }
    } else {
      // Resume rAF
      rafRef.current = requestAnimationFrame(tick);
      // Restart spawn
      scheduleSpawn();
      // Restart level timer
      levelTimer.current = setInterval(() => {
        setLevel(l => { const n = Math.min(9, l + 1); levelRef.current = n; return n; });
      }, 8_000);
      // Reset combo (fair: combo streak shouldn't persist across a pause)
      comboRef.current = 0;
      setCombo(0);
    }
  }, [gamePaused, gameState, tick, scheduleSpawn]);
```

- [ ] **Step 6: Verify build**

Run: `cd "/home/dejanandovski/Code Repo/aero-chat-app" && pnpm build 2>&1 | tail -10`

Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app"
git add src/components/corners/games/BubblePop.tsx
git commit -m "feat: pause BubblePop rAF loop and timers when game chat overlay is open"
```

---

## Task 7: Add pause logic to Tropico

**Files:**
- Modify: `src/components/corners/games/Tropico.tsx`

- [ ] **Step 1: Add the `gamePaused` selector and pause ref**

Inside the `Tropico` component, after the existing ref declarations (find `const rafRef` and the refs near it), add:

```tsx
  const gamePaused = useCornerStore(s => s.gameChatOverlay !== null);
  const pausedRef  = useRef(false);
  pausedRef.current = gamePaused;
```

- [ ] **Step 2: Add pause guard to keyboard handlers**

In the game loop `useEffect` (around line 646), find the `onKeyDown` handler:

```tsx
    const onKeyDown = (e: KeyboardEvent) => {
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      keysRef.current.add(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.code);
```

Replace with:

```tsx
    const onKeyDown = (e: KeyboardEvent) => {
      if (pausedRef.current) return;
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      keysRef.current.add(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (pausedRef.current) return;
      keysRef.current.delete(e.code);
    };
```

- [ ] **Step 3: Add pause guard inside the game loop**

Find the `loop` function (around line 662):

```tsx
    let last = performance.now();
    function loop(now: number) {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      update(dt);
      render();
      rafRef.current = requestAnimationFrame(loop);
    }
```

Replace with:

```tsx
    let last = performance.now();
    function loop(now: number) {
      if (pausedRef.current) return; // stop loop entirely — canvas retains last frame
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      update(dt);
      render();
      rafRef.current = requestAnimationFrame(loop);
    }
```

- [ ] **Step 4: Add pause/resume useEffect**

After the game loop `useEffect` (after the `}, [screen]);` line around line 679), add:

```tsx
  // Pause / resume when game chat overlay opens / closes
  useEffect(() => {
    if (screen !== 'playing') return;

    if (gamePaused) {
      // Stop the loop
      cancelAnimationFrame(rafRef.current);
      // Clear any buffered keys so player doesn't move on resume
      keysRef.current.clear();
    } else {
      // Resume — reset lastTime so first dt is zero (no delta jump)
      let last = performance.now();
      function loop(now: number) {
        if (pausedRef.current) return;
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        update(dt);
        render();
        rafRef.current = requestAnimationFrame(loop);
      }
      rafRef.current = requestAnimationFrame(loop);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gamePaused, screen]);
```

Note: The `update` and `render` functions are defined earlier in the same component scope and are stable (they read from refs). The eslint-disable is consistent with the existing game loop `useEffect`.

- [ ] **Step 5: Verify build**

Run: `cd "/home/dejanandovski/Code Repo/aero-chat-app" && pnpm build 2>&1 | tail -10`

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app"
git add src/components/corners/games/Tropico.tsx
git commit -m "feat: pause Tropico rAF loop and keyboard handlers when game chat overlay is open"
```

---

## Task 8: Add pause logic to TypingTest

**Files:**
- Modify: `src/components/corners/games/TypingTest.tsx`

- [ ] **Step 1: Add the `gamePaused` selector and a ref for remaining time**

Inside the `TypingTest` component, after the existing ref declarations (around line 88, after `timerRef`), add:

```tsx
  const gamePaused     = useCornerStore(s => s.gameChatOverlay !== null);
  const pausedTimeLeft = useRef<number | null>(null);
  const timeLeftRef    = useRef(timeLeft);
  timeLeftRef.current  = timeLeft;
```

- [ ] **Step 2: Add pause/resume useEffect**

After the existing timer `useEffect` (around line 184, after the `}, [status]);` line), add:

```tsx
  // Pause / resume countdown when game chat overlay opens / closes
  useEffect(() => {
    if (status !== 'running') return;

    if (gamePaused) {
      // Store remaining time (read from ref to avoid dep on timeLeft) and clear interval
      pausedTimeLeft.current = timeLeftRef.current;
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    } else if (pausedTimeLeft.current !== null) {
      // Resume — restore time and restart interval
      setTimeLeft(pausedTimeLeft.current);
      pausedTimeLeft.current = null;
      timerRef.current = setInterval(() => {
        setTimeLeft(t => (t <= 1 ? 0 : t - 1));
      }, 1000);
    }
  }, [gamePaused, status]);
```

- [ ] **Step 3: Verify build**

Run: `cd "/home/dejanandovski/Code Repo/aero-chat-app" && pnpm build 2>&1 | tail -10`

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app"
git add src/components/corners/games/TypingTest.tsx
git commit -m "feat: pause TypingTest countdown timer when game chat overlay is open"
```

---

## Task 9: Manual smoke test

- [ ] **Step 1: Start dev server**

Run: `cd "/home/dejanandovski/Code Repo/aero-chat-app" && pnpm dev`

- [ ] **Step 2: Test checklist**

1. Play BubblePop → receive message → click notification → game freezes (no new bubbles spawning, no level advancement), "PAUSED" overlay visible, chat panel slides in from right
2. Reply to message in overlay → close overlay (X / click dim area) → game resumes, timer/spawns pick up correctly
3. Play Tropico → same flow → physics loop stops, player frozen, canvas stays painted, resumes correctly with no delta jump
4. Play Tropico → open overlay → press arrow keys in chat input → keys do NOT move the player
5. Play TypingTest → open overlay with 15s remaining → chat for a bit → close overlay → timer still shows ~15s, game has not ended
6. Play Wordle → overlay opens → keyboard blocked by overlay → close → continue guessing
7. Play 2048 → overlay opens → swipe/keys blocked → close → continue playing
8. Play Chess → overlay opens → chess keeps running → close → chess unaffected
9. Multiple senders → sender picker shows → pick one → conversation opens → back arrow returns to picker
10. Single sender → picker skipped, conversation opens directly
11. Exit game entirely (back button) while overlay is open → both overlay and game close, state is clean
