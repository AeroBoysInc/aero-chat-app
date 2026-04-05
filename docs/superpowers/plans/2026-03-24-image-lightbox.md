# Image Lightbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "open image in new tab" behavior with an inline lightbox modal that shows the full-size image, filename, file size, and a download button.

**Architecture:** A new `ImageLightbox` component rendered once inside `ChatWindow`. `FileMessage` receives an `onImageClick` callback prop instead of wrapping images in an `<a target="_blank">`. Lightbox state lives in `ChatWindow` as a single `useState`.

**Tech Stack:** React, TypeScript, Tailwind CSS, Lucide icons (already in project)

**Spec:** `docs/superpowers/specs/2026-03-24-image-lightbox-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/components/chat/ImageLightbox.tsx` | Lightbox overlay — full-size image, info bar, download button, dismiss handling |
| Modify | `src/components/chat/ChatWindow.tsx` | Add lightbox state, wire `onImageClick` into `FileMessage`, render `ImageLightbox` |

---

## Task 1: Create `ImageLightbox` component

**Files:**
- Create: `src/components/chat/ImageLightbox.tsx`

- [ ] **Step 1: Create `ImageLightbox.tsx` with full implementation**

```tsx
import { useEffect } from 'react';
import { X, Download } from 'lucide-react';

interface ImageLightboxProps {
  image: { url: string; name: string; size: number } | null;
  onClose: () => void;
}

function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export function ImageLightbox({ image, onClose }: ImageLightboxProps) {
  useEffect(() => {
    if (!image) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [image, onClose]);

  if (!image) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="glass-elevated mx-4 max-w-[90vw] p-4 animate-fade-in relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full transition-all hover:scale-110 active:scale-95"
          style={{ background: 'rgba(0,0,0,0.35)', color: '#fff' }}
        >
          <X className="h-4 w-4" />
        </button>

        {/* Image */}
        <img
          src={image.url}
          alt={image.name}
          className="rounded-aero block"
          style={{ maxWidth: '85vw', maxHeight: '75vh', objectFit: 'contain' }}
        />

        {/* Info bar + download */}
        <div className="mt-3 flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {image.name}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {fmtBytes(image.size)}
            </p>
          </div>
          <a
            href={image.url}
            download={image.name}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-9 items-center gap-2 rounded-aero px-4 text-sm font-semibold transition-all hover:scale-105 active:scale-95"
            style={{
              background: 'linear-gradient(180deg, #00e0ff 0%, #00a8cc 100%)',
              color: '#fff',
              border: '1px solid rgba(0,212,255,0.50)',
              boxShadow: '0 3px 12px rgba(0,180,220,0.30)',
            }}
          >
            <Download className="h-4 w-4" />
            Download
          </a>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd "/home/dejanandovski/Code Repo/aero-chat-app" && npx tsc --noEmit src/components/chat/ImageLightbox.tsx 2>&1 | head -20`

Expected: No errors (or only unrelated project-wide errors).

- [ ] **Step 3: Commit**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app"
git add src/components/chat/ImageLightbox.tsx
git commit -m "feat: add ImageLightbox component for inline image preview"
```

---

## Task 2: Wire `FileMessage` and `ChatWindow` to use the lightbox

**Files:**
- Modify: `src/components/chat/ChatWindow.tsx:115-131` (`FileMessage` image branch)
- Modify: `src/components/chat/ChatWindow.tsx:~186` (state declarations area)
- Modify: `src/components/chat/ChatWindow.tsx:~786` (`FileMessage` render site)
- Modify: `src/components/chat/ChatWindow.tsx:~2` (imports)

- [ ] **Step 1: Add import for `ImageLightbox` at the top of `ChatWindow.tsx`**

After the existing `ChessInviteCard` import (line 15), add:

```tsx
import { ImageLightbox } from './ImageLightbox';
```

- [ ] **Step 2: Add `onImageClick` prop to `FileMessage`**

Change the `FileMessage` function signature (line 115) from:

```tsx
function FileMessage({ content, isMine }: { content: string; isMine: boolean }) {
```

to:

```tsx
function FileMessage({ content, isMine, onImageClick }: { content: string; isMine: boolean; onImageClick: (img: { url: string; name: string; size: number }) => void }) {
```

- [ ] **Step 3: Replace the `<a>` wrapper with a clickable `<button>` in the image branch**

Replace lines 122-131 (the `if (isImage)` return block) with:

```tsx
  if (isImage) {
    return (
      <button
        type="button"
        className="block cursor-pointer text-left"
        onClick={() => onImageClick({ url, name, size })}
      >
        <img
          src={url} alt={name}
          className="rounded-aero block"
          style={{ maxWidth: 220, maxHeight: 220, objectFit: 'cover', display: 'block' }}
        />
        <p style={{ fontSize: 10, color: subColor, marginTop: 4 }}>{name}</p>
      </button>
    );
  }
```

- [ ] **Step 4: Add lightbox state in `ChatWindow`**

In the state declarations area of the `ChatWindow` component (around line 186-207, near the other `useState` calls), add:

```tsx
const [lightboxImage, setLightboxImage] = useState<{ url: string; name: string; size: number } | null>(null);
```

- [ ] **Step 5: Pass `onImageClick` to `FileMessage` at the render site**

Change line ~786 from:

```tsx
? <FileMessage content={msg.content} isMine={isMine} />
```

to:

```tsx
? <FileMessage content={msg.content} isMine={isMine} onImageClick={setLightboxImage} />
```

- [ ] **Step 6: Render `ImageLightbox` in `ChatWindow` JSX**

Just before the closing `</div>` of the `ChatWindow` return statement (before line 984), add:

```tsx
<ImageLightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />
```

- [ ] **Step 7: Verify build**

Run: `cd "/home/dejanandovski/Code Repo/aero-chat-app" && pnpm build 2>&1 | tail -10`

Expected: Build succeeds with no type errors.

- [ ] **Step 8: Commit**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app"
git add src/components/chat/ChatWindow.tsx
git commit -m "feat: wire ImageLightbox into ChatWindow and FileMessage"
```

---

## Task 3: Manual smoke test

- [ ] **Step 1: Start dev server and test**

Run: `cd "/home/dejanandovski/Code Repo/aero-chat-app" && pnpm dev`

Test checklist:
1. Send an image in a chat → thumbnail appears as before (220x220, rounded)
2. Click the thumbnail → lightbox opens with full-size image, filename, file size, download button
3. Click backdrop → lightbox closes
4. Click X button → lightbox closes
5. Press Escape → lightbox closes
6. Click Download → image downloads
7. Send a non-image file (PDF, etc.) → renders as file card with download icon, no lightbox behavior
