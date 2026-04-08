# Identity Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every user a visible identity (accent color, custom status, bio, card effects) shown across rich mini cards, a floating hover popout, and chat header banner bleed.

**Architecture:** All identity data stored as new columns on the `profiles` table. Friends' identity fetched via `friendStore` with realtime subscriptions. New UI components (`AccentName`, `CustomStatusBadge`, `CardEffect`, `ProfilePopout`, `IdentityEditor`) composed into Sidebar, ChatWindow, and CompactSidebar.

**Tech Stack:** React 19, Zustand, Supabase (PostgreSQL + Realtime), TypeScript, CSS custom properties

**Design Spec:** `docs/superpowers/specs/2026-04-08-identity-foundation-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `supabase/migrations/027_identity_columns.sql` | Add identity columns to profiles table |
| `src/lib/identityConstants.ts` | Accent color presets, banner gradient presets, card effect definitions |
| `src/components/ui/AccentName.tsx` | Renders username with accent color (single or gradient) |
| `src/components/ui/CustomStatusBadge.tsx` | Renders emoji + status text badge |
| `src/components/ui/CardEffect.tsx` | Renders animated card effect overlay (bubbles, sparkles, etc.) |
| `src/components/ui/ProfilePopout.tsx` | Floating identity card on hover |
| `src/components/ui/IdentityEditor.tsx` | Panel for editing own identity (bio, status, accent, effect) |

### Modified Files
| File | Changes |
|------|---------|
| `src/store/authStore.ts` | Extend Profile interface, add `updateIdentity()` |
| `src/store/friendStore.ts` | Fetch identity columns with friends, expose `friendProfiles` map |
| `src/components/chat/Sidebar.tsx` | Rich mini cards, own profile card effects, edit button, popout trigger |
| `src/components/chat/ChatWindow.tsx` | Header banner bleed + accent line + accent name |
| `src/components/master/CompactSidebar.tsx` | Accent-colored names, popout trigger |

---

### Task 1: Database Migration + Identity Constants

**Files:**
- Create: `supabase/migrations/027_identity_columns.sql`
- Create: `src/lib/identityConstants.ts`

- [ ] **Step 1: Create the migration SQL file**

```sql
-- 027_identity_columns.sql
-- Add identity customization columns to profiles

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS custom_status_text text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS custom_status_emoji text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS accent_color text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS accent_color_secondary text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banner_gradient text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banner_image_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS card_effect text;

-- Migrate existing card_gradient values to banner_gradient
UPDATE profiles SET banner_gradient = card_gradient WHERE card_gradient IS NOT NULL AND banner_gradient IS NULL;
```

- [ ] **Step 2: Create identity constants**

```ts
// src/lib/identityConstants.ts

// ── Free accent color presets (12 colors) ───────────────────────────
export const ACCENT_PRESETS = [
  { id: 'cyan',   hex: '#00d4ff', label: 'Cyan' },
  { id: 'blue',   hex: '#3d8bfd', label: 'Blue' },
  { id: 'purple', hex: '#a060ff', label: 'Purple' },
  { id: 'pink',   hex: '#ff60b0', label: 'Pink' },
  { id: 'red',    hex: '#ff4060', label: 'Red' },
  { id: 'orange', hex: '#ff9a4d', label: 'Orange' },
  { id: 'gold',   hex: '#ffd740', label: 'Gold' },
  { id: 'green',  hex: '#4fc97a', label: 'Green' },
  { id: 'teal',   hex: '#20c9b0', label: 'Teal' },
  { id: 'silver', hex: '#e0e8f0', label: 'Silver' },
  { id: 'rose',   hex: '#f5c6d0', label: 'Rose' },
  { id: 'steel',  hex: '#b0c4de', label: 'Steel' },
] as const;

export type AccentPresetId = (typeof ACCENT_PRESETS)[number]['id'];

export const DEFAULT_ACCENT = '#00d4ff';

// ── Banner gradient presets (6 gradients) ───────────────────────────
export const BANNER_PRESETS = [
  { id: 'ocean',  css: 'linear-gradient(135deg, #0044aa, #0088cc)',  preview: '#0066bb' },
  { id: 'sunset', css: 'linear-gradient(135deg, #cc4400, #ff8800)',  preview: '#e06600' },
  { id: 'forest', css: 'linear-gradient(135deg, #006644, #00aa66)',  preview: '#008855' },
  { id: 'cosmic', css: 'linear-gradient(135deg, #2a0066, #6600cc)',  preview: '#4a0099' },
  { id: 'rose',   css: 'linear-gradient(135deg, #aa2255, #ff6699)',  preview: '#cc4477' },
  { id: 'steel',  css: 'linear-gradient(135deg, #2a3a4a, #4a6a8a)',  preview: '#3a5060' },
] as const;

export type BannerPresetId = (typeof BANNER_PRESETS)[number]['id'];

export function getBannerCss(id: string | null | undefined): string | null {
  if (!id) return null;
  return BANNER_PRESETS.find(b => b.id === id)?.css ?? null;
}

// ── Card effects (premium only) ─────────────────────────────────────
export const CARD_EFFECTS = [
  { id: 'shimmer',   label: 'Shimmer',   description: 'Diagonal light sweep' },
  { id: 'bubbles',   label: 'Bubbles',   description: 'Floating translucent circles' },
  { id: 'sparkles',  label: 'Sparkles',  description: 'Twinkling star particles' },
  { id: 'aurora',    label: 'Aurora',     description: 'Slow color bands' },
  { id: 'rain',      label: 'Rain',      description: 'Soft diagonal droplets' },
  { id: 'fireflies', label: 'Fireflies', description: 'Warm floating dots' },
] as const;

export type CardEffectId = (typeof CARD_EFFECTS)[number]['id'];

// ── Shared identity type ────────────────────────────────────────────
export interface IdentityFields {
  bio: string | null;
  custom_status_text: string | null;
  custom_status_emoji: string | null;
  accent_color: string | null;
  accent_color_secondary: string | null;
  banner_gradient: string | null;
  banner_image_url: string | null;
  card_effect: string | null;
}

