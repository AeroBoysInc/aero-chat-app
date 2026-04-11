# Mobile-Responsive UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the broken mobile layout and make AeroChat fully usable on phones — friends list, chat, calls, settings, friend requests.

**Architecture:** Fix the core flex layout (sticky header + sticky composer via `100dvh` + flex-col), add a collapsible profile card to Sidebar, add mobile-specific renders for calls (full-screen + chat toggle), incoming call modals (full-screen takeover), and settings/friend-requests (full-screen pages). All changes are behind the existing `useIsMobile()` hook — desktop is untouched.

**Tech Stack:** React 19, Zustand, Tailwind CSS, CSS custom properties, `100dvh` viewport units

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/index.css` | Add `dvh` utility class, safe-area CSS, mobile orb limit |
| `src/components/chat/ChatLayout.tsx` | Fix mobile flex container, route group chats + calls on mobile, add settings/requests as full-screen pages |
| `src/components/chat/Sidebar.tsx` | Collapsible profile card (collapsed/expanded), mobile settings routing |
| `src/components/chat/ChatWindow.tsx` | Fix flex layout so header and composer are sticky, messages-only scroll |
| `src/components/chat/GroupChatWindow.tsx` | Add `onBack` prop, fix flex layout matching ChatWindow |
| `src/components/call/CallView.tsx` | Mobile full-screen overlay with chat toggle |
| `src/components/call/GroupCallView.tsx` | Mobile full-screen overlay with 2x2 grid + chat toggle |
| `src/components/call/CallControls.tsx` | Add `onToggleChatMobile` prop for mobile chat toggle button |
| `src/components/call/IncomingCallModal.tsx` | Full-screen takeover on mobile |
| `src/components/call/IncomingGroupCallModal.tsx` | Full-screen takeover on mobile |
| `src/components/call/MiniCallWidget.tsx` | Add mobile bar variant |
| `src/components/chat/FriendRequestModal.tsx` | Full-screen page on mobile |

---

### Task 1: CSS Foundations — dvh utility + safe areas

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Add dvh height utility and safe-area padding**

At the end of `src/index.css` (after all existing styles), add:

```css
/* ── Mobile viewport ─────────────────────────────── */
.h-dvh {
  height: 100vh; /* fallback */
  height: 100dvh;
}

.safe-top    { padding-top:    env(safe-area-inset-top, 0px); }
.safe-bottom { padding-bottom: env(safe-area-inset-bottom, 0px); }

/* Cap orbs on mobile to save GPU */
@media (max-width: 767px) {
  .orb:nth-child(n+3) { display: none; }
}
```

- [ ] **Step 2: Verify the dev server compiles cleanly**

Run: `cd /home/dejanandovski/Code\ Repo/aero-chat-app && pnpm build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app"
git add src/index.css
git commit -m "feat(mobile): add dvh utility, safe-area padding, mobile orb cap"
```

---

### Task 2: Fix ChatLayout mobile — dvh + group chats + calls routing

**Files:**
- Modify: `src/components/chat/ChatLayout.tsx:184-220`

The current mobile branch (line 184-220) has these problems:
1. Uses `h-screen` instead of `100dvh` (browser address bar hides content)
2. Only handles 1:1 chat — doesn't render GroupChatWindow when a group is selected
3. Doesn't render CallView or GroupCallView on mobile
4. Doesn't render IncomingCallModal or IncomingGroupCallModal
5. No settings or friend-requests routing

- [ ] **Step 1: Replace the mobile `if (isMobile)` block**

Replace lines 184-220 (the entire `if (isMobile) { return (...) }` block) with:

```tsx
  // ── Mobile layout — single-pane slide navigation ──────────────────────────
  if (isMobile) {
    // Determine which chat component to show
    const chatContent = selectedGroupId ? (
      <GroupChatWindow groupId={selectedGroupId} onBack={() => setMobilePaneShowChat(false)} />
    ) : selectedContact ? (
      <ChatWindow contact={selectedContact} onBack={() => setMobilePaneShowChat(false)} />
    ) : null;

    return (
      <div className="h-dvh safe-top safe-bottom relative overflow-hidden" style={{ background: 'var(--sidebar-bg)' }}>

        {/* Theme switcher — top right */}
        <div className="fixed top-3 right-3 z-50">
          <ThemeSwitcher />
        </div>

        {/* Sidebar pane — slides out left when chat opens */}
        <div style={{
          position: 'absolute', inset: 0,
          transform: mobilePaneShowChat ? 'translateX(-100%)' : 'translateX(0)',
          transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}>
          <Sidebar selectedUser={selectedContact} onSelectUser={setSelectedContact} isMobile />
        </div>

        {/* Chat pane — slides in from right */}
        <div style={{
          position: 'absolute', inset: 0,
          transform: mobilePaneShowChat ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex', flexDirection: 'column',
        }}>
          {chatContent}
        </div>

        {/* 1:1 Call — full-screen overlay */}
        {callActive && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
            <CallView />
          </div>
        )}

        {/* Group Call — full-screen overlay */}
        {groupCallActive && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
            <GroupCallView />
          </div>
        )}

        {/* Group Call ringing modal */}
        {groupCallStatus === 'ringing' && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
            <GroupCallView />
          </div>
        )}

        {/* Friend requests */}
        {requestsOpen && <FriendRequestModal onClose={() => setRequestsOpen(false)} />}
      </div>
    );
  }
