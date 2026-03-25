# Contact Card Header Bleed — Design Spec

## Goal

When a user opens a chat, the contact's profile card background (gradient preset or custom photo) bleeds into the right side of the chat header with a smooth gradient fade, giving each conversation a distinct visual personality tied to the person you're talking to.

## Visual Design

**Layout:** The contact's card background occupies the **right ~48%** of the chat header div. It is masked with a CSS `mask-image` gradient fading from transparent (left edge of the bleed zone) to fully opaque (right edge), so it seamlessly melts into the existing glass background on the left.

**Layering (bottom to top):**
1. `var(--panel-header-bg)` — base glass background (unchanged)
2. Bleed layer — contact's gradient CSS or `url(card_image_url)` with their crop params, right-aligned, `opacity: 0.52`
3. Glass tint — `linear-gradient(180deg, rgba(0,100,255,0.07) 0%, transparent 100%)` (existing) + `linear-gradient(to left, rgba(0,15,50,0.28) 0%, transparent 55%)` (new right-edge darkening vignette)
4. Avatar, text, buttons — `z-index: 3`, unchanged

**Mask formula:**
```css
mask-image: linear-gradient(
  to right,
  transparent 0%,
  rgba(0,0,0,0.5) 30%,
  rgba(0,0,0,0.85) 65%,
  black 100%
);
```

**For gradient contacts:** Apply the gradient's `css` string directly as `background` on the bleed div.

**For photo contacts:** Apply `background-image: url(card_image_url)`, `background-size: ${zoom*100}%`, `background-position: ${x}% ${y}%` — matching the crop params they set on their own card for visual consistency.

**Fallback:** If the contact has neither a `card_gradient` nor a `card_image_url` set in their profile, no bleed layer is rendered. The header appears as it does today.

## Architecture

### Database — Migration 012

Add three columns to `profiles`:

```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS card_gradient   TEXT DEFAULT 'ocean',
  ADD COLUMN IF NOT EXISTS card_image_url  TEXT,
  ADD COLUMN IF NOT EXISTS card_image_params JSONB;
```

`card_gradient` defaults to `'ocean'` (matches the existing localStorage default) so existing users immediately have a gradient bleed without needing to do anything.

`card_image_url` is `NULL` until the user uploads a photo. When set, it takes visual precedence over `card_gradient`.

`card_image_params` is `NULL` until a photo is uploaded; stores `{ zoom: number, x: number, y: number }`.

### Storage — Supabase bucket `card-images`

- Public read (images served as CDN URLs)
- RLS: authenticated users can upload/update/delete only their own files (path prefix = `{user_id}/`)
- Object path pattern: `{user_id}/card.jpg` (single file per user — overwrite on re-upload)

### Type update — `Profile` (authStore.ts)

```ts
export interface Profile {
  id: string;
  username: string;
  public_key: string;
  avatar_url?: string | null;
  status?: string | null;
  card_gradient?: string | null;       // ADD
  card_image_url?: string | null;      // ADD
  card_image_params?: {                // ADD
    zoom: number;
    x: number;
    y: number;
  } | null;
}
```

### Write path — Sidebar.tsx

Two changes when the user saves their card:

**Gradient change** (`setCardGradient`):
- Existing: saves to `localStorage`
- Add: `supabase.from('profiles').update({ card_gradient: id }).eq('id', user.id)`

**Photo upload** (`onCropConfirm`):
- Existing: saves resized base64 + params to `localStorage`
- Add:
  1. Convert base64 to `Blob`
  2. `supabase.storage.from('card-images').upload('{user_id}/card.jpg', blob, { upsert: true })`
  3. Get public URL via `supabase.storage.from('card-images').getPublicUrl('{user_id}/card.jpg')`
  4. `supabase.from('profiles').update({ card_image_url: url, card_image_params: params }).eq('id', user.id)`

**Photo removal** (`removeCardImage`):
- Existing: removes from `localStorage`
- Add:
  1. `supabase.storage.from('card-images').remove(['{user_id}/card.jpg'])`
  2. `supabase.from('profiles').update({ card_image_url: null, card_image_params: null }).eq('id', user.id)`

> **localStorage is kept as-is** for the sidebar card display (fast, sync, no network round-trip). Supabase is the additional sync layer so other users can read the card data.

### Read path — friendStore.ts

