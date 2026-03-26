# React Render Efficiency (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the five main re-render cascades in AeroChat — useShallow selectors, memoized FriendItem, memoized MessageItem with local hover state, presence throttle when hidden, and message list virtualization.

**Architecture:** Three files modified (Sidebar.tsx, ChatWindow.tsx, App.tsx) plus one package install. Tasks 2–3 are coupled to Sidebar; Tasks 4 and 6 are coupled to ChatWindow; Task 5 is isolated to App.tsx. Task 1 (package install) must run before Task 6 (virtualization). All other tasks are independent.

**Tech Stack:** React 19, TypeScript, Zustand v5 (`useShallow` from `zustand/react/shallow`), `@tanstack/react-virtual`, Vite, Vitest.

---

## File Map

| File | What changes |
|------|-------------|
| `src/components/chat/Sidebar.tsx` | Tasks 2 + 3: add `useShallow` imports, replace store destructures with individual selectors, extract `FriendItem` component |
| `src/components/chat/ChatWindow.tsx` | Tasks 4 + 6: add `useShallow`, extract `MessageItem`, add `reactionsRef`, virtualize message list |
| `src/App.tsx` | Task 5: add `pendingPresenceSync` ref, extract `syncPresenceState` helper, skip updates when hidden, flush on tab return |

---

## Task 1 — Install `@tanstack/react-virtual`

**Files:**
- Modify: `package.json` (via pnpm)

- [ ] **Step 1: Install the package**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app" && pnpm add @tanstack/react-virtual
```

Expected output: `dependencies: + @tanstack/react-virtual x.x.x`

- [ ] **Step 2: Build check**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app" && pnpm build 2>&1 | tail -4
```

Expected: `✓ built in`

- [ ] **Step 3: Commit**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app" && git add package.json pnpm-lock.yaml && git commit -m "chore: add @tanstack/react-virtual"
```

---

## Task 2 — `useShallow` selectors in `Sidebar.tsx`

**Files:**
- Modify: `src/components/chat/Sidebar.tsx`

The current store subscriptions at lines 59–65 use full destructures and bare object/Set/Map selectors. Every store update re-renders the entire Sidebar regardless of whether consumed values changed.

- [ ] **Step 1: Add `useShallow` to the React import line**

Find line 1:
```typescript
import { useState, useEffect, useRef } from 'react';
```

Replace with:
```typescript
import { useState, useEffect, useRef, memo } from 'react';
```

(Adding `memo` now because Task 3 uses it — saves an edit pass.)

- [ ] **Step 2: Add `useShallow` import after the existing store imports**

Find line 10:
```typescript
import { usePresenceStore } from '../../store/presenceStore';
```

Add directly after it:
```typescript
import { useShallow } from 'zustand/react/shallow';
```

- [ ] **Step 3: Replace the six store subscription lines (59–65)**

Find the exact block:
```typescript
  const { friends, pendingIncoming, pendingSent, sendFriendRequest, removeFriend } = useFriendStore();
  const { counts, clear } = useUnreadStore();
  const { typing } = useTypingStore();
  const { status: myStatus, setStatus: setMyStatus } = useStatusStore();
  const onlineIds = usePresenceStore(s => s.onlineIds);
  const presenceReady = usePresenceStore(s => s.presenceReady);
  const playingGames = usePresenceStore(s => s.playingGames);
```

Replace with:
```typescript
  const friends           = useFriendStore(useShallow(s => s.friends));
  const pendingIncoming   = useFriendStore(useShallow(s => s.pendingIncoming));
  const pendingSent       = useFriendStore(useShallow(s => s.pendingSent));
  const sendFriendRequest = useFriendStore(s => s.sendFriendRequest);
  const removeFriend      = useFriendStore(s => s.removeFriend);
  const counts            = useUnreadStore(useShallow(s => s.counts));
  const clear             = useUnreadStore(s => s.clear);
  const typing            = useTypingStore(useShallow(s => s.typing));
  const { status: myStatus, setStatus: setMyStatus } = useStatusStore();
  const onlineIds         = usePresenceStore(s => s.onlineIds);
  const presenceReady     = usePresenceStore(s => s.presenceReady);
  const playingGames      = usePresenceStore(s => s.playingGames);
```

Note: `onlineIds`, `presenceReady`, and `playingGames` remain here temporarily — they move to `FriendItem` in Task 3. `counts`, `typing`, and `removeFriend` also move to `FriendItem` in Task 3, but are needed here for the build to pass between tasks.

- [ ] **Step 4: Build check**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app" && pnpm build 2>&1 | tail -4
```

Expected: `✓ built in`

