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
gameChatOverlay: 'picker' | string | null
```

- `null` — no overlay, game running normally
- `'picker'` — sender picker list is shown (multiple unread senders)
- `string` — a specific sender's user ID; that conversation is displayed

### New Actions

```ts
openGameChat: () => void        // sets gameChatOverlay to 'picker'
openGameChatFor: (id: string) => void  // sets gameChatOverlay to senderId
closeGameChat: () => void       // sets gameChatOverlay to null
```

### Derived Value

Games derive a pause signal: `gamePaused = gameChatOverlay !== null`. This is read via `useCornerStore(s => s.gameChatOverlay !== null)`.

## GameNotification Behavior Change

**File:** `src/components/ui/GameNotification.tsx`

Current behavior: `onClick` calls `closeGameView()` → destroys game, returns to chat.

New behavior:
- Count the number of senders with unread messages
- If **one sender**: call `openGameChatFor(senderId)` → skip picker, open conversation directly
- If **multiple senders**: call `openGameChat()` → show sender picker
- The notification bubble hides while the overlay is open (`gameChatOverlay !== null`)

## New Component: `GameChatOverlay`

**File:** `src/components/corners/GameChatOverlay.tsx`

Rendered inside the game layer in `ChatLayout`, as a sibling to `GamesCorner`.

### Layout

- **Width:** ~38% of the game area, anchored to the right edge
- **Height:** Full height of the game area
- **Animation:** Slides in from the right using `transform: translateX()` with `cubic-bezier(0.4, 0, 0.2, 1)`, matching the existing game layer slide animation
- **Styling:** `glass-elevated` background, left border glow, Frutiger Aero aesthetic

### Pause Dim Layer

When the overlay is open, a semi-transparent layer covers the game area behind the overlay (the left ~62%):

- Background: `rgba(0,0,0,0.3)`
- `backdrop-filter: blur(2px)` — gently frosts the paused game
- Centered "PAUSED" text: bold, uppercase, slightly translucent white, subtle text shadow
- **Clicking this layer closes the overlay** (calls `closeGameChat()`)

This dim layer is part of `GameChatOverlay` — one element serves as dim + pause indicator + dismiss target.

### Two States

**1. Sender Picker (`gameChatOverlay === 'picker'`)**

A compact list of users who have unread messages:
- Each row: avatar, username, unread count badge, last message preview
- Clicking a row calls `openGameChatFor(senderId)` → transitions to conversation view
- Header with X button to close the entire overlay

**2. Conversation View (`gameChatOverlay === senderId`)**

Reuses the existing `ChatWindow` component rendered in the narrower frame:
- Header area: back arrow (returns to picker if multiple senders, otherwise closes) + contact name + X button (closes overlay entirely)
- Full message list, input field, encryption — all handled by `ChatWindow` as-is
- `ChatWindow` already accepts a `contact` prop and an `onBack` callback

### Dismiss Behavior

- X button in overlay header → `closeGameChat()`
- Clicking the dim layer (paused game area) → `closeGameChat()`

## Per-Game Pause Behavior

### BubblePop (`src/components/corners/games/BubblePop.tsx`)

Uses `requestAnimationFrame` for its game loop. When `gamePaused` is `true`:
- Stop re-scheduling `requestAnimationFrame` in the `tick` function
- When `gamePaused` flips back to `false`, schedule a new frame to resume

### Tropico (`src/components/corners/games/Tropico.tsx`)

Uses `requestAnimationFrame` for physics/rendering loop. Same approach:
- Stop re-scheduling rAF when paused
- Resume by scheduling a new frame when unpaused

### Wordle, 2048, TypingTest

No animation loops. These are turn-based / input-driven games. The overlay sitting on top naturally blocks keyboard and mouse input. **No code changes needed** in these components.

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

## What This Does NOT Change

- No new dependencies or libraries
- No new Zustand stores (extends existing `cornerStore`)
- No changes to `ChatWindow` internals — reused as-is
- No changes to message format, encryption, or Supabase schema
- No changes to file upload flow
- Chess continues to work exactly as today (no pause)
- Wordle, 2048, TypingTest need zero code modifications

## Testing

- Play BubblePop → receive message → click notification → game freezes, "PAUSED" overlay visible, chat panel slides in from right
- Reply to message in overlay → close overlay (X / click dim area) → game resumes where it left off
- Play Tropico → same flow → physics loop stops, resumes correctly
- Play Wordle → overlay opens → keyboard blocked by overlay → close → continue guessing
- Play Chess → overlay opens → chess keeps running → close → chess unaffected
- Multiple senders → sender picker shows → pick one → conversation opens → back arrow returns to picker
- Single sender → picker skipped, conversation opens directly
