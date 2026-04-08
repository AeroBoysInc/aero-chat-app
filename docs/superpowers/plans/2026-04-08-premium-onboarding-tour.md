# Premium Onboarding Tour — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 7-slide wizard modal that welcomes premium users and showcases their unlocked features, with auto-trigger on first login and manual re-trigger via logo click.

**Architecture:** New `tourStore.ts` Zustand store manages open/seen state and "Try it" CTA routing. `PremiumTour.tsx` is a self-contained modal with all 7 slides. ChatLayout and Sidebar wire up auto-trigger logic and logo click handlers. The store's `pendingAction` field lets the tour tell other components to open specific UI (ThemeSwitcher, IdentityEditor, etc.) without prop-drilling.

**Tech Stack:** React 19, Zustand, CSS-in-JS (inline styles), localStorage for persistence.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/store/tourStore.ts` | Create | Tour open state, seen persistence, pendingAction for CTA routing |
| `src/components/ui/PremiumTour.tsx` | Create | All 7 slides, navigation, dot indicators, "Try it" handlers |
| `src/components/chat/ChatLayout.tsx` | Modify | Auto-trigger tour, logo click handler, consume pendingAction for ThemeSwitcher |
| `src/components/chat/Sidebar.tsx` | Modify | Logo click handler, consume pendingAction for IdentityEditor |
| `src/components/chat/ChatWindow.tsx` | Modify | Consume pendingAction for BubbleStylePicker |

---

### Task 1: Tour Store

**Files:**
- Create: `src/store/tourStore.ts`

- [ ] **Step 1: Create the store**

```ts
import { create } from 'zustand';

export type TourAction = 'theme-switcher' | 'identity-editor' | 'bubble-picker' | 'settings' | null;

interface TourState {
  open: boolean;
  pendingAction: TourAction;
  openTour: () => void;
  closeTour: () => void;
  markSeen: (userId: string) => void;
  hasSeen: (userId: string) => boolean;
  setPendingAction: (action: TourAction) => void;
  clearPendingAction: () => void;
}

export const useTourStore = create<TourState>((set) => ({
  open: false,
  pendingAction: null,

  openTour: () => set({ open: true }),
  closeTour: () => set({ open: false }),

  markSeen: (userId: string) => {
    localStorage.setItem(`aero-premium-tour-seen-${userId}`, '1');
  },

  hasSeen: (userId: string) => {
    return localStorage.getItem(`aero-premium-tour-seen-${userId}`) === '1';
  },

  setPendingAction: (action: TourAction) => set({ pendingAction: action }),
  clearPendingAction: () => set({ pendingAction: null }),
}));
```

- [ ] **Step 2: Commit**

```bash
git add src/store/tourStore.ts
git commit -m "feat: add tourStore for premium onboarding tour state"
```

---

### Task 2: PremiumTour Modal — Shell + Navigation

**Files:**
- Create: `src/components/ui/PremiumTour.tsx`

This task creates the modal shell with backdrop, entry/exit animation, dot indicators, and Back/Next/Skip navigation. Slide content is placeholder — Task 3 fills it in.

- [ ] **Step 1: Create PremiumTour.tsx with modal shell and navigation**

```tsx
import { useState, useEffect, useCallback } from 'react';
import { useTourStore } from '../../store/tourStore';
import type { TourAction } from '../../store/tourStore';

const TOTAL_SLIDES = 7;

/* ── Style constants ── */
const MODAL_BG = 'linear-gradient(135deg, #0a1628 0%, #1a3a5c 50%, #0d2240 100%)';
const GOLD = '#FFD700';
const GOLD_GRADIENT = 'linear-gradient(135deg, #FFD700, #FFA500)';
const CARD_BG = 'rgba(255,255,255,0.04)';
const CARD_BORDER = 'rgba(255,255,255,0.08)';
const TEXT_SUB = 'rgba(255,255,255,0.5)';
const TEXT_MUTED = 'rgba(255,255,255,0.3)';
const AMBIENT = `radial-gradient(circle at 50% 20%, rgba(255,215,0,0.06) 0%, transparent 60%),
                 radial-gradient(circle at 20% 80%, rgba(91,200,245,0.04) 0%, transparent 50%)`;

