# Identity Foundation — Design Spec

**Sub-project 1 of 3** in the Expressive Identity customization phase.

## Goal

Give every user a visible identity that others see throughout the app — accent-colored names, custom statuses, bios, personalized profile cards with effects, and a rich hover popout. The friend list becomes a living gallery of identities. Each chat conversation is tinted by the contact's personality.

## Architecture

All identity data lives on the `profiles` table as new columns. Friends' identity data is fetched alongside friend profiles and cached in `friendStore`. Real-time updates broadcast via the existing Supabase presence channel so changes appear instantly to friends. New UI components (`ProfilePopout`, `CardEffect`, `AccentName`, `CustomStatusBadge`, `IdentityEditor`) are composed into existing surfaces (Sidebar, ChatWindow, CompactSidebar).

## Priority Order (Full Customization Phase)

1. **Sub-project 1 — Identity Foundation** (this spec): Core identity fields, UI surfaces, infrastructure
2. **Sub-project 2 — Visual Flair**: Banner images, profile effects detail work, animated GIF avatars, name effects/styles
3. **Sub-project 3 — Custom Colors**: Full gradient color picker for bubbles and custom aura ring colors

---

## Database Schema

New columns on the `profiles` table (single migration):

| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| `bio` | `text` | `null` | Max 500 chars enforced at app level |
| `custom_status_text` | `text` | `null` | Max 128 chars |
| `custom_status_emoji` | `text` | `null` | Single emoji character |
| `accent_color` | `text` | `null` | Hex string e.g. `#00d4ff`. Null falls back to default cyan |
| `accent_color_secondary` | `text` | `null` | Premium only. Second hex color for gradient names/aura |
| `banner_gradient` | `text` | `null` | Preset gradient ID from `BANNER_PRESETS` |
| `banner_image_url` | `text` | `null` | Reserved for Sub-project 2 (uploaded banner image) |
| `card_effect` | `text` | `null` | Premium effect ID: `shimmer`, `bubbles`, `sparkles`, `aurora`, `rain`, `fireflies`. Null = no effect (free), shimmer default for premium |

RLS policy: All columns readable by authenticated users (friends need to see your identity). Writable only by the owning user (`auth.uid() = id`).

---

## Premium Gating

| Feature | Free | Premium (Aero Chat+) |
|---------|------|----------------------|
| Bio | 150 characters | 500 characters |
| Custom Status | Emoji + text (128 chars) | Same |
| Accent Color | 12 preset colors | Full color picker + secondary color for gradients |
| Banner | 6 preset gradients | Same + image upload (Sub-project 2) |
| Card Effects | None | 6 effects (shimmer, bubbles, sparkles, aurora, rain, fireflies) |
| Popout / Mini Cards | Sees others' full identity | Same |

Key principle: everyone sees rich identities on others (drives FOMO), but creating the richest identity requires premium.

---

## Free Accent Color Presets

12 colors available to all users:

| Name | Hex |
|------|-----|
| Cyan | `#00d4ff` |
| Blue | `#3d8bfd` |
| Purple | `#a060ff` |
| Pink | `#ff60b0` |
| Red | `#ff4060` |
| Orange | `#ff9a4d` |
| Gold | `#ffd740` |
| Green | `#4fc97a` |
| Teal | `#20c9b0` |
| Silver | `#e0e8f0` |
| Rose | `#f5c6d0` |
| Steel | `#b0c4de` |

Premium users bypass this list and use a full hex color picker. They can also set `accent_color_secondary` for gradient-style names.

---

## Banner Gradient Presets

6 preset gradients available to all users. These replace the existing `card_gradient` column — the new `banner_gradient` column supersedes it. Migration should copy existing `card_gradient` values to `banner_gradient` for users who already set one, then the old column can be ignored (not dropped, to avoid breaking older clients).

| ID | Gradient |
|----|----------|
| `ocean` | `linear-gradient(135deg, #0044aa, #0088cc)` |
| `sunset` | `linear-gradient(135deg, #cc4400, #ff8800)` |
| `forest` | `linear-gradient(135deg, #006644, #00aa66)` |
| `cosmic` | `linear-gradient(135deg, #2a0066, #6600cc)` |
| `rose` | `linear-gradient(135deg, #aa2255, #ff6699)` |
| `steel` | `linear-gradient(135deg, #2a3a4a, #4a6a8a)` |

These serve as both the popout banner background and the mini card background tint (at reduced opacity). Users who have a `card_image_url` (existing feature) see their image as the banner instead.

---

## Card Effects

6 CSS-based effects. All premium-only. Rendered by a `CardEffect` component that accepts `effect: string` and `playing: boolean`.