The existing `loadFriends` query uses `select('*, sender:profiles!sender_id(...), receiver:profiles!receiver_id(...)')`. Extend the profile column list to include the three new columns:

```
id, username, public_key, avatar_url, status, card_gradient, card_image_url, card_image_params
```

The `profileChannel` real-time subscription (UPDATE on `profiles`) already patches friend entries — it will automatically propagate card changes to open chat windows since the patch applies to all fields in `payload.new`.

### Read path — ChatWindow.tsx

The `contact` prop is already a `Profile`. With the updated `Profile` type and friend query, it will carry the card fields automatically. No new queries needed.

New derived value in the component:

```tsx
// Determine bleed source from contact's profile
const CARD_GRADIENTS = [ /* same array as Sidebar */ ];
const contactCardGradientCss = CARD_GRADIENTS.find(g => g.id === (contact.card_gradient ?? 'ocean'))?.css;
const contactCardImageUrl    = contact.card_image_url;
const contactCardImageParams = contact.card_image_params ?? { zoom: 1.5, x: 50, y: 50 };
const hasBleed = !!(contactCardImageUrl || contactCardGradientCss);
```

New JSX inside the header `<div>` (before the glass tint overlay):

```tsx
{hasBleed && (
  <div
    aria-hidden="true"
    style={{
      position: 'absolute',
      top: 0, right: 0, bottom: 0,
      width: '48%',
      zIndex: 1,
      opacity: 0.52,
      borderRadius: '0 18px 0 0',
      WebkitMaskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.5) 30%, rgba(0,0,0,0.85) 65%, black 100%)',
      maskImage:       'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.5) 30%, rgba(0,0,0,0.85) 65%, black 100%)',
      ...(contactCardImageUrl
        ? {
            backgroundImage:    `url(${contactCardImageUrl})`,
            backgroundSize:     `${contactCardImageParams.zoom * 100}%`,
            backgroundPosition: `${contactCardImageParams.x}% ${contactCardImageParams.y}%`,
          }
        : { background: contactCardGradientCss }),
    }}
  />
)}
```

Add the right-edge vignette to the existing header style:

```tsx
background: 'linear-gradient(180deg, rgba(0,100,255,0.08) 0%, transparent 100%), linear-gradient(to left, rgba(0,15,50,0.28) 0%, transparent 55%), var(--panel-header-bg)',
```

All existing children (`AvatarImage`, text block, action buttons) get `position: relative; z-index: 3` if not already set — they already have `z-index: 2` or above via class, so this is likely a no-op confirmation.

## File Map

| File | Action | What changes |
|------|--------|--------------|
| `supabase/migrations/012_card_sync.sql` | **Create** | `ALTER TABLE profiles` — add 3 columns; create `card-images` bucket + RLS policies |
| `src/store/authStore.ts` | Modify | Add `card_gradient`, `card_image_url`, `card_image_params` to `Profile` interface |
| `src/store/friendStore.ts` | Modify | Extend profile column list in `loadFriends` query to include new fields |
| `src/components/chat/Sidebar.tsx` | Modify | Add Supabase sync on gradient change, photo upload, and photo removal |
| `src/components/chat/ChatWindow.tsx` | Modify | Add bleed layer + vignette to chat header using contact's card fields |

## Behaviour Details

- **Real-time updates:** The `profileChannel` UPDATE subscription in `friendStore` already fires when any profile column changes. When a contact updates their card mid-session, the friend entry is patched, and because `contact` is derived from the friend list in `ChatWindow`, the header re-renders automatically.
- **No bleed on `contact.card_gradient = null`:** Treat null as 'ocean' (the default), so virtually all users get a bleed. Only an explicit `NULL` at the DB level (pre-existing rows before migration) falls back; the migration default `'ocean'` handles this for new writes.
- **Day theme:** The existing glass tint and vignette layers are sufficient — the bleed at 0.52 opacity looks natural on both day and night themes without theme-specific adjustments.
- **CallView chat panel:** `ChatWindow` is reused inside `CallView`'s chat side panel. The bleed will appear there too with no extra work.
- **Mobile:** Same component, same header — bleed works on mobile layout unchanged.

## Out of Scope

- Exposing the contact's card background in any other surface (e.g., friend list popups, incoming call modal)
- Per-conversation card overrides
- Animated gradient bleeds