interface PremiumTourProps {
  open: boolean;
  onClose: () => void;
}

export function PremiumTour({ open, onClose }: PremiumTourProps) {
  const [slide, setSlide] = useState(0);
  const [visible, setVisible] = useState(false);
  const { setPendingAction, markSeen } = useTourStore();

  // Entry animation
  useEffect(() => {
    if (open) {
      setSlide(0);
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [open]);

  const userId = (() => {
    try {
      const raw = localStorage.getItem('aero-auth');
      if (!raw) return '';
      const parsed = JSON.parse(raw);
      return parsed?.state?.user?.id ?? '';
    } catch { return ''; }
  })();

  const handleClose = useCallback(() => {
    if (userId) markSeen(userId);
    setVisible(false);
    setTimeout(onClose, 150);
  }, [userId, markSeen, onClose]);

  const handleTryIt = useCallback((action: TourAction) => {
    if (userId) markSeen(userId);
    setPendingAction(action);
    setVisible(false);
    setTimeout(onClose, 150);
  }, [userId, markSeen, setPendingAction, onClose]);

  // Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, handleClose]);

  if (!open) return null;

  const isFirst = slide === 0;
  const isLast = slide === TOTAL_SLIDES - 1;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `rgba(0,0,0,${visible ? 0.7 : 0})`,
        transition: 'background 0.2s ease',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div style={{
        width: '100%', maxWidth: 480, maxHeight: '90vh',
        borderRadius: 20, overflow: 'hidden',
        background: MODAL_BG,
        border: `1px solid rgba(255,215,0,0.15)`,
        boxShadow: '0 8px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
        transform: visible ? 'scale(1)' : 'scale(0.95)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.2s ease-out, opacity 0.2s ease-out',
        display: 'flex', flexDirection: 'column',
        position: 'relative',
      }}>
        {/* Ambient glow */}
        <div style={{ position: 'absolute', inset: 0, background: AMBIENT, pointerEvents: 'none' }} />

        {/* Slide content */}
        <div style={{ flex: 1, overflowY: 'auto', position: 'relative', zIndex: 1 }}>
          <SlideContent slide={slide} onTryIt={handleTryIt} />
        </div>

        {/* Dots */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', padding: '16px 0 8px', position: 'relative', zIndex: 1 }}>
          {Array.from({ length: TOTAL_SLIDES }, (_, i) => (
            <div key={i} style={{
              width: i === slide ? 24 : 8, height: 8,
              borderRadius: i === slide ? 4 : '50%',
              background: i === slide ? GOLD : 'rgba(255,215,0,0.2)',
              transition: 'all 0.2s ease',
            }} />
          ))}
        </div>

        {/* Nav buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 36px 24px', position: 'relative', zIndex: 1 }}>
          {isFirst ? (
            <button onClick={handleClose} style={{ ...navBtnBase, background: 'transparent', color: TEXT_MUTED }}>
              Skip Tour
            </button>
          ) : (
            <button onClick={() => setSlide(s => s - 1)} style={{ ...navBtnBase, background: 'transparent', color: TEXT_MUTED }}>
              ← Back
            </button>
          )}
          {isLast ? (
            <button onClick={handleClose} style={{ ...navBtnBase, ...goldBtn }}>
              Start Exploring →
            </button>
          ) : (
            <button onClick={() => setSlide(s => s + 1)} style={{ ...navBtnBase, ...goldBtn }}>
              {isFirst ? "Let's Go →" : 'Next →'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const navBtnBase: React.CSSProperties = {
  padding: '10px 28px', borderRadius: 12, border: 'none',
  fontSize: 13, fontWeight: 700, cursor: 'pointer',
  fontFamily: 'Inter, system-ui, sans-serif',
};

const goldBtn: React.CSSProperties = {
  background: GOLD_GRADIENT, color: '#0a1628',
  boxShadow: '0 4px 16px rgba(255,215,0,0.25)',
};

/* ── Placeholder SlideContent — replaced in Task 3 ── */
function SlideContent({ slide, onTryIt }: { slide: number; onTryIt: (a: TourAction) => void }) {
  return (
    <div style={{ padding: '40px 36px', textAlign: 'center' }}>
      <div style={{ fontSize: 56 }}>🎉</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: GOLD, marginTop: 16 }}>
        Slide {slide}
      </div>
      <div style={{ fontSize: 14, color: TEXT_SUB, marginTop: 8 }}>
        Placeholder — content added in Task 3
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/PremiumTour.tsx
git commit -m "feat: add PremiumTour modal shell with navigation and animations"
```

---

### Task 3: PremiumTour Slide Content

**Files:**
- Modify: `src/components/ui/PremiumTour.tsx`

Replace the placeholder `SlideContent` function with the full 7 slides.

- [ ] **Step 1: Replace the SlideContent function**

Remove the placeholder `SlideContent` function at the bottom of the file and replace it with the full implementation. The function should switch on `slide` index (0–6) and render the appropriate content for each slide.

The slide content for each index:

**Slide 0 (Welcome):** Icon 🎉 (56px), title "Welcome to Aero Chat+" in gold, subtitle "Congratulations! You're now part of the Aero Plus club. Let us show you everything you've unlocked." in `TEXT_SUB`. Below: 2×2 grid of feature preview cards using `CARD_BG` and `CARD_BORDER` — Premium Themes (🎨), Card Effects (💎), Bubble Styles (💬), Unlimited XP (⚡). Each card has icon (28px) + name (12px bold white) + one-line description (10px `TEXT_MUTED`).

**Slide 1 (Themes):** Icon 🎨 (64px), title "Premium Themes", description about 4 themes. Below: 4 theme pills — each is a `<span>` with inline `background` matching the theme color and `borderRadius: 20`, styled like:
- 🌊 Ocean: `background: linear-gradient(135deg, #041e30, #0a6e8a); color: #00d4ff`
- 🌅 Sunset: `background: linear-gradient(135deg, #2a1008, #8b3a0e); color: #ff8c3c`
- 🌌 Aurora: `background: linear-gradient(135deg, #080620, #2a1050); color: #a855f7`
- 🌸 Sakura: `background: linear-gradient(135deg, #1e081a, #4a1040); color: #ff78b4`

Below pills: small note (11px, `TEXT_MUTED`) "Plus Ultra themes available for purchase: John Frutiger & Golden Hour". CTA button: "Open Theme Switcher →" calling `onTryIt('theme-switcher')`.

**Slide 2 (Card Customization):** Icon 💎 (64px), title "Card Customization", description. 2×2 grid: Custom Colors (🌈), Name Effects (✨, list: rainbow/wave/pulse/glitch/sparkle), Card Effects (🎭, list: shimmer/bubbles/sparkles/aurora/rain/fireflies), Extended Bio (📝, up to 500 chars). CTA: "Open Identity Editor →" calling `onTryIt('identity-editor')`.

**Slide 3 (Bubble Styles):** Icon 💬 (64px), title "Chat Bubble Styles", description. 4 stacked mock chat bubbles:
- "Aero Cyan ✨" — `background: linear-gradient(135deg, #00b4d8, #0096c7); color: white`
- "Sunset Warm 🌅" — `background: linear-gradient(135deg, #ff6b35, #f7931e); color: white`
- "Midnight 🌙" — `background: linear-gradient(135deg, #1a1a3e, #2d2d5e); color: #b0b0ff`
- "Neon Pink 💖" — `background: linear-gradient(135deg, #ff1493, #ff69b4); color: white`

Each bubble: `padding: 10px 16px; borderRadius: '16px 16px 4px 16px'; alignSelf: 'flex-end'; fontSize: 13`. Below: note "+ Aurora Violet, Frosted Glass, Matte Dark". CTA: "Open Bubble Picker →" calling `onTryIt('bubble-picker')`.

**Slide 4 (Animated Avatars):** Icon 🖼️ (64px), title "Animated Avatars", description. Visual: two 72px circles side by side with an arrow between them. Left circle: gray gradient, labeled "Static". Right circle: gold shimmer `animation: shimmer 2s ease infinite` with `background-size: 200% 200%`, labeled "GIF ✨". Add `@keyframes shimmer` as inline `<style>` within the component (or use a `style` element). CTA: "Upload Avatar →" calling `onTryIt('settings')`.

**Slide 5 (More Perks):** Icon ⚡ (64px), title "More Perks", description. 2 perk rows, each: icon (24px) + title (13px bold) + description (11px muted), with `CARD_BG` background and `CARD_BORDER` border, `borderRadius: 12`:
- 📊 "Unlimited XP" — "No daily cap — earn as much as you want"
- 📁 "50 MB File Uploads" — "5x the free tier limit"

**Slide 6 (Done):** Icon 🏆 (56px), title "You're All Set!" in gold, subtitle "Go explore and make AeroChat truly yours. You can revisit this tour anytime by clicking the logo in the header." in `TEXT_SUB`. No CTA button (the nav "Start Exploring →" serves as the close). Below subtitle: small tip text (11px, `TEXT_MUTED`) "Tip: Click the AeroChat logo in the header to reopen this tour".

**Shared styles for slides:**
- Slide inner padding: `40px 36px`
- Feature icon: `fontSize: 64, marginBottom: 16`
- Feature title: `fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 6`
- Feature description: `fontSize: 13, color: TEXT_SUB, lineHeight: 1.6, maxWidth: 360`
- "Try it" CTA button: `display: 'inline-flex'; padding: '10px 24px'; borderRadius: 12; background: 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,165,0,0.08))'; border: '1px solid rgba(255,215,0,0.25)'; color: GOLD; fontSize: 13; fontWeight: 700; cursor: 'pointer'; marginTop: 8`
- Feature grid: `display: 'grid'; gridTemplateColumns: '1fr 1fr'; gap: 12; width: '100%'`

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/PremiumTour.tsx
git commit -m "feat: add all 7 slide contents to PremiumTour"
```

---

### Task 4: Wire Up Auto-Trigger in ChatLayout

**Files:**
- Modify: `src/components/chat/ChatLayout.tsx`

- [ ] **Step 1: Add imports and tour state**

At the top of `ChatLayout.tsx`, add:
```ts
import { PremiumTour } from '../ui/PremiumTour';
import { useTourStore } from '../../store/tourStore';
```

Inside the component (near line 81, alongside the other `useState` calls), add:
```ts
const tourOpen = useTourStore(s => s.open);
const openTour = useTourStore(s => s.openTour);
const closeTour = useTourStore(s => s.closeTour);
const tourHasSeen = useTourStore(s => s.hasSeen);
```

- [ ] **Step 2: Add auto-trigger useEffect**

After the existing useEffects (around line 116), add:
```ts
// Auto-trigger premium tour for first-time premium users
useEffect(() => {
  if (isPremium && user?.id && !tourHasSeen(user.id)) {
    openTour();
  }
}, [isPremium, user?.id, tourHasSeen, openTour]);
```

- [ ] **Step 3: Render PremiumTour modal**

Near line 316 where `PremiumModal` is rendered, add the tour modal right after it:
```tsx
<PremiumTour open={tourOpen} onClose={closeTour} />
```

- [ ] **Step 4: Commit**

```bash
git add src/components/chat/ChatLayout.tsx
git commit -m "feat: wire up premium tour auto-trigger in ChatLayout"
```

---

### Task 5: Logo Click → Open Tour

**Files:**
- Modify: `src/components/chat/ChatLayout.tsx`
- Modify: `src/components/chat/Sidebar.tsx`

- [ ] **Step 1: Make the desktop header logo clickable in ChatLayout.tsx**

Find the logo wrapper div (around line 219–240). The outer positioning div currently has no click handler and the inner logo div has `pointerEvents: 'none'`. Change the outer div to be a clickable button area. Replace:

```tsx
          {/* Logo circle + logo layered separately so logo isn't clipped */}
          <div style={{
            position: 'absolute', left: -30, top: -6, zIndex: 15,
            width: 52, height: 52,
          }}>
            {/* Circle backdrop */}
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: 'var(--card-bg-solid, var(--bg-solid, #dceefb))',
              border: '3px solid var(--panel-divider)',
              boxShadow: '0 2px 16px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.10)',
            }} />
            {/* Logo — sits on top, not clipped by circle */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 16,
              pointerEvents: 'none',
            }}>
              <AeroLogo size={43} />
            </div>
          </div>
```

With:

```tsx
          {/* Logo circle — clickable: premium → tour, free → premium modal */}
          <div
            className="no-drag"
            onClick={() => isPremium ? openTour() : setPremiumModalOpen(true)}
            style={{
              position: 'absolute', left: -30, top: -6, zIndex: 15,
              width: 52, height: 52, cursor: 'pointer',
            }}
          >
            {/* Circle backdrop */}
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: 'var(--card-bg-solid, var(--bg-solid, #dceefb))',
              border: '3px solid var(--panel-divider)',
              boxShadow: '0 2px 16px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.10)',
            }} />
            {/* Logo — sits on top */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 16,
              pointerEvents: 'none',
            }}>
              <AeroLogo size={43} />
            </div>
          </div>
