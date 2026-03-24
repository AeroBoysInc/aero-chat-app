# Game Activity Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user plays a game, friends see "🎮 Playing Wordle" (or whichever game) inline next to the user's status in the sidebar and chat header — with a settings toggle to disable it.

**Architecture:** Extend the existing Supabase Realtime presence channel to carry a `playingGame` field. `presenceStore` stores a `playingGames` map (userId → game ID). `statusStore` gains a `showGameActivity` boolean (auto-persisted via `persist` middleware). Display is inline in `StatusLine` (sidebar) and the chat header.

**Tech Stack:** React 19, TypeScript, Zustand (with `persist` middleware), Supabase Realtime presence — all already in project.

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/lib/gameLabels.ts` | Single source of truth for game ID → display name mapping |
| Modify | `src/store/presenceStore.ts` | Add `playingGames: Map<string, string>` + `setPlayingGames` action |
| Modify | `src/store/statusStore.ts` | Add `showGameActivity: boolean` + `setShowGameActivity` action |
| Modify | `src/App.tsx` | Promote presence channel to ref; extend track payload; populate `playingGames` on sync; add re-track effect |
| Modify | `src/components/chat/Sidebar.tsx` | Extend local `StatusLine` function with optional `playingGame` prop; pass it from friend row |
| Modify | `src/components/chat/ChatWindow.tsx` | Append game label inline in chat header status line |
| Modify | `src/components/settings/GeneralPanel.tsx` | Add Privacy section with `showGameActivity` toggle |

---

## Task 1: Create `gameLabels.ts` constant

**Files:**
- Create: `src/lib/gameLabels.ts`

- [ ] **Step 1: Create the file**

```ts
import type { SelectedGame } from '../store/cornerStore';

export const GAME_LABELS: Record<NonNullable<SelectedGame>, string> = {
  bubblepop:       'Bubble Pop',
  tropico:         'Tropico',
  twentyfortyeight:'2048',
  typingtest:      'Typing Test',
  wordle:          'Wordle',
  chess:           'Chess',
};
```

- [ ] **Step 2: Verify build**

Run: `cd "/home/dejanandovski/Code Repo/aero-chat-app" && pnpm build 2>&1 | tail -5`

Expected: `✓ built in`

- [ ] **Step 3: Commit**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app"
git add src/lib/gameLabels.ts
git commit -m "feat: add GAME_LABELS constant for game ID to display name mapping"
```

---

## Task 2: Extend `presenceStore` with `playingGames`

**Files:**
- Modify: `src/store/presenceStore.ts`

- [ ] **Step 1: Replace the entire file**

```ts
import { create } from 'zustand';

interface PresenceState {
  onlineIds: Set<string>;
  presenceReady: boolean;
  playingGames: Map<string, string>;
  setOnlineIds: (ids: Set<string>) => void;
  setPresenceReady: (ready: boolean) => void;
  setPlayingGames: (games: Map<string, string>) => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  onlineIds:     new Set<string>(),
  presenceReady: false,
  playingGames:  new Map<string, string>(),
  setOnlineIds:     (ids)   => set({ onlineIds: ids }),
  setPresenceReady: (ready) => set({ presenceReady: ready }),
  setPlayingGames:  (games) => set({ playingGames: games }),
}));
```

- [ ] **Step 2: Verify build**

Run: `cd "/home/dejanandovski/Code Repo/aero-chat-app" && pnpm build 2>&1 | tail -5`

Expected: `✓ built in`

- [ ] **Step 3: Commit**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app"
git add src/store/presenceStore.ts
git commit -m "feat: add playingGames map to presenceStore"
```

---

## Task 3: Add `showGameActivity` to `statusStore`

**Files:**
- Modify: `src/store/statusStore.ts`

The store uses Zustand's `persist` middleware with key `aero-status`. Adding a new state field automatically includes it in localStorage — no manual serialisation needed. `showGameActivity` is **local-only** (never synced to Supabase).

- [ ] **Step 1: Replace the entire file**

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import type { Status } from '../components/ui/AvatarImage';

interface StatusStore {
  status: Status;
  showGameActivity: boolean;
  /** Change status locally and persist it to the profiles table */
  setStatus: (s: Status) => Promise<void>;
  /** Push the locally-stored status to Supabase (call on login) */
  syncToSupabase: (userId: string) => Promise<void>;
  setShowGameActivity: (val: boolean) => void;
}

export const useStatusStore = create<StatusStore>()(
  persist(
    (set, get) => ({
      status: 'online' as Status,
      showGameActivity: true,

      setStatus: async (status) => {
        set({ status });
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('profiles').update({ status }).eq('id', user.id);
        }
      },

      syncToSupabase: async (userId) => {
        const { status } = get();
        await supabase.from('profiles').update({ status }).eq('id', userId);
      },

      setShowGameActivity: (val) => set({ showGameActivity: val }),
    }),
    { name: 'aero-status' }
  )
);
```