```

- [ ] **Step 2: Also slide to chat pane on group selection**

Find the existing `useEffect` that handles `selectedContact` (around line 146-148):

```ts
  useEffect(() => {
    if (isMobile && selectedContact) setMobilePaneShowChat(true);
  }, [selectedContact, isMobile]);
```

Replace with:

```ts
  useEffect(() => {
    if (isMobile && (selectedContact || selectedGroupId)) setMobilePaneShowChat(true);
  }, [selectedContact, selectedGroupId, isMobile]);
```

- [ ] **Step 3: Verify build compiles**

Run: `cd /home/dejanandovski/Code\ Repo/aero-chat-app && pnpm build`
Expected: Build succeeds. There will be a TypeScript error because `GroupChatWindow` doesn't accept `onBack` yet — that's Task 4.

- [ ] **Step 4: Commit**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app"
git add src/components/chat/ChatLayout.tsx
git commit -m "feat(mobile): fix ChatLayout - dvh, group chats, calls, full-screen routing"
```

---

### Task 3: Fix ChatWindow flex layout — sticky header + composer

**Files:**
- Modify: `src/components/chat/ChatWindow.tsx:1480-1481,1708,1779`

The root `<div>` at line 1480 uses `h-full` which doesn't constrain height on mobile when the parent is absolutely positioned. The messages area at line 1708 uses `flex-1 overflow-y-auto` which is correct, but the container isn't forcing a fixed height.

- [ ] **Step 1: Fix the root container**

At line 1480, change:
```tsx
    <div className="flex h-full flex-col">
```
to:
```tsx
    <div className="flex h-full flex-col" style={{ minHeight: 0 }}>
```

- [ ] **Step 2: Add flex-shrink:0 to the header**

At line 1483-1484, the header `<div>` needs `flexShrink: 0` added to its inline style. Find:
```tsx
        style={{ position: 'relative', overflow: 'hidden', padding: '8px 14px', borderBottom: '1px solid var(--panel-divider)', background: 'var(--panel-header-bg)', backdropFilter: 'blur(12px)', borderRadius: '18px 18px 0 0' }}>
```
Add `flexShrink: 0` to the style object:
```tsx
        style={{ flexShrink: 0, position: 'relative', overflow: 'hidden', padding: '8px 14px', borderBottom: '1px solid var(--panel-divider)', background: 'var(--panel-header-bg)', backdropFilter: 'blur(12px)', borderRadius: '18px 18px 0 0' }}>
```

- [ ] **Step 3: Ensure messages area has min-height:0**