export const IDENTITY_COLUMNS = [
  'bio', 'custom_status_text', 'custom_status_emoji',
  'accent_color', 'accent_color_secondary',
  'banner_gradient', 'banner_image_url', 'card_effect',
] as const;

/** Max bio length by tier */
export const BIO_MAX_FREE = 150;
export const BIO_MAX_PREMIUM = 500;
export const STATUS_TEXT_MAX = 128;
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/027_identity_columns.sql src/lib/identityConstants.ts
git commit -m "feat: add identity columns migration and constants"
```

---

### Task 2: Extend authStore with Identity Fields

**Files:**
- Modify: `src/store/authStore.ts`

- [ ] **Step 1: Add identity fields to Profile interface**

The current `Profile` interface is at lines 4-18 of `src/store/authStore.ts`. Add the new identity fields after `is_premium`:

```ts
export interface Profile {
  id: string;
  username: string;
  public_key: string;
  avatar_url?: string | null;
  status?: string | null;
  card_gradient?: string | null;
  card_image_url?: string | null;
  card_image_params?: { zoom: number; x: number; y: number } | null;
  is_premium?: boolean;
  // Identity fields
  bio?: string | null;
  custom_status_text?: string | null;
  custom_status_emoji?: string | null;
  accent_color?: string | null;
  accent_color_secondary?: string | null;
  banner_gradient?: string | null;
  banner_image_url?: string | null;
  card_effect?: string | null;
}
```

- [ ] **Step 2: Add updateIdentity action to AuthState interface and implementation**

Add to the `AuthState` interface (after `signOut`):

```ts
updateIdentity(fields: Partial<Pick<Profile, 'bio' | 'custom_status_text' | 'custom_status_emoji' | 'accent_color' | 'accent_color_secondary' | 'banner_gradient' | 'banner_image_url' | 'card_effect'>>): Promise<void>;
```

Add the implementation inside the `create<AuthState>` call, after `signOut`:

```ts
updateIdentity: async (fields) => {
  const user = get().user;
  if (!user) return;
  // Optimistic local update
  set({ user: { ...user, ...fields } });
  const { error } = await supabase
    .from('profiles')
    .update(fields)
    .eq('id', user.id);
  if (error) {
    console.error('[Identity] Failed to update:', error);
    // Revert on failure
    set({ user });
  }
},
```

- [ ] **Step 3: Verify build**

Run: `cd aero-chat-app && pnpm build`
Expected: Build succeeds with no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/store/authStore.ts
git commit -m "feat: extend authStore Profile with identity fields and updateIdentity"
```

---

### Task 3: Extend friendStore to Fetch and Cache Identity

**Files:**
- Modify: `src/store/friendStore.ts`

- [ ] **Step 1: Update the friend profiles query to include identity columns**

In `loadFriends` (around line 35), the current query selects from `friend_requests` with joined `profiles`. The profiles join needs to include identity columns. Find the `.select(...)` call that fetches friend profiles and ensure it selects all profile fields (Supabase `select('*')` on the join already returns all columns — verify this is the case).

The key change is in the `subscribeToRequests` function (around lines 136-151) where profile updates are spread onto the friend cache. The existing code already handles this pattern — when a profile updates, it spreads updated fields onto the matching friend. Since the new identity columns are on the same `profiles` table, they will flow through automatically as long as the real-time subscription listens for all columns.

Verify the subscription filter at line ~138 uses `profiles` table and spreads all returned fields. The existing code should look like:

```ts
.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
  const updated = payload.new as Profile;
  set({
    friends: get().friends.map(f => f.id === updated.id ? { ...f, ...updated } : f),
  });
})
```

If the spread already uses `{ ...f, ...updated }`, no change is needed — the new columns will propagate automatically.

- [ ] **Step 2: Add a friendProfiles selector for convenient access**

Add a helper function export below the store definition:

```ts
/** Get a friend's full profile including identity fields by ID. */
export function getFriendProfile(friendId: string): Profile | undefined {
  return useFriendStore.getState().friends.find(f => f.id === friendId);
}
```

- [ ] **Step 3: Verify build**

Run: `cd aero-chat-app && pnpm build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/store/friendStore.ts
git commit -m "feat: friendStore exposes identity fields from friend profiles"
```

---

### Task 4: AccentName Component

**Files:**
- Create: `src/components/ui/AccentName.tsx`

- [ ] **Step 1: Create the AccentName component**

```tsx
// src/components/ui/AccentName.tsx
import React from 'react';
import { DEFAULT_ACCENT } from '../../lib/identityConstants';

interface AccentNameProps {
  name: string;
  accentColor?: string | null;
  accentColorSecondary?: string | null;
  className?: string;
  style?: React.CSSProperties;
}

/** Renders a username with their accent color (solid or gradient). */
const AccentName = React.memo(function AccentName({
  name,
  accentColor,
  accentColorSecondary,
  className,
  style,
}: AccentNameProps) {
  const primary = accentColor || DEFAULT_ACCENT;

  const nameStyle: React.CSSProperties = accentColorSecondary
    ? {
        background: `linear-gradient(90deg, ${primary}, ${accentColorSecondary})`,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        ...style,
      }
    : {
        color: primary,
        ...style,
      };

  return (
    <span className={className} style={nameStyle}>
      {name}
    </span>
  );
});

export { AccentName };
```

- [ ] **Step 2: Verify build**

Run: `cd aero-chat-app && pnpm build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/AccentName.tsx
git commit -m "feat: add AccentName component for identity-colored usernames"
```

---

### Task 5: CustomStatusBadge Component

**Files:**
- Create: `src/components/ui/CustomStatusBadge.tsx`

- [ ] **Step 1: Create the CustomStatusBadge component**