- [ ] **Step 2: Verify build**

Run: `cd "/home/dejanandovski/Code Repo/aero-chat-app" && pnpm build 2>&1 | tail -5`

Expected: `✓ built in`

- [ ] **Step 3: Commit**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app"
git add src/store/statusStore.ts
git commit -m "feat: add showGameActivity preference to statusStore"
```

---

## Task 4: Update `App.tsx` — broadcast and receive game activity

**Files:**
- Modify: `src/App.tsx`

This is the most involved task. Three changes to the presence `useEffect` (lines 161–181) and one new `useEffect`:

1. Add `presenceChannelRef` at component level
2. Store the channel in the ref; extend the initial `track()` call; update `sync` handler to populate `playingGames`
3. Add a second `useEffect` that re-tracks when `selectedGame` or `showGameActivity` changes

- [ ] **Step 1: Add `useRef` import and ref**

At the top of `App.tsx`, the existing React import is `import { useEffect } from 'react'`. Add `useRef` to it:

```ts
import { useEffect, useRef } from 'react';
```

Note: `useCornerStore` (line 6) and `useStatusStore` (line 8) are already imported — do not add them again.

At the top of the `App()` function body, after the existing store destructures, add:

```ts
const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
const selectedGame       = useCornerStore(s => s.selectedGame);
const { showGameActivity } = useStatusStore();
```

- [ ] **Step 2: Update the existing presence `useEffect`**

Find the existing presence `useEffect` (lines 161–181). Replace it with:

```ts
// Global presence channel — detects who is actually connected + game activity
useEffect(() => {
  if (!user) return;
  const { setOnlineIds, setPresenceReady, setPlayingGames } = usePresenceStore.getState();
  const channel = supabase
    .channel('global:online', { config: { presence: { key: user.id } } })
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const newIds = new Set(Object.keys(state));
      // Skip re-render if the set of online users hasn't changed
      const prev = usePresenceStore.getState().onlineIds;
      const changed = newIds.size !== prev.size || [...newIds].some(id => !prev.has(id));
      if (changed) setOnlineIds(newIds);
      setPresenceReady(true);
      // Populate playingGames from presence payload
      const newGames = new Map<string, string>();
      for (const [userId, presences] of Object.entries(state)) {
        const p = (presences as any[])[0];
        if (p?.playingGame) newGames.set(userId, p.playingGame);
      }
      setPlayingGames(newGames);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        const { showGameActivity: sga } = useStatusStore.getState();
        const { selectedGame: sg }      = useCornerStore.getState();
        await channel.track({ connected: true, playingGame: sga ? sg : null });
      }
    });
  presenceChannelRef.current = channel;
  return () => { supabase.removeChannel(channel); };
}, [user?.id]);
```

Key points:
- `setPlayingGames` is now destructured alongside the existing `setOnlineIds`/`setPresenceReady`
- Initial `track()` includes `playingGame` (reads from store getState to avoid stale closure)
- `presenceChannelRef.current = channel` is assigned before the cleanup return

- [ ] **Step 3: Add the re-track `useEffect`**

After the presence `useEffect`, add:

```ts
// Re-broadcast game activity when selectedGame or showGameActivity changes
useEffect(() => {
  if (!user?.id) return;
  presenceChannelRef.current?.track({
    connected: true,
    playingGame: showGameActivity ? selectedGame : null,
  });
}, [selectedGame, showGameActivity, user?.id]);
```

- [ ] **Step 4: Verify build**

Run: `cd "/home/dejanandovski/Code Repo/aero-chat-app" && pnpm build 2>&1 | tail -5`

Expected: `✓ built in`

- [ ] **Step 5: Commit**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app"
git add src/App.tsx
git commit -m "feat: broadcast and receive game activity via presence channel"
```

