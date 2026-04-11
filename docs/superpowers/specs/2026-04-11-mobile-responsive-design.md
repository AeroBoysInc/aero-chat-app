# AeroChat Mobile-Responsive UI — Design Spec

## Goal

Make AeroChat fully usable on mobile phones by fixing the broken mobile layout and designing proper mobile adaptations for all core features: friends list, profile card, 1:1 chat, group chat, 1:1 calls, group calls, incoming call modals, settings, and friend requests.

## Scope

**In scope (this pass):**
- Friends list / sidebar (home screen)
- Collapsible profile card with premium styling
- 1:1 chat window (ChatWindow)
- Group chat window (GroupChatWindow)
- 1:1 calls (CallView)
- Group calls (GroupCallView)
- Incoming call modals (1:1 and group)
- Call mini widget + chat toggle
- Settings (full-screen pages)
- Friend requests (full-screen page)
- Create group modal
- Group settings modal

**Out of scope (future passes):**
- Games corner
- Servers / bubbles
- Writers corner
- Calendar corner
- Avatar corner
- Master theme dashboard (already has CompactSidebar)
- Video corner / Music corner

## Breakpoint

- **Mobile:** `window.innerWidth < 768` (existing `useIsMobile` hook)
- No changes to desktop layout — all modifications are behind the `isMobile` conditional

---

## Architecture

### Navigation Pattern: Fixed Stack

Single-pane stack navigation (same as current, fixed properly):

```
Friends List (home)
  ├── tap friend → Chat Window (slides in from right)
  ├── tap group → Group Chat Window (slides in from right)
  ├── tap gear → Settings (slides in from right)
  ├── tap friend requests → Friend Requests (slides in from right)
  ├── tap avatar → Profile card expands in-place
  │
  Chat Window
  ├── ← back arrow → Friends List (slides back left)
  ├── call button → Call Full-Screen (overlay)
  │   ├── chat toggle → Mini Widget + Chat
  │   └── chat toggle again → Back to Full-Screen
  └── hang up → Back to Chat
```

Every sub-screen has a back arrow in the header that returns to the previous screen. Transitions use `translateX` with `0.25s cubic-bezier(0.4, 0, 0.2, 1)`.

### Core Layout Fix

The two main bugs — header scrolling away and composer scrolling off-screen — are caused by the mobile layout not constraining the scroll area. The fix:

```
┌──────────────────────┐
│  HEADER (flex-shrink:0, position:sticky or fixed)  │
├──────────────────────┤
│                      │
│  MESSAGES            │
│  (flex:1, overflow-y │
│   auto, min-h:0)     │
│                      │
├──────────────────────┤
│  COMPOSER (flex-shrink:0, position:sticky or fixed) │
└──────────────────────┘
```

- Container: `display:flex; flex-direction:column; height:100dvh` (use `dvh` for mobile viewport address bar)
- Header: `flex-shrink:0` — never scrolls
- Messages: `flex:1; min-height:0; overflow-y:auto` — only this area scrolls
- Composer: `flex-shrink:0` — always pinned at bottom

This same pattern applies to ChatWindow, GroupChatWindow, Settings, and Friend Requests.

---

## Screen Specifications

### 1. Friends List (Home Screen)

**File:** `src/components/chat/Sidebar.tsx` (mobile render path when `isMobile` prop is true)

**Structure:**
```
┌──────────────���───────────┐
│ Collapsible Profile Card │  ← premium gradient bg, tap avatar to expand
├──────────────────────────┤
│ 🔍 Search friends...     │
├──────────────────────────┤
│ Groups                   │
│  📱 Project Team    [3]  │
├──────────────────────────┤
│ Online — 2               │
│  🟢 Alice                │
│  🟢 Bob                  │
│ Offline — 1              │
│  ⚫ Charlie              │
└──────────────────────────┘
```

**Collapsible Profile Card — Collapsed state (default):**
- Premium gradient background: `linear-gradient(145deg, rgba(0,120,255,0.10), rgba(255,255,255,0.30))` (day) / `linear-gradient(145deg, rgba(0,150,255,0.18), rgba(80,0,200,0.12))` (night)
- Decorative corner orb (top-right) and subtle left orb — always visible in both states
- Compact row: avatar (34px, aura ring) + username + status text + friend request badge + settings gear
- `border-bottom: 1px solid var(--panel-divider)`
- Total height: ~54px

**Collapsible Profile Card — Expanded state (tap avatar):**
- Same premium gradient background, orbs grow slightly larger
- Avatar grows to 48px
- Status selector chips appear: Online / Away / Busy / Invisible (horizontal wrap, pill-shaped)
- Custom status input field: `"😊 Set a custom status..."`
- Friend request badge and settings gear move to bottom row
- Collapse chevron (▲) in top-right corner — tap to collapse
- Smooth expand/collapse: `max-height` transition, `0.3s ease`
- Also collapses on tap outside the card

**Friend list items:**
- Each row: avatar (28px, aura ring) + name + optional last message preview + time
- Groups section above friends, separated by section headers
- Unread badge: small pill on the right
- Tap → `setMobilePaneShowChat(true)` + select contact/group