```tsx
// src/components/ui/CustomStatusBadge.tsx
import React from 'react';

interface CustomStatusBadgeProps {
  emoji?: string | null;
  text?: string | null;
  size?: 'sm' | 'md';
}

const SIZES = {
  sm: { fontSize: '9.5px', gap: 3 },
  md: { fontSize: '11px', gap: 4 },
} as const;

/** Renders a custom status line: emoji + text. Returns null if both are empty. */
const CustomStatusBadge = React.memo(function CustomStatusBadge({
  emoji,
  text,
  size = 'sm',
}: CustomStatusBadgeProps) {
  if (!emoji && !text) return null;

  const s = SIZES[size];
  return (
    <div
      style={{
        fontSize: s.fontSize,
        color: 'var(--text-muted)',
        display: 'flex',
        alignItems: 'center',
        gap: s.gap,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {emoji && <span>{emoji}</span>}
      {text && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{text}</span>}
    </div>
  );
});

export { CustomStatusBadge };
```

- [ ] **Step 2: Verify build**

Run: `cd aero-chat-app && pnpm build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/CustomStatusBadge.tsx
git commit -m "feat: add CustomStatusBadge component for custom status display"
```

---

### Task 6: CardEffect Component

**Files:**
- Create: `src/components/ui/CardEffect.tsx`
- Modify: `src/index.css` (add effect keyframes)

- [ ] **Step 1: Add card effect keyframes to index.css**

Add after the existing `@keyframes aura-pulse` block (around line 1475 area of `src/index.css`):

```css
/* ── Card effect keyframes ─────────────────────────────────────────── */
@keyframes effect-shimmer {
  0% { left: -100%; }
  100% { left: 200%; }
}
@keyframes effect-bubble-up {
  0% { transform: translateY(0); opacity: 0.7; }
  100% { transform: translateY(-70px); opacity: 0; }
}
@keyframes effect-sparkle {
  0%, 100% { opacity: 0; transform: scale(0); }
  50% { opacity: 1; transform: scale(1); }
}
@keyframes effect-aurora {
  0% { background-position: 0% 50%; }
  100% { background-position: 100% 50%; }
}
@keyframes effect-rain {
  0% { transform: translateY(-14px); }
  100% { transform: translateY(100px); }
}
@keyframes effect-firefly {
  0%, 100% { opacity: 0.2; transform: translate(0, 0); }
  25% { opacity: 1; transform: translate(5px, -3px); }
  50% { opacity: 0.3; transform: translate(-3px, 4px); }
  75% { opacity: 0.9; transform: translate(2px, -2px); }
}
```

- [ ] **Step 2: Create the CardEffect component**

```tsx
// src/components/ui/CardEffect.tsx
import React from 'react';

interface CardEffectProps {
  effect: string | null | undefined;
  playing: boolean;
}

const playState = (playing: boolean) => (playing ? 'running' : 'paused');

function ShimmerEffect({ playing }: { playing: boolean }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: '-100%',
        width: '60%',
        height: '100%',
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent)',
        transform: 'skewX(-20deg)',
        animation: `effect-shimmer 3s ease-in-out infinite`,
        animationPlayState: playState(playing),
      }}
    />
  );
}

const BUBBLE_ITEMS = [
  { size: 16, left: '15%', delay: '0s', dur: '3.5s' },
  { size: 12, left: '40%', delay: '0.8s', dur: '4s' },
  { size: 10, left: '65%', delay: '1.5s', dur: '3s' },
  { size: 14, left: '82%', delay: '0.4s', dur: '4.5s' },
  { size: 8,  left: '30%', delay: '2s', dur: '3.2s' },
];

function BubblesEffect({ playing }: { playing: boolean }) {
  return (
    <>
      {BUBBLE_ITEMS.map((b, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            bottom: 0,
            left: b.left,
            width: b.size,
            height: b.size,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)',
            animation: `effect-bubble-up ${b.dur} ease-in-out infinite`,
            animationDelay: b.delay,
            animationPlayState: playState(playing),
          }}
        />
      ))}
    </>
  );
}

const SPARKLE_ITEMS = [
  { top: '15%', left: '20%', delay: '0s', dur: '1.5s' },
  { top: '40%', left: '60%', delay: '0.4s', dur: '2s' },
  { top: '25%', left: '80%', delay: '0.9s', dur: '1.8s' },
  { top: '55%', left: '35%', delay: '1.3s', dur: '2.2s' },
  { top: '20%', left: '50%', delay: '1.8s', dur: '1.6s' },
  { top: '50%', left: '75%', delay: '0.6s', dur: '2.5s' },
];

function SparklesEffect({ playing }: { playing: boolean }) {
  return (
    <>
      {SPARKLE_ITEMS.map((s, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: s.top,
            left: s.left,
            width: 3,
            height: 3,
            borderRadius: '50%',
            background: 'white',
            animation: `effect-sparkle ${s.dur} ease-in-out infinite`,
            animationDelay: s.delay,
            animationPlayState: playState(playing),
          }}
        />
      ))}
    </>
  );
}

function AuroraEffect({ playing }: { playing: boolean }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(45deg, rgba(0,200,150,0.15), rgba(0,100,255,0.10), rgba(150,0,255,0.12))',
        backgroundSize: '200% 200%',
        animation: `effect-aurora 4s ease-in-out infinite alternate`,
        animationPlayState: playState(playing),
      }}
    />
  );
}

const RAIN_ITEMS = [
  { left: '12%', height: 12, delay: '0s', dur: '0.9s' },
  { left: '30%', height: 10, delay: '0.2s', dur: '1.1s' },
  { left: '50%', height: 14, delay: '0.5s', dur: '0.8s' },
  { left: '68%', height: 8, delay: '0.3s', dur: '1.2s' },
  { left: '85%', height: 11, delay: '0.7s', dur: '1s' },
];

function RainEffect({ playing }: { playing: boolean }) {
  return (
    <>
      {RAIN_ITEMS.map((r, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: -r.height,
            left: r.left,
            width: 1,
            height: r.height,
            background: 'rgba(150,200,255,0.25)',
            animation: `effect-rain ${r.dur} linear infinite`,
            animationDelay: r.delay,
            animationPlayState: playState(playing),
          }}
        />
      ))}
    </>
  );
}

const FIREFLY_ITEMS = [
  { top: '20%', left: '25%', delay: '0s', dur: '3s', color: '#ffd740' },
  { top: '45%', left: '60%', delay: '1s', dur: '4s', color: '#ffe070' },
  { top: '15%', left: '75%', delay: '2s', dur: '3.5s', color: '#ffd740' },
  { top: '55%', left: '40%', delay: '0.5s', dur: '4.5s', color: '#ffcc30' },
];

function FirefliesEffect({ playing }: { playing: boolean }) {
  return (
    <>
      {FIREFLY_ITEMS.map((f, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: f.top,
            left: f.left,
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: f.color,
            boxShadow: `0 0 6px ${f.color}`,
            animation: `effect-firefly ${f.dur} ease-in-out infinite`,
            animationDelay: f.delay,
            animationPlayState: playState(playing),
          }}
        />
      ))}
    </>
  );
}

const EFFECT_MAP: Record<string, React.FC<{ playing: boolean }>> = {
  shimmer: ShimmerEffect,
  bubbles: BubblesEffect,
  sparkles: SparklesEffect,
  aurora: AuroraEffect,
  rain: RainEffect,
  fireflies: FirefliesEffect,
};

/** Card effect overlay. Renders animated particles/effects on top of a card.
 *  Parent must have `position: relative; overflow: hidden`. */
const CardEffect = React.memo(function CardEffect({ effect, playing }: CardEffectProps) {
  if (!effect) return null;
  const EffectComponent = EFFECT_MAP[effect];
  if (!EffectComponent) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 2,
        borderRadius: 'inherit',
      }}
    >
      <EffectComponent playing={playing} />
    </div>
  );
});

export { CardEffect };
```

