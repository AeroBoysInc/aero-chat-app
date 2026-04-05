# Image Lightbox Design

**Date:** 2026-03-24
**Status:** Approved
**Scope:** Replace "open in new tab" image behavior with an inline lightbox modal

---

## Problem

Clicking a shared image in chat opens the full image in a new browser tab. This breaks flow and feels disconnected. It should open in an inline popup overlay instead.

## Solution

**Approach B — Shared `ImageLightbox` component + ChatWindow state.**

A standalone `ImageLightbox` component rendered once inside `ChatWindow`. `FileMessage` receives an `onImageClick` callback prop and calls it instead of navigating to a new tab.

## New Component: `ImageLightbox`

**File:** `src/components/chat/ImageLightbox.tsx`

### Props

```ts
interface ImageLightboxProps {
  image: { url: string; name: string; size: number } | null;
  onClose: () => void;
}
```

When `image` is `null`, the component renders nothing.

### Layout

- **Overlay:** `fixed inset-0 z-50`, `rgba(0,0,0,0.45)` background, `backdrop-filter: blur(4px)`. Matches existing modal pattern (clear-chat modal, FriendRequestModal).
- **Content area:** Centered, `glass-elevated` Frutiger Aero styling, `animate-fade-in` entrance animation (matches clear-chat modal). Clicks inside use `stopPropagation()` to prevent accidental dismiss.
- **Image:** `max-w-[90vw] max-h-[75vh] object-contain`. Scales to viewport, preserves aspect ratio, no cropping.
- **Info bar:** Below the image. Filename (left-aligned) + human-readable file size (right-aligned). Small text, subdued color.
- **Download button:** Aero-styled cyan button. Triggers programmatic download via `<a download>` pattern.
- **Close button:** X icon, top-right corner of content area.

### Dismiss Behavior

- Backdrop click calls `onClose()`
- X button calls `onClose()`
- `Escape` key calls `onClose()` (via `useEffect` keydown listener)

## Changes to Existing Code

### `FileMessage` component (`ChatWindow.tsx`)

- Add prop: `onImageClick: (image: { url: string; name: string; size: number }) => void`
- Replace `<a href={url} target="_blank">` with a clickable element that calls `onImageClick({ url, name, size })`
- Thumbnail rendering unchanged (220x220 max, `rounded-aero`, `object-cover`)
- Add `cursor-pointer` to make clickability obvious

### `ChatWindow` component (`ChatWindow.tsx`)

- New state: `const [lightboxImage, setLightboxImage] = useState<{ url: string; name: string; size: number } | null>(null)`
- Pass `onImageClick={setLightboxImage}` to every `<FileMessage>` instance
- Render `<ImageLightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />` once at the end of JSX

## What This Does NOT Change

- No new dependencies or libraries
- No new Zustand stores
- No changes to message format, encryption, or Supabase schema
- No changes to file upload flow
- Non-image file messages remain unaffected

## Testing

- Click an image thumbnail in chat: lightbox opens with full-size image, filename, file size, and download button
- Click backdrop / X button / press Escape: lightbox closes
- Click download button: browser downloads the image file
- Non-image files (PDF, etc.) still render as before with no lightbox behavior