| ID | Visual | Implementation |
|----|--------|----------------|
| `shimmer` | Diagonal light sweep across card | CSS `@keyframes` moving a gradient pseudo-element (already exists for premium cards) |
| `bubbles` | Translucent circles drifting upward | 4-6 absolutely positioned `<div>` elements with `@keyframes` vertical float + fade. Frutiger Aero signature. |
| `sparkles` | Tiny star-like dots that blink in and out | 5-8 small dots with staggered `@keyframes` scale + opacity cycles |
| `aurora` | Slow-moving color bands washing across | CSS `background-size: 200% 200%` with `@keyframes background-position` animation |
| `rain` | Soft diagonal lines falling downward | 4-5 thin `<div>` elements with `@keyframes translateY` |
| `fireflies` | Small warm dots floating lazily | 3-5 dots with `box-shadow` glow and multi-step `@keyframes` for position + opacity |

**Hover behavior:**
- **At rest**: Effects are frozen — static shapes are visible as a decorative hint but no animation runs (`animation-play-state: paused` or no animation applied).
- **On hover**: Effects start animating (`animation-play-state: running`). This applies to mini cards in the friend list, the floating popout, and the own-profile card.
- This is performance-conscious: dozens of friend cards in the sidebar won't run animations simultaneously.

---

## New Components

### `ProfilePopout.tsx`

Floating card that appears on hover over any friend avatar/card. Renders as a React portal positioned to the right of the hovered element.

**Contents (top to bottom):**
1. Banner area (90px tall): user's `banner_gradient` or `card_image_url` as background. `CardEffect` overlay plays here.
2. Avatar: overlaps banner bottom edge. Shows user's avatar with aura ring in their accent color.
3. Username: rendered via `AccentName` (single color or gradient for premium).
4. Custom status: emoji + text via `CustomStatusBadge`.
5. Bio section: labeled "About Me", shows `bio` text. Hidden if no bio set.
6. Metadata: "Member Since" date.
7. Action buttons: "Message" (accent-colored), phone icon, video icon.

**Positioning:** Appears to the right of the sidebar (left edge of chat area) when hovering a sidebar friend card. For chat header avatar hover, appears below the header. Uses `position: fixed` with calculated coordinates from the hovered element's bounding rect. Stays open while the mouse is over either the trigger element or the popout itself (standard hover-intent pattern with ~200ms delay before showing, ~300ms delay before hiding).

**Z-index:** Above all other content (`z-index: 50`).

### `CardEffect.tsx`

Reusable overlay component for card effects.