- [ ] **Step 3: Verify build**

Run: `cd aero-chat-app && pnpm build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/CardEffect.tsx src/index.css
git commit -m "feat: add CardEffect component with 6 animated effects"
```

---

### Task 7: Rich Mini Cards in Sidebar

**Files:**
- Modify: `src/components/chat/Sidebar.tsx`

This is the largest task. The existing `FriendItem` component (lines 756-850 of Sidebar.tsx) needs to be rewritten as a rich mini card showing the friend's identity.

- [ ] **Step 1: Add imports to Sidebar.tsx**

Add at the top of the file with the other imports:

```ts
import { AccentName } from '../ui/AccentName';
import { CustomStatusBadge } from '../ui/CustomStatusBadge';
import { CardEffect } from '../ui/CardEffect';
import { getBannerCss, DEFAULT_ACCENT } from '../../lib/identityConstants';
```

- [ ] **Step 2: Rewrite the FriendItem component**

Replace the existing `FriendItem` memoized component (lines ~756-850) with the new rich mini card version. The component must keep the same Props interface and external behavior (click to select, hover state) but render as a mini card:

```tsx
const FriendItem = React.memo(function FriendItem({
  friend,
  isSelected,
  onSelect,
  currentUserId,
}: {
  friend: Profile;
  isSelected: boolean;
  onSelect: (f: Profile) => void;
  currentUserId: string;
}) {
  const isOnline = usePresenceStore(s => s.presenceReady && s.onlineIds.has(friend.id));
  const game = usePresenceStore(s => s.playingGames.get(friend.id));
  const isTyping = useTypingStore(s => s.typingUsers.has(friend.id));
  const unread = useUnreadStore(s => s.unreadCounts.get(friend.id) ?? 0);
  const storedStatus = useStatusStore(s => s.statuses.get(friend.id)) as Status | undefined;
  const presenceReady = usePresenceStore(s => s.presenceReady);

  const liveStatus: Status = !presenceReady ? 'offline' : !isOnline ? 'offline' : storedStatus ?? 'online';

  const [isHovered, setIsHovered] = useState(false);

  // Friend's identity
  const accentColor = friend.accent_color || null;
  const accentSecondary = friend.accent_color_secondary || null;
  const bannerCss = getBannerCss(friend.banner_gradient);
  const cardImage = friend.card_image_url;
  const cardEffect = friend.card_effect || null;

  // Card background: image > gradient > subtle default
  const cardBg: React.CSSProperties = cardImage
    ? {}
    : bannerCss
      ? {}
      : { background: 'rgba(255,255,255,0.02)' };

  // Status line: custom status > game > typing > presence
  const statusLine = friend.custom_status_emoji || friend.custom_status_text
    ? { emoji: friend.custom_status_emoji, text: friend.custom_status_text }
    : null;

  return (
    <button
      onClick={() => onSelect(friend)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="w-full text-left transition-all"
      style={{
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 4,
        border: isSelected
          ? `1px solid ${accentColor ? accentColor + '40' : 'rgba(0,212,255,0.25)'}`
          : isHovered
            ? `1px solid rgba(255,255,255,0.08)`
            : '1px solid rgba(255,255,255,0.04)',
        opacity: liveStatus === 'offline' ? 0.5 : 1,
        cursor: 'pointer',
      }}
    >
      {/* Card background layer */}
      {cardImage && (
        <>
          <div style={{ position: 'absolute', inset: 0, background: `url(${cardImage}) center/cover`, borderRadius: 12 }} />
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', borderRadius: 12 }} />
        </>
      )}
      {!cardImage && bannerCss && (
        <div style={{ position: 'absolute', inset: 0, background: bannerCss, opacity: 0.12, borderRadius: 12 }} />
      )}

      {/* Card effect overlay (plays on hover) */}
      <CardEffect effect={cardEffect} playing={isHovered && liveStatus !== 'offline'} />

      {/* Avatar with aura ring */}
      <div style={{ position: 'relative', zIndex: 3, flexShrink: 0 }}>
        <AvatarImage
          username={friend.username}
          avatarUrl={friend.avatar_url}
          size="sm"
          status={liveStatus}
          playingGame={game}
        />
      </div>

      {/* Name + status */}
      <div style={{ position: 'relative', zIndex: 3, flex: 1, minWidth: 0 }}>
        <AccentName
          name={friend.username}
          accentColor={accentColor}
          accentColorSecondary={accentSecondary}
          style={{ fontSize: '12.5px', fontWeight: 600 }}
        />
        <div style={{ marginTop: 1 }}>
          {isTyping ? (
            <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', fontStyle: 'italic' }}>typing...</span>
          ) : statusLine ? (
            <CustomStatusBadge emoji={statusLine.emoji} text={statusLine.text} size="sm" />
          ) : game ? (
            <span style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>🎮 {game}</span>
          ) : (
            <span style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>{liveStatus}</span>
          )}
        </div>
      </div>

      {/* Unread badge */}
      {unread > 0 && (
        <div style={{
          position: 'relative', zIndex: 3,
          background: '#ff4060', color: 'white',
          fontSize: 9, fontWeight: 700,
          borderRadius: 10, padding: '1px 6px',
          minWidth: 18, textAlign: 'center',
        }}>
          {unread > 99 ? '99+' : unread}
        </div>
      )}
    </button>
  );
});
```