```

- [ ] **Step 2: Make the mobile header logo clickable in Sidebar.tsx**

Add imports at the top of Sidebar.tsx:
```ts
import { useTourStore } from '../../store/tourStore';
```

Inside the component, add:
```ts
const openTour = useTourStore(s => s.openTour);
```

Find the mobile logo wrapper div (around line 149–170). Same pattern — make the outer div clickable. Replace:

```tsx
          {/* Logo circle + logo layered separately so logo isn't clipped */}
          <div style={{
            position: 'absolute', left: -16, top: -2, zIndex: 15,
            width: 52, height: 52,
          }}>
```

With:

```tsx
          {/* Logo circle — clickable: premium → tour, free → premium modal */}
          <div
            onClick={() => user?.is_premium ? openTour() : null}
            style={{
              position: 'absolute', left: -16, top: -2, zIndex: 15,
              width: 52, height: 52, cursor: user?.is_premium ? 'pointer' : 'default',
            }}
          >
```

Note: Sidebar mobile header doesn't have a PremiumModal instance, so free users get no action on mobile logo click. This is fine — the upgrade button is already visible in the sidebar.

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/ChatLayout.tsx src/components/chat/Sidebar.tsx
git commit -m "feat: make logo clickable — premium opens tour, free opens upgrade modal"
```

