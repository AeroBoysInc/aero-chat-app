# Contact Card Header Bleed — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user opens a chat, the contact's profile card background (gradient preset or custom photo) bleeds into the right ~48% of the chat header with a CSS mask gradient fade, giving each conversation a distinct visual personality.

**Architecture:** Extract `CARD_GRADIENTS` to a shared constant file so both Sidebar and ChatWindow can import it. Add three new columns to `profiles` and a `card-images` Supabase Storage bucket so card data syncs between users. Sidebar writes to Supabase fire-and-forget; ChatWindow reads from the already-live `friends[]` store (updated via `profileChannel` real-time).

**Tech Stack:** React 19 + TypeScript, Zustand, Supabase (PostgreSQL + Storage + Realtime), CSS mask-image

---

## File Map

| File | Action | What changes |
|------|--------|--------------|
| `src/lib/cardGradients.ts` | **Create** | Shared `CARD_GRADIENTS` constant extracted from Sidebar |
| `src/store/authStore.ts` | Modify | Add 3 fields to `Profile` interface; update `refreshProfile` select string |
| `src/store/friendStore.ts` | Modify | Extend select columns in `loadFriends`; spread all fields in `profileChannel` patch |
| `src/components/chat/Sidebar.tsx` | Modify | Import `CARD_GRADIENTS` from shared lib; add silent Supabase sync on gradient change, photo upload, photo removal |
| `src/components/chat/ChatWindow.tsx` | Modify | Import `CARD_GRADIENTS`; add `position: relative; overflow: hidden` to header; add bleed div + vignette |
| `supabase/migrations/012_card_sync.sql` | **Create** | `ALTER TABLE profiles` — 3 columns; `card-images` bucket + INSERT/UPDATE/DELETE RLS policies |

---

## Task 1: Create shared `src/lib/cardGradients.ts` and update Sidebar import

**Files:**
- Create: `src/lib/cardGradients.ts`
- Modify: `src/components/chat/Sidebar.tsx:24-31` (remove local `CARD_GRADIENTS`) and line `1` imports

- [ ] **Step 1: Write the failing test**

Create `src/lib/cardGradients.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { CARD_GRADIENTS } from './cardGradients';

describe('CARD_GRADIENTS', () => {
  it('exports an array with 6 entries', () => {
    expect(CARD_GRADIENTS).toHaveLength(6);
  });

  it('first entry has id ocean', () => {
    expect(CARD_GRADIENTS[0].id).toBe('ocean');
  });

  it('every entry has id, preview, and css fields', () => {
    for (const g of CARD_GRADIENTS) {
      expect(typeof g.id).toBe('string');
      expect(typeof g.preview).toBe('string');
      expect(typeof g.css).toBe('string');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd aero-chat-app && pnpm test src/lib/cardGradients.test.ts
```
Expected: FAIL — `Cannot find module './cardGradients'`

- [ ] **Step 3: Create `src/lib/cardGradients.ts`**

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

- [ ] **Step 4: Update `Sidebar.tsx` to import from shared lib**

In `src/components/chat/Sidebar.tsx`:

Remove lines 23–31 (the local `CARD_GRADIENTS` const block):
```ts
// ── Account card gradient presets ────────────────────────────────────────────
const CARD_GRADIENTS = [
  { id: 'ocean',   preview: '#1a8fff', css: 'linear-gradient(135deg, rgba(0,120,255,0.22) 0%, rgba(56,204,248,0.16) 50%, rgba(255,255,255,0.18) 100%)' },
  { id: 'sunset',  preview: '#ff7b3a', css: 'linear-gradient(135deg, rgba(255,80,50,0.18) 0%, rgba(255,160,0,0.20) 60%, rgba(255,220,80,0.12) 100%)' },
  { id: 'forest',  preview: '#2ecc71', css: 'linear-gradient(135deg, rgba(0,180,80,0.18) 0%, rgba(0,200,160,0.16) 60%, rgba(0,240,200,0.10) 100%)' },
  { id: 'cosmic',  preview: '#9b59b6', css: 'linear-gradient(135deg, rgba(120,0,255,0.20) 0%, rgba(200,0,200,0.14) 55%, rgba(80,0,255,0.10) 100%)' },
  { id: 'rose',    preview: '#e91e8c', css: 'linear-gradient(135deg, rgba(255,50,100,0.18) 0%, rgba(200,50,180,0.14) 55%, rgba(255,100,200,0.10) 100%)' },
  { id: 'steel',   preview: '#90a4ae', css: 'linear-gradient(135deg, rgba(100,150,200,0.16) 0%, rgba(180,200,220,0.20) 60%, rgba(240,248,255,0.18) 100%)' },
] as const;
```