- [ ] **Step 5: Commit**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app" && git add src/components/chat/Sidebar.tsx && git commit -m "perf: add useShallow selectors in Sidebar.tsx"
```

---

## Task 3 — Extract memoized `FriendItem` from `Sidebar.tsx`

**Files:**
- Modify: `src/components/chat/Sidebar.tsx`

The friend list `{friends.map(...)}` block at lines 591–658 has inline JSX that reads from four stores. Any presence sync, typing update, or unread increment re-renders all friends. Extract to a memoized component where each instance subscribes only to primitive slices for its own friend ID.

- [ ] **Step 1: Add the `FriendItem` component**

Find `function StatusLine` at line 701. Insert the following block **directly before** it (leave a blank line before `function StatusLine`):

```typescript
// ── FriendItem ─────────────────────────────────────────────────────────────────
// Memoized per-friend row. Each instance subscribes to primitive selectors
// for its own friend.id so only the affected row re-renders on presence/typing/
// unread changes.

interface FriendItemProps {
  friend: Profile;
  isSelected: boolean;
  onSelect: (friend: Profile) => void;
  currentUserId: string;
}

const FriendItem = memo(function FriendItem({
  friend, isSelected, onSelect, currentUserId,
}: FriendItemProps) {
  const isOnline      = usePresenceStore(s => s.onlineIds.has(friend.id));
  const presenceReady = usePresenceStore(s => s.presenceReady);
  const playingGame   = usePresenceStore(s => s.playingGames.get(friend.id) ?? null);
  const isTyping      = useTypingStore(s => s.typing[friend.id] === true);
  const unread        = useUnreadStore(s => s.counts[friend.id] ?? 0);
  const removeFriend  = useFriendStore(s => s.removeFriend);
  const [isHovered, setIsHovered] = useState(false);

  const storedStatus = (friend.status as Status | undefined) ?? 'online';
  const effectiveStatus: Status = presenceReady && !isOnline ? 'offline' : storedStatus;

  return (
    <button
      onClick={() => onSelect(friend)}
      className="flex w-full items-center gap-3 rounded-aero px-3 py-3 text-left transition-all duration-150"
      style={isSelected ? {
        background: 'linear-gradient(135deg, rgba(26,111,212,0.16) 0%, rgba(0,190,255,0.12) 100%)',
        boxShadow: 'inset 0 0 0 1.5px rgba(26,111,212,0.30), 0 2px 8px rgba(26,111,212,0.10)',
      } : {}}
      onMouseEnter={e => { setIsHovered(true); if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--hover-bg)'; }}
      onMouseLeave={e => { setIsHovered(false); if (!isSelected) (e.currentTarget as HTMLElement).style.background = ''; }}
    >
      <AvatarImage
        username={friend.username}
        avatarUrl={friend.avatar_url}
        size="xl"
        status={effectiveStatus}
        playingGame={playingGame}
      />

      <div className="min-w-0 flex-1">
        <p className="truncate font-bold" style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: 14, color: 'var(--text-primary)', letterSpacing: '-0.1px' }}>
          {friend.username}
        </p>
        {isTyping ? (
          <p className="flex items-center gap-1 mt-0.5" style={{ fontSize: 11, color: '#1a6fd4', fontStyle: 'italic' }}>
            <span className="typing-dots" style={{ color: '#1a6fd4' }}>
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </span>
            <span>typing…</span>
          </p>
        ) : (
          <StatusLine status={effectiveStatus} playingGame={playingGame} />
        )}
      </div>

      {isHovered && unread === 0 && (
        <button
          onClick={e => { e.stopPropagation(); removeFriend(currentUserId, friend.id); }}
          className="rounded-aero p-1 transition-all shrink-0"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#e03f3f'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
          title="Remove friend"
        >
          <UserMinus className="h-3.5 w-3.5" />
        </button>
      )}

      {unread > 0 && (
        <span
          className="flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold shrink-0"
          style={{ background: 'var(--badge-bg)', color: 'var(--badge-text)', boxShadow: '0 1px 6px rgba(0,80,200,0.30)' }}
        >
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  );
});

```

- [ ] **Step 2: Replace the friend list `map` block in `Sidebar`**

Find this block inside the `Sidebar` function (approximately lines 591–658):
```typescript
            {friends.map(friend => {
              // Use presence to determine if actually connected; fall back to stored status before presence syncs
              const storedStatus = (friend.status as Status | undefined) ?? 'online';
              const effectiveStatus: Status = presenceReady && !onlineIds.has(friend.id) ? 'offline' : storedStatus;
              const isSelected = selectedUser?.id === friend.id;
              const unread = counts[friend.id] ?? 0;
              const isTyping = typing[friend.id] === true;
              const isHovered = hoveredFriend === friend.id;

              return (
                <button
                  key={friend.id}
                  onClick={() => { onSelectUser(friend); clear(friend.id); }}
```

Replace the entire `{friends.map(friend => { ... })}` block (from `{friends.map` through the closing `})}`) with:
```tsx
            {friends.map(f => (
              <FriendItem
                key={f.id}
                friend={f}
                isSelected={selectedUser?.id === f.id}
                onSelect={f => { onSelectUser(f); clear(f.id); }}
                currentUserId={user!.id}
              />
            ))}
```

- [ ] **Step 3: Remove now-unused state and store subscriptions from `Sidebar`**

After Step 2, the following are no longer used in `Sidebar` directly. Remove them:

Remove from the store subscriptions block:
```typescript
  const removeFriend      = useFriendStore(s => s.removeFriend);
  const counts            = useUnreadStore(useShallow(s => s.counts));
  const typing            = useTypingStore(useShallow(s => s.typing));
  const onlineIds         = usePresenceStore(s => s.onlineIds);
  const presenceReady     = usePresenceStore(s => s.presenceReady);
  const playingGames      = usePresenceStore(s => s.playingGames);
```

Remove from the `useState` declarations block (around line 75):
```typescript
  const [hoveredFriend,   setHoveredFriend]   = useState<string | null>(null);
```

After removal, verify that `useTypingStore`, `usePresenceStore` imports at the top are still needed — `useTypingStore` is only used in `FriendItem` now (which is in the same file), so the import stays. `usePresenceStore` is also in `FriendItem`, so it stays.

- [ ] **Step 4: Build check**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app" && pnpm build 2>&1 | tail -4
```

Expected: `✓ built in` — no TypeScript errors.

If you see "property X does not exist" or "Cannot find name X" — check that the removed variables are not referenced elsewhere in `Sidebar`. The TypeScript compiler will tell you exactly which lines.

- [ ] **Step 5: Commit**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app" && git add src/components/chat/Sidebar.tsx && git commit -m "perf: extract memoized FriendItem with per-item primitive selectors"
```

---

## Task 4 — `useShallow` + `MessageItem` extraction in `ChatWindow.tsx`

**Files:**
- Modify: `src/components/chat/ChatWindow.tsx`

Three changes in one commit:
1. Fix the `usePresenceStore` full destructure at line 200
2. Add `reactionsRef` to stabilize `toggleReaction`'s deps
3. Extract memoized `MessageItem` with local hover + picker state

- [ ] **Step 1: Add `memo` and `useShallow` imports**

Find line 1:
```typescript
import { useState, useEffect, useRef, useCallback } from 'react';
```

Replace with:
```typescript
import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
```

Find the existing `usePresenceStore` import line:
```typescript
import { usePresenceStore } from '../../store/presenceStore';
```

Add directly after it:
```typescript
import { useShallow } from 'zustand/react/shallow';
```

- [ ] **Step 2: Fix store subscriptions at lines ~197–200**

Find:
```typescript
  const { friends } = useFriendStore();
  const { gameViewActive, gameChatOverlay } = useCornerStore();
  const { inputDeviceId, outputDeviceId, noiseCancellation, inputVolume, outputVolume } = useAudioStore();
  const { playingGames, onlineIds, presenceReady } = usePresenceStore();
```

Replace with:
```typescript
  const friends       = useFriendStore(useShallow(s => s.friends));
  const { gameViewActive, gameChatOverlay } = useCornerStore();
  const { inputDeviceId, outputDeviceId, noiseCancellation, inputVolume, outputVolume } = useAudioStore();
  const playingGames  = usePresenceStore(s => s.playingGames);
  const onlineIds     = usePresenceStore(s => s.onlineIds);
  const presenceReady = usePresenceStore(s => s.presenceReady);
```

- [ ] **Step 3: Delete `hoveredMsgId` and `reactionPickerFor` state**

Find and remove these two lines (around lines 231–232):
```typescript
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  ...
  const [hoveredMsgId,      setHoveredMsgId]      = useState<string | null>(null);
```

(They are not adjacent — search for each by name and delete both.)

- [ ] **Step 4: Add `reactionsRef` and stabilize `toggleReaction`**

Find the line after the `reactions` useState declaration (around line 228):
```typescript
  const [reactions,         setReactions]         = useState<ReactionsMap>({});
```

Add directly after it:
```typescript
  const reactionsRef = useRef<ReactionsMap>({});
  reactionsRef.current = reactions;
```

Find the existing `toggleReaction` useCallback (around line 550):
```typescript
  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!user) return;
    const alreadyReacted = reactions[messageId]?.[emoji]?.includes(user.id);
    if (alreadyReacted) {
      await supabase.from('reactions').delete()
        .eq('message_id', messageId).eq('user_id', user.id).eq('emoji', emoji);
      setReactions(prev => {
        const next = { ...prev, [messageId]: { ...prev[messageId] } };
        next[messageId][emoji] = (next[messageId][emoji] ?? []).filter(id => id !== user.id);
        return next;
      });
    } else {
      await supabase.from('reactions').insert({ message_id: messageId, user_id: user.id, emoji });
      setReactions(prev => {
        const next = { ...prev, [messageId]: { ...prev[messageId] } };
        next[messageId][emoji] = [...(next[messageId][emoji] ?? []), user.id];
        return next;
      });
      spawnBubble(emoji, messageId);
    }
    setReactionPickerFor(null);
  }, [user, reactions, spawnBubble]);