---

### Task 6: Consume pendingAction in ChatLayout (ThemeSwitcher)

**Files:**
- Modify: `src/components/chat/ChatLayout.tsx`

The ThemeSwitcher is an inline dropdown that toggles itself. To "open" it from the tour, we need to simulate a click on it. The simplest approach: use a ref on the ThemeSwitcher's wrapper and click it.

- [ ] **Step 1: Add pendingAction consumer**

Add to the existing tourStore selectors:
```ts
const pendingAction = useTourStore(s => s.pendingAction);
const clearPendingAction = useTourStore(s => s.clearPendingAction);
```

Add a ref for the ThemeSwitcher wrapper. Find where `<ThemeSwitcher />` is rendered in the desktop header (around line 311) and wrap it:
```tsx
<div ref={themeSwitcherRef}>
  <ThemeSwitcher />
</div>
```

Add the ref:
```ts
const themeSwitcherRef = useRef<HTMLDivElement>(null);
```

Add useEffect to consume the action:
```ts
// Consume tour "Try it" actions
useEffect(() => {
  if (pendingAction === 'theme-switcher') {
    clearPendingAction();
    // Click the ThemeSwitcher to open its dropdown
    const btn = themeSwitcherRef.current?.querySelector('button');
    if (btn) btn.click();
  } else if (pendingAction === 'settings') {
    clearPendingAction();
    // No settings panel in ChatLayout — this is handled by the settings view
    // in Sidebar. We'll trigger it there.
  }
}, [pendingAction, clearPendingAction]);
```