**Props:**
- `effect: string | null` — effect ID from the 6 presets. Null = no effect.
- `playing: boolean` — whether animations are running (controlled by parent's hover state).

**Renders:** An absolutely-positioned div (`inset: 0, overflow: hidden, pointer-events: none`) containing the effect's animated elements. When `playing` is false, elements are rendered but with `animation-play-state: paused`.

**Used by:** `ProfilePopout` (always playing when open), sidebar mini cards (playing on hover), own profile card in sidebar (playing on hover).

### `AccentName.tsx`

Renders a username with their identity color.

**Props:**
- `name: string`
- `accentColor: string | null` — primary accent hex
- `accentColorSecondary: string | null` — secondary accent hex (premium gradient)
- `className?: string`

**Renders:** A `<span>` with either `color: accentColor` (single color) or `background: linear-gradient(90deg, primary, secondary); -webkit-background-clip: text; -webkit-text-fill-color: transparent` (gradient). Falls back to `var(--text-primary)` if no accent set.

**Used by:** Sidebar friend list, chat header, ProfilePopout, CompactSidebar.

### `CustomStatusBadge.tsx`

Renders the custom status emoji + text.

**Props:**
- `emoji: string | null`
- `text: string | null`
- `size?: 'sm' | 'md'` — sm for mini cards (9.5px), md for popout (11px)

**Renders:** `<div>` with emoji followed by text. Hidden entirely if both are null.

**Used by:** Sidebar mini cards, ProfilePopout, chat header.

### `IdentityEditor.tsx`

Settings panel for editing your own identity. Accessed from the own-profile card in the sidebar (e.g. a pencil/edit button).

**Sections:**
1. **Custom Status**: Emoji picker button + text input (128 char limit). Clear button.
2. **Bio**: Textarea (150 chars free / 500 premium). Character counter.
3. **Accent Color**: 12 preset color circles for free users. Full color picker input for premium. Secondary color picker for premium (with "Gradient name" label).
4. **Banner**: 6 gradient preset thumbnails. Premium badge on image upload option (Sub-project 2).
5. **Card Effect**: 6 effect thumbnail previews (premium-locked for free users). Currently selected effect highlighted.

Each section saves to the `profiles` table on change (debounced for text fields, immediate for color/effect selection). Uses existing Supabase client from `authStore`.

---

## Modified Components

### `Sidebar.tsx` — Friend List

**Current:** Friends render as simple rows with avatar, name, status dot.

**New:** Each friend renders as a Rich Mini Card:
- Background: friend's `banner_gradient` (at ~10-12% opacity) or `card_image_url` (darkened to ~55% opacity). Falls back to subtle `rgba(255,255,255,0.02)` if no customization.
- Border: `1px solid rgba(255,255,255,0.05)`, rounded 12px.
- Avatar: existing `AvatarImage` with aura ring (uses friend's `accent_color` if set).
- Name: `AccentName` component with friend's accent color(s).
- Status line: `CustomStatusBadge` if set, otherwise falls back to presence status text (online/busy/away/offline).
- Unread badge: existing, positioned at right.
- `CardEffect` overlay with `playing={isHovered}`.
- Offline friends: entire card at 50% opacity, no effect animation.

**Hover behavior:**
- Card gets subtle brightness increase (border brightens to `rgba(accentColor, 0.2)`).
- `CardEffect` starts playing.
- After 200ms hover intent delay, `ProfilePopout` appears to the right.
- Popout stays open while mouse is over card or popout. Closes after 300ms of leaving both.

**Row height:** ~52px (up from current ~40px) to accommodate the card styling.

### `Sidebar.tsx` — Own Profile Card

**Current:** Card at top with gradient background, avatar, name, status selector, settings gear.

**New additions:**
- `CardEffect` overlay with `playing={isHovered}`.
- Edit button (pencil icon) that opens `IdentityEditor` as a dropdown/panel.
- `CustomStatusBadge` showing own custom status.
- Name rendered via `AccentName` with own accent color.

### `ChatWindow.tsx` — Header

**Current:** Simple header with avatar, name, call/video buttons.

**New:** Banner bleed + accent line:
- Header background: contact's `banner_gradient` or `card_image_url` rendered at ~18% opacity, with `backdrop-filter: blur(20px)` and dark overlay (~55% opacity).
- Accent gradient line: 2px line at bottom of header. `linear-gradient(90deg, accent_color 0%, accent_color_secondary 40%, transparent 70%)`. If no secondary, just primary fading to transparent.
- Name: `AccentName` component.
- Custom status: `CustomStatusBadge` (size "sm") below name.
- Avatar hover: triggers `ProfilePopout` below the header.

### `CompactSidebar.tsx`

- Friend entries get accent-colored names via `AccentName`.
- Avatar hover triggers `ProfilePopout`.

### `authStore.ts`

Profile interface extended with new fields:
```
bio, custom_status_text, custom_status_emoji, accent_color, accent_color_secondary, banner_gradient, banner_image_url, card_effect
```

New actions:
- `updateIdentity(fields: Partial<IdentityFields>)` — updates one or more identity fields on `profiles` table and local state. Debounced for text fields.

### `friendStore.ts`

- When fetching friends, select all new identity columns from `profiles`.
- Cache in a `friendProfiles: Map<string, FriendIdentity>` where `FriendIdentity` contains the identity fields.
- Subscribe to profile changes via Supabase realtime: when a friend updates their profile, the cached data updates and UI re-renders.

### `presenceStore.ts`

- No structural changes needed. Presence continues to track online/offline/status.
- Custom status (text + emoji) is separate and comes from `friendStore` profile data, not presence.

---

## Data Flow

### Reading friend identity:
1. `friendStore` fetches friend profiles (including new columns) on login and caches them.
2. Components read from `friendStore.friendProfiles.get(friendId)` for accent_color, bio, custom_status, banner_gradient, card_effect.
3. Supabase realtime subscription on `profiles` table (filtered to friend IDs) updates the cache when a friend changes their identity.

### Writing own identity:
1. User edits via `IdentityEditor` component.
2. `authStore.updateIdentity()` writes to Supabase `profiles` table.
3. Local `authStore.user` profile updates immediately (optimistic).
4. Supabase realtime propagates the change to friends who have us in their friend list.

### Accent color in chat messages:
- When rendering a received message, look up sender's `accent_color` from `friendStore.friendProfiles` and pass to `AccentName` for the sender name display.
- Sent messages continue using the existing bubble style system (accent color applies to the sender's name label above the message, not the bubble itself).

---

## Performance Considerations

- **Card effects only animate on hover**: prevents dozens of simultaneous CSS animations in the friend list. At rest, effect elements are rendered but paused (`animation-play-state: paused`).
- **Friend identity data cached in memory**: no per-render Supabase queries. Single subscription for realtime updates.
- **ProfilePopout renders as portal**: only one popout exists at a time, created/destroyed on hover intent.
- **Mini card backgrounds**: gradient backgrounds are cheap (CSS only). Image backgrounds use the existing `card_image_url` which is already a Supabase Storage URL with CDN caching.
- **Hover intent delays** (200ms show, 300ms hide): prevents popout flickering when moving mouse across the friend list.
- **AccentName** is a pure component — memoized, re-renders only when accent color or name changes.

---

## Migration SQL

```sql
-- Migration: add identity customization columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS custom_status_text text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS custom_status_emoji text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS accent_color text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS accent_color_secondary text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banner_gradient text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banner_image_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS card_effect text;
```

No new RLS policies needed — existing `profiles` policies already allow authenticated read and owner-only write.