At line 1708, the messages `<div>` already has `flex-1 overflow-y-auto`. Add `min-h-0` to ensure flex overflow works:
```tsx
        className="flex-1 overflow-y-auto scrollbar-aero px-6 py-4 min-h-0"
```

- [ ] **Step 4: Add flex-shrink:0 to the composer form**

At line 1779, the `<form>` needs `flexShrink: 0`. Find:
```tsx
      <form onSubmit={sendMessage} className="px-5 py-4"
        style={{ borderTop: '1px solid var(--panel-divider)', background: 'var(--panel-header-bg)', backdropFilter: 'blur(12px)', borderRadius: '0 0 18px 18px' }}>
```
Add `flexShrink: 0`:
```tsx
      <form onSubmit={sendMessage} className="px-5 py-4"
        style={{ flexShrink: 0, borderTop: '1px solid var(--panel-divider)', background: 'var(--panel-header-bg)', backdropFilter: 'blur(12px)', borderRadius: '0 0 18px 18px' }}>
```

- [ ] **Step 5: Verify build**

Run: `cd /home/dejanandovski/Code\ Repo/aero-chat-app && pnpm build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app"
git add src/components/chat/ChatWindow.tsx
git commit -m "fix(mobile): sticky header + composer in ChatWindow via flex-shrink:0 + min-h-0"
```

---

### Task 4: Add onBack to GroupChatWindow + fix flex layout

**Files:**
- Modify: `src/components/chat/GroupChatWindow.tsx`

GroupChatWindow currently has no `onBack` prop and likely has the same flex overflow issue as ChatWindow.

- [ ] **Step 1: Add onBack to the Props interface**

Find (around line 26-28):
```tsx
interface Props {
  groupId: string;
}
```
Replace with:
```tsx
interface Props {
  groupId: string;
  onBack?: () => void;
}
```

- [ ] **Step 2: Destructure onBack in the component**

Find (around line 30):
```tsx
export function GroupChatWindow({ groupId }: Props) {
```
Replace with:
```tsx
export function GroupChatWindow({ groupId, onBack }: Props) {
```

- [ ] **Step 3: Add ArrowLeft import**

Find the lucide-react import line and add `ArrowLeft`:
```tsx
import { Send, Lock, Phone, PhoneIncoming, Settings, Bell, BellOff, Users, ArrowLeft } from 'lucide-react';
```

- [ ] **Step 4: Fix the root container and header flex**

Find the component's return JSX root `<div>` and ensure it uses `flex h-full flex-col` with `minHeight: 0`. Then find the header `<div>` and add `flexShrink: 0` to its style, plus the back arrow button. Also add `flexShrink: 0` to the composer/input form, and `min-h-0` to the messages area.

Add the back arrow inside the header, before the group name:
```tsx
{onBack && (
  <button
    onClick={onBack}
    className="flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-xl transition-all"
    style={{ background: 'var(--btn-ghost-bg)', border: '1px solid var(--btn-ghost-border)', color: 'var(--text-muted)' }}
    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--popup-hover)'}
    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--btn-ghost-bg)'}
  >
    <ArrowLeft className="h-3.5 w-3.5" />
  </button>
)}
```

- [ ] **Step 5: Verify build**

Run: `cd /home/dejanandovski/Code\ Repo/aero-chat-app && pnpm build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app"
git add src/components/chat/GroupChatWindow.tsx
git commit -m "feat(mobile): add onBack prop to GroupChatWindow + fix flex layout"
```

---

### Task 5: Collapsible profile card in Sidebar

**Files:**
- Modify: `src/components/chat/Sidebar.tsx`

Currently the sidebar has a profile card at the bottom (footer). On mobile, we want a collapsible card at the top — collapsed shows the premium gradient bg + compact row (avatar, name, status, gear, requests badge), expanded adds status selector chips + custom status input.

- [ ] **Step 1: Add collapsed/expanded state**

Near the top of the component (after existing state declarations around line 92-93), add:

```tsx
const [profileExpanded, setProfileExpanded] = useState(false);
```

