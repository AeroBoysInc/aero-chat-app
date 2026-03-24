# Game Pause & Chat Overlay Design

**Date:** 2026-03-24
**Status:** Approved
**Scope:** Pause games when user opens in-game chat overlay; resume on close

---

## Problem

When a user is playing a game in Games Corner and receives a message notification, clicking the notification calls `closeGameView()`, which sets `selectedGame: null` and unmounts the game component. All game state (score, level progress, board position, timers) is destroyed. The user must restart from scratch when they return.

## Solution

**Approach A — Game-scoped overlay with `cornerStore` state.**

Instead of navigating away from the game, clicking the notification opens a **chat overlay panel** that slides in from the right over the game area. The game pauses while the overlay is open and resumes when it closes. The user never leaves the game context.

## Store Changes (`cornerStore`)

### New State

```ts
gameChatOverlay: null | { mode: 'picker' } | { mode: 'conversation'; senderId: string }
```

- `null` — no overlay, game running normally
- `{ mode: 'picker' }` — sender picker list is shown (multiple unread senders)
- `{ mode: 'conversation', senderId }` — specific conversation is displayed

Using a discriminated union avoids any collision between mode identifiers and user IDs.

### New Actions

```ts
openGameChat: () => void                    // sets gameChatOverlay to { mode: 'picker' }
openGameChatFor: (senderId: string) => void // sets gameChatOverlay to { mode: 'conversation', senderId }
closeGameChat: () => void                   // sets gameChatOverlay to null
```

### Derived Value

Games derive a pause signal: `gamePaused = gameChatOverlay !== null`. Read via `useCornerStore(s => s.gameChatOverlay !== null)`.

### State Cleanup

`closeGameView()` must also reset `gameChatOverlay` to `null`. If the user exits the game entirely (back button, CornerRail click) while the overlay is open, both the overlay and game close cleanly.

## GameNotification Behavior Change

**File:** `src/components/ui/GameNotification.tsx`

Current behavior: `onClick` calls `closeGameView()` → destroys game, returns to chat.

New behavior:
- Count the number of senders with unread messages (from `useUnreadStore().counts`)
- If **one sender**: call `openGameChatFor(senderId)` → skip picker, open conversation directly
- If **multiple senders**: call `openGameChat()` → show sender picker
- The notification bubble hides while the overlay is open (`gameChatOverlay !== null`)

## New Component: `GameChatOverlay`

**File:** `src/components/corners/GameChatOverlay.tsx`

Rendered inside the game layer in `ChatLayout`, as a sibling to `GamesCorner`. Only renders on desktop layout — **not rendered on mobile** (mobile layout has a different navigation flow).

### Layout

- **Width:** ~38% of the game area, anchored to the right edge
- **Height:** Full height of the game area
- **Animation:** Slides in from the right using `transform: translateX()` with `cubic-bezier(0.4, 0, 0.2, 1)`, matching the existing game layer slide animation
- **Styling:** `glass-elevated` background, left border glow, Frutiger Aero aesthetic

### Pause Dim Layer

When the overlay is open, a semi-transparent layer covers the **entire** game area behind the overlay:

- Background: `rgba(0,0,0,0.3)`
- `backdrop-filter: blur(2px)` — gently frosts the paused game
- Centered "PAUSED" text: bold, uppercase, slightly translucent white, subtle text shadow
- **Clicking this layer closes the overlay** (calls `closeGameChat()`)

This dim layer is part of `GameChatOverlay` — one element serves as dim + pause indicator + dismiss target.

### Two States

**1. Sender Picker (`mode === 'picker'`)**

A compact list of users who have unread messages:
- Data source: `useUnreadStore().counts` + `useFriendStore().friends` (same stores `GameNotification` uses)
- Each row: avatar, username, unread count badge
- Clicking a row calls `openGameChatFor(senderId)` → transitions to conversation view
- Header with X button to close the entire overlay
- The list updates live — if a new message arrives from a new sender while the picker is open, the new sender appears in the list

**2. Conversation View (`mode === 'conversation'`)**

Reuses the existing `ChatWindow` component rendered in the narrower frame:
- Header area: back arrow (returns to picker if there were multiple senders, otherwise closes) + contact name + X button (closes overlay entirely)
- Full message list, input field, encryption — all handled by `ChatWindow`
- `ChatWindow` already accepts a `contact` prop and an `onBack` callback

**Unread clearing:** `ChatWindow` currently skips clearing unreads when `gameViewActive` is `true` (the `useEffect` with the comment "Clear unread when this chat is opened or when returning from game view"). When rendered inside the overlay, this logic must be updated: clear unreads for the contact being viewed in the overlay, even though `gameViewActive` is still `true`. The condition should become: `if (!gameViewActive || gameChatOverlay?.mode === 'conversation')`.

**New messages while overlay is open:** If a message arrives from a sender not currently being viewed, the `GameNotification` bubble should NOT reappear (since the overlay is already open). Instead, the sender picker (if user navigates back to it) will show the updated unread counts.

### Dismiss Behavior

- X button in overlay header → `closeGameChat()`
- Clicking the dim layer (paused game area) → `closeGameChat()`

### Keyboard Event Isolation

The overlay must prevent keyboard events from reaching the underlying games. Some games (Tropico) register handlers directly on `window` via `addEventListener`, which means `stopPropagation()` from a React component lower in the DOM tree **cannot** block them. The `GameChatOverlay` wrapper should still call `e.stopPropagation()` on `keydown`/`keyup` (handles games that use React event handlers), but the **primary** isolation mechanism is a `pausedRef` guard inside each game's keyboard handler that early-returns when paused.

## Per-Game Pause Behavior