Add import at the top (after line 21, after `GAME_LABELS` import):
```ts
import { CARD_GRADIENTS } from '../../lib/cardGradients';
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd aero-chat-app && pnpm test src/lib/cardGradients.test.ts
```
Expected: PASS (3 tests)

- [ ] **Step 6: Build check**

```bash
cd aero-chat-app && pnpm build
```
Expected: 0 TypeScript errors.

- [ ] **Step 7: Commit**

```bash
cd aero-chat-app && git add src/lib/cardGradients.ts src/lib/cardGradients.test.ts src/components/chat/Sidebar.tsx
git commit -m "refactor: extract CARD_GRADIENTS to shared lib (cardGradients.ts)"
```

---

## Task 2: Extend `Profile` type and `refreshProfile` select in `authStore.ts`

**Files:**
- Modify: `src/store/authStore.ts:4-10` (Profile interface), `src/store/authStore.ts:29` (select string)

- [ ] **Step 1: Write the failing test**

Create `src/store/authStore.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import type { Profile } from './authStore';

describe('Profile type', () => {
  it('accepts card_gradient, card_image_url, card_image_params fields', () => {
    // Compile-time test: if Profile type is missing fields, TypeScript will error
    const p: Profile = {
      id: '1',
      username: 'alice',
      public_key: 'pk',
      card_gradient: 'ocean',
      card_image_url: null,
      card_image_params: { zoom: 1.5, x: 50, y: 50 },
    };
    expect(p.card_gradient).toBe('ocean');
    expect(p.card_image_params?.zoom).toBe(1.5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd aero-chat-app && pnpm test src/store/authStore.test.ts
```
Expected: FAIL — TypeScript error: property `card_gradient` does not exist on type `Profile`

- [ ] **Step 3: Update `authStore.ts`**

In `src/store/authStore.ts`, replace the `Profile` interface (lines 4–10):
```ts
export interface Profile {
  id: string;
  username: string;
  public_key: string;
  avatar_url?: string | null;
  status?: string | null;
  card_gradient?: string | null;
  card_image_url?: string | null;
  card_image_params?: {
    zoom: number;
    x: number;
    y: number;
  } | null;
}
```

Update the `refreshProfile` select string (line 29):
```ts
.select('id, username, public_key, avatar_url, status, card_gradient, card_image_url, card_image_params')
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd aero-chat-app && pnpm test src/store/authStore.test.ts
```
Expected: PASS

- [ ] **Step 5: Build check**

```bash
cd aero-chat-app && pnpm build
```
Expected: 0 TypeScript errors.

- [ ] **Step 6: Commit**

```bash
cd aero-chat-app && git add src/store/authStore.ts src/store/authStore.test.ts
git commit -m "feat: add card_gradient/card_image_url/card_image_params to Profile type"
```

---

## Task 3: Update `friendStore.ts` — select columns + profileChannel spread

**Files:**
- Modify: `src/store/friendStore.ts:39-58` (select strings), `src/store/friendStore.ts:143-149` (profileChannel handler)

- [ ] **Step 1: Write the failing test**

Create `src/store/friendStore.card.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import type { Profile } from './authStore';

describe('friendStore profile spread', () => {
  it('Profile type includes card fields for spread compatibility', () => {
    // A profile update coming from payload.new should be spreadable onto a friend entry
    const existing: Profile = { id: '1', username: 'alice', public_key: 'pk' };
    const updated: Profile = {
      id: '1',
      username: 'alice',
      public_key: 'pk',
      card_gradient: 'sunset',
      card_image_url: 'https://example.com/card.jpg',
      card_image_params: { zoom: 1.2, x: 40, y: 60 },
    };
    const merged = { ...existing, ...updated };
    expect(merged.card_gradient).toBe('sunset');
    expect(merged.card_image_url).toBe('https://example.com/card.jpg');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd aero-chat-app && pnpm test src/store/friendStore.card.test.ts
```
Expected: FAIL if Task 2 has not been committed yet (card fields missing on Profile). If Task 2 is already done this test may pass — that is fine, but **you must still complete Steps 3 and 4 regardless**: this test only validates type compatibility, not the actual `friendStore.ts` select queries or the profileChannel spread handler.

