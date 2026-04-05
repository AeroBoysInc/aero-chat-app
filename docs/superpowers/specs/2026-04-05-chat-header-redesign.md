# Chat Header Redesign — Inline Compact

## Summary

Redesign the 1:1 ChatWindow header to be more compact with a blurred (not stretched) background image and tighter layout. Avatar stays inline inside the header. Name and status collapse to a single row.

## What changes

### File: `src/components/chat/ChatWindow.tsx`

**Header outer div:**
- Padding: `py-4 px-4` → `py-2 px-3.5` (slimmer)
- `overflow: hidden` stays (contains the blur)

**Background bleed (the card image / gradient):**
- Currently: stretched `background-size: cover` on right 48% with mask fade. Looks pixelated.
- New: full-width blurred background. The card image (or gradient) fills the entire header with:
  - `filter: blur(20px) saturate(1.4)`
  - `transform: scale(1.15)` (hides blur edge artifacts under `overflow: hidden`)
  - `inset: -12px` (extra bleed for blur)
  - `opacity: 0.35`
- Dark gradient overlay on top: `linear-gradient(180deg, rgba(10,18,36,0.35) 0%, rgba(10,18,36,0.7) 100%)`
- When no card image: falls back to the existing gradient preset (same as current, but full-width instead of right-half)

**Avatar:**
- Size: `lg` (40px) → `md` (32px)
- Stays inline in the flex row, no overlap/float
- Aura ring from AvatarImage component wraps it as usual

**Name + status — single row:**
- Currently: name on first line, status on second line
- New: single flex row: `Name · ● Online · 🎮 Chess`
- Typing state: `Name · ●●● typing…`
- Font size: name 13px (from 15px), status/game 10px (same)

**Call buttons + lock icon:**
- Stay on the right side, unchanged
- Clear chat (trash) button stays next to name

**Offline state:**
- Avatar opacity: 0.55
- Blurred bg opacity: reduced to 0.20
- Status dot + text: muted grey (#5a6a7a)

### What does NOT change

- Call buttons, group call, video call — same position and behavior
- Lock icon, AeroLogo — stay right-aligned
- Back button (mobile) — stays left of avatar
- Typing indicator logic — same detection, just rendered inline
- Clear chat button — stays next to name
- Status menu/dropdown — not part of header

## Implementation notes

- The blurred bg div uses `position: absolute; inset: -12px` with a separate overlay div on top. Both at `z-index: 0`, content at `z-index: 2`.
- `bleedBackground` computed variable already exists — reuse it but apply to the full-width blur div instead of right-half mask div.
- For image backgrounds: wrap in the blur div. For gradient presets: apply as full-width gradient (remove the right-half mask).
- No new CSS classes or keyframes needed — everything is inline styles matching existing patterns.
