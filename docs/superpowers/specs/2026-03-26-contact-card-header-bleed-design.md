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

**For gradient contacts:** Apply the gradient's `css` string directly as `background` on the bleed div. If `contact.card_gradient` is not found in the local gradient array (data inconsistency / future preset), fall back to `CARD_GRADIENTS[0].css` (ocean).

**For photo contacts:** Apply `background-image: url(card_image_url)`, `background-size: ${zoom*100}%`, `background-position: ${x}% ${y}%` — matching the crop params they set on their own card for visual consistency.

**Bleed always visible:** After migration 012 applies `DEFAULT 'ocean'` to `card_gradient`, every contact will have a bleed. The bleed div is rendered whenever `contactCardGradientCss` is defined OR `contact.card_image_url` is set. In practice this means all contacts after migration. No "no bleed" fallback is needed in the normal path.

**Day theme:** The bleed at 0.52 opacity and the darkening vignette should be verified visually on both day and night themes during implementation. No separate CSS variables are expected to be needed, but the implementer should check.

**`position: relative` + `overflow: hidden` on header:** The header `<div className="drag-region ...">` must have `position: relative` (so the absolutely-positioned bleed layer is contained) and `overflow: hidden` (so the bleed respects the `borderRadius: '18px 18px 0 0'` corner). Confirm these are present and add them if missing.

## Architecture

### Shared constant — `src/lib/cardGradients.ts` (new file)

Extract `CARD_GRADIENTS` out of `Sidebar.tsx` into a shared module so `ChatWindow.tsx` can import the same array without duplication. Any future additions or CSS changes only need to happen in one place.

```ts
export const CARD_GRADIENTS = [
  { id: 'ocean',  preview: '#1a8fff', css: 'linear-gradient(135deg, rgba(0,120,255,0.22) 0%, rgba(56,204,248,0.16) 50%, rgba(255,255,255,0.18) 100%)' },
  { id: 'sunset', preview: '#ff7b3a', css: 'linear-gradient(135deg, rgba(255,80,50,0.18) 0%, rgba(255,160,0,0.20) 60%, rgba(255,220,80,0.12) 100%)' },
  { id: 'forest', preview: '#2ecc71', css: 'linear-gradient(135deg, rgba(0,180,80,0.18) 0%, rgba(0,200,160,0.16) 60%, rgba(0,240,200,0.10) 100%)' },
  { id: 'cosmic', preview: '#9b59b6', css: 'linear-gradient(135deg, rgba(120,0,255,0.20) 0%, rgba(200,0,200,0.14) 55%, rgba(80,0,255,0.10) 100%)' },
  { id: 'rose',   preview: '#e91e8c', css: 'linear-gradient(135deg, rgba(255,50,100,0.18) 0%, rgba(200,50,180,0.14) 55%, rgba(255,100,200,0.10) 100%)' },
  { id: 'steel',  preview: '#90a4ae', css: 'linear-gradient(135deg, rgba(100,150,200,0.16) 0%, rgba(180,200,220,0.20) 60%, rgba(240,248,255,0.18) 100%)' },
] as const;
```

Update `Sidebar.tsx` to `import { CARD_GRADIENTS } from '../../lib/cardGradients'` and remove the local definition.

### Database — Migration 012 (`supabase/migrations/012_card_sync.sql`)

```sql
-- Add card customization columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS card_gradient    TEXT    DEFAULT 'ocean',
  ADD COLUMN IF NOT EXISTS card_image_url   TEXT,
  ADD COLUMN IF NOT EXISTS card_image_params JSONB;

-- Create card-images storage bucket (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('card-images', 'card-images', true)
ON CONFLICT DO NOTHING;

-- RLS: authenticated users can INSERT their own files
CREATE POLICY "card_images_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'card-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- RLS: authenticated users can UPDATE (overwrite) their own files
CREATE POLICY "card_images_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'card-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  ) WITH CHECK (
    bucket_id = 'card-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- RLS: authenticated users can DELETE their own files
CREATE POLICY "card_images_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'card-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
```

### Type update — `Profile` (`src/store/authStore.ts`)

```ts
export interface Profile {
  id: string;
  username: string;
  public_key: string;
  avatar_url?: string | null;
  status?: string | null;
  card_gradient?: string | null;        // ADD
  card_image_url?: string | null;       // ADD
  card_image_params?: {                 // ADD
    zoom: number;
    x: number;
    y: number;
  } | null;
}
```

Also update the hardcoded `select` string inside `refreshProfile` to include the new columns:

```ts
.select('id, username, public_key, avatar_url, status, card_gradient, card_image_url, card_image_params')
```

### Friend queries — `src/store/friendStore.ts`

**`loadFriends`:** Extend the profile column list in the `select` call to include the three new columns:

```
id, username, public_key, avatar_url, status, card_gradient, card_image_url, card_image_params
```

**`profileChannel` real-time patch:** The current handler only patches `status`. Extend it to spread all fields from `payload.new` so card changes propagate live to open chat windows:

```ts
}, (payload) => {
  const updated = payload.new as Profile;
  set(state => ({
    friends: state.friends.map(f =>
      f.id === updated.id ? { ...f, ...updated } : f
    ),
  }));
})
```

### Write path — `Sidebar.tsx`

Three write locations need Supabase sync added. **All Supabase calls are fire-and-forget** (no error surfacing to the user). localStorage continues to drive the local sidebar card display regardless of network state; Supabase is additive. A failed write is silent — the user's own card still looks correct locally, and other users will see the old value until the next successful write.

**Gradient change** — add after the existing `localStorage.setItem(CARD_GRADIENT_KEY, id)`:
```ts
supabase.from('profiles').update({ card_gradient: id }).eq('id', user.id ?? '');
```

**Photo upload** (`onCropConfirm`) — add after the existing localStorage saves:
```ts
// Convert the already-resized base64 to a Blob and upload
const res = await fetch(cropModalPending); // cropModalPending is the base64 data URL
const blob = await res.blob();
const { data: uploadData } = await supabase.storage
  .from('card-images')
  .upload(`${user.id}/card.jpg`, blob, { upsert: true, contentType: 'image/jpeg' });
if (uploadData) {
  const { data: urlData } = supabase.storage
    .from('card-images')
    .getPublicUrl(`${user.id}/card.jpg`);
  supabase.from('profiles').update({
    card_image_url:    urlData.publicUrl,
    card_image_params: params,
  }).eq('id', user.id ?? '');
}
```

**Photo removal** (`removeCardImage`) — add after the existing localStorage removes:
```ts
supabase.storage.from('card-images').remove([`${user.id}/card.jpg`]);
supabase.from('profiles').update({ card_image_url: null, card_image_params: null })
  .eq('id', user.id ?? '');
```

### Read path — `ChatWindow.tsx`

The `contact` prop is already a `Profile`. With the updated type, `loadFriends` query, and `profileChannel` patch, card fields arrive automatically — no additional queries needed.

New derived values (import `CARD_GRADIENTS` from `../../lib/cardGradients`):

```tsx
const contactCardGradientCss =
  CARD_GRADIENTS.find(g => g.id === (contact.card_gradient ?? 'ocean'))?.css
  ?? CARD_GRADIENTS[0].css; // fallback for unknown gradient id

const contactCardImageUrl    = contact.card_image_url ?? null;
const contactCardImageParams = contact.card_image_params ?? { zoom: 1.5, x: 50, y: 50 };
// Note: card_image_params null-default is only reached if card_image_url is set
// but card_image_params is null — an unlikely data inconsistency; the default is defensive only.
```

New bleed layer inside the header `<div>` (add `position: relative; overflow: hidden` to the header div if not already present), before the existing content:

```tsx
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
```

Update the header `<div>` background style to add the right-edge vignette:

```tsx
background: 'linear-gradient(180deg, rgba(0,100,255,0.08) 0%, transparent 100%), linear-gradient(to left, rgba(0,15,50,0.28) 0%, transparent 55%), var(--panel-header-bg)',
```

Ensure existing content children maintain `position: relative; z-index: 3` (or higher) so they render above the bleed and tint layers.

## File Map

| File | Action | What changes |
|------|--------|--------------|
| `supabase/migrations/012_card_sync.sql` | **Create** | `ALTER TABLE profiles` — 3 columns; `card-images` bucket + INSERT/UPDATE/DELETE RLS policies |
| `src/lib/cardGradients.ts` | **Create** | Shared `CARD_GRADIENTS` constant extracted from Sidebar |
| `src/store/authStore.ts` | Modify | Add 3 fields to `Profile` interface; update `refreshProfile` select string |
| `src/store/friendStore.ts` | Modify | Extend profile column list in `loadFriends`; extend `profileChannel` patch to spread all fields |
| `src/components/chat/Sidebar.tsx` | Modify | Import `CARD_GRADIENTS` from shared lib; add silent Supabase sync on gradient change, photo upload, photo removal |
| `src/components/chat/ChatWindow.tsx` | Modify | Import `CARD_GRADIENTS`; add bleed layer + vignette to header; add `position: relative; overflow: hidden` to header div |

## Behaviour Details

- **Real-time card updates:** When a contact changes their card mid-session, `profileChannel` fires an UPDATE, the friend entry is spread with all new fields including `card_gradient`/`card_image_url`/`card_image_params`, and the ChatWindow header re-renders immediately.
- **All contacts get a bleed:** The `DEFAULT 'ocean'` on migration means every contact row resolves to a defined gradient. All chat headers will show a bleed after migration.
- **CallView chat panel:** `ChatWindow` is reused inside `CallView`. The bleed appears there with no extra work.
- **Mobile:** Same component, same header — bleed renders unchanged on mobile layout.
- **Write failures are silent:** Supabase writes are additive. localStorage remains the source of truth for the local card display. A failed Supabase write doesn't surface an error — the user's own card looks correct; other users see the previous value until the next write succeeds.

## Out of Scope

- Exposing the contact's card background in friend list popups, incoming call modal, or any surface other than the ChatWindow header
- Per-conversation card overrides
- Animated gradient bleeds