```

Replace with:
```typescript
  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!user) return;
    const alreadyReacted = reactionsRef.current[messageId]?.[emoji]?.includes(user.id);
    if (alreadyReacted) {
      await supabase.from('reactions').delete()
        .eq('message_id', messageId).eq('user_id', user.id).eq('emoji', emoji);
      setReactions(prev => {
        const next = { ...prev, [messageId]: { ...prev[messageId] } };
        next[messageId][emoji] = (next[messageId][emoji] ?? []).filter(id => id !== user.id);
        return next;
      });
    } else {
      await supabase.from('reactions').insert({ message_id: messageId, user_id: user.id, emoji });
      setReactions(prev => {
        const next = { ...prev, [messageId]: { ...prev[messageId] } };
        next[messageId][emoji] = [...(next[messageId][emoji] ?? []), user.id];
        return next;
      });
      spawnBubble(emoji, messageId);
    }
    // picker state is now local to each MessageItem — no setReactionPickerFor needed
  }, [user, spawnBubble]);
```

- [ ] **Step 5: Add `itemList` useMemo after the `reactions` state**

Find the block of `useRef` declarations (around line 238, after all useState declarations):
```typescript
  const bottomRef          = useRef<HTMLDivElement>(null);
```

Insert directly **before** `const bottomRef`:
```typescript
  const itemList = useMemo(() =>
    messages.map((msg, i) => ({
      msg,
      showDate: i === 0 ||
        new Date(msg.created_at).toDateString() !== new Date(messages[i - 1].created_at).toDateString(),
    })),
  [messages]);