- [ ] **Step 3: Update `friendStore.ts` — select strings**

In `src/store/friendStore.ts`, update all three `.select()` calls in `loadFriends` to include the new columns.

Replace (line 39):
```ts
.select('*, sender:profiles!sender_id(id,username,public_key,avatar_url,status), receiver:profiles!receiver_id(id,username,public_key,avatar_url,status)')
```
With:
```ts
.select('*, sender:profiles!sender_id(id,username,public_key,avatar_url,status,card_gradient,card_image_url,card_image_params), receiver:profiles!receiver_id(id,username,public_key,avatar_url,status,card_gradient,card_image_url,card_image_params)')
```

Replace (line 50):
```ts
.select('*, sender:profiles!sender_id(id,username,public_key,avatar_url,status)')
```
With:
```ts
.select('*, sender:profiles!sender_id(id,username,public_key,avatar_url,status,card_gradient,card_image_url,card_image_params)')
```

Replace (line 57):
```ts
.select('*, receiver:profiles!receiver_id(id,username,public_key,avatar_url,status)')
```
With:
```ts
.select('*, receiver:profiles!receiver_id(id,username,public_key,avatar_url,status,card_gradient,card_image_url,card_image_params)')
```

- [ ] **Step 4: Update `friendStore.ts` — profileChannel handler**

Replace lines 143–149:
```ts
const updated = payload.new as { id: string; status: string };
// Patch the status on any friend whose profile was updated
set(state => ({
  friends: state.friends.map(f =>
    f.id === updated.id ? { ...f, status: updated.status } : f
  ),
}));
```
With:
```ts
const updated = payload.new as Profile;
// Spread all fields so card changes (gradient, image) propagate live
set(state => ({
  friends: state.friends.map(f =>
    f.id === updated.id ? { ...f, ...updated } : f
  ),
}));
```

Also add the `Profile` import if not already present at the top of the file (it is already imported: `import type { Profile } from './authStore';` — confirm it is there).

- [ ] **Step 5: Run test**

```bash
cd aero-chat-app && pnpm test src/store/friendStore.card.test.ts
```
Expected: PASS

- [ ] **Step 6: Build check**

```bash
cd aero-chat-app && pnpm build
```
Expected: 0 TypeScript errors.

- [ ] **Step 7: Commit**

```bash
cd aero-chat-app && git add src/store/friendStore.ts src/store/friendStore.card.test.ts
git commit -m "feat: extend friendStore to load and live-patch card fields on friends"
```

---

## Task 4: Create migration `supabase/migrations/012_card_sync.sql`

**Files:**
- Create: `supabase/migrations/012_card_sync.sql`

No automated test is possible for SQL migrations (requires live Supabase). The verification step is manual.

- [ ] **Step 1: Create the migration file**

