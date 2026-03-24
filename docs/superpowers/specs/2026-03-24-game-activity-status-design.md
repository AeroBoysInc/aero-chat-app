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
- Colour: cyan (`#5BC8F5`) for the game label, matching the Frutiger Aero palette
- Icon: 🎮 emoji prefix

### Locations

1. **Sidebar friend list** — status line beneath the friend's username (the line that shows `online` / `away` / `busy` / `offline`)
2. **Chat window header** — status text shown next to the contact's name at the top of the open conversation

### Game name mapping

| `SelectedGame` ID | Display name |
|---|---|
| `bubblepop` | Bubble Pop |
| `tropico` | Tropico |
| `twentyfortyeight` | 2048 |
| `typingtest` | Typing Test |
| `wordle` | Wordle |
| `chess` | Chess |

A `GAME_LABELS` constant (plain object) is defined once and imported wherever the display name is needed.

---

## Data Architecture

### Broadcasting — Supabase Realtime presence

The existing `global:online` presence channel in `App.tsx` currently tracks:

```ts
channel.track({ connected: true })
```

This is extended to:

```ts
channel.track({ connected: true, playingGame: selectedGame ?? null })
```

- `selectedGame` is read from `cornerStore`
- When `showGameActivity` is `false` in `statusStore`, `playingGame` is always sent as `null`
- `channel.track()` is re-called whenever `selectedGame` or `showGameActivity` changes

No database schema changes are required — game activity is ephemeral presence data only.

### `presenceStore` — new field

Add `playingGames: Map<string, string>` to the store (userId → game ID string).

```ts
interface PresenceStore {
  onlineIds: Set<string>;
  presenceReady: boolean;
  playingGames: Map<string, string>;   // NEW
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

Add `showGameActivity: boolean` (default: `true`) persisted in localStorage alongside the existing status key.

```ts
interface StatusStore {
  // ... existing fields
  showGameActivity: boolean;           // NEW
  setShowGameActivity: (val: boolean) => void;  // NEW
}
```

The localStorage key remains `aero-status`; the new field is added to the same serialised object.

---

## App.tsx changes

Two reactive effects:

1. **Re-track on game change** — a `useEffect` watching `[selectedGame, showGameActivity]` calls `channel.track({ connected: true, playingGame: showGameActivity ? selectedGame : null })`. The channel ref is exposed so effects outside the subscription callback can call `track()`.

2. **Sync handler update** — in the existing `presence.sync` callback, after updating `onlineIds`, also compute and call `setPlayingGames(newGames)`.

---

## Sidebar.tsx changes

In the friend row's status line, after the status text, conditionally render the game label:

```tsx
const playingGame = playingGames.get(friend.id);

<span style={{ color: statusColour }}>{effectiveStatus}</span>
{playingGame && (
  <>
    <span style={{ color: 'rgba(255,255,255,0.3)' }}> · </span>
    <span style={{ color: '#5BC8F5' }}>🎮 Playing {GAME_LABELS[playingGame]}</span>
  </>
)}
```

`playingGames` is destructured from `usePresenceStore()`.

---

## ChatWindow.tsx changes

In the chat header, the contact's status line receives the same inline treatment. The contact's `id` is used to look up `playingGames.get(contact.id)`.

---

## GeneralPanel.tsx changes

A new toggle row in the General settings panel:

```
Show game activity
Let friends see what game you're playing
[toggle]
```

Calls `setShowGameActivity(val)` on change. Reads `showGameActivity` from `statusStore`.

---

## File Summary

| Action | File | Change |
|--------|------|--------|
| Modify | `src/store/presenceStore.ts` | Add `playingGames` map + `setPlayingGames` action |
| Modify | `src/store/statusStore.ts` | Add `showGameActivity` boolean + `setShowGameActivity` action, persist in localStorage |
| Modify | `src/App.tsx` | Extend `channel.track()` payload; update `presence.sync` to populate `playingGames` |
| Modify | `src/components/chat/Sidebar.tsx` | Inline game label in friend status line |
| Modify | `src/components/chat/ChatWindow.tsx` | Inline game label in chat header |
| Modify | `src/components/settings/GeneralPanel.tsx` | Add `showGameActivity` toggle |

---

## Out of Scope

- Persisting game activity to the `profiles` table (ephemeral presence is sufficient)
- Showing game activity in notifications or presence outside the sidebar/chat header
- Per-game icons beyond the 🎮 emoji