```

- [ ] **Step 6: Add the `MessageItem` component**

Find the `VoicePlayer` function definition at line 76:
```typescript
function VoicePlayer({ content, isMine, outputVolume, outputDeviceId }: { ... }) {
```

Insert the following block **directly before** it:

```typescript
// ── MessageItem ────────────────────────────────────────────────────────────────
// Memoized per-message row. Owns its own hover + reaction picker state so that
// hovering any message does not re-render the rest of the list.

interface MessageItemProps {
  msg: Message;
  isMine: boolean;
  showDate: boolean;
  msgReactions: Record<string, string[]>;
  isLastMessage: boolean;
  historyLoaded: boolean;
  contact: Profile;
  user: Profile;
  outputVolume: number;
  outputDeviceId: string;
  toggleReaction: (msgId: string, emoji: string) => void;
  setLightboxImage: (img: { url: string; name: string; size: number } | null) => void;
  setPendingLinkUrl: (url: string | null) => void;
}

const MessageItem = memo(function MessageItem({
  msg, isMine, showDate, msgReactions, isLastMessage, historyLoaded,
  contact, user, outputVolume, outputDeviceId,
  toggleReaction, setLightboxImage, setPendingLinkUrl,
}: MessageItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const hasReactions = Object.values(msgReactions).some(users => users.length > 0);

  return (
    <div>
      {showDate && (
        <div className="my-4 flex items-center gap-3" style={{ position: 'relative', zIndex: 1 }}>
          <div className="flex-1 h-px" style={{ background: 'var(--date-sep-line)' }} />
          <span style={{ fontSize: 10, color: 'var(--date-sep-text)', fontWeight: 500, letterSpacing: '0.04em', whiteSpace: 'nowrap', fontFamily: 'Inter, system-ui, sans-serif' }}>
            {formatDateLabel(new Date(msg.created_at))}
          </span>
          <div className="flex-1 h-px" style={{ background: 'var(--date-sep-line)' }} />
        </div>
      )}
      <div
        data-msg-id={msg.id}
        className={`relative flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'} ${isLastMessage && historyLoaded ? 'animate-slide-up' : ''}`}
        style={{ position: 'relative', zIndex: 1 }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => { setIsHovered(false); setPickerOpen(false); }}
      >
        {!isMine && <AvatarImage username={contact.username} avatarUrl={contact.avatar_url} size="sm" />}

        <div className="flex flex-col" style={{ alignItems: isMine ? 'flex-end' : 'flex-start', maxWidth: '65%' }}>
          <div className={`rounded-aero-lg px-4 py-2.5${isMine ? ' sent-bubble-gloss' : ''}`}
            style={isMine ? {
              background: 'linear-gradient(165deg, #72e472 0%, #28b828 100%)',
              boxShadow: '0 3px 14px rgba(30,160,30,0.35), inset 0 1px 0 rgba(255,255,255,0.50)',
              border: '1px solid rgba(80,210,80,0.55)',
              borderBottomRightRadius: 4,
            } : {
              background: 'var(--recv-bg)',
              boxShadow: '0 2px 10px rgba(0,80,160,0.10), inset 0 1px 0 rgba(255,255,255,0.50)',
              border: '1px solid var(--recv-border)',
              borderBottomLeftRadius: 4,
            }}>
            {isVoiceMessage(msg.content)
              ? <VoicePlayer content={msg.content} isMine={isMine} outputVolume={outputVolume} outputDeviceId={outputDeviceId} />
              : isFileMessage(msg.content)
              ? <FileMessage content={msg.content} isMine={isMine} onImageClick={setLightboxImage} />
              : msg.content.startsWith(CHESS_INVITE_PREFIX) && !isMine
              ? (() => {
                  const parts = msg.content.split(':');
                  const gameId = parts[1] ?? '';
                  const inviter = parts.slice(2).join(':');
                  return <ChessInviteCard gameId={gameId} inviterUsername={inviter} />;
                })()
              : msg.content.startsWith(CHESS_INVITE_PREFIX) && isMine
              ? <p className="text-sm leading-relaxed break-words" style={{ color: 'rgba(255,255,255,0.65)', fontStyle: 'italic', fontFamily: 'Inter, system-ui, sans-serif' }}>
                  ♟️ Chess invite sent
                </p>
              : msg.content === '[decryption failed]'
              ? (
                <p className="text-sm leading-relaxed break-words" style={{ color: isMine ? '#fff' : 'var(--recv-text)', fontFamily: 'Inter, system-ui, sans-serif' }}>
                  <span style={{ opacity: 0.55, fontStyle: 'italic', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}><Lock style={{ width: 11, height: 11 }} />Encrypted with a previous key</span>
                </p>
              )
              : (
                <MessageContent
                  content={msg.content}
                  isMine={isMine}
                  textColor={isMine ? '#fff' : 'var(--recv-text)'}
                  onClickLink={setPendingLinkUrl}
                />
              )
            }
            <p className="mt-0.5 flex items-center justify-end gap-1 text-[10px]" style={{ color: isMine ? 'rgba(255,255,255,0.62)' : 'var(--recv-time)' }}>
              {msg.expires_at && (
                <span title={`Expires ${new Date(msg.expires_at).toLocaleString()}`} style={{ display: 'flex', alignItems: 'center' }}>
                  <Timer style={{ width: 9, height: 9, opacity: 0.7 }} />
                </span>
              )}
              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {isMine && (
                <span style={{ fontSize: 10, letterSpacing: '-1px', color: msg.read_at ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.50)' }}>
                  {msg.read_at ? ' ✓✓' : ' ✓'}
                </span>
              )}
            </p>
          </div>

          {hasReactions && (
            <div className="flex flex-wrap gap-1 mt-1" style={{ justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
              {Object.entries(msgReactions).filter(([, users]) => users.length > 0).map(([emoji, users]) => {
                const mine = users.includes(user.id);
                return (
                  <button
                    key={emoji}
                    onClick={() => toggleReaction(msg.id, emoji)}
                    className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 transition-all active:scale-90"
                    style={{
                      background: mine ? 'rgba(0,212,255,0.18)' : 'var(--reaction-idle-bg)',
                      border: `1px solid ${mine ? 'rgba(0,212,255,0.45)' : 'var(--reaction-idle-border)'}`,
                      fontSize: 13,
                    }}
                  >
                    <span>{emoji}</span>
                    <span style={{ color: mine ? '#00d4ff' : 'var(--text-secondary)', fontSize: 10, fontWeight: 600, marginLeft: 2 }}>{users.length}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {isHovered && (
          <div className="relative flex-shrink-0" style={{ order: isMine ? -1 : 1 }}>
            <button
              onClick={() => setPickerOpen(prev => !prev)}
              className="flex h-6 w-6 items-center justify-center rounded-full text-sm transition-all hover:scale-110 active:scale-95"
              style={{ background: 'var(--btn-ghost-bg)', border: '1px solid var(--btn-ghost-border)', color: 'var(--text-secondary)' }}
            >
              +
            </button>
            {pickerOpen && (
              <div
                className="absolute z-30 flex gap-1 rounded-aero-lg p-2 shadow-xl"
                style={{
                  background: 'var(--popup-bg)',
                  border: '1px solid var(--popup-border)',
                  backdropFilter: 'blur(16px)',
                  bottom: '110%',
                  ...(isMine ? { right: 0 } : { left: 0 }),
                  whiteSpace: 'nowrap',
                }}
              >
                {REACTION_EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => toggleReaction(msg.id, emoji)}
                    className="flex h-8 w-8 items-center justify-center rounded-aero text-lg transition-all hover:scale-125 active:scale-95"
                    style={{ background: msgReactions[emoji]?.includes(user.id) ? 'rgba(0,212,255,0.18)' : 'transparent' }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

```

- [ ] **Step 7: Replace the message list `map` in the JSX**

Find the entire block starting with:
```typescript
        {messages.map((msg, i) => {
          const isMine = msg.sender_id === user?.id;
          const showDate = i === 0 || new Date(msg.created_at).toDateString() !== new Date(messages[i - 1].created_at).toDateString();
          const msgReactions = reactions[msg.id] ?? {};
          const hasReactions = Object.values(msgReactions).some(users => users.length > 0);
          return (
```

And ending with the closing `})}` of the map (after the `</div>` at the end of the return). Replace the entire block with:

```tsx
        {itemList.map((item, i) => (
          <MessageItem
            key={item.msg.id}
            msg={item.msg}
            isMine={item.msg.sender_id === user?.id}
            showDate={item.showDate}
            msgReactions={reactions[item.msg.id] ?? {}}
            isLastMessage={i === itemList.length - 1}
            historyLoaded={historyLoadedRef.current}
            contact={contact}
            user={user!}
            outputVolume={outputVolume}
            outputDeviceId={outputDeviceId}
            toggleReaction={toggleReaction}
            setLightboxImage={setLightboxImage}
            setPendingLinkUrl={setPendingLinkUrl}
          />
        ))}
```

- [ ] **Step 8: Build check**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app" && pnpm build 2>&1 | tail -6
```

Expected: `✓ built in` — no TypeScript errors.

If you see "Cannot find name 'hoveredMsgId'" or "Cannot find name 'reactionPickerFor'" — search the file for any remaining references to those deleted variables and remove them.

- [ ] **Step 9: Commit**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app" && git add src/components/chat/ChatWindow.tsx && git commit -m "perf: extract memoized MessageItem, stabilize toggleReaction, add itemList"
```

---

## Task 5 — Presence throttle when hidden (`App.tsx`)

**Files:**
- Modify: `src/App.tsx`

When `document.hidden`, every Supabase presence sync still calls `setOnlineIds()` / `setPlayingGames()`, triggering re-renders in all presence subscribers. Skip those updates while hidden; flush the latest state the moment the tab returns to visibility.

- [ ] **Step 1: Add `pendingPresenceSync` ref**

Find line 23:
```typescript
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
```

Add directly after it:
```typescript
  const pendingPresenceSync = useRef(false);
```

- [ ] **Step 2: Extract `syncPresenceState` helper inside the presence useEffect**

Find the presence `useEffect` that starts with:
```typescript
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
        // Skip re-render if playing games map hasn't changed
        const prevGames = usePresenceStore.getState().playingGames;
        const gamesChanged = newGames.size !== prevGames.size ||
          [...newGames.entries()].some(([k, v]) => prevGames.get(k) !== v);
        if (gamesChanged) setPlayingGames(newGames);
      })
```

Replace the entire `.on('presence', { event: 'sync' }, () => { ... })` callback with this refactored version that extracts a helper and adds the hidden check:

```typescript
  useEffect(() => {
    if (!user) return;
    const { setOnlineIds, setPresenceReady, setPlayingGames } = usePresenceStore.getState();

    function syncPresenceState(state: ReturnType<typeof channel.presenceState>) {
      const newIds = new Set(Object.keys(state));
      const prev = usePresenceStore.getState().onlineIds;
      const changed = newIds.size !== prev.size || [...newIds].some(id => !prev.has(id));
      if (changed) setOnlineIds(newIds);
      setPresenceReady(true);
      const newGames = new Map<string, string>();
      for (const [userId, presences] of Object.entries(state)) {
        const p = (presences as any[])[0];
        if (p?.playingGame) newGames.set(userId, p.playingGame);
      }
      const prevGames = usePresenceStore.getState().playingGames;
      const gamesChanged = newGames.size !== prevGames.size ||
        [...newGames.entries()].some(([k, v]) => prevGames.get(k) !== v);
      if (gamesChanged) setPlayingGames(newGames);
    }

    const channel = supabase
      .channel('global:online', { config: { presence: { key: user.id } } })
      .on('presence', { event: 'sync' }, () => {
        if (document.hidden) {
          pendingPresenceSync.current = true;
          return;
        }
        syncPresenceState(channel.presenceState());
      })
```

Keep the rest of the useEffect (`.subscribe(...)`, `presenceChannelRef.current = channel`, `return () => { supabase.removeChannel(channel); }`) unchanged. The `syncPresenceState` function is declared inside the `useEffect` so it closes over `channel` — this is intentional and required since `channel` is only defined inside the effect.

- [ ] **Step 3: Add flush to the existing `visibilitychange` handler**

Find the existing `visibilitychange` useEffect at the top of `App`:
```typescript
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

Replace with:
```typescript
  useEffect(() => {
    const handler = () => {
      document.documentElement.classList.toggle('paused', document.hidden)
      document.dispatchEvent(
        new CustomEvent('aerochat:visibilitychange', { detail: { hidden: document.hidden } })
      )
      // Flush any presence sync that was skipped while the tab was hidden
      if (!document.hidden && pendingPresenceSync.current) {
        pendingPresenceSync.current = false;
        const ch = presenceChannelRef.current;
        if (ch) {
          const { setOnlineIds, setPresenceReady, setPlayingGames } = usePresenceStore.getState();
          const state = ch.presenceState();
          const newIds = new Set(Object.keys(state));
          const prev = usePresenceStore.getState().onlineIds;
          const changed = newIds.size !== prev.size || [...newIds].some(id => !prev.has(id));
          if (changed) setOnlineIds(newIds);
          setPresenceReady(true);
          const newGames = new Map<string, string>();
          for (const [userId, presences] of Object.entries(state)) {
            const p = (presences as any[])[0];
            if (p?.playingGame) newGames.set(userId, p.playingGame);
          }
          const prevGames = usePresenceStore.getState().playingGames;
          const gamesChanged = newGames.size !== prevGames.size ||
            [...newGames.entries()].some(([k, v]) => prevGames.get(k) !== v);
          if (gamesChanged) setPlayingGames(newGames);
        }
      }
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [])
```

Note: The flush logic repeats the sync body because `syncPresenceState` is defined inside the other `useEffect`'s closure and is not accessible here. This is intentional — the two effects have different lifecycles. The duplication is small (12 lines) and avoids moving `syncPresenceState` to module scope where it would require different plumbing.

- [ ] **Step 4: Build check**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app" && pnpm build 2>&1 | tail -4
```

Expected: `✓ built in`

- [ ] **Step 5: Commit**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app" && git add src/App.tsx && git commit -m "perf: skip presence sync updates when tab is hidden, flush on return"
```

---

## Task 6 — Virtualize message list (`ChatWindow.tsx`)

**Files:**
- Modify: `src/components/chat/ChatWindow.tsx`

**Prerequisite:** Task 1 must be complete (`@tanstack/react-virtual` installed).

Replace the `bottomRef` scroll-to-bottom approach with `useVirtualizer`. Only the visible window of messages is mounted in the DOM; off-screen messages are unmounted automatically.

- [ ] **Step 1: Add the `useVirtualizer` import**

Find the existing import block at the top of `ChatWindow.tsx`. Add after the last import line:
```typescript
import { useVirtualizer } from '@tanstack/react-virtual';
```

- [ ] **Step 2: Replace `bottomRef` with `chatAreaRef` and move it above `itemList`**

Find:
```typescript
  const itemList = useMemo(() =>
    messages.map((msg, i) => ({
      msg,
      showDate: i === 0 ||
        new Date(msg.created_at).toDateString() !== new Date(messages[i - 1].created_at).toDateString(),
    })),
  [messages]);

  const chatAreaRef        = useRef<HTMLDivElement>(null);
```

Replace with (note: `chatAreaRef` moves above `itemList` so `useVirtualizer` can reference it safely):
```typescript
  const chatAreaRef        = useRef<HTMLDivElement>(null);

  const itemList = useMemo(() =>
    messages.map((msg, i) => ({
      msg,
      showDate: i === 0 ||
        new Date(msg.created_at).toDateString() !== new Date(messages[i - 1].created_at).toDateString(),
    })),
  [messages]);
```

- [ ] **Step 3: Add `useVirtualizer` hook after `itemList`**

Find the `itemList` useMemo (now after `chatAreaRef`):
```typescript
  const itemList = useMemo(() =>
    messages.map((msg, i) => ({
      msg,
      showDate: i === 0 ||
        new Date(msg.created_at).toDateString() !== new Date(messages[i - 1].created_at).toDateString(),
    })),
  [messages]);
```

Add directly after it:
```typescript
  const virtualizer = useVirtualizer({
    count: itemList.length,
    getScrollElement: () => chatAreaRef.current,
    estimateSize: () => 72,
    overscan: 8,
    measureElement: el => el.getBoundingClientRect().height,
  });
```

- [ ] **Step 4: Replace the scroll-to-bottom `useEffect`**

Find:
```typescript
  // Scroll to bottom — instant for history loads, smooth only for new realtime messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: historyLoadedRef.current ? 'smooth' : 'instant' });
  }, [messages, contactTyping]);
```

Replace with:
```typescript
  // Scroll to bottom — only when near bottom or on initial load
  useEffect(() => {
    if (itemList.length === 0) return;
    const el = chatAreaRef.current;
    if (!el) return;
    const nearBottom = !historyLoadedRef.current ||
      el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    if (nearBottom) {
      virtualizer.scrollToIndex(itemList.length - 1, { align: 'end' });
    }
  }, [itemList.length, contactTyping]);
```

- [ ] **Step 5: Add `ref` to the scroll container div and remove `space-y-1`**

Find the messages scroll container (the div with `data-bubble-container`):
```tsx
      <div
        data-bubble-container=""
        className="flex-1 overflow-y-auto scrollbar-aero px-6 py-4 space-y-1"
        style={{ position: 'relative' }}
      >
```

Replace with:
```tsx
      <div
        ref={chatAreaRef}
        data-bubble-container=""
        className="flex-1 overflow-y-auto scrollbar-aero px-6 py-4"
        style={{ position: 'relative' }}
      >
```

(`space-y-1` is removed because items are absolutely positioned by the virtualizer — spacing is handled by `paddingBottom` on each virtual item wrapper in Step 6.)

- [ ] **Step 6: Replace the message list rendering with virtual items**

Find the `{itemList.map((item, i) => (` block added in Task 4 and replace it with the virtual version:

```tsx
        {itemList.length > 0 && (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
            {virtualizer.getVirtualItems().map(vItem => {
              const item = itemList[vItem.index];
              return (
                <div
                  key={vItem.key}
                  data-index={vItem.index}
                  ref={virtualizer.measureElement}
                  style={{ position: 'absolute', top: vItem.start, width: '100%', paddingBottom: 4 }}
                >
                  <MessageItem
                    msg={item.msg}
                    isMine={item.msg.sender_id === user?.id}
                    showDate={item.showDate}
                    msgReactions={reactions[item.msg.id] ?? {}}
                    isLastMessage={vItem.index === itemList.length - 1}
                    historyLoaded={historyLoadedRef.current}
                    contact={contact}
                    user={user!}
                    outputVolume={outputVolume}
                    outputDeviceId={outputDeviceId}
                    toggleReaction={toggleReaction}
                    setLightboxImage={setLightboxImage}
                    setPendingLinkUrl={setPendingLinkUrl}
                  />
                </div>
              );
            })}
          </div>
        )}
```

- [ ] **Step 7: Remove the `<div ref={bottomRef} />` sentinel element**

Find and delete this line (near the bottom of the scroll container, just before the closing `</div>`):
```tsx
        <div ref={bottomRef} />
```

- [ ] **Step 8: Build check**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app" && pnpm build 2>&1 | tail -6
```

Expected: `✓ built in` — no TypeScript errors.

Common issues:
- `virtualizer` referenced before `chatAreaRef` is declared: move `useVirtualizer` to after `chatAreaRef` declaration, or declare `chatAreaRef` before `itemList`.
- `bottomRef` still referenced somewhere: search for `bottomRef` and remove any remaining references.

- [ ] **Step 9: Run all tests**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app" && pnpm test --run 2>&1 | tail -8
```

Expected: all existing tests pass (gameInstalls, cardGradients, authStore, callStore, friendStore.card).

- [ ] **Step 10: Commit**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app" && git add src/components/chat/ChatWindow.tsx && git commit -m "perf: virtualize message list with @tanstack/react-virtual"
```

---

## Self-Review Notes

- `chatAreaRef` is declared above `itemList` and `useVirtualizer` in Task 6 Step 2 so TypeScript sees it in scope when `getScrollElement` references it. Do not reorder these declarations.

- The `syncPresenceState` logic is duplicated between Task 5 Steps 2 and 3. This is intentional — the alternative (extracting to module scope) would require passing store setters as arguments, which is more complex for no gain. The duplication is small and contained.

- `historyLoadedRef.current` is passed as the `historyLoaded` prop to `MessageItem`. Since it's a ref value read at render time (not reactive), it will be `false` for all items on initial render and `true` thereafter. The animate-slide-up class only applies to the last message after initial load — this is the same behavior as before.