```sql
-- Migration 012: card sync columns + storage bucket

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

- [ ] **Step 2: Apply migration manually**

Open Supabase dashboard → SQL Editor → run the migration SQL.

Verify in Table Editor that `profiles` now has `card_gradient`, `card_image_url`, `card_image_params` columns.

Verify in Storage that the `card-images` bucket exists and is set to public.

**Note on public URL access:** Setting `public: true` on the bucket grants unauthenticated read access. If you encounter 403 errors when fetching a public card image URL, add this SELECT policy manually in the SQL Editor:
```sql
CREATE POLICY "card_images_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'card-images');
```

- [ ] **Step 3: Commit**

```bash
cd aero-chat-app && git add supabase/migrations/012_card_sync.sql
git commit -m "feat: migration 012 — card columns on profiles + card-images storage bucket"
```

---

## Task 5: Add Supabase sync write path to `Sidebar.tsx`

**Files:**
- Modify: `src/components/chat/Sidebar.tsx` — `selectCardGradient`, `onCropConfirm`, `removeCardImage`

All three writes are fire-and-forget: no `.catch()`, no error surfacing. `user` is already available via `useAuthStore()` at the top of the component (`const { user, ... } = useAuthStore();`).

- [ ] **Step 1: Update `selectCardGradient`**

Current (lines 106–109):
```ts
function selectCardGradient(id: string) {
  setCardGradient(id);
  localStorage.setItem(CARD_GRADIENT_KEY, id);
}
```

Replace with:
```ts
function selectCardGradient(id: string) {
  setCardGradient(id);
  localStorage.setItem(CARD_GRADIENT_KEY, id);
  if (!user) return;
  supabase.from('profiles').update({ card_gradient: id }).eq('id', user.id);
}
```

- [ ] **Step 2: Update `onCropConfirm`**

Current (lines 125–132):
```ts
function onCropConfirm(params: CropParams) {
  if (!cropModalPending) return;
  setCardImage(cropModalPending);
  setCardCropParams(params);
  setCropModalPending(null);
  try { localStorage.setItem(CARD_IMAGE_KEY, cropModalPending); } catch { /* quota exceeded — active for session only */ }
  try { localStorage.setItem(CARD_PARAMS_KEY, JSON.stringify(params)); } catch { /* ignore */ }
}
```

Replace with:
```ts
async function onCropConfirm(params: CropParams) {
  if (!cropModalPending) return;
  setCardImage(cropModalPending);
  setCardCropParams(params);
  const pendingDataUrl = cropModalPending;
  setCropModalPending(null);
  try { localStorage.setItem(CARD_IMAGE_KEY, pendingDataUrl); } catch { /* quota exceeded — active for session only */ }
  try { localStorage.setItem(CARD_PARAMS_KEY, JSON.stringify(params)); } catch { /* ignore */ }
  if (!user) return;
  // Fire-and-forget Supabase Storage upload
  // The file is stored at `{userId}/card.jpg` — a stable path so removeCardImage can delete it by the same path.
  try {
    const res = await fetch(pendingDataUrl);
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
      }).eq('id', user.id);
    }
  } catch { /* silent failure — local display is unaffected */ }
}
```

- [ ] **Step 3: Update `removeCardImage`**

Current (lines 134–138):
```ts
function removeCardImage() {
  setCardImage(null);
  localStorage.removeItem(CARD_IMAGE_KEY);
  localStorage.removeItem(CARD_PARAMS_KEY);
}
```

Replace with:
```ts
function removeCardImage() {
  setCardImage(null);
  localStorage.removeItem(CARD_IMAGE_KEY);
  localStorage.removeItem(CARD_PARAMS_KEY);
  if (!user) return;
  supabase.storage.from('card-images').remove([`${user.id}/card.jpg`]);
  supabase.from('profiles').update({ card_image_url: null, card_image_params: null })
    .eq('id', user.id);
}
```

- [ ] **Step 4: Build check**

```bash
cd aero-chat-app && pnpm build
```
Expected: 0 TypeScript errors.

- [ ] **Step 5: Commit**

```bash
cd aero-chat-app && git add src/components/chat/Sidebar.tsx
git commit -m "feat: sync card gradient/image to Supabase on change (fire-and-forget)"
```

---

## Task 6: Add contact card bleed layer to `ChatWindow.tsx` header

**Files:**
- Modify: `src/components/chat/ChatWindow.tsx` — imports, derived values near header, header `<div>`, header children

- [ ] **Step 1: Write a smoke test (build-time)**

No runtime unit test is practical for a pure CSS layout effect. Use the build check as the test gate.

```bash
cd aero-chat-app && pnpm build
```
Expected before changes: PASS (baseline).

- [ ] **Step 2: Add `CARD_GRADIENTS` import**

In `src/components/chat/ChatWindow.tsx` at the top, add after the existing `GAME_LABELS` import (line 17):
```ts
import { CARD_GRADIENTS } from '../../lib/cardGradients';
```

- [ ] **Step 3: Add derived values before the header JSX**

Find the header section in `ChatWindow.tsx` (around line 680, the `drag-region` div). Before the header `<div>`, add these derived values (place them near the other contact-derived values like `contactGame`, `liveStatus`):

```tsx
const contactCardGradientCss =
  CARD_GRADIENTS.find(g => g.id === (contact.card_gradient ?? 'ocean'))?.css
  ?? CARD_GRADIENTS[0].css;

