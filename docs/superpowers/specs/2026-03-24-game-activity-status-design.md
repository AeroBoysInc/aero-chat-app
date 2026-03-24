# Game Activity Status — Design Spec

**Date:** 2026-03-24
**Status:** Approved

---

## Goal

When a user is playing a game in the Games Corner, their friends see "Playing [Game]" inline next to the user's status in both the sidebar friend list and the chat window header. The user can disable this from settings.

---

## Display

Both locations use the same inline pattern:

```
online · 🎮 Playing Wordle
```

- The game label is appended to the existing status text, separated by ` · `
- When the user is not playing, only the status text shows (no change to existing behaviour)
- Colour: `#5BC8F5` (the `sky` design token) for the game label
- Icon: 🎮 emoji prefix

### Locations

1. **Sidebar friend list** — status line beneath the friend's username (the line that shows `online` / `away` / `busy` / `offline`)
2. **Chat window header** — status text shown next to the contact's name at the top of the open conversation

Note: ChatWindow currently reads the contact's status from the `profiles` table (friends store) rather than from `presenceStore.onlineIds`. This is a pre-existing inconsistency that is out of scope for this feature. The game label will be appended the same way in both places; the label will simply use the presence data without correcting the underlying status source.

### Game name mapping

A `GAME_LABELS` constant (plain object) is defined once in a shared location (e.g., `src/lib/gameLabels.ts`) and imported wherever the display name is needed.

| `SelectedGame` ID | Display name |
|---|---|
| `bubblepop` | Bubble Pop |
| `tropico` | Tropico |
| `twentyfortyeight` | 2048 |
| `typingtest` | Typing Test |
| `wordle` | Wordle |
| `chess` | Chess |

---

## Data Architecture

### Broadcasting — Supabase Realtime presence

The existing `global:online` presence channel in `App.tsx` currently tracks:

```ts
channel.track({ connected: true })
```

This is extended to:

```ts
channel.track({ connected: true, playingGame: showGameActivity ? selectedGame : null })
```

- When `selectedGame` is `null` (user closed game hub or no game selected), `playingGame` is `null`
- When `showGameActivity` is `false`, `playingGame` is always `null`

#### Channel ref refactoring required

Currently, `channel` is a local `const` inside the presence `useEffect` in `App.tsx`, scoped to the subscription callback. To allow a separate `useEffect` to call `channel.track()` when `selectedGame` or `showGameActivity` changes, the channel must be promoted to a component-level ref:

```ts
// At component level in App.tsx
const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

// Inside the presence useEffect, after creating the channel:
presenceChannelRef.current = channel;
```

The initial `channel.track()` call inside the subscribe callback must also include the game payload:

```ts
await channel.track({
  connected: true,
  playingGame: showGameActivity ? selectedGame : null,
});
```

A second `useEffect` watches `[selectedGame, showGameActivity]` only (gated on `user?.id` existing). Refs are not reactive so `presenceChannelRef.current` is **not** in the dependency array — the channel will already be set by the time `selectedGame` or `showGameActivity` changes:

```ts
presenceChannelRef.current?.track({
  connected: true,
  playingGame: showGameActivity ? selectedGame : null,
});
```

No database schema changes are required — game activity is ephemeral presence data only.

### `presenceStore` — new field

Add `playingGames: Map<string, string>` to the existing `PresenceState` interface (userId → game ID string).

```ts
interface PresenceState {
  onlineIds: Set<string>;
  presenceReady: boolean;
  playingGames: Map<string, string>;           // NEW
  setOnlineIds: (ids: Set<string>) => void;
  setPresenceReady: (ready: boolean) => void;
  setPlayingGames: (games: Map<string, string>) => void;  // NEW
}
```

Populated in the `presence.sync` handler in `App.tsx`:

```ts
const newGames = new Map<string, string>();
for (const [userId, presences] of Object.entries(state)) {
  const p = (presences as any[])[0];
  if (p?.playingGame) newGames.set(userId, p.playingGame);
}
setPlayingGames(newGames);
```

