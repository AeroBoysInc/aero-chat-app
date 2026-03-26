# Design Spec: React Render Efficiency (Phase 2)
**Date:** 2026-03-26
**Status:** Approved

---

## Overview

Five targeted fixes that eliminate the main re-render cascades in AeroChat. Zero visual change to the user — all gains are internal. Approach C (hybrid): extract where the cascade is worst, patch where it isn't.

**Files touched:**

| File | Change |
|------|--------|
| `src/components/chat/Sidebar.tsx` | `useShallow` selectors + extract memoized `FriendItem` |
| `src/components/chat/ChatWindow.tsx` | Extract memoized `MessageItem`, pre-compute `itemList`, add virtualization |
| `src/App.tsx` | Presence throttle when hidden + flush on tab return |

---

## Fix 1 — `useShallow` selectors

### Problem

Every full-store destructure and every selector returning an object/array/Set/Map re-renders its subscriber on every store update, regardless of whether the consumed values changed.

Audit findings — dangerous subscriptions:

| Location | Store | Returns | Frequency |
|----------|-------|---------|-----------|
| `Sidebar.tsx` | `useFriendStore()` | full destructure | medium |
| `Sidebar.tsx` | `useTypingStore()` | full destructure (Record) | per keystroke |
| `Sidebar.tsx` | `useUnreadStore()` | full destructure (Record) | per message |
| `Sidebar.tsx` | `usePresenceStore(s => s.onlineIds)` | Set | presence sync |
| `Sidebar.tsx` | `usePresenceStore(s => s.playingGames)` | Map | game activity |
| `ChatWindow.tsx` | `usePresenceStore()` | full destructure | presence sync |

### Fix

Import `useShallow` from `zustand/react/shallow`. Replace every dangerous subscription with a shallow-selected pick of only the fields the component actually uses.

```ts
// Before
const { friends, sendFriendRequest, removeFriend } = useFriendStore()

// After
const friends         = useFriendStore(useShallow(s => s.friends))
const sendFriendRequest = useFriendStore(s => s.sendFriendRequest)
const removeFriend    = useFriendStore(s => s.removeFriend)
```

Actions (functions) are stable references and can be selected individually without `useShallow`.

For `onlineIds` (Set) and `playingGames` (Map): these are already deduplicated at the source in `App.tsx` (only updated when content changes). With `FriendItem` extraction (Fix 2), Sidebar no longer subscribes to these directly — the subscription moves into each `FriendItem` as a primitive selector, making `useShallow` unnecessary for them.

---

## Fix 2 — `FriendItem` extraction (`Sidebar.tsx`)

### Problem

The friend list renders as `{friends.map(friend => <inline JSX>)}`. Every presence sync, typing update, or unread increment re-renders the entire list — all friends, all avatars, all status lines.

### Fix

Extract a `FriendItem` component (internal to `Sidebar.tsx`, not a separate file). Wrap in `React.memo`. Each instance subscribes only to its own primitive slices:

```ts
const isOnline    = usePresenceStore(s => s.onlineIds.has(friend.id))          // boolean
const isTyping    = useTypingStore(s => s.typing[friend.id] === true)           // boolean
const unread      = useUnreadStore(s => s.counts[friend.id] ?? 0)               // number
const playingGame = usePresenceStore(s => s.playingGames.get(friend.id) ?? null) // string | null
```

All selectors return primitives or null — reference equality works. When friend A goes online, only `FriendItem` for A re-renders. The parent Sidebar renders:

```tsx
{friends.map(f => (
  <FriendItem
    key={f.id}
    friend={f}
    isSelected={selectedContact?.id === f.id}
    onSelect={setSelectedContact}
  />
))}
```

`isSelected` is the only non-primitive prop, derived locally in Sidebar from `selectedContact?.id === f.id` — a boolean, so safe.

**Props interface:**

```ts
interface FriendItemProps {
  friend: Profile
  isSelected: boolean
  onSelect: (friend: Profile) => void
}
```

All rendering logic currently inside the `friends.map` block moves into `FriendItem`. No visual change.

---

## Fix 3 — `MessageItem` extraction + hover fix (`ChatWindow.tsx`)

### Problem

`hoveredMsgId` is state owned at ChatWindow level. Any `onMouseEnter` calls `setHoveredMsgId()`, re-rendering all messages to check `hoveredMsgId === msg.id`. Up to 300 re-renders per hover event.

### Fix

Extract a memoized `MessageItem` component (internal to `ChatWindow.tsx`). It owns `const [isHovered, setIsHovered] = useState(false)`. The ChatWindow-level `hoveredMsgId` state is deleted. Hovering any message causes exactly one component to re-render.

**Props interface:**

```ts
interface MessageItemProps {
  msg: Message
  isMine: boolean
  showDate: boolean
  msgReactions: Record<string, string[]>  // reactions[msg.id] only
  user: Profile
  contact: Profile
  onReact: (msgId: string, emoji: string) => void
  // ...other callbacks as needed
}
```

`msgReactions` receives only the per-message slice of the reactions object. When reactions update on message X, only `MessageItem` for X gets a changed prop. All other items stay frozen via `React.memo`'s shallow comparison.

**`itemList` pre-computation:**

The `showDate` flag is currently computed inline in the map on every render. Replace with a memoized derived list:

```ts
const itemList = useMemo(() =>
  messages.map((msg, i) => ({
    msg,
    showDate: i === 0 ||
      new Date(msg.created_at).toDateString() !== new Date(messages[i-1].created_at).toDateString(),
  })),
[messages])
```

This feeds directly into the virtualizer (Fix 4).

---

## Fix 4 — Presence throttle when hidden (`App.tsx`)

### Problem

The Supabase presence `sync` event fires multiple times per second. When the tab is hidden, these updates trigger `setOnlineIds()` / `setPlayingGames()` and cascade re-renders through every presence subscriber — entirely wasted work.

### Fix

**Step 1 — Skip updates while hidden:**

Add a `pendingPresenceSync` ref. In the presence sync handler, early-return when hidden:

```ts
const pendingPresenceSync = useRef(false)

.on('presence', { event: 'sync' }, () => {
  if (document.hidden) {
    pendingPresenceSync.current = true
    return
  }
  syncPresenceState(channel.presenceState())
})
```

**Step 2 — Extract `syncPresenceState` helper:**

Pull the existing `setOnlineIds` / `setPlayingGames` logic into a named helper so it can be called from two places without duplication:

```ts
function syncPresenceState(state: ReturnType<typeof channel.presenceState>) {
  const newIds = new Set(Object.keys(state))
  const prev = usePresenceStore.getState().onlineIds
  const changed = newIds.size !== prev.size || [...newIds].some(id => !prev.has(id))
  if (changed) setOnlineIds(newIds)
  setPresenceReady(true)
  // ...playingGames map update
}
```

**Step 3 — Flush on tab return:**

In the existing `visibilitychange` handler (added in Feature 2):

```ts
const handler = () => {
  document.documentElement.classList.toggle('paused', document.hidden)
  document.dispatchEvent(new CustomEvent('aerochat:visibilitychange', { detail: { hidden: document.hidden } }))

  if (!document.hidden && pendingPresenceSync.current) {
    pendingPresenceSync.current = false
    const state = presenceChannelRef.current?.presenceState()
    if (state) syncPresenceState(state)
  }
}
```

Online status is accurate the instant the tab becomes visible. Zero missed updates.

---

## Fix 5 — Message list virtualization (`ChatWindow.tsx`)

### Problem

All messages (up to 300) are always in the DOM. On slower hardware, scrolling through a long chat means 300 complex nodes — avatars, bubbles, reactions, voice players, file attachments — all participating in layout and paint.

### Fix

Install `@tanstack/react-virtual`. Use `useVirtualizer` with `measureElement` for dynamic heights (messages vary significantly in height):

```ts
const virtualizer = useVirtualizer({
  count: itemList.length,
  getScrollElement: () => chatAreaRef.current,
  estimateSize: () => 72,
  overscan: 8,
  measureElement: el => el.getBoundingClientRect().height,
})
```

**Scroll container:**

```tsx
<div ref={chatAreaRef} className="overflow-y-auto ...">
  <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
    {virtualizer.getVirtualItems().map(vItem => (
      <div
        key={vItem.key}
        data-index={vItem.index}
        ref={virtualizer.measureElement}
        style={{ position: 'absolute', top: vItem.start, width: '100%' }}
      >
        <MessageItem
          msg={itemList[vItem.index].msg}
          showDate={itemList[vItem.index].showDate}
          isMine={itemList[vItem.index].msg.sender_id === user?.id}
          msgReactions={reactions[itemList[vItem.index].msg.id] ?? {}}
          user={user!}
          contact={contact}
          onReact={handleReact}
        />
      </div>
    ))}
  </div>
</div>
```

**Scroll-to-bottom on new messages:**

Replace the current `scrollTop = scrollHeight` with:

```ts
useEffect(() => {
  if (!isNearBottom()) return
  virtualizer.scrollToIndex(messages.length - 1, { align: 'end' })
}, [messages.length])
```

`isNearBottom()` checks whether the user is within 150px of the bottom before auto-scrolling — identical to current behavior.

**`SoapBubbles` and depth orbs:**

These are absolutely-positioned overlays, not part of the message list. They are siblings of the virtualizer container and remain unchanged.

---

## Out of scope

- No changes to Zustand store shapes — only subscription patterns change
- No changes to message rendering logic — only how/when components re-render
- No changes to `cornerStore.ts`, game components, or the WebRTC call flow
- No backend changes
- `audioStore` and `callStore` subscriptions left as-is (low-frequency, low impact)

---

## Verification

1. **Sidebar presence** — open DevTools React Profiler, trigger a presence sync (another user goes online/offline). Only the affected `FriendItem` should highlight, not the entire list.
2. **Typing indicator** — start typing in another client. Only the typing friend's `FriendItem` should re-render in the profiler.
3. **Message hover** — hover over messages. Only one `MessageItem` highlights per hover in the profiler.
4. **Hidden tab** — switch away from the app for 10+ seconds, return. Online statuses are accurate immediately.
5. **Scroll** — load a 200+ message chat. Scroll freely — messages above/below the visible window should not be in the DOM (confirm via Elements panel).
6. **Auto-scroll** — send a new message. List snaps to bottom. Scrolling up and receiving a message does NOT auto-scroll (existing behavior preserved).