- [ ] **Step 3: Add the `useState` import if not already present**

Check that `useState` is in the React imports at the top of Sidebar.tsx. If not, add it.

- [ ] **Step 4: Verify build**

Run: `cd aero-chat-app && pnpm build`
Expected: Build succeeds.

- [ ] **Step 5: Visual test**

Run: `cd aero-chat-app && pnpm dev`
Open http://localhost:1420. The friend list should show mini cards with subtle backgrounds. Friends without identity customization show a minimal default card. The layout should not break.

- [ ] **Step 6: Commit**

```bash
git add src/components/chat/Sidebar.tsx
git commit -m "feat: rich mini cards in friend list with accent names and card effects"
```

---

### Task 8: ProfilePopout Component

**Files:**
- Create: `src/components/ui/ProfilePopout.tsx`
- Modify: `src/components/chat/Sidebar.tsx` (wire up hover trigger)

- [ ] **Step 1: Create ProfilePopout component**

```tsx
// src/components/ui/ProfilePopout.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { Profile } from '../../store/authStore';
import { AvatarImage, type Status } from './AvatarImage';
import { AccentName } from './AccentName';
import { CustomStatusBadge } from './CustomStatusBadge';
import { CardEffect } from './CardEffect';
import { getBannerCss, DEFAULT_ACCENT } from '../../lib/identityConstants';

interface ProfilePopoutProps {
  friend: Profile;
  status: Status;
  game?: string | null;
  isInCall?: boolean;
  /** Bounding rect of the trigger element */
  anchorRect: DOMRect;
  /** Direction to open: 'right' (default for sidebar), 'below' (for header) */
  direction?: 'right' | 'below';
  onClose: () => void;
  onMessage?: () => void;
}

const ProfilePopout = React.memo(function ProfilePopout({
  friend,
  status,
  game,
  isInCall,
  anchorRect,
  direction = 'right',
  onClose,
  onMessage,
}: ProfilePopoutProps) {
  const popoutRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // Position the popout relative to anchor
  useEffect(() => {
    if (direction === 'right') {
      setPos({
        top: Math.max(8, Math.min(anchorRect.top, window.innerHeight - 380)),
        left: anchorRect.right + 8,
      });
    } else {
      setPos({
        top: anchorRect.bottom + 8,
        left: Math.max(8, anchorRect.left),
      });
    }
  }, [anchorRect, direction]);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoutRef.current && !popoutRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const accent = friend.accent_color || DEFAULT_ACCENT;
  const bannerCss = getBannerCss(friend.banner_gradient);
  const cardImage = friend.card_image_url;

  const bannerStyle: React.CSSProperties = cardImage
    ? { background: `url(${cardImage}) center/cover` }
    : bannerCss
      ? { background: bannerCss }
      : { background: `linear-gradient(135deg, ${accent}40, ${accent}18)` };

  return createPortal(
    <div
      ref={popoutRef}
      className="animate-fade-in"
      onMouseLeave={onClose}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        width: 280,
        borderRadius: 16,
        overflow: 'hidden',
        background: 'var(--card-bg)',
        border: '1px solid var(--panel-divider)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.4), 0 0 20px rgba(0,100,255,0.06)',
        backdropFilter: 'blur(24px)',
        zIndex: 50,
      }}
    >
      {/* Banner */}
      <div style={{ height: 90, position: 'relative', overflow: 'hidden', ...bannerStyle }}>
        <CardEffect effect={friend.card_effect} playing={true} />
      </div>

      {/* Avatar overlapping banner */}
      <div style={{ padding: '0 16px', marginTop: -26, position: 'relative', zIndex: 3 }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          border: '3px solid var(--card-bg)', overflow: 'hidden',
        }}>
          <AvatarImage
            username={friend.username}
            avatarUrl={friend.avatar_url}
            size="lg"
            status={status}
            playingGame={game}
            isInCall={isInCall}
          />
        </div>
      </div>

      {/* Identity info */}
      <div style={{ padding: '8px 16px 16px' }}>
        <AccentName
          name={friend.username}
          accentColor={friend.accent_color}
          accentColorSecondary={friend.accent_color_secondary}
          style={{ fontSize: 16, fontWeight: 700 }}
        />

        <div style={{ marginTop: 3 }}>
          <CustomStatusBadge
            emoji={friend.custom_status_emoji}
            text={friend.custom_status_text}
            size="md"
          />
          {!friend.custom_status_text && !friend.custom_status_emoji && game && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>🎮 {game}</span>
          )}
          {!friend.custom_status_text && !friend.custom_status_emoji && !game && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{status}</span>
          )}
        </div>

        {/* Bio */}
        {friend.bio && (
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--panel-divider)' }}>
            <div style={{
              fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em',
              color: 'var(--text-muted)', marginBottom: 5, opacity: 0.6,
            }}>
              About Me
            </div>
            <div style={{
              fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.55,
              wordBreak: 'break-word',
            }}>
              {friend.bio}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
          <button
            onClick={onMessage}
            style={{
              flex: 1, textAlign: 'center', padding: 7, borderRadius: 10,
              background: `${accent}18`, border: `1px solid ${accent}28`,
              fontSize: 11, color: accent, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Message
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
});

export { ProfilePopout };
```