const contactCardImageUrl    = contact.card_image_url ?? null;
const contactCardImageParams = contact.card_image_params ?? { zoom: 1.5, x: 50, y: 50 };
```

- [ ] **Step 4: Update header `<div>` to add `position: relative`, `overflow: hidden`, and the vignette gradient**

Find the current header opening tag (around line 682):
```tsx
<div className="drag-region flex items-center gap-3 px-4 py-4"
  style={{ borderBottom: '1px solid var(--panel-divider)', background: 'linear-gradient(180deg, rgba(0,100,255,0.08) 0%, transparent 100%), var(--panel-header-bg)', backdropFilter: 'blur(12px)', borderRadius: '18px 18px 0 0' }}>
```

Replace with:
```tsx
<div className="drag-region flex items-center gap-3 px-4 py-4"
  style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid var(--panel-divider)', background: 'linear-gradient(180deg, rgba(0,100,255,0.07) 0%, transparent 100%), linear-gradient(to left, rgba(0,15,50,0.28) 0%, transparent 55%), var(--panel-header-bg)', backdropFilter: 'blur(12px)', borderRadius: '18px 18px 0 0' }}>
```

- [ ] **Step 5: Add the bleed div as the first child inside the header `<div>`**

Immediately after the opening header `<div>` tag, before the avatar `<AvatarImage>` or any existing children, insert:
```tsx
{/* Contact card bleed layer */}
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
    maskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.5) 30%, rgba(0,0,0,0.85) 65%, black 100%)',
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

- [ ] **Step 6: Ensure header children have `position: relative; zIndex: 3` (or higher)**

The bleed div is at `zIndex: 1`. Content must be at `zIndex: 3` per spec to maintain a clean three-layer stack (base → bleed at 1 → tint baked into `background` → content at 3).

Scan the direct children of the header `<div>` (avatar wrapper, text block, action buttons). Each child that already has an inline style or className should have `position: relative` and `zIndex: 3`. If any child does not, add `style={{ position: 'relative', zIndex: 3 }}` to its wrapper or an enclosing `<div>`.

Typical children to check:
- `<AvatarImage ...>` wrapper — add `style={{ position: 'relative', zIndex: 3, flexShrink: 0 }}` to its immediate wrapper if any
- Username/status text block — add `position: relative; zIndex: 3`
- Action buttons (`<Phone>`, `<Video>`, back button) — add `position: relative; zIndex: 3` to their container

- [ ] **Step 7: Build check**

```bash
cd aero-chat-app && pnpm build
```
Expected: 0 TypeScript errors.

- [ ] **Step 8: Commit**

```bash
cd aero-chat-app && git add src/components/chat/ChatWindow.tsx
git commit -m "feat: contact card header bleed — gradient/photo bleeds into chat header right edge"
```

---

## Task 7: Visual smoke test, full test suite, and deploy

- [ ] **Step 1: Run full test suite**

```bash
cd aero-chat-app && pnpm test
```
Expected: all tests pass (no regressions).

- [ ] **Step 2: Start dev server and verify visually**

```bash
cd aero-chat-app && pnpm dev
```

Open `http://localhost:1420` and verify:
1. Open a chat with a friend — right ~48% of the header shows the contact's gradient (ocean by default). The bleed fades left smoothly into the glass background.
2. If the contact has set a custom card photo, the bleed shows their photo using their crop parameters.
3. Avatar, username, status, and action buttons all render clearly above the bleed.
4. The header top-right corner respects the `18px` border radius (bleed does not overflow).
5. Switch between night and day themes — bleed is visible on both.
6. If you change your own card gradient (your own sidebar) and a friend opens a chat with you, they see the updated gradient after a page refresh (real-time propagation requires migration 012 to be applied).

- [ ] **Step 3: Deploy to Vercel preview**

```bash
cd aero-chat-app && vercel deploy --yes
```

Share the preview URL with the user for review.

- [ ] **Step 4: Deploy to production (only when user approves)**

```bash
cd aero-chat-app && vercel --prod --yes
```
