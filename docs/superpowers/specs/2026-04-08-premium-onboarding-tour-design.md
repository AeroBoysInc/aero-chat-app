# Premium Onboarding Tour — Design Spec

**Date:** 2026-04-08
**Scope:** Multi-step wizard modal that introduces premium features to newly upgraded Aero Chat+ users.

---

## Overview

When a premium user logs in and hasn't seen the tour yet, a full-screen modal wizard appears congratulating them and walking them through each premium feature. The tour has 7 slides, a dark & gold visual style, dot progress indicators, and "Try it" buttons that navigate to the relevant feature. After completing (or skipping) the tour, it does not appear again. Users can re-trigger it by clicking the AeroChat logo in the header.

---

## Visual Style

- **Background:** Dark navy gradient (`#0a1628` → `#1a3a5c` → `#0d2240`)
- **Accent:** Gold (`#FFD700` → `#FFA500` gradient for buttons)
- **Ambient glow:** Subtle gold and cyan radial gradients behind content
- **Card surface:** `rgba(255,255,255,0.04)` with `rgba(255,255,255,0.08)` border
- **Typography:** Inter font, white text, gold for titles, `rgba(255,255,255,0.5)` for subtitles
- **Border radius:** 20px for modal, 14px for inner cards, 12px for buttons
- **Backdrop:** Dark overlay (`rgba(0,0,0,0.7)`) behind the modal

---

## Slide Content

### Slide 0 — Welcome
- **Icon:** 🎉 (56px)
- **Title:** "Welcome to Aero Chat+"
- **Subtitle:** "Congratulations! You're now part of the Aero Plus club. Let us show you everything you've unlocked."
- **Content:** 2×2 feature preview grid — Premium Themes (🎨), Card Effects (💎), Bubble Styles (💬), Unlimited XP (⚡). Each card has icon + name + one-line description.
- **Actions:** "Skip Tour" (left, ghost), "Let's Go →" (right, gold)

### Slide 1 — Premium Themes
- **Icon:** 🎨 (64px)
- **Title:** "Premium Themes"
- **Description:** "Four beautiful new themes to transform your entire AeroChat experience. Each one changes colors, backgrounds, and ambient effects."
- **Content:** 4 theme pills with theme-colored backgrounds — 🌊 Ocean, 🌅 Sunset, 🌌 Aurora, 🌸 Sakura. Below: small note about Ultra themes available for purchase.
- **CTA:** "Open Theme Switcher →" — on click, closes modal and opens ThemeSwitcher

### Slide 2 — Card Customization
- **Icon:** 💎 (64px)
- **Title:** "Card Customization"
- **Description:** "Make your profile card truly yours with premium-exclusive effects and styling options."
- **Content:** 2×2 grid — Custom Colors (🌈, full color picker), Name Effects (✨, rainbow/wave/pulse/glitch/sparkle), Card Effects (🎭, shimmer/bubbles/sparkles/aurora/rain/fireflies), Extended Bio (📝, up to 500 chars)
- **CTA:** "Open Identity Editor →" — on click, closes modal and opens IdentityEditor

### Slide 3 — Chat Bubble Styles
- **Icon:** 💬 (64px)
- **Title:** "Chat Bubble Styles"
- **Description:** "Express yourself with 7 premium chat bubble designs. From sleek Midnight to vibrant Neon Pink."
- **Content:** 4 sample bubble messages stacked (Aero Cyan, Sunset Warm, Midnight, Neon Pink) with their gradient colors. Below: "+ Aurora Violet, Frosted Glass, Matte Dark" note.
- **CTA:** "Open Bubble Picker →" — on click, closes modal and opens BubbleStylePicker

### Slide 4 — Animated Avatars
- **Icon:** 🖼️ (64px)
- **Title:** "Animated Avatars"
- **Description:** "Upload GIF avatars up to 2MB and bring your profile to life. Your avatar animates everywhere — chat, sidebar, and profile card."
- **Content:** Visual comparison — static avatar circle (gray, labeled "Static") → arrow → animated avatar circle (gold shimmer, labeled "GIF ✨")
- **CTA:** "Upload Avatar →" — on click, closes modal and opens Settings (avatar upload section)

### Slide 5 — More Perks
- **Icon:** ⚡ (64px)
- **Title:** "More Perks"
- **Description:** "A few extra benefits that come with your Aero Chat+ membership."
- **Content:** 2 perk rows (list items with icon + title + description):
  - 📊 Unlimited XP — "No daily cap — earn as much as you want"
  - 📁 50 MB File Uploads — "5x the free tier limit"

### Slide 6 — Done
- **Icon:** 🏆 (56px)
- **Title:** "You're All Set!"
- **Subtitle:** "Go explore and make AeroChat truly yours. You can revisit this tour anytime by clicking the logo in the header."
- **CTA:** "Start Exploring →" (large gold button) — closes modal
- **Tip:** Small text: "Tip: Click the AeroChat logo in the header to reopen this tour"