- [ ] **Step 2: Commit**

```bash
git add src/components/chat/ChatLayout.tsx
git commit -m "feat: consume tour pendingAction to auto-open ThemeSwitcher"
```

---

### Task 7: Consume pendingAction in Sidebar (IdentityEditor + Settings)

**Files:**
- Modify: `src/components/chat/Sidebar.tsx`

- [ ] **Step 1: Add pendingAction consumer**

Add to the existing tourStore selectors:
```ts
const pendingAction = useTourStore(s => s.pendingAction);
const clearPendingAction = useTourStore(s => s.clearPendingAction);
```

Add useEffect:
```ts
// Consume tour "Try it" actions
useEffect(() => {
  if (pendingAction === 'identity-editor') {
    clearPendingAction();
    setIdentityEditorOpen(true);
  } else if (pendingAction === 'settings') {
    clearPendingAction();
    setSettingsView('general');
  }
}, [pendingAction, clearPendingAction]);
```

- [ ] **Step 2: Commit**

```bash
git add src/components/chat/Sidebar.tsx
git commit -m "feat: consume tour pendingAction to open IdentityEditor and Settings"
```

---

### Task 8: Consume pendingAction in ChatWindow (BubbleStylePicker)

**Files:**
- Modify: `src/components/chat/ChatWindow.tsx`