### 2. Chat Window (1:1)

**File:** `src/components/chat/ChatWindow.tsx` (when `onBack` prop exists = mobile)

**Layout:** `height: 100dvh; display: flex; flex-direction: column`

**Header (sticky, flex-shrink: 0):**
- `← ` back arrow (tap → `onBack()`)
- Contact avatar (24px, aura ring)
- Contact name + status text
- Audio call button (circle, 28px)
- Video call button (circle, 28px)
- `border-bottom: 1px solid var(--panel-divider)`
- `background: var(--panel-header-bg); backdrop-filter: blur(12px)`

**Message area (flex: 1, min-height: 0, overflow-y: auto):**
- Same message rendering as desktop
- Date separators centered with flanking lines
- Sent bubble gloss on own messages
- Touch-friendly: message bubbles have min 44px tap target for long-press actions
- Depth orbs render behind messages (same as desktop)

**Composer (sticky, flex-shrink: 0):**
- `border-top: 1px solid var(--panel-divider)`
- Attachment button (+) + text input (border-radius: 20px) + send button
- Same emoji/GIF picker as desktop (slides up above keyboard)
- Voice message button when input is empty

### 3. Group Chat Window

**File:** `src/components/chat/GroupChatWindow.tsx`

Same layout as Chat Window with these differences:
- Header shows group name + member count instead of contact name
- Group settings gear icon in header (opens GroupSettingsModal as full-screen page)
- "Call in progress — Join" banner (same as desktop, positioned below header)
- Call button starts group call

**GroupSettingsModal on mobile:**
- Opens as full-screen page (not modal overlay)
- Back arrow in header to return to group chat
- Group name, member list, add member, leave group

**CreateGroupModal on mobile:**
- Opens as full-screen page
- Back arrow to cancel
- Friend selector with checkboxes, group name input, create button

### 4. Call View — 1:1 (Full-Screen)

**File:** `src/components/call/CallView.tsx`

**Layout:** Full-screen overlay (`position: fixed; inset: 0; z-index: 50`)

**Audio call state:**
- Centered large avatar (80px) with aura ring + pulsing rings behind
- Contact name below avatar
- Call duration timer
- Self-view PiP in top-right corner (48x64px, border-radius: 10px)

**Video call state:**
- Remote video fills screen
- Self-view PiP in top-right (draggable not required, fixed position)

**Controls bar (pinned bottom, flex-shrink: 0):**
- Centered row with equal spacing
- Buttons (36px circles): Mute | Camera | **Chat toggle** | Screen share | Hang up (42px, red)
- Chat toggle button: `💬` icon, highlighted border when active (`rgba(0,212,255,0.3)`)
- `background: rgba(0,0,0,0.3); backdrop-filter: blur(12px)`

**Chat toggle behavior:**
- Tap chat button → call shrinks to mini widget bar at top, chat window appears below
- Tap chat button again → mini widget expands back to full-screen call
- State managed by `showChatDuringCall` boolean

### 5. Call Mini Widget + Chat

When chat toggle is active during a call:

**Mini widget bar (top, flex-shrink: 0):**
- `background: linear-gradient(135deg, rgba(0,80,200,0.2), rgba(0,40,100,0.3))`
- Content: avatar (22px) + contact name + duration + mute button (18px) + hang up button (18px, red)
- Tap the bar → return to full-screen call
- Height: ~44px

**Chat area below:**
- Standard ChatWindow layout (header + messages + composer)
- Chat header shows `← ` back arrow (goes to friends list, NOT back to full-screen call)

### 6. Group Call View (Full-Screen)

**File:** `src/components/call/GroupCallView.tsx`

**Layout:** Full-screen overlay, same as 1:1 call

**Participant grid:**
- 2x2 CSS grid (`grid-template-columns: 1fr 1fr`)
- Each cell: avatar (centered) + name label below
- Video call: video feed fills each cell
- Empty slot: dashed border + "+" add button
- "Calling..." slots for invited users (pulsing indicator)
- `gap: 4px; padding: 6px`

**Controls bar:** Same as 1:1 call (mute, camera, chat toggle, hang up). No screen share on mobile group calls (limited screen space).

**Chat toggle:** Same behavior as 1:1 — mini widget bar + group chat window below.

### 7. Incoming Call — Full-Screen Takeover

**Files:** `src/components/call/IncomingCallModal.tsx`, `src/components/call/IncomingGroupCallModal.tsx`

**Layout:** `position: fixed; inset: 0; z-index: 60` (above call view)

**Visual:**
- Dark gradient background: `linear-gradient(180deg, rgba(0,40,100,0.4), rgba(0,0,0,0.5))`
- Three concentric pulsing rings behind avatar (animated, `aura-pulse` keyframe)
- "INCOMING CALL" label (uppercase, small, cyan, letter-spaced)
- Caller avatar (72px) with aura ring + box-shadow glow
- Caller name (16px, bold)
- Call type label: "Audio Call" or "Video Call" or "Group Call"

**Buttons (bottom, centered, 48px gap between):**
- Decline: 52px red circle, ☎ icon, "Decline" label below
- Accept: 52px green circle, 📞 icon, "Accept" label below
- `box-shadow: 0 0 15px` on each for glow effect