---

## Navigation

- **Dots:** 7 dots at bottom of each slide. Active dot is gold and wider (24px pill shape), inactive dots are 8px circles at 20% gold opacity.
- **Back/Next:** Every slide (except Welcome) has "← Back" on the left. Every slide (except Done) has "Next →" on the right. Welcome has "Skip Tour" instead of Back.
- **Skip Tour:** On the Welcome slide only. Marks the tour as seen and closes the modal.
- **"Try it" CTAs:** Each feature slide has a contextual button. Clicking it:
  1. Marks the tour as seen (same as completing it)
  2. Closes the modal
  3. Triggers the relevant UI action (open ThemeSwitcher, IdentityEditor, BubbleStylePicker, or Settings)

---

## State Management

### "Tour seen" persistence
- **Key:** `aero-premium-tour-seen-{userId}` in localStorage
- **Value:** `'1'` when seen
- **Check:** On mount of the main app layout (ChatLayout), if user `is_premium` and this key is NOT `'1'`, show the tour modal

### Tour trigger logic
- **Auto-trigger:** When ChatLayout mounts and user is premium and tour hasn't been seen
- **Manual re-trigger:** Click the AeroChat logo circle in the header. This opens the tour regardless of the seen state.

### Logo click behavior
- Currently the logo in the header is non-interactive (wrapped in `pointerEvents: 'none'`)
- Change: Make the logo clickable. For premium users, clicking it opens the tour. For free users, clicking it opens the PremiumModal (upgrade prompt).

---

## Component Architecture

### New files
- **`src/components/ui/PremiumTour.tsx`** — The tour modal component. Contains all 7 slides, navigation logic, slide transition state, and "Try it" action handlers.
- **`src/store/tourStore.ts`** — Lightweight Zustand store for tour open state and "Try it" CTA routing (`pendingAction`).

### Modified files
- **`src/components/chat/ChatLayout.tsx`** — Add tour auto-trigger logic on mount. Make the logo circle clickable (remove `pointerEvents: 'none'` from the logo wrapper, add onClick).
- **`src/components/chat/Sidebar.tsx`** — Same logo click change for mobile header.

### Component structure
```
PremiumTour (modal overlay)
├── Backdrop (dark overlay, click = close)
├── Modal container (centered, max-width ~480px)
│   ├── Slide content (keyed by currentSlide index)
│   ├── Dot indicators
│   └── Nav buttons (Back/Skip + Next/Finish)
```

### "Try it" CTA routing

The tour's "Try it" buttons need to open UI that lives in different components (IdentityEditor is local state in Sidebar, BubbleStylePicker is local state in ChatWindow, ThemeSwitcher is an inline dropdown, Settings is local state in various places). To avoid prop-drilling:

- **Add a lightweight Zustand store** (`src/store/tourStore.ts`) with a `pendingAction` field:
  ```ts
  type TourAction = 'theme-switcher' | 'identity-editor' | 'bubble-picker' | 'settings' | null;
  ```
- When a "Try it" button is clicked: set `pendingAction`, mark tour as seen, close modal.
- ChatLayout, Sidebar, and ChatWindow each subscribe to `pendingAction` and react by opening the relevant local UI, then clear the action.

### Props
```ts
interface PremiumTourProps {
  open: boolean;
  onClose: () => void;
}
```

### Internal state
- `currentSlide: number` (0–6)
- Slide transitions: simple opacity crossfade (0.2s) or no animation (instant swap is fine for a wizard)

---

## Animations & Performance

- **Modal entry:** Fade in backdrop (0.2s) + scale up modal from 0.95 → 1.0 (0.2s ease-out)
- **Modal exit:** Reverse of entry (0.15s)
- **Slide transitions:** Simple opacity swap — no heavy animations needed
- **Ambient glow:** CSS radial-gradient only (no animated orbs) — this is a static modal, not a live scene
- **Idle:** Modal should respect `.paused` class — though since there are no keyframe animations in the tour, this is a non-issue
- **No filter:blur()** on any element in the tour

---

## Accessibility

- Modal traps focus (first focusable element on open, tab cycles within modal)
- Escape key closes modal (marks as seen)
- Backdrop click closes modal (marks as seen)
- Buttons have visible focus rings

---

## Edge Cases

- **User downgrades from premium:** Tour key stays in localStorage, no harm. Tour won't trigger because `is_premium` check fails.
- **User clears localStorage:** Tour will re-show next login. This is fine — better to re-show than to lose the state permanently.
- **Multiple tabs:** Each tab checks localStorage independently. If one tab marks as seen, others won't re-trigger (they check on mount, not reactively).
- **Tour re-trigger via logo:** Always opens regardless of seen state. Does NOT reset the seen state — if user closes it, it's still marked as seen.