- [ ] **Step 2: Add the collapsible card JSX in the mobile render path**

Find where the component renders differently based on `isMobile`. In the sidebar's return JSX, add the mobile profile card right after the opening `<aside>` tag (before the search bar), wrapped in `{isMobile && (...)}`:

```tsx
{isMobile && (
  <div
    style={{
      background: 'var(--card-bg, linear-gradient(145deg, rgba(0,120,255,0.10), rgba(255,255,255,0.30)))',
      borderBottom: '1px solid var(--panel-divider)',
      position: 'relative',
      overflow: 'hidden',
    }}
  >
    {/* Decorative orbs */}
    <div className="pointer-events-none absolute" style={{
      width: profileExpanded ? 80 : 50, height: profileExpanded ? 80 : 50,
      top: -15, right: -15, borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(0,180,255,0.18) 0%, transparent 70%)',
      filter: 'blur(8px)', transition: 'all 0.3s ease',
    }} />
    <div className="pointer-events-none absolute" style={{
      width: 35, height: 35, bottom: -8, left: 20, borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(120,0,255,0.10) 0%, transparent 70%)',
      filter: 'blur(6px)',
    }} />

    {/* Collapsed row */}
    <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
      <button onClick={() => setProfileExpanded(e => !e)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        <AvatarImage
          username={user?.username ?? '?'}
          avatarUrl={user?.avatar_url}
          size={profileExpanded ? 'lg' : 'md'}
          status={myStatus}
          isInCall={callStatus === 'connected'}
          playingGame={myPlayingGame}
        />
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="truncate font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
          {user?.username}
        </p>
        <div style={{ fontSize: 10, color: statusColor[myStatus], display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: statusColor[myStatus] }} />
          {statusLabel[myStatus]}
        </div>
      </div>
      {/* Friend requests badge */}
      {(pendingIncoming.length > 0) && (
        <button
          onClick={() => setRequestsOpen(true)}
          style={{
            width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
            position: 'relative', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
          }}
        >
          <Bell className="h-3.5 w-3.5" />
          <span style={{
            position: 'absolute', top: -3, right: -3, width: 14, height: 14, borderRadius: '50%',
            background: 'var(--badge-bg)', color: 'var(--badge-text)', fontSize: 8, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {pendingIncoming.length}
          </span>
        </button>
      )}
      {/* Settings gear */}
      <button
        onClick={() => setSettingsView(v => v === 'menu' ? null : 'menu')}
        style={{
          width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
      </button>
    </div>

    {/* Expanded section — status chips + custom status */}
    <div style={{
      maxHeight: profileExpanded ? 120 : 0,
      overflow: 'hidden',
      transition: 'max-height 0.3s ease',
      padding: profileExpanded ? '0 14px 10px' : '0 14px 0',
    }}>
      {/* Status chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {ALL_STATUSES.map(s => (
          <button
            key={s}
            onClick={() => { setMyStatus(s); setProfileExpanded(false); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', borderRadius: 12, fontSize: 10,
              background: myStatus === s ? `${statusColor[s]}22` : 'rgba(255,255,255,0.04)',
              border: `1px solid ${myStatus === s ? `${statusColor[s]}55` : 'rgba(255,255,255,0.08)'}`,
              color: myStatus === s ? statusColor[s] : 'rgba(255,255,255,0.5)',
              cursor: 'pointer',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor[s] }} />
            {statusLabel[s]}
          </button>
        ))}
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 3: Collapse on outside tap**

Add an effect that collapses the profile card when tapping outside. Near the existing outside-click handler (around line 160-173), add a condition that also handles `profileExpanded`:

Inside the existing `handler` function, add:
```tsx
if (profileExpanded && !statusMenuRef.current?.contains(t)) {
  setProfileExpanded(false);
}
```

Or alternatively, wrap the mobile profile card in a ref and check if the click target is outside that ref.

- [ ] **Step 4: Verify build**

Run: `cd /home/dejanandovski/Code\ Repo/aero-chat-app && pnpm build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app"
git add src/components/chat/Sidebar.tsx
git commit -m "feat(mobile): collapsible profile card with premium gradient and status chips"
```

---

### Task 6: Mobile full-screen incoming call — IncomingCallModal

**Files:**
- Modify: `src/components/call/IncomingCallModal.tsx`

Currently renders as a centered card overlay. On mobile, should be full-screen takeover with large avatar, pulsing rings, and big Accept/Decline buttons.

- [ ] **Step 1: Import useIsMobile**

Add to imports:
```tsx
import { useIsMobile } from '../../lib/useIsMobile';
```

- [ ] **Step 2: Add isMobile check and mobile render path**

Inside the component, after the existing hooks:
```tsx
const isMobile = useIsMobile();
```

Before the existing return, add a mobile-specific return:

```tsx
if (isMobile) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(180deg, rgba(0,40,100,0.5) 0%, rgba(0,0,0,0.7) 100%)',
    }}>
      {/* Pulsing rings */}
      <div className="pointer-events-none" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {[160, 120, 80].map((size, i) => (
          <div key={i} style={{
            position: 'absolute', width: size, height: size, borderRadius: '50%',
            border: `1px solid rgba(0,212,255,${0.06 + i * 0.04})`,
            animation: `aura-pulse ${2.5 + i * 0.3}s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: 'rgba(0,212,255,0.5)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 20 }}>
          Incoming {callType === 'video' ? 'Video' : 'Audio'} Call
        </p>
        <div style={{ margin: '0 auto 14px', width: 72, height: 72 }}>
          <AvatarImage username={contact.username} avatarUrl={contact.avatar_url} size="xl" />
        </div>
        <p style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{contact.username}</p>
      </div>

      {/* Accept / Decline buttons */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 56, marginTop: 48 }}>
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={rejectCall}
            style={{
              width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: 'rgba(239,68,68,0.7)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 20px rgba(239,68,68,0.3)',
            }}
          >
            <PhoneOff className="h-6 w-6" />
          </button>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>Decline</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={answerCall}
            style={{
              width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: 'rgba(34,197,94,0.7)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 20px rgba(34,197,94,0.3)',
            }}
          >
            <Phone className="h-6 w-6" />
          </button>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>Accept</p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `cd /home/dejanandovski/Code\ Repo/aero-chat-app && pnpm build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app"
git add src/components/call/IncomingCallModal.tsx
git commit -m "feat(mobile): full-screen incoming call takeover with pulsing rings"
```

---

### Task 7: Mobile full-screen incoming group call — IncomingGroupCallModal

**Files:**
- Modify: `src/components/call/IncomingGroupCallModal.tsx`

- [ ] **Step 1: Import useIsMobile**

Add to imports:
```tsx
import { useIsMobile } from '../../lib/useIsMobile';
```

- [ ] **Step 2: Add mobile render path**

Inside the component, after existing hooks:
```tsx
const isMobile = useIsMobile();
```

Before the existing return, add a mobile-specific return:

```tsx
if (isMobile) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(180deg, rgba(0,40,100,0.5) 0%, rgba(0,0,0,0.7) 100%)',
    }}>
      {/* Pulsing rings */}
      <div className="pointer-events-none" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {[160, 120, 80].map((size, i) => (
          <div key={i} style={{
            position: 'absolute', width: size, height: size, borderRadius: '50%',
            border: `1px solid rgba(0,212,255,${0.06 + i * 0.04})`,
            animation: `aura-pulse ${2.5 + i * 0.3}s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>

      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: 'rgba(0,212,255,0.5)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 20 }}>
          Incoming Group Call
        </p>
        {/* Participant avatars row */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: -8, marginBottom: 14 }}>
          {participantList.slice(0, 3).map((p, i) => (
            <div key={p.userId} style={{ marginLeft: i > 0 ? -8 : 0, position: 'relative', zIndex: 3 - i }}>
              <AvatarImage username={p.username} avatarUrl={p.avatarUrl} size="lg" />
            </div>
          ))}
        </div>
        <p style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{displayNames}</p>
      </div>

      {/* Accept / Decline */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 56, marginTop: 48 }}>
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={handleReject}
            style={{
              width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: 'rgba(239,68,68,0.7)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 20px rgba(239,68,68,0.3)',
            }}
          >
            <PhoneOff className="h-6 w-6" />
          </button>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>Decline</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={handleAccept}
            style={{
              width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: 'rgba(34,197,94,0.7)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 20px rgba(34,197,94,0.3)',
            }}
          >
            <Phone className="h-6 w-6" />
          </button>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>Accept</p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `cd /home/dejanandovski/Code\ Repo/aero-chat-app && pnpm build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app"
git add src/components/call/IncomingGroupCallModal.tsx
git commit -m "feat(mobile): full-screen incoming group call with participant avatars"
```

---

### Task 8: CallView mobile — full-screen + chat toggle

**Files:**
- Modify: `src/components/call/CallView.tsx`
- Modify: `src/components/call/CallControls.tsx`

The desktop CallView already has a `chatOpen` state and renders ChatWindow in a side panel. On mobile, the chat toggle should switch between full-screen call and a mini widget bar + chat view.

- [ ] **Step 1: Import useIsMobile in CallView**

Add:
```tsx
import { useIsMobile } from '../../lib/useIsMobile';
```

- [ ] **Step 2: Add isMobile and mobile-specific chat toggle state**

Inside `CallView`, after existing state:
```tsx
const isMobile = useIsMobile();
const [mobileChatMode, setMobileChatMode] = useState(false);
```

- [ ] **Step 3: Add mobile render path before the desktop return**

Before the existing `return` statement, add:

```tsx
if (isMobile) {
  // Mini widget + chat mode
  if (mobileChatMode && status === 'connected' && contact) {
    return (
      <div className="h-dvh flex flex-col" style={{ background: 'var(--sidebar-bg)' }}>
        {/* Mini call bar */}
        <button
          onClick={() => setMobileChatMode(false)}
          style={{
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, rgba(0,80,200,0.2), rgba(0,40,100,0.3))',
            borderBottom: '1px solid rgba(0,212,255,0.1)',
            color: '#fff', width: '100%',
          }}
        >
          <AvatarImage username={contact.username} avatarUrl={contact.avatar_url} size="sm" />
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{contact.username}</div>
            <div style={{ fontSize: 10, color: 'rgba(0,212,255,0.5)' }}>{duration}</div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); hangUp(); }}
            style={{
              width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: 'rgba(239,68,68,0.5)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <PhoneOff className="h-3.5 w-3.5" />
          </button>
        </button>
        {/* Chat below */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <ChatWindow contact={contact} />
        </div>
        <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />
      </div>
    );
  }

  // Full-screen call view
  return (
    <div className="h-dvh safe-bottom flex flex-col" style={{ background: 'rgba(6,14,31,0.98)' }}>
      <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />
      {/* Ringing state */}
      {status === 'ringing' && <IncomingCallModal />}
      {/* Connected state */}
      {status === 'connected' && (
        <>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            {/* PiP self-view */}
            {localStream && callType === 'video' && (
              <div style={{ position: 'absolute', top: 12, right: 12, width: 56, height: 72, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(0,212,255,0.15)', zIndex: 5 }}>
                <CameraFeed stream={localStream} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}
            {/* Remote video or avatar */}
            {remoteStream && callType === 'video' ? (
              <CameraFeed stream={remoteStream} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <>
                <div style={{ width: 88, height: 88 }}>
                  <AvatarImage username={contact?.username ?? ''} avatarUrl={contact?.avatar_url} size="xl" />
                </div>
                <p style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginTop: 14 }}>{contact?.username}</p>
                <p style={{ fontSize: 12, color: 'rgba(0,212,255,0.5)', marginTop: 4, fontFamily: 'monospace' }}>{duration}</p>
              </>
            )}
          </div>
          {/* Controls bar */}
          <div style={{
            flexShrink: 0, display: 'flex', justifyContent: 'center', gap: 14,
            padding: '16px 20px 20px', alignItems: 'center',
            background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(12px)',
          }}>
            <button onClick={toggleMute} style={{
              width: 40, height: 40, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)',
              background: isMuted ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.1)',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}>
              {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
            <button onClick={() => isCameraOn ? toggleCamera() : toggleCamera()} style={{
              width: 40, height: 40, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.1)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}>
              <Video className="h-4 w-4" />
            </button>
            {/* Chat toggle */}
            {contact && (
              <button onClick={() => setMobileChatMode(true)} style={{
                width: 40, height: 40, borderRadius: '50%',
                border: '1px solid rgba(0,212,255,0.3)', background: 'rgba(0,212,255,0.15)',
                color: 'rgba(0,212,255,0.85)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}>
                <MessageSquare className="h-4 w-4" />
              </button>
            )}
            <button onClick={hangUp} style={{
              width: 48, height: 48, borderRadius: '50%', border: 'none',
              background: 'rgba(239,68,68,0.7)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              boxShadow: '0 0 15px rgba(239,68,68,0.3)',
            }}>
              <PhoneOff className="h-5 w-5" />
            </button>
          </div>
        </>
      )}
      {/* Calling state */}
      {status === 'calling' && contact && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ fontSize: 11, color: 'rgba(0,212,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 20 }}>Calling...</p>
          <div style={{ width: 80, height: 80 }}>
            <AvatarImage username={contact.username} avatarUrl={contact.avatar_url} size="xl" />
          </div>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginTop: 12 }}>{contact.username}</p>
          <button onClick={hangUp} style={{
            width: 52, height: 52, borderRadius: '50%', border: 'none', marginTop: 40,
            background: 'rgba(239,68,68,0.7)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}>
            <PhoneOff className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Add missing imports**

Ensure `MessageSquare`, `Mic`, `MicOff`, `PhoneOff` are imported from lucide-react. Check existing imports and add any missing ones. Also need `toggleMute`, `toggleCamera`, `isCameraOn` from `useCallStore` — check if they're already destructured.

Add to the CallView destructure if not present:
```tsx
const { toggleMute } = useCallStore();
const isCameraOn = useCallStore(s => s.isCameraOn);
const toggleCamera = useCallStore(s => s.toggleCamera);
```

- [ ] **Step 5: Verify build**

Run: `cd /home/dejanandovski/Code\ Repo/aero-chat-app && pnpm build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app"
git add src/components/call/CallView.tsx
git commit -m "feat(mobile): full-screen call view with chat toggle and mini widget bar"
```

---

### Task 9: GroupCallView mobile — full-screen 2x2 grid + chat toggle

**Files:**
- Modify: `src/components/call/GroupCallView.tsx`

- [ ] **Step 1: Import useIsMobile and MessageSquare**

Add:
```tsx
import { useIsMobile } from '../../lib/useIsMobile';
import { MessageSquare } from 'lucide-react';
```

- [ ] **Step 2: Add state**

Inside the component:
```tsx
const isMobile = useIsMobile();
const [mobileChatMode, setMobileChatMode] = useState(false);
```

Also need to know the current group ID for showing group chat in chat mode. Add:
```tsx
const groupId = useGroupCallStore(s => s.groupId);
```

- [ ] **Step 3: Import GroupChatWindow**

```tsx
import { GroupChatWindow } from '../chat/GroupChatWindow';
```

- [ ] **Step 4: Add mobile render path before the desktop return**

Before the existing `return`, add a mobile render path. The structure mirrors CallView Task 8 but with a 2x2 participant grid instead of a single avatar. Include the mini widget bar + GroupChatWindow for chat mode, and the full-screen grid + controls for call mode.

The controls bar should include: Mute, Camera (via `toggleMute`), Chat toggle (MessageSquare icon), and Hang up. No screen share on mobile.

- [ ] **Step 5: Verify build**

Run: `cd /home/dejanandovski/Code\ Repo/aero-chat-app && pnpm build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app"
git add src/components/call/GroupCallView.tsx
git commit -m "feat(mobile): full-screen group call with 2x2 grid and chat toggle"
```

---

### Task 10: FriendRequestModal — full-screen on mobile

**Files:**
- Modify: `src/components/chat/FriendRequestModal.tsx`

- [ ] **Step 1: Import useIsMobile and ArrowLeft**

```tsx
import { useIsMobile } from '../../lib/useIsMobile';
import { ArrowLeft } from 'lucide-react';
```

- [ ] **Step 2: Add isMobile hook**

```tsx
const isMobile = useIsMobile();
```

- [ ] **Step 3: Add mobile render path**

Before the existing return, add:

```tsx
if (isMobile) {
  return (
    <div className="h-dvh flex flex-col" style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'var(--sidebar-bg)' }}>
      {/* Header */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid var(--panel-divider)' }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="font-bold" style={{ color: 'var(--text-primary)', fontSize: 16 }}>Friend Requests</h2>
      </div>
      {/* Content — scrollable */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 14 }}>
        {pendingIncoming.length === 0 && pendingInvites.length === 0 ? (
          <p className="py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No pending requests</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pendingIncoming.map((req) => (
              <li key={req.id} className="flex items-center gap-3 rounded-aero px-3 py-3"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--panel-divider)' }}>
                <AvatarImage username={req.sender?.username ?? '?'} avatarUrl={req.sender?.avatar_url} size="md" />
                <span className="flex-1 truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{req.sender?.username}</span>
                <button onClick={() => respondToRequest(req.id, true)}
                  style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(34,197,94,0.2)', color: '#22c55e', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Check className="h-4 w-4" />
                </button>
                <button onClick={() => respondToRequest(req.id, false)}
                  style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
            {pendingInvites.map((inv) => (
              <li key={inv.id} className="flex items-center gap-3 rounded-aero px-3 py-3"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--panel-divider)' }}>
                <Users className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                <span className="flex-1 truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{inv.group_name ?? 'Group invite'}</span>
                <button onClick={() => acceptInvite(inv.id)}
                  style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(34,197,94,0.2)', color: '#22c55e', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Check className="h-4 w-4" />
                </button>
                <button onClick={() => declineInvite(inv.id)}
                  style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

Run: `cd /home/dejanandovski/Code\ Repo/aero-chat-app && pnpm build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app"
git add src/components/chat/FriendRequestModal.tsx
git commit -m "feat(mobile): full-screen friend requests page with back arrow"
```

---

### Task 11: Manual verification on localhost

- [ ] **Step 1: Start dev server**

Run: `cd /home/dejanandovski/Code\ Repo/aero-chat-app && pnpm dev`

- [ ] **Step 2: Open on phone or browser DevTools (375×812 iPhone viewport)**

Verify the following:

1. **Friends list** — profile card visible with premium gradient, tap avatar expands status chips, gear opens settings
2. **Chat** — tap a friend → slides to chat, header stays fixed at top, composer stays fixed at bottom, messages scroll in the middle
3. **Group chat** — tap a group → slides to group chat, back arrow works, same sticky header/composer
4. **1:1 call** — call button → full-screen call view, chat toggle → mini bar + chat, chat toggle again → back to full-screen
5. **Group call** — start group call → full-screen 2x2 grid, chat toggle works
6. **Incoming call** — receive a call → full-screen takeover with pulsing rings, accept/decline buttons
7. **Settings** — gear → full-screen settings page, back arrow returns
8. **Friend requests** — badge tap → full-screen requests page, back arrow returns
9. **Day theme** — switch to day theme, verify all above still looks correct
10. **Keyboard** — tap composer → keyboard opens, composer stays visible, messages scroll

- [ ] **Step 3: Fix any issues found during verification**

- [ ] **Step 4: Final commit and deploy**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app"
git add -A
git commit -m "fix(mobile): address issues found during manual verification"
vercel --prod --yes
```