- [ ] **Step 1: Add pendingAction consumer**

Add import:
```ts
import { useTourStore } from '../../store/tourStore';
```

Inside the component, add:
```ts
const pendingAction = useTourStore(s => s.pendingAction);
const clearPendingAction = useTourStore(s => s.clearPendingAction);
```

Add useEffect:
```ts
// Consume tour "Try it" action
useEffect(() => {
  if (pendingAction === 'bubble-picker') {
    clearPendingAction();
    setBubblePickerOpen(true);
  }
}, [pendingAction, clearPendingAction]);
```

- [ ] **Step 2: Commit**

```bash
git add src/components/chat/ChatWindow.tsx
git commit -m "feat: consume tour pendingAction to open BubbleStylePicker"
```

---

### Task 9: Build Verification + Final Commit

**Files:** None new — verification only.

- [ ] **Step 1: Run TypeScript check + build**

```bash
cd aero-chat-app && pnpm build
```

Expected: Clean build, no type errors.

- [ ] **Step 2: Manual smoke test checklist**

Test in the browser:
1. As a premium user, the tour auto-opens on page load (clear `aero-premium-tour-seen-{userId}` from localStorage first)
2. Navigate all 7 slides with Next/Back
3. Skip Tour on slide 0 closes and marks seen
4. Reload — tour does NOT reappear
5. Click logo in header — tour reopens
6. Click "Open Theme Switcher →" on slide 1 — tour closes, ThemeSwitcher dropdown opens
7. Click "Open Identity Editor →" on slide 2 — tour closes, IdentityEditor opens
8. Click "Open Bubble Picker →" on slide 3 — tour closes, BubbleStylePicker opens
9. Click "Upload Avatar →" on slide 4 — tour closes, Settings opens
10. "Start Exploring →" on slide 6 closes modal
11. Escape key closes modal
12. Backdrop click closes modal

- [ ] **Step 3: Push to git and deploy**

```bash
git push origin main
vercel --prod --yes
```