### BubblePop (`src/components/corners/games/BubblePop.tsx`)

Uses `requestAnimationFrame` for its game loop, plus `setTimeout`-based spawn timers and `setInterval`-based level timers.

When `gamePaused` becomes `true`:
- Add a `pausedRef` check at the top of the `tick` function — if paused, do **not** re-schedule rAF
- Clear the spawn timer (`spawnTimer`), level timer (`levelTimer`), and combo timer (`comboTimer`) — these run independently of rAF and would otherwise keep spawning bubbles, advancing levels, and resetting the combo counter while paused
- Store the remaining time for any active spawn/level/combo intervals so they can be restored on unpause

When `gamePaused` flips back to `false`:
- Schedule a new `requestAnimationFrame` to resume the render loop
- Restart spawn, level, and combo timers with the remaining durations

### Tropico (`src/components/corners/games/Tropico.tsx`)

Uses `requestAnimationFrame` for a physics + rendering loop. The loop unconditionally calls `update(dt)` and `render()` then schedules the next frame.

When `gamePaused` becomes `true`:
- Add a `pausedRef` check inside the `loop` closure — if paused, do **not** call `update(dt)` or `render()`, and do **not** re-schedule rAF. The loop stops entirely. The canvas retains the last painted frame automatically since nothing clears it.

When `gamePaused` flips back to `false`:
- Schedule a new `requestAnimationFrame` to restart the loop
- Reset the `lastTime` reference so the first `dt` after unpause is zero (prevents a large delta jump)

Tropico registers keyboard handlers on `window` directly (`window.addEventListener('keydown', ...)`). `stopPropagation()` from the overlay **cannot** block these — `window`-level listeners fire regardless of propagation. The **required** fix is a `pausedRef` guard at the top of each keyboard handler that early-returns when paused. This is the primary mechanism, not a backup.

### TypingTest (`src/components/corners/games/TypingTest.tsx`)

Uses `setInterval` for a countdown timer. The timer ticks every second and would continue running while the overlay is open, causing the game to end while the user is chatting.

When `gamePaused` becomes `true`:
- Clear the countdown interval
- Store the remaining seconds

When `gamePaused` flips back to `false`:
- Restart the interval with the stored remaining seconds

### Wordle, 2048

No animation loops or timers. Turn-based / input-driven only. The overlay blocks keyboard and mouse input. **No code changes needed.**

### AeroChess (3D Chess)

**Excluded from pausing.** Chess is multiplayer — the opponent continues playing. The chat overlay opens over the chess board but the R3F scene keeps running. Supabase realtime events continue flowing.

## Changes to `ChatLayout`

**File:** `src/components/chat/ChatLayout.tsx`

Render `GameChatOverlay` inside the existing game layer `<div>`, after `<GamesCorner />`:

```tsx
{/* GAME LAYER */}
<div style={{ /* existing styles */ }}>
  <GamesCorner />
  <GameChatOverlay />
</div>
```

`GameChatOverlay` handles its own visibility based on `gameChatOverlay` state.

## Changes Summary

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/store/cornerStore.ts` | Add `gameChatOverlay`, `openGameChat`, `openGameChatFor`, `closeGameChat`; update `closeGameView` to reset overlay |
| Create | `src/components/corners/GameChatOverlay.tsx` | Sender picker + embedded ChatWindow + pause dim layer + slide animation + keyboard isolation |
| Modify | `src/components/ui/GameNotification.tsx` | Call `openGameChat()` / `openGameChatFor()` instead of `closeGameView()`; hide when overlay open |
| Modify | `src/components/chat/ChatLayout.tsx` | Render `GameChatOverlay` inside the game layer |
| Modify | `src/components/chat/ChatWindow.tsx` | Update unread-clearing logic to account for overlay state |
| Modify | `src/components/corners/games/BubblePop.tsx` | Pause rAF loop + spawn/level timers when `gamePaused` |
| Modify | `src/components/corners/games/Tropico.tsx` | Pause rAF loop (skip `update`, keep `render`), guard keyboard handlers |
| Modify | `src/components/corners/games/TypingTest.tsx` | Pause countdown interval when `gamePaused` |

## What This Does NOT Change

- No new dependencies or libraries
- No new Zustand stores (extends existing `cornerStore`)
- No changes to message format, encryption, or Supabase schema
- No changes to file upload flow
- Chess continues to work exactly as today (no pause)
- Wordle and 2048 need zero code modifications
- No mobile layout changes (overlay is desktop-only)

## Testing

- Play BubblePop → receive message → click notification → game freezes (no new bubbles spawning, no level advancement), "PAUSED" overlay visible, chat panel slides in from right
- Reply to message in overlay → close overlay (X / click dim area) → game resumes where it left off, timer/spawns pick up correctly
- Play Tropico → same flow → physics loop stops, player frozen mid-air, canvas stays painted, resumes correctly with no delta jump
- Play Tropico → open overlay → press arrow keys in chat input → keys do NOT move the player
- Play TypingTest → open overlay with 15s remaining → chat for 30s → close overlay → timer still shows ~15s, game has not ended
- Play Wordle → overlay opens → keyboard blocked by overlay → close → continue guessing
- Play 2048 → overlay opens → swipe/keys blocked → close → continue playing
- Play Chess → overlay opens → chess keeps running → close → chess unaffected
- Multiple senders → sender picker shows → pick one → conversation opens → back arrow returns to picker
- Single sender → picker skipped, conversation opens directly
- Exit game entirely (back button) while overlay is open → both overlay and game close, state is clean
- New message from unknown sender while overlay is open → sender picker updates when navigated to, notification bubble does NOT reappear
- Open overlay → view a conversation → unreads for that contact are cleared