- [ ] **Step 2: Wire hover trigger into Sidebar FriendItem**

In the `FriendItem` component (modified in Task 7), add popout state and hover-intent logic. Add these state/ref declarations inside FriendItem:

```tsx
const [showPopout, setShowPopout] = useState(false);
const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const cardRef = useRef<HTMLButtonElement>(null);

const handleMouseEnter = useCallback(() => {
  setIsHovered(true);
  hoverTimerRef.current = setTimeout(() => setShowPopout(true), 200);
}, []);

const handleMouseLeave = useCallback(() => {
  setIsHovered(false);
  if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
  // Don't close popout here — it closes via its own onMouseLeave
}, []);

const handlePopoutClose = useCallback(() => {
  setShowPopout(false);
  setIsHovered(false);
}, []);
```

Replace the existing `onMouseEnter`/`onMouseLeave` handlers on the `<button>` with `handleMouseEnter`/`handleMouseLeave`. Add `ref={cardRef}` to the `<button>`.

Add the popout render after the closing `</button>` tag but before the FriendItem return's closing fragment:

```tsx
{showPopout && cardRef.current && (
  <ProfilePopout
    friend={friend}
    status={liveStatus}
    game={game}
    anchorRect={cardRef.current.getBoundingClientRect()}
    direction="right"
    onClose={handlePopoutClose}
    onMessage={() => { handlePopoutClose(); onSelect(friend); }}
  />
)}
```

Add the import at the top of Sidebar.tsx:

```ts
import { ProfilePopout } from '../ui/ProfilePopout';
```

- [ ] **Step 3: Verify build**

Run: `cd aero-chat-app && pnpm build`
Expected: Build succeeds.

- [ ] **Step 4: Visual test**

Run: `cd aero-chat-app && pnpm dev`
Hover over a friend card for ~200ms. The floating popout should appear to the right. Moving mouse to the popout should keep it open. Moving away from both should close it.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/ProfilePopout.tsx src/components/chat/Sidebar.tsx
git commit -m "feat: add ProfilePopout with hover trigger on friend cards"
```

---

### Task 9: IdentityEditor Component

**Files:**
- Create: `src/components/ui/IdentityEditor.tsx`
- Modify: `src/components/chat/Sidebar.tsx` (add edit button + mount IdentityEditor)

- [ ] **Step 1: Create the IdentityEditor component**

```tsx
// src/components/ui/IdentityEditor.tsx
import React, { useState, useRef, useCallback } from 'react';
import { useAuthStore } from '../../store/authStore';
import {
  ACCENT_PRESETS, BANNER_PRESETS, CARD_EFFECTS,
  BIO_MAX_FREE, BIO_MAX_PREMIUM, STATUS_TEXT_MAX,
} from '../../lib/identityConstants';