### `statusStore` — new preference

`statusStore` uses Zustand's `persist` middleware with key `aero-status`. Adding a new state field automatically includes it in the serialised localStorage object — no manual serialisation code is needed.

Add `showGameActivity: boolean` (default: `true`). This is **local-only** — it is never written to Supabase (unlike the `status` field which is synced to `profiles`).

```ts
interface StatusState {
  // ... existing fields
  showGameActivity: boolean;                          // NEW — persisted in localStorage, local only
  setShowGameActivity: (val: boolean) => void;        // NEW
}
```

---

## App.tsx changes

1. Add `presenceChannelRef` at component level (see Channel ref refactoring above)
2. In the existing `presence.sync` callback, after updating `onlineIds`, compute and call `setPlayingGames(newGames)`
3. Add a new `useEffect([selectedGame, showGameActivity])` (gated on `user?.id`) that calls `presenceChannelRef.current?.track(...)` with the updated payload

---

## Sidebar.tsx changes

The friend row renders status via a `<StatusLine>` component that renders a `<p>` (block element). Appending a sibling `<span>` after it would render on a separate line. Instead, `StatusLine` is extended to accept an optional `playingGame` prop and renders the label inline:

```tsx
// StatusLine component — add optional prop:
interface StatusLineProps {
  status: string;
  playingGame?: string | null;
}

// Inside StatusLine render:
<p className="...">
  <span style={{ color: statusColour }}>{status}</span>
  {playingGame && (
    <>
      <span style={{ color: 'rgba(255,255,255,0.3)' }}> · </span>
      <span style={{ color: '#5BC8F5' }}>🎮 Playing {GAME_LABELS[playingGame] ?? playingGame}</span>
    </>
  )}
</p>
```

At the call site in Sidebar, pass the game:

```tsx
const playingGame = playingGames.get(friend.id);
<StatusLine status={effectiveStatus} playingGame={playingGame} />
```

`playingGames` is destructured from `usePresenceStore()`. The typing indicator ternary already replaces `<StatusLine>` when typing is active — the game label is automatically suppressed during typing since `StatusLine` is not rendered.

---

## ChatWindow.tsx changes

In the chat header, the contact's status line receives the same inline treatment. The contact's `id` is used to look up `playingGames.get(contact.id)`. The same `GAME_LABELS` constant and `#5BC8F5` colour apply.

---

## GeneralPanel.tsx changes

`GeneralPanel` is currently titled "Voice & Audio" and contains only audio settings. A new **Privacy** section with a divider is added below the audio section:

```
── Privacy ──────────────────────────────

Show game activity
Let friends see what game you're playing
[toggle]
```

The toggle calls `setShowGameActivity(val)` and reads `showGameActivity` from `statusStore`.

---

## File Summary

| Action | File | Change |
|--------|------|--------|
| Create | `src/lib/gameLabels.ts` | `GAME_LABELS` constant mapping game IDs to display names |
| Modify | `src/store/presenceStore.ts` | Add `playingGames` map + `setPlayingGames` action to `PresenceState` |
| Modify | `src/store/statusStore.ts` | Add `showGameActivity` boolean + `setShowGameActivity` action (auto-persisted via `persist` middleware) |
| Modify | `src/App.tsx` | Add `presenceChannelRef`; extend `channel.track()` payload; update `presence.sync` to populate `playingGames`; add re-track effect |
| Modify | `src/components/chat/Sidebar.tsx` | Extend the local `StatusLine` function (defined at the bottom of the file) with optional `playingGame` prop; pass it in the friend row |
| Modify | `src/components/chat/ChatWindow.tsx` | Inline game label in chat header |
| Modify | `src/components/settings/GeneralPanel.tsx` | Add Privacy section with `showGameActivity` toggle |

---

## Out of Scope

- Persisting game activity to the `profiles` table
- Fixing the pre-existing ChatWindow status inconsistency (presence vs. profiles table)
- Showing game activity in notifications or anywhere outside the sidebar/chat header
- Per-game icons beyond the 🎮 emoji