---

## Task 5: Display game status in `Sidebar.tsx`

**Files:**
- Modify: `src/components/chat/Sidebar.tsx`

`StatusLine` is a local function at the bottom of this file (line 418). It currently takes `{ status: Status }`. We extend it with an optional `playingGame` prop and pass it from the friend row.

- [ ] **Step 1: Import `GAME_LABELS` and `usePresenceStore`**

At the top of `Sidebar.tsx`, add:

```ts
import { GAME_LABELS } from '../../lib/gameLabels';
```

`usePresenceStore` is already imported. Confirm it's there; if not, add:

```ts
import { usePresenceStore } from '../../store/presenceStore';
```

- [ ] **Step 2: Destructure `playingGames` from presenceStore**

In the component body, find where `onlineIds` and `presenceReady` are destructured from `usePresenceStore()`. Add `playingGames`:

```ts
const { onlineIds, presenceReady, playingGames } = usePresenceStore();
```

- [ ] **Step 3: Extend the `StatusLine` function**

Find the `StatusLine` function at the bottom of the file (currently line 418):

```ts
function StatusLine({ status }: { status: Status }) {
  const color = statusColor[status];
  return (
    <p className="flex items-center gap-1.5 mt-0.5" style={{ fontSize: 11, color }}>
      <span className="inline-block rounded-full shrink-0"
        style={{ width: 7, height: 7, background: color, boxShadow: `0 0 5px ${color}cc` }} />
      <span style={{ fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 500 }}>
        {statusLabel[status]}
      </span>
    </p>
  );
}
```

Replace with:

```ts
function StatusLine({ status, playingGame }: { status: Status; playingGame?: string | null }) {
  const color = statusColor[status];
  return (
    <p className="flex items-center gap-1.5 mt-0.5" style={{ fontSize: 11, color }}>
      <span className="inline-block rounded-full shrink-0"
        style={{ width: 7, height: 7, background: color, boxShadow: `0 0 5px ${color}cc` }} />
      <span style={{ fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 500 }}>
        {statusLabel[status]}
      </span>
      {playingGame && (
        <>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
          <span style={{ color: '#5BC8F5', fontWeight: 500 }}>
            🎮 Playing {GAME_LABELS[playingGame as keyof typeof GAME_LABELS] ?? playingGame}
          </span>
        </>
      )}
    </p>
  );
}
```

- [ ] **Step 4: Pass `playingGame` at the call site**

Find the line that renders `<StatusLine status={effectiveStatus} />` (currently line 274). Replace with:

```tsx
<StatusLine status={effectiveStatus} playingGame={playingGames.get(friend.id)} />
```

- [ ] **Step 5: Verify build**

Run: `cd "/home/dejanandovski/Code Repo/aero-chat-app" && pnpm build 2>&1 | tail -5`

Expected: `✓ built in`

- [ ] **Step 6: Commit**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app"
git add src/components/chat/Sidebar.tsx
git commit -m "feat: show game activity inline in sidebar friend status"
```

---

## Task 6: Display game status in `ChatWindow.tsx` header

**Files:**
- Modify: `src/components/chat/ChatWindow.tsx`

The chat header renders the contact's status at lines 671–675:

```tsx
<p className="flex items-center gap-1 text-[11px]" style={{ color: statusColor[liveStatus] }}>
  <span className="inline-block h-1.5 w-1.5 rounded-full"
    style={{ background: statusColor[liveStatus], boxShadow: `0 0 4px ${statusColor[liveStatus]}cc` }} />
  {statusLabel[liveStatus]}