/** Identity editor panel — for editing bio, custom status, accent color, banner, card effect. */
export function IdentityEditor({ onClose }: { onClose: () => void }) {
  const user = useAuthStore(s => s.user);
  const updateIdentity = useAuthStore(s => s.updateIdentity);
  const isPremium = user?.is_premium === true;
  const bioMax = isPremium ? BIO_MAX_PREMIUM : BIO_MAX_FREE;

  const [bio, setBio] = useState(user?.bio ?? '');
  const [statusEmoji, setStatusEmoji] = useState(user?.custom_status_emoji ?? '');
  const [statusText, setStatusText] = useState(user?.custom_status_text ?? '');
  const [accentColor, setAccentColor] = useState(user?.accent_color ?? '#00d4ff');
  const [bannerGradient, setBannerGradient] = useState(user?.banner_gradient ?? 'ocean');
  const [cardEffect, setCardEffect] = useState(user?.card_effect ?? null);

  const bioTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveBio = useCallback((val: string) => {
    setBio(val);
    if (bioTimerRef.current) clearTimeout(bioTimerRef.current);
    bioTimerRef.current = setTimeout(() => {
      updateIdentity({ bio: val || null });
    }, 600);
  }, [updateIdentity]);

  const saveStatusText = useCallback((val: string) => {
    setStatusText(val);
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => {
      updateIdentity({ custom_status_text: val || null });
    }, 600);
  }, [updateIdentity]);

  const saveStatusEmoji = useCallback((val: string) => {
    setStatusEmoji(val);
    updateIdentity({ custom_status_emoji: val || null });
  }, [updateIdentity]);

  const saveAccent = useCallback((hex: string) => {
    setAccentColor(hex);
    updateIdentity({ accent_color: hex });
  }, [updateIdentity]);

  const saveBanner = useCallback((id: string) => {
    setBannerGradient(id);
    updateIdentity({ banner_gradient: id });
  }, [updateIdentity]);

  const saveEffect = useCallback((id: string | null) => {
    setCardEffect(id);
    updateIdentity({ card_effect: id });
  }, [updateIdentity]);

  return (
    <div
      className="animate-fade-in"
      style={{
        position: 'absolute', top: '100%', left: 0, right: 0,
        marginTop: 4, zIndex: 30, borderRadius: 16, overflow: 'hidden',
        background: 'var(--popup-bg)', border: '1px solid var(--popup-border)',
        boxShadow: 'var(--popup-shadow)', backdropFilter: 'blur(28px)',
        padding: 14, maxHeight: 420, overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Edit Identity</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}>×</button>
      </div>

      {/* Custom Status */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
          Custom Status
        </label>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={statusEmoji}
            onChange={e => saveStatusEmoji(e.target.value.slice(0, 2))}
            placeholder="😊"
            style={{
              width: 40, textAlign: 'center', padding: '6px 4px', borderRadius: 8,
              background: 'var(--input-bg)', border: '1px solid var(--input-border)',
              color: 'var(--text-primary)', fontSize: 14,
            }}
          />
          <input
            value={statusText}
            onChange={e => saveStatusText(e.target.value.slice(0, STATUS_TEXT_MAX))}
            placeholder="What's up?"
            maxLength={STATUS_TEXT_MAX}
            style={{
              flex: 1, padding: '6px 10px', borderRadius: 8,
              background: 'var(--input-bg)', border: '1px solid var(--input-border)',
              color: 'var(--text-primary)', fontSize: 12,
            }}
          />
        </div>
      </div>

      {/* Bio */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
          About Me <span style={{ opacity: 0.5 }}>({bio.length}/{bioMax})</span>
        </label>
        <textarea
          value={bio}
          onChange={e => saveBio(e.target.value.slice(0, bioMax))}
          placeholder="Tell people about yourself..."
          rows={3}
          style={{
            width: '100%', padding: '8px 10px', borderRadius: 10, resize: 'vertical',
            background: 'var(--input-bg)', border: '1px solid var(--input-border)',
            color: 'var(--text-primary)', fontSize: 12, lineHeight: 1.5,
          }}
        />
      </div>

      {/* Accent Color */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
          Accent Color
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {ACCENT_PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => saveAccent(p.hex)}
              title={p.label}
              style={{
                width: 28, height: 28, borderRadius: 8, background: p.hex, cursor: 'pointer',
                border: accentColor === p.hex ? '2px solid white' : '2px solid transparent',
                boxShadow: accentColor === p.hex ? `0 0 8px ${p.hex}60` : 'none',
                transition: 'border 0.15s, box-shadow 0.15s',
              }}
            />
          ))}
          {isPremium && (
            <input
              type="color"
              value={accentColor}
              onChange={e => saveAccent(e.target.value)}
              title="Custom color"
              style={{
                width: 28, height: 28, borderRadius: 8, cursor: 'pointer',
                border: '2px solid var(--input-border)', padding: 0,
              }}
            />
          )}
        </div>
        {!isPremium && (
          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4, opacity: 0.6 }}>
            🔒 Aero Chat+ unlocks full color picker + gradient names
          </div>
        )}
      </div>

      {/* Banner Gradient */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
          Banner
        </label>
        <div style={{ display: 'flex', gap: 6 }}>
          {BANNER_PRESETS.map(b => (
            <button
              key={b.id}
              onClick={() => saveBanner(b.id)}
              title={b.id}
              style={{
                width: 36, height: 24, borderRadius: 6, background: b.css, cursor: 'pointer',
                border: bannerGradient === b.id ? '2px solid white' : '2px solid transparent',
                transition: 'border 0.15s',
              }}
            />
          ))}
        </div>
      </div>

      {/* Card Effect */}
      <div>
        <label style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
          Card Effect {!isPremium && <span style={{ opacity: 0.5 }}>🔒 Premium</span>}
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <button
            onClick={() => isPremium && saveEffect(null)}
            style={{
              padding: '4px 10px', borderRadius: 8, fontSize: 10, cursor: isPremium ? 'pointer' : 'default',
              background: !cardEffect ? 'var(--input-focus-border)' : 'var(--input-bg)',
              border: '1px solid var(--input-border)', color: 'var(--text-primary)',
              opacity: isPremium ? 1 : 0.4,
            }}
          >
            None
          </button>
          {CARD_EFFECTS.map(ef => (
            <button
              key={ef.id}
              onClick={() => isPremium && saveEffect(ef.id)}
              title={ef.description}
              style={{
                padding: '4px 10px', borderRadius: 8, fontSize: 10, cursor: isPremium ? 'pointer' : 'default',
                background: cardEffect === ef.id ? 'var(--input-focus-border)' : 'var(--input-bg)',
                border: '1px solid var(--input-border)', color: 'var(--text-primary)',
                opacity: isPremium ? 1 : 0.4,
              }}
            >
              {ef.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add edit button to own profile card in Sidebar.tsx**

In the own profile card section of Sidebar.tsx (around lines 340-420), add state for the identity editor and an edit button. Add near the existing state declarations:

```tsx
const [identityEditorOpen, setIdentityEditorOpen] = useState(false);
```

Add the import:

```ts
import { IdentityEditor } from '../ui/IdentityEditor';
```

Add a pencil/edit button near the settings gear button in the profile card. After the settings gear `<button>`:

```tsx
<button
  onClick={() => setIdentityEditorOpen(o => !o)}
  className="hover:opacity-70 transition-opacity"
  title="Edit Identity"
  style={{
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--text-muted)', fontSize: 14, padding: 4,
  }}
>
  ✏️
</button>
```

Add the editor dropdown inside the profile card's relatively-positioned container, alongside the existing status menu and settings menu:

```tsx
{identityEditorOpen && (
  <IdentityEditor onClose={() => setIdentityEditorOpen(false)} />
)}
```

- [ ] **Step 3: Show AccentName and CustomStatusBadge on own profile card**

In the own profile card, replace the hardcoded username text with:

```tsx
<AccentName
  name={user?.username ?? '?'}
  accentColor={user?.accent_color}
  accentColorSecondary={user?.accent_color_secondary}
  style={{ fontSize: 14, fontWeight: 700 }}
/>
```

Below the status button, add custom status display:

```tsx
{(user?.custom_status_emoji || user?.custom_status_text) && (
  <CustomStatusBadge
    emoji={user?.custom_status_emoji}
    text={user?.custom_status_text}
    size="sm"
  />
)}
```

- [ ] **Step 4: Add CardEffect to own profile card**

The own profile card container already has `position: relative; overflow: hidden`. Add the CardEffect:

```tsx
<CardEffect effect={user?.card_effect} playing={isOwnCardHovered} />
```

Add hover state for the own card:

```tsx
const [isOwnCardHovered, setIsOwnCardHovered] = useState(false);
```

And `onMouseEnter={() => setIsOwnCardHovered(true)} onMouseLeave={() => setIsOwnCardHovered(false)}` on the profile card wrapper div.

- [ ] **Step 5: Verify build**

Run: `cd aero-chat-app && pnpm build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/IdentityEditor.tsx src/components/chat/Sidebar.tsx
git commit -m "feat: add IdentityEditor and wire into own profile card"
```

---

### Task 10: ChatWindow Header — Banner Bleed + Accent Line

**Files:**
- Modify: `src/components/chat/ChatWindow.tsx`

- [ ] **Step 1: Add imports**

Add at the top of ChatWindow.tsx with other imports:

```ts
import { AccentName } from '../ui/AccentName';
import { CustomStatusBadge } from '../ui/CustomStatusBadge';
import { getBannerCss, DEFAULT_ACCENT } from '../../lib/identityConstants';
import { getFriendProfile } from '../../store/friendStore';
```

- [ ] **Step 2: Get contact's identity data in the component body**

Near the top of the ChatWindow component (near other store selectors, around lines 170-190), add:

```ts
const contactProfile = contact ? getFriendProfile(contact.id) : null;
const contactAccent = contactProfile?.accent_color || DEFAULT_ACCENT;
const contactAccentSecondary = contactProfile?.accent_color_secondary || null;
const contactBannerCss = getBannerCss(contactProfile?.banner_gradient);
const contactCardImage = contactProfile?.card_image_url;
```

Note: `getFriendProfile` reads from the Zustand store's current state (non-reactive). To make it reactive, use the store selector instead:

```ts
const contactProfile = useFriendStore(s => s.friends.find(f => f.id === contact?.id));
```

Add the import for `useFriendStore`:

```ts
import { useFriendStore } from '../../store/friendStore';
```

- [ ] **Step 3: Modify the header section**

The header is around lines 1458-1584. Replace the header container's inline style to add banner bleed. The existing header div has a style with `borderBottom`, `background`, `backdropFilter`, `borderRadius`. Replace it:

The header wrapper `<div>` should become:

```tsx
<div
  style={{
    padding: '8px 14px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    position: 'relative',
    overflow: 'hidden',
    borderBottom: '1px solid var(--panel-divider)',
    borderRadius: '18px 18px 0 0',
  }}
>
  {/* Banner bleed background */}
  <div style={{
    position: 'absolute', inset: 0,
    background: contactCardImage
      ? `url(${contactCardImage}) center/cover`
      : contactBannerCss || `linear-gradient(135deg, ${contactAccent}20, transparent)`,
    opacity: contactCardImage ? 0.18 : 0.15,
  }} />
  <div style={{
    position: 'absolute', inset: 0,
    backdropFilter: 'blur(20px)',
    background: 'var(--panel-header-bg)',
    opacity: 0.85,
  }} />
  {/* Accent gradient line at bottom */}
  <div style={{
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 2,
    background: contactAccentSecondary
      ? `linear-gradient(90deg, ${contactAccent}, ${contactAccentSecondary}, transparent 70%)`
      : `linear-gradient(90deg, ${contactAccent}80, transparent 60%)`,
  }} />

  {/* ...existing header content (avatar, name, buttons) but with relative z-index */}
```

Wrap all existing header content in a div with `style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}` so it renders above the bleed layers.

- [ ] **Step 4: Replace contact name with AccentName**

Find where the contact's username is rendered in the header (around line 1499-1505). Replace the plain text with:

```tsx
<AccentName
  name={contact?.username ?? ''}
  accentColor={contactAccent}
  accentColorSecondary={contactAccentSecondary}
  style={{ fontSize: 14, fontWeight: 700 }}
/>
```

- [ ] **Step 5: Add custom status to header**

Below the contact name in the header, add:

```tsx
{contactProfile?.custom_status_emoji || contactProfile?.custom_status_text ? (
  <CustomStatusBadge
    emoji={contactProfile.custom_status_emoji}
    text={contactProfile.custom_status_text}
    size="sm"
  />
) : /* existing status/typing/game rendering */ }
```

Integrate this into the existing conditional rendering that shows typing indicator, status, or game activity.

- [ ] **Step 6: Verify build**

Run: `cd aero-chat-app && pnpm build`
Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/components/chat/ChatWindow.tsx
git commit -m "feat: chat header banner bleed with accent line and identity display"
```

---

### Task 11: CompactSidebar Accent Names

**Files:**
- Modify: `src/components/master/CompactSidebar.tsx`

- [ ] **Step 1: Add imports**

```ts
import { AccentName } from '../ui/AccentName';
```

- [ ] **Step 2: Replace friend name rendering with AccentName**

In the friend list rendering (around lines 99-104 of CompactSidebar.tsx), find where the friend's username is rendered as a plain `<span>` or text. Replace with:

```tsx
<AccentName
  name={friend.username}
  accentColor={friend.accent_color}
  accentColorSecondary={friend.accent_color_secondary}
  className="truncate"
  style={{ fontSize: 11 }}
/>
```

- [ ] **Step 3: Verify build**

Run: `cd aero-chat-app && pnpm build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/master/CompactSidebar.tsx
git commit -m "feat: accent-colored names in CompactSidebar"
```

---

### Task 12: Final Integration + Build + Deploy

**Files:**
- All previously modified files

- [ ] **Step 1: Full build verification**

Run: `cd aero-chat-app && pnpm build`
Expected: Clean build with no TypeScript errors.

- [ ] **Step 2: Visual verification**

Run: `cd aero-chat-app && pnpm dev`

Verify in browser at http://localhost:1420:
1. Friend list shows mini cards with card styling (subtle backgrounds)
2. Hovering a friend card shows the floating popout after ~200ms
3. Popout shows banner, avatar, name, status, bio section, message button
4. Card effects play only on hover (frozen at rest)
5. Own profile card shows edit button (pencil)
6. Clicking edit opens IdentityEditor panel
7. Can set custom status (emoji + text), bio, accent color, banner, card effect
8. Changes save and reflect immediately on own card
9. Chat header shows banner bleed with accent gradient line
10. Contact's accent-colored name shows in chat header
11. CompactSidebar shows accent-colored names

- [ ] **Step 3: Deploy to Vercel**

```bash
cd aero-chat-app && vercel --prod --yes
```

- [ ] **Step 4: Final commit with all uncommitted changes (if any)**

```bash
cd aero-chat-app && git add -A && git status
# Only commit if there are remaining changes
git commit -m "feat: Identity Foundation — complete implementation"
```

- [ ] **Step 5: Push to remote**

```bash
cd aero-chat-app && git push origin main
```