**Group variant:** Shows group name + member avatars (small row of 3-4 avatars) instead of single caller avatar.

### 8. Settings (Full-Screen Page)

**File:** `src/components/chat/Sidebar.tsx` (settings view state) — on mobile, renders as full-screen instead of dropdown

**Layout:** Standard stack page (header + scrollable content)

**Header:** `← ` back arrow + "Settings" title

**Menu items (vertical list):**
- Each item: icon + label + chevron `›`
- Items: Edit Profile, Appearance (theme), Security, Notifications, About
- Log Out at bottom (red tint)
- Each item tap → pushes another full-screen page with that settings content
- Glass card styling: `background: rgba(255,255,255,0.04); border-radius: 12px`

### 9. Friend Requests (Full-Screen Page)

**File:** `src/components/chat/FriendRequestModal.tsx` — on mobile, renders as full-screen page

**Layout:** Standard stack page

**Header:** `← ` back arrow + "Friend Requests" title

**Sections:**
- "Incoming" — request cards with avatar + username + time + accept ✓ / reject ✗ buttons (24px circles)
- "Sent" — pending request cards with avatar + username + "Pending..." status
- Add friend input at top or bottom: username input + send button

---

## Technical Implementation

### Viewport Height

Replace all `h-screen` with `h-dvh` (or `height: 100dvh` inline) on mobile layouts. This accounts for the mobile browser address bar collapsing/expanding. Fallback: `height: 100vh; height: 100dvh` for browsers that don't support `dvh`.

### Touch Targets

All interactive elements must have a minimum tap target of 44x44px (Apple HIG). This applies to:
- Back arrow buttons
- Call control buttons
- Accept/decline buttons
- Friend list rows
- Settings menu items
- Send button in composer

### Keyboard Handling

When the mobile keyboard opens:
- The `100dvh` container automatically shrinks to the visual viewport
- Composer stays pinned at the bottom of the visual viewport
- Messages area shrinks, auto-scrolls to keep latest message visible
- No `position: fixed` on composer (causes iOS jump bugs) — use flex layout instead

### Safe Areas

Add `padding-top: env(safe-area-inset-top)` and `padding-bottom: env(safe-area-inset-bottom)` to the root mobile container for notched phones. Call controls bar gets extra bottom padding for home indicator.

### Performance

- No additional orbs on mobile — reuse desktop orbs but cap at 2 visible on mobile (reduce GPU load)
- Disable `backdrop-filter: blur()` on message bubbles on mobile (keep only on header/composer/call controls)
- Keep virtualized message list (`@tanstack/react-virtual`) — critical for mobile scroll performance
- Animations: reduce `orb-drift` to `animation-play-state: paused` on mobile to save battery, or remove entirely

### Theme Support

All mobile styles use existing CSS custom properties (`--panel-divider`, `--sidebar-bg`, `--text-primary`, etc.) — day/night/aurora/sunset themes work automatically. No mobile-specific theme variables needed.

### Existing Mobile Code

The existing `useIsMobile` hook and `ChatLayout.tsx` mobile branch remain the foundation. Changes are:
1. Fix the flex layout in ChatLayout mobile branch (sticky header + composer)
2. Add `height: 100dvh` instead of `h-screen`
3. Add mobile render paths in Sidebar (collapsible card), CallView (full-screen + chat toggle), GroupCallView, IncomingCallModal, settings views
4. Add `onBack` prop handling in GroupChatWindow (currently only ChatWindow supports it)

---

## File Change Summary

| File | Change |
|------|--------|
| `src/index.css` | Add `dvh` utility, safe-area padding, mobile orb limits |
| `src/lib/useIsMobile.ts` | No change (reuse as-is) |
| `src/components/chat/ChatLayout.tsx` | Fix mobile flex layout, add `100dvh`, route settings/friend-requests as full-screen pages |
| `src/components/chat/Sidebar.tsx` | Collapsible profile card (collapsed/expanded), mobile friend request/settings routing |
| `src/components/chat/ChatWindow.tsx` | Fix flex layout (sticky header/composer), ensure `min-height:0` on message area |
| `src/components/chat/GroupChatWindow.tsx` | Add `onBack` prop, fix flex layout, full-screen modals on mobile |
| `src/components/call/CallView.tsx` | Mobile full-screen layout, chat toggle button, mini widget mode |
| `src/components/call/GroupCallView.tsx` | Mobile 2x2 grid, chat toggle, mini widget mode |
| `src/components/call/CallControls.tsx` | Add chat toggle button |
| `src/components/call/IncomingCallModal.tsx` | Full-screen takeover on mobile |
| `src/components/call/IncomingGroupCallModal.tsx` | Full-screen takeover on mobile |
| `src/components/call/MiniCallWidget.tsx` | Mobile mini widget bar variant |
| `src/components/chat/FriendRequestModal.tsx` | Full-screen page on mobile |
| `src/components/chat/CreateGroupModal.tsx` | Full-screen page on mobile |
| `src/components/chat/GroupSettingsModal.tsx` | Full-screen page on mobile |