</p>
```

- [ ] **Step 1: Import `GAME_LABELS` and `usePresenceStore`, destructure `playingGames`**

Add these two imports near the top of `ChatWindow.tsx` (with the other store imports):

```ts
import { GAME_LABELS } from '../../lib/gameLabels';
import { usePresenceStore } from '../../store/presenceStore';
```

In the component body (alongside the other store destructures), add:

```ts
const { playingGames } = usePresenceStore();
```

- [ ] **Step 2: Update the header status line**

Find the status `<p>` in the chat header (lines 671–675). Replace with:

```tsx
<p className="flex items-center gap-1 text-[11px]" style={{ color: statusColor[liveStatus] }}>
  <span className="inline-block h-1.5 w-1.5 rounded-full"
    style={{ background: statusColor[liveStatus], boxShadow: `0 0 4px ${statusColor[liveStatus]}cc` }} />
  {statusLabel[liveStatus]}
  {playingGames.get(contact.id) && (
    <>
      <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
      <span style={{ color: '#5BC8F5', fontWeight: 500 }}>
        🎮 Playing {GAME_LABELS[playingGames.get(contact.id) as keyof typeof GAME_LABELS] ?? playingGames.get(contact.id)}
      </span>
    </>
  )}
</p>
```

- [ ] **Step 3: Verify build**

Run: `cd "/home/dejanandovski/Code Repo/aero-chat-app" && pnpm build 2>&1 | tail -5`

Expected: `✓ built in`

- [ ] **Step 4: Commit**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app"
git add src/components/chat/ChatWindow.tsx
git commit -m "feat: show game activity inline in chat window header"
```

---

## Task 7: Add Privacy toggle to `GeneralPanel.tsx`

**Files:**
- Modify: `src/components/settings/GeneralPanel.tsx`

Add a Privacy section with a `showGameActivity` toggle after the existing audio settings. The pattern to follow is the existing Noise Cancellation toggle (lines 103–121).

- [ ] **Step 1: Import `useStatusStore` and `Gamepad2` icon**

At the top of `GeneralPanel.tsx`, add:

```ts
import { useStatusStore } from '../../store/statusStore';
```

Update the existing lucide import to include `Gamepad2`:

```ts
import { X, Mic, Volume2, Headphones, Waves, Gamepad2 } from 'lucide-react';
```

- [ ] **Step 2: Destructure `showGameActivity` and `setShowGameActivity`**

In the component body, after the existing `useAudioStore()` destructure, add:

```ts
const { showGameActivity, setShowGameActivity } = useStatusStore();
```

- [ ] **Step 3: Add Privacy section at the end of the settings list**

Inside the `<div className="flex flex-col gap-4">`, after the closing `</div>` of the Output volume block (and before the outer closing `</div>`), add:

```tsx
<div className="h-px bg-white/10" />

{/* Privacy section */}
<div>
  <div className="mb-3 flex items-center gap-2">
    <Gamepad2 className="h-3.5 w-3.5 text-white/50" />
    <p className="text-xs font-semibold text-white/70">Privacy</p>
  </div>

  <div className="flex items-center justify-between">
    <div>
      <p className="text-xs font-semibold text-white/80">Show game activity</p>
      <p className="text-[10px] text-white/40">Let friends see what game you're playing</p>
    </div>
    <button
      onClick={() => setShowGameActivity(!showGameActivity)}
      className="relative flex-shrink-0 h-5 w-9 rounded-full transition-colors duration-200"
      style={{ background: showGameActivity ? '#00d4ff' : 'rgba(255,255,255,0.15)' }}
    >
      <span
        className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all duration-200"
        style={{ left: showGameActivity ? '18px' : '2px' }}
      />
    </button>
  </div>
</div>
```

- [ ] **Step 4: Verify build**

Run: `cd "/home/dejanandovski/Code Repo/aero-chat-app" && pnpm build 2>&1 | tail -5`

Expected: `✓ built in`

- [ ] **Step 5: Commit**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app"
git add src/components/settings/GeneralPanel.tsx
git commit -m "feat: add Privacy section with showGameActivity toggle to GeneralPanel"
```

---

## Task 8: Manual smoke test

- [ ] **Step 1: Start dev server**

Run: `cd "/home/dejanandovski/Code Repo/aero-chat-app" && pnpm dev`

- [ ] **Step 2: Test checklist**

1. User A starts playing Wordle → User B (sidebar) sees `online · 🎮 Playing Wordle` in the friend list
2. User B opens a chat with User A → chat header shows `🎮 Playing Wordle` inline next to status
3. User A stops playing (goes back to game hub without selecting a game) → label disappears for User B
4. User A opens Settings → General → Privacy section visible → toggle "Show game activity" off → User B no longer sees the label
5. Toggle back on → label reappears
6. User A is "away" and playing → label reads `away · 🎮 Playing Bubble Pop` (not just `online`)
