# Ultra Themes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two purchasable premium themes — "John Frutiger" (bright sky Aero glass) and "Golden Hour" (Vista sunset dark glass) — that completely transform the visual experience with animated backgrounds, unique transitions, and themed server navigation.

**Architecture:** Extends the existing Zustand theme store with two new ultra theme IDs. Each theme is a `[data-theme]` CSS variable block (~80 vars) plus conditional React ambient layers (clouds, aurora, particles). Transitions and server pickers are new components rendered conditionally based on the active theme. Ownership is stored as boolean columns on the `profiles` table.

**Tech Stack:** React 19, Zustand, CSS custom properties, CSS keyframe animations, Supabase (PostgreSQL)

**Spec:** `docs/superpowers/specs/2026-04-07-ultra-themes-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/migrations/026_ultra_themes.sql` | Create | DB columns for theme ownership |
| `src/store/themeStore.ts` | Modify | Extend Theme type, add ultra arrays, purchase logic |
| `src/index.css` | Modify | Two new `[data-theme]` blocks + new keyframes |
| `src/components/ui/ThemeSwitcher.tsx` | Modify | Add "Ultra Themes" section with extravagant cards |
| `src/components/ui/AmbientBackground.tsx` | Create | Conditional clouds/aurora/orbs/sparkles/embers per theme |
| `src/components/ui/TransitionWipe.tsx` | Create | Cloud wipe + heat haze transition components |
| `src/components/chat/ChatLayout.tsx` | Modify | Insert AmbientBackground, hook TransitionWipe into corner/server nav |
| `src/components/servers/ServerOverlay.tsx` | Modify | Conditional cloud picker / sun burst picker for ultra themes |
| `src/components/servers/BubbleHub.tsx` | Modify | Conditional Bubble Sky layout for ultra themes |

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/026_ultra_themes.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- 026_ultra_themes.sql
-- Add ultra theme ownership columns to profiles
ALTER TABLE profiles ADD COLUMN owns_john_frutiger BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN owns_golden_hour BOOLEAN NOT NULL DEFAULT false;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/026_ultra_themes.sql
git commit -m "feat: add ultra theme ownership columns to profiles"
```

---

### Task 2: Extend Theme Store

**Files:**
- Modify: `src/store/themeStore.ts`

- [ ] **Step 1: Extend the Theme type and add ultra theme arrays**

Replace the entire file content with:

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';

export type Theme = 'day' | 'night' | 'ocean' | 'sunset' | 'aurora' | 'sakura' | 'john-frutiger' | 'golden-hour';

export const FREE_THEMES: Theme[] = ['day', 'night'];
export const PREMIUM_THEMES: Theme[] = ['ocean', 'sunset', 'aurora', 'sakura'];
export const ULTRA_THEMES: Theme[] = ['john-frutiger', 'golden-hour'];
export const ALL_THEMES: Theme[] = [...FREE_THEMES, ...PREMIUM_THEMES, ...ULTRA_THEMES];

export function isUltraTheme(t: Theme): boolean {
  return ULTRA_THEMES.includes(t);
}

interface ThemeStore {
  theme: Theme;
  ownsJohnFrutiger: boolean;
  ownsGoldenHour: boolean;
  setTheme: (t: Theme) => void;
  loadOwnership: (userId: string) => Promise<void>;
  purchaseTheme: (theme: 'john-frutiger' | 'golden-hour', userId: string) => Promise<boolean>;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: 'day',
      ownsJohnFrutiger: false,
      ownsGoldenHour: false,

      setTheme: (theme) => {
        set({ theme });
        document.documentElement.setAttribute('data-theme', theme);
      },

      loadOwnership: async (userId) => {
        const { data } = await supabase
          .from('profiles')
          .select('owns_john_frutiger, owns_golden_hour')
          .eq('id', userId)
          .single();
        if (data) {
          set({
            ownsJohnFrutiger: data.owns_john_frutiger ?? false,
            ownsGoldenHour: data.owns_golden_hour ?? false,
          });
        }
      },

      purchaseTheme: async (theme, userId) => {
        const col = theme === 'john-frutiger' ? 'owns_john_frutiger' : 'owns_golden_hour';
        const { error } = await supabase
          .from('profiles')
          .update({ [col]: true })
          .eq('id', userId);
        if (error) return false;
        set(theme === 'john-frutiger'
          ? { ownsJohnFrutiger: true }
          : { ownsGoldenHour: true }
        );
        return true;
      },
    }),
    {
      name: 'aero-theme',
      partialize: (state) => ({ theme: state.theme }),
    }
  )
);

/** Call before React renders to prevent theme flash */
export function initTheme() {
  try {
    const raw = localStorage.getItem('aero-theme');
    if (raw) {
      const theme = JSON.parse(raw)?.state?.theme;
      if (theme) document.documentElement.setAttribute('data-theme', theme);
    }
  } catch {}
}
```

- [ ] **Step 2: Load ownership on auth in ChatLayout**

In `src/components/chat/ChatLayout.tsx`, add at the top of `ChatLayout()` after the existing `useAuthStore` line:

```ts
import { useThemeStore, isUltraTheme } from '../../store/themeStore';
```

And inside the component body, after `const isPremium = user?.is_premium === true;`:

```ts
const activeTheme = useThemeStore(s => s.theme);

// Load ultra theme ownership on mount
useEffect(() => {
  if (user?.id) useThemeStore.getState().loadOwnership(user.id);
}, [user?.id]);

// If user loses premium, fall back from ultra theme
useEffect(() => {
  if (!isPremium && isUltraTheme(activeTheme)) {
    useThemeStore.getState().setTheme('day');
  }
}, [isPremium, activeTheme]);
```

- [ ] **Step 3: Verify app still builds**

Run: `cd aero-chat-app && pnpm build`
Expected: No TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add src/store/themeStore.ts src/components/chat/ChatLayout.tsx
git commit -m "feat: extend theme store with ultra theme types and purchase logic"
```

---

### Task 3: CSS Variables — John Frutiger Theme

**Files:**
- Modify: `src/index.css` (append after the last theme block, before `@layer`)

- [ ] **Step 1: Add the John Frutiger CSS variable block**

Add after the sakura theme block (after line ~716) and before the `@layer base` section:

```css
/* ═══ ULTRA: John Frutiger — bright sky, white glass, aqua accents ═══ */
[data-theme="john-frutiger"] {
  --body-bg:
    radial-gradient(ellipse 480px 420px at 20% 15%, rgba(255,255,255,0.45) 0%, transparent 50%),
    radial-gradient(ellipse 420px 420px at 75% 60%, rgba(255,255,255,0.30) 0%, transparent 50%),
    radial-gradient(ellipse 360px 360px at 50% 90%, rgba(0,180,255,0.12) 0%, transparent 55%),
    radial-gradient(ellipse 280px 280px at 85% 20%, rgba(0,140,220,0.10) 0%, transparent 50%),
    linear-gradient(170deg, #b8ecff 0%, #5ec8f5 20%, #0098e0 50%, #0068b8 80%, #004a90 100%);

  --sidebar-bg:      rgba(255,255,255,0.18);
  --sidebar-border:  rgba(255,255,255,0.30);
  --sidebar-shadow:  0 8px 32px rgba(0,0,0,0.08), inset 0 1px 1px rgba(255,255,255,0.50);
  --sidebar-gloss:   linear-gradient(180deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.05) 38%, rgba(0,0,0,0) 60%);

  --chat-bg:         rgba(255,255,255,0.12);
  --chat-border:     rgba(255,255,255,0.22);
  --chat-shadow:     0 8px 32px rgba(0,0,0,0.08), inset 0 1px 1px rgba(255,255,255,0.50);
  --chat-gloss:      linear-gradient(180deg, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.04) 30%, rgba(0,0,0,0) 50%);

  --card-bg:         rgba(255,255,255,0.22);
  --card-bg-solid:   #d0ebff;
  --card-border:     rgba(255,255,255,0.35);
  --card-shadow:     0 12px 48px rgba(0,0,0,0.10), inset 0 1px 1px rgba(255,255,255,0.55);
  --card-gloss:      linear-gradient(180deg, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.06) 40%, rgba(0,0,0,0) 62%);

  --panel-header-bg: linear-gradient(180deg, rgba(0,120,255,0.08) 0%, transparent 100%);
  --panel-divider:   rgba(255,255,255,0.18);

  --text-primary:    rgba(0,40,80,0.90);
  --text-secondary:  rgba(0,60,120,0.70);
  --text-muted:      rgba(0,80,160,0.45);
  --text-label:      rgba(0,60,120,0.40);
  --text-title:      #0068b8;

  --rail-icon:       rgba(255,255,255,0.55);
  --rail-icon-hover: rgba(255,255,255,0.90);
  --rail-bg-idle:    rgba(255,255,255,0.12);
  --rail-bg-hover:   rgba(255,255,255,0.22);
  --rail-border:     rgba(255,255,255,0.20);

  --input-bg:        rgba(255,255,255,0.20);
  --input-border:    rgba(255,255,255,0.30);
  --input-text:      rgba(0,40,80,0.85);
  --input-placeholder: rgba(0,80,160,0.35);
  --input-focus-border: rgba(0,180,255,0.55);
  --input-focus-ring:   rgba(0,180,255,0.15);

  --hover-bg:        rgba(0,160,255,0.08);
  --hover-bg-btn:    rgba(0,160,255,0.15);

  --recv-bg:         linear-gradient(160deg, rgba(255,255,255,0.25) 0%, rgba(200,235,255,0.20) 100%);
  --recv-border:     rgba(255,255,255,0.35);
  --recv-text:       rgba(0,40,80,0.85);
  --recv-time:       rgba(0,80,160,0.40);

  --badge-bg:        #0098e0;
  --badge-text:      #ffffff;

  --switcher-bg:     rgba(255,255,255,0.25);
  --switcher-border: rgba(255,255,255,0.35);

  --popup-bg:           rgba(240,248,255,0.92);
  --popup-border:       rgba(255,255,255,0.40);
  --popup-shadow:       0 8px 32px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.60);
  --popup-text:         rgba(0,40,80,0.90);
  --popup-text-secondary: rgba(0,40,80,0.65);
  --popup-text-muted:   rgba(0,40,80,0.35);
  --popup-text-label:   rgba(0,40,80,0.42);
  --popup-divider:      rgba(0,120,200,0.10);
  --popup-hover:        rgba(0,160,255,0.08);
  --popup-icon:         rgba(0,120,200,0.70);
  --popup-item-bg:      rgba(0,160,255,0.04);
  --popup-select-bg:    rgba(0,160,255,0.06);
  --popup-select-border: rgba(0,160,255,0.18);
  --popup-select-text:  rgba(0,40,80,0.85);

  --btn-ghost-bg:       rgba(0,160,255,0.06);
  --btn-ghost-border:   rgba(0,160,255,0.14);
  --reaction-idle-bg:   rgba(0,160,255,0.06);
  --reaction-idle-border: rgba(0,160,255,0.14);
  --separator-dot:      rgba(0,120,200,0.20);
  --slider-track:       rgba(0,160,255,0.18);
  --game-activity-color: #00d4ff;

  --game-tile-empty-bg:          rgba(0,160,255,0.04);
  --game-tile-empty-border:      rgba(0,160,255,0.10);
  --game-tile-tbd-bg:            rgba(0,160,255,0.08);
  --game-tile-tbd-border:        rgba(0,160,255,0.35);
  --game-tile-absent-bg:         rgba(0,160,255,0.03);
  --game-tile-absent-border:     rgba(0,160,255,0.08);
  --game-tile-absent-color:      rgba(0,40,80,0.20);
  --game-key-bg:                 rgba(0,160,255,0.08);
  --game-key-border:             rgba(0,160,255,0.15);
  --game-key-absent-bg:          rgba(0,160,255,0.03);
  --game-key-absent-border:      rgba(0,160,255,0.05);
  --game-key-absent-color:       rgba(0,40,80,0.18);
  --typing-word-future:          rgba(0,40,80,0.15);
  --typing-word-active-pending:  rgba(0,40,80,0.20);
  --typing-word-done-correct:    rgba(0,40,80,0.55);
  --typing-surface-bg:           rgba(0,160,255,0.03);
  --typing-surface-border:       rgba(0,160,255,0.08);

  --aura-online:        rgba(0,212,255,0.55);
  --aura-gaming:        rgba(79,201,122,0.55);
  --aura-incall:        rgba(255,160,0,0.65);
  --aura-busy:          rgba(255,80,50,0.55);
  --aura-away:          rgba(0,150,200,0.28);
  --aura-glow-online:   rgba(0,180,255,0.30);
  --aura-glow-gaming:   rgba(50,180,80,0.30);
  --aura-glow-incall:   rgba(200,120,0,0.35);
  --aura-glow-busy:     rgba(220,60,20,0.28);
  --date-sep-line:      rgba(120,180,220,0.25);
  --date-sep-text:      rgba(80,130,170,0.50);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/index.css
git commit -m "feat: add John Frutiger CSS variables"
```

---

### Task 4: CSS Variables — Golden Hour Theme

**Files:**
- Modify: `src/index.css` (append after John Frutiger block)

- [ ] **Step 1: Add the Golden Hour CSS variable block**

```css
/* ═══ ULTRA: Golden Hour — Vista sunset, dark glass, amber/gold ═══ */
[data-theme="golden-hour"] {
  --body-bg:
    radial-gradient(ellipse 480px 300px at 50% 85%, rgba(255,180,50,0.45) 0%, transparent 55%),
    radial-gradient(ellipse 420px 420px at 70% 40%, rgba(255,100,140,0.15) 0%, transparent 50%),
    radial-gradient(ellipse 360px 360px at 30% 20%, rgba(255,120,60,0.12) 0%, transparent 50%),
    radial-gradient(ellipse 280px 280px at 50% 50%, rgba(255,140,0,0.10) 0%, transparent 50%),
    linear-gradient(180deg, #1a0a2e 0%, #2d1045 12%, #5c1a3a 25%, #8b3a2a 38%, #c45e1a 55%, #e88a20 68%, #f5a623 80%, #ffe680 100%);

  --sidebar-bg:      rgba(60,30,10,0.55);
  --sidebar-border:  rgba(255,180,80,0.22);
  --sidebar-shadow:  0 8px 32px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,220,150,0.20);
  --sidebar-gloss:   linear-gradient(180deg, rgba(255,200,120,0.12) 0%, rgba(255,160,60,0.03) 38%, rgba(0,0,0,0) 60%);

  --chat-bg:         rgba(40,20,8,0.55);
  --chat-border:     rgba(255,180,80,0.18);
  --chat-shadow:     0 8px 32px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,220,150,0.15);
  --chat-gloss:      linear-gradient(180deg, rgba(255,200,100,0.10) 0%, rgba(255,160,60,0.03) 30%, rgba(0,0,0,0) 50%);

  --card-bg:         rgba(60,30,10,0.65);
  --card-bg-solid:   #3a1a0e;
  --card-border:     rgba(255,180,80,0.25);
  --card-shadow:     0 12px 48px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,220,150,0.18);
  --card-gloss:      linear-gradient(180deg, rgba(255,200,120,0.12) 0%, rgba(255,160,60,0.03) 40%, rgba(0,0,0,0) 62%);

  --panel-header-bg: linear-gradient(180deg, rgba(255,200,120,0.10) 0%, transparent 100%);
  --panel-divider:   rgba(255,180,80,0.14);

  --text-primary:    #ffe0c0;
  --text-secondary:  #c89060;
  --text-muted:      #8a5c38;
  --text-label:      #7a5030;
  --text-title:      #ffe0a0;

  --rail-icon:       rgba(255,200,100,0.50);
  --rail-icon-hover: rgba(255,220,150,0.90);
  --rail-bg-idle:    rgba(255,180,80,0.08);
  --rail-bg-hover:   rgba(255,180,80,0.18);
  --rail-border:     rgba(255,180,80,0.14);

  --input-bg:        rgba(0,0,0,0.25);
  --input-border:    rgba(255,180,80,0.20);
  --input-text:      #ffe0c0;
  --input-placeholder: rgba(200,140,80,0.40);
  --input-focus-border: rgba(255,180,80,0.45);
  --input-focus-ring:   rgba(255,180,50,0.15);

  --hover-bg:        rgba(255,180,80,0.08);
  --hover-bg-btn:    rgba(255,180,80,0.15);

  --recv-bg:         linear-gradient(160deg, rgba(255,180,80,0.08) 0%, rgba(200,100,30,0.10) 100%);
  --recv-border:     rgba(255,180,80,0.18);
  --recv-text:       #ffe0c0;
  --recv-time:       rgba(200,140,80,0.45);

  --badge-bg:        #f5a623;
  --badge-text:      #1a0a04;

  --switcher-bg:     rgba(60,30,10,0.80);
  --switcher-border: rgba(255,180,80,0.28);

  --popup-bg:           rgba(50,25,10,0.94);
  --popup-border:       rgba(255,180,80,0.22);
  --popup-shadow:       0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,200,100,0.15);
  --popup-text:         rgba(255,224,192,0.90);
  --popup-text-secondary: rgba(255,224,192,0.60);
  --popup-text-muted:   rgba(255,224,192,0.32);
  --popup-text-label:   rgba(255,224,192,0.38);
  --popup-divider:      rgba(255,180,80,0.10);
  --popup-hover:        rgba(255,180,80,0.08);
  --popup-icon:         rgba(255,200,100,0.75);
  --popup-item-bg:      rgba(255,180,80,0.04);
  --popup-select-bg:    rgba(255,180,80,0.06);
  --popup-select-border: rgba(255,180,80,0.16);
  --popup-select-text:  rgba(255,224,192,0.85);

  --btn-ghost-bg:       rgba(255,180,80,0.08);
  --btn-ghost-border:   rgba(255,180,80,0.14);
  --reaction-idle-bg:   rgba(255,180,80,0.06);
  --reaction-idle-border: rgba(255,180,80,0.12);
  --separator-dot:      rgba(255,180,80,0.22);
  --slider-track:       rgba(255,180,80,0.15);
  --game-activity-color: #ffb060;

  --game-tile-empty-bg:          rgba(255,180,80,0.03);
  --game-tile-empty-border:      rgba(255,180,80,0.09);
  --game-tile-tbd-bg:            rgba(255,180,80,0.08);
  --game-tile-tbd-border:        rgba(255,180,80,0.35);
  --game-tile-absent-bg:         rgba(255,180,80,0.04);
  --game-tile-absent-border:     rgba(255,180,80,0.08);
  --game-tile-absent-color:      rgba(255,224,192,0.22);
  --game-key-bg:                 rgba(255,180,80,0.08);
  --game-key-border:             rgba(255,180,80,0.14);
  --game-key-absent-bg:          rgba(255,180,80,0.03);
  --game-key-absent-border:      rgba(255,180,80,0.05);
  --game-key-absent-color:       rgba(255,224,192,0.18);
  --typing-word-future:          rgba(255,224,192,0.15);
  --typing-word-active-pending:  rgba(255,224,192,0.20);
  --typing-word-done-correct:    rgba(255,224,192,0.50);
  --typing-surface-bg:           rgba(255,180,80,0.025);
  --typing-surface-border:       rgba(255,180,80,0.07);

  --aura-online:        rgba(255,200,80,0.55);
  --aura-gaming:        rgba(128,224,64,0.55);
  --aura-incall:        rgba(255,160,0,0.70);
  --aura-busy:          rgba(255,80,50,0.60);
  --aura-away:          rgba(200,140,60,0.30);
  --aura-glow-online:   rgba(255,180,50,0.30);
  --aura-glow-gaming:   rgba(100,200,50,0.30);
  --aura-glow-incall:   rgba(240,140,20,0.40);
  --aura-glow-busy:     rgba(220,60,20,0.30);
  --date-sep-line:      rgba(255,180,80,0.14);
  --date-sep-text:      rgba(200,140,80,0.38);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/index.css
git commit -m "feat: add Golden Hour CSS variables"
```

---

### Task 5: CSS Keyframes for Ultra Themes

**Files:**
- Modify: `src/index.css` (add new keyframes after existing ones, before `@layer`)

- [ ] **Step 1: Add animation keyframes for ambient effects**

Add after the ultra theme variable blocks, before the `@layer base` section:

```css
/* ═══ ULTRA THEME KEYFRAMES ═══ */
@keyframes cloud-float {
  0%, 100% { transform: translate(0px, 0px); }
  25%      { transform: translate(15px, -8px); }
  50%      { transform: translate(-10px, 5px); }
  75%      { transform: translate(8px, -3px); }
}
@keyframes sparkle-twinkle {
  0%, 100% { opacity: 0; transform: scale(0.5); }
  50%      { opacity: 1; transform: scale(1.2); }
}
@keyframes ember-rise {
  0%   { opacity: 0; transform: translateY(0) scale(0.5); }
  10%  { opacity: 0.7; }
  80%  { opacity: 0.2; }
  100% { opacity: 0; transform: translateY(-100vh) scale(0.2); }
}
@keyframes aurora-drift {
  0%, 100% { transform: translateX(0) scaleY(1); }
  33%      { transform: translateX(5%) scaleY(1.1); }
  66%      { transform: translateX(-3%) scaleY(0.9); }
}
@keyframes ray-pulse {
  0%, 100% { opacity: 0.5; }
  50%      { opacity: 1; }
}
@keyframes burst-breathe {
  0%, 100% { transform: scale(1); opacity: 0.85; }
  50%      { transform: scale(1.06); opacity: 1; }
}
@keyframes ring-pulse-orbit {
  0%, 100% { transform: scale(1); opacity: 0.5; }
  50%      { transform: scale(1.04); opacity: 0.8; }
}
@keyframes spark-orbit {
  0%   { transform: rotate(0deg) translateX(200px) rotate(0deg); opacity: 0.7; }
  25%  { opacity: 1; }
  50%  { opacity: 0.4; }
  75%  { opacity: 0.9; }
  100% { transform: rotate(360deg) translateX(200px) rotate(-360deg); opacity: 0.7; }
}

/* Pause ultra animations when idle */
.paused .ultra-ambient,
.paused .ultra-ambient * {
  animation-play-state: paused !important;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/index.css
git commit -m "feat: add ultra theme keyframes and idle-pause rule"
```

---

### Task 6: Ambient Background Component

**Files:**
- Create: `src/components/ui/AmbientBackground.tsx`

- [ ] **Step 1: Create the ambient background component**

This renders the full sky/sunset backgrounds conditionally based on the active theme. It sits behind all glass panels at `z-index: 0`.

```tsx
// src/components/ui/AmbientBackground.tsx
import { memo } from 'react';
import { useThemeStore } from '../../store/themeStore';

const FrutigerAmbient = memo(function FrutigerAmbient() {
  return (
    <div className="ultra-ambient pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 0 }}>
      {/* Volumetric clouds */}
      <div style={{
        position: 'absolute', width: 600, height: 200, top: -40, left: -80,
        borderRadius: '50%',
        background: 'radial-gradient(ellipse at 50% 40%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.15) 45%, transparent 70%)',
        filter: 'blur(30px)',
        animation: 'cloud-float 12s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', width: 500, height: 180, top: 10, right: -60,
        borderRadius: '50%',
        background: 'radial-gradient(ellipse at 50% 40%, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.12) 45%, transparent 70%)',
        filter: 'blur(30px)',
        animation: 'cloud-float 15s ease-in-out 3s infinite', opacity: 0.7,
      }} />
      <div style={{
        position: 'absolute', width: 400, height: 150, bottom: 20, left: '30%',
        borderRadius: '50%',
        background: 'radial-gradient(ellipse at 50% 40%, rgba(255,255,255,0.40) 0%, rgba(255,255,255,0.10) 45%, transparent 70%)',
        filter: 'blur(30px)',
        animation: 'cloud-float 10s ease-in-out 6s infinite', opacity: 0.5,
      }} />

      {/* God rays */}
      <div style={{
        position: 'absolute', width: 200, height: '100%', top: 0, left: '15%',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, transparent 100%)',
        transformOrigin: 'top center', transform: 'skewX(-8deg)',
        animation: 'ray-pulse 6s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', width: 150, height: '80%', top: 0, left: '55%',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 100%)',
        transformOrigin: 'top center', transform: 'skewX(5deg)',
        animation: 'ray-pulse 8s ease-in-out 2s infinite', opacity: 0.7,
      }} />
      <div style={{
        position: 'absolute', width: 100, height: '60%', top: 0, right: '15%',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 100%)',
        transformOrigin: 'top center', transform: 'skewX(-12deg)',
        animation: 'ray-pulse 7s ease-in-out 4s infinite', opacity: 0.5,
      }} />

      {/* Glass spheres (box-shadow glow, no filter:blur) */}
      {[
        { size: 60, left: '12%', top: '30%', delay: 0 },
        { size: 45, right: '18%', top: '20%', delay: 2 },
        { size: 35, left: '60%', bottom: '25%', delay: 4 },
      ].map((s, i) => (
        <div key={i} style={{
          position: 'absolute', width: s.size, height: s.size,
          left: s.left, right: (s as any).right, top: s.top, bottom: (s as any).bottom,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.50) 0%, rgba(255,255,255,0.08) 60%, transparent 80%)',
          border: '1px solid rgba(255,255,255,0.25)',
          boxShadow: '0 0 20px rgba(0,180,255,0.12), inset 0 -2px 6px rgba(0,0,0,0.06)',
          animation: `orb-drift ${7 + i}s ease-in-out ${s.delay}s infinite`,
        }} />
      ))}

      {/* Sparkles */}
      {[
        { top: '12%', left: '20%', delay: '0s' },
        { top: '25%', left: '70%', delay: '1s' },
        { top: '60%', left: '35%', delay: '2s' },
        { top: '45%', left: '85%', delay: '0.5s' },
      ].map((p, i) => (
        <div key={i} style={{
          position: 'absolute', width: 4, height: 4, ...p,
          background: 'white', borderRadius: '50%',
          boxShadow: '0 0 8px rgba(255,255,255,0.8), 0 0 16px rgba(0,200,255,0.4)',
          animation: `sparkle-twinkle 3s ease-in-out ${p.delay} infinite`,
        }} />
      ))}
    </div>
  );
});

const GoldenHourAmbient = memo(function GoldenHourAmbient() {
  return (
    <div className="ultra-ambient pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 0 }}>
      {/* Sun orb */}
      <div style={{
        position: 'absolute', bottom: -40, left: '50%', transform: 'translateX(-50%)',
        width: 180, height: 180, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,230,150,0.80) 0%, rgba(255,180,50,0.40) 40%, transparent 70%)',
        boxShadow: '0 0 80px rgba(255,180,50,0.35), 0 0 160px rgba(255,140,0,0.18)',
      }} />

      {/* Aurora waves */}
      <div style={{
        position: 'absolute', top: '5%', left: '-25%', width: '150%', height: '40%',
        background: 'linear-gradient(90deg, transparent 0%, rgba(255,80,120,0.25) 20%, rgba(255,140,60,0.20) 50%, rgba(255,200,80,0.15) 80%, transparent 100%)',
        filter: 'blur(50px)', opacity: 0.35,
        animation: 'aurora-drift 15s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', top: '20%', left: '-10%', width: '150%', height: '40%',
        background: 'linear-gradient(90deg, transparent 0%, rgba(200,60,140,0.18) 30%, rgba(255,120,40,0.20) 60%, transparent 100%)',
        filter: 'blur(50px)', opacity: 0.25,
        animation: 'aurora-drift 20s ease-in-out 5s infinite',
      }} />

      {/* Sun rays */}
      {[
        { width: 120, height: '70vh', left: '35%', skew: -6, delay: 0, dur: 7 },
        { width: 80, height: '55vh', left: '52%', skew: 4, delay: 2, dur: 9, opacity: 0.6 },
        { width: 100, height: '60vh', left: '62%', skew: 10, delay: 4, dur: 8, opacity: 0.4 },
        { width: 60, height: '50vh', left: '28%', skew: -12, delay: 1, dur: 10, opacity: 0.35 },
      ].map((r, i) => (
        <div key={i} style={{
          position: 'absolute', bottom: 0, width: r.width, height: r.height, left: r.left,
          background: 'linear-gradient(0deg, rgba(255,200,80,0.12) 0%, transparent 100%)',
          transformOrigin: 'bottom center', transform: `skewX(${r.skew}deg)`,
          animation: `ray-pulse ${r.dur}s ease-in-out ${r.delay}s infinite`,
          opacity: (r as any).opacity ?? 1,
        }} />
      ))}

      {/* Ember particles */}
      {[
        { left: '18%', delay: 0 }, { left: '42%', delay: 2 }, { left: '68%', delay: 4 },
        { left: '55%', delay: 1 }, { left: '82%', delay: 3 }, { left: '30%', delay: 5 },
      ].map((e, i) => (
        <div key={i} style={{
          position: 'absolute', bottom: `${5 + (i % 3) * 4}%`, left: e.left,
          width: 3, height: 3, borderRadius: '50%',
          background: 'rgba(255,140,40,0.55)',
          boxShadow: '0 0 4px rgba(255,140,40,0.35)',
          animation: `ember-rise 8s ease-out ${e.delay}s infinite`,
        }} />
      ))}

      {/* Golden sparkles */}
      {[
        { top: '15%', left: '22%', delay: '0s' },
        { top: '30%', left: '65%', delay: '1.2s' },
        { top: '55%', left: '40%', delay: '2.4s' },
        { top: '70%', right: '20%', delay: '0.6s' },
      ].map((p, i) => (
        <div key={i} style={{
          position: 'absolute', width: 4, height: 4, ...p,
          background: '#ffe080', borderRadius: '50%',
          boxShadow: '0 0 8px rgba(255,200,80,0.7), 0 0 16px rgba(255,140,40,0.3)',
          animation: `sparkle-twinkle 3s ease-in-out ${p.delay} infinite`,
        }} />
      ))}
    </div>
  );
});

export const AmbientBackground = memo(function AmbientBackground() {
  const theme = useThemeStore(s => s.theme);
  if (theme === 'john-frutiger') return <FrutigerAmbient />;
  if (theme === 'golden-hour') return <GoldenHourAmbient />;
  return null;
});
```

- [ ] **Step 2: Wire AmbientBackground into ChatLayout**

In `src/components/chat/ChatLayout.tsx`, add the import:

```ts
import { AmbientBackground } from '../ui/AmbientBackground';
```

Insert `<AmbientBackground />` as the FIRST child of the desktop layout's outer `<div className="flex flex-col h-screen overflow-hidden">` (line 150), before the glass top bar:

```tsx
<div className="flex flex-col h-screen overflow-hidden" style={{ position: 'relative' }}>
  <AmbientBackground />
  {/* ── Glass top bar — AeroChat header + actions ── */}
  ...
```

Also add `position: 'relative'` style to the outer div so the ambient layers position correctly.

- [ ] **Step 3: Verify the app builds**

Run: `cd aero-chat-app && pnpm build`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/AmbientBackground.tsx src/components/chat/ChatLayout.tsx
git commit -m "feat: add ambient background layers for ultra themes"
```

---

### Task 7: Theme Switcher — Ultra Themes Section

**Files:**
- Modify: `src/components/ui/ThemeSwitcher.tsx`

- [ ] **Step 1: Add ultra theme metadata and imports**

At the top of the file, update the import:

```ts
import { useThemeStore, PREMIUM_THEMES, ULTRA_THEMES, type Theme } from '../../store/themeStore';
```

Add two new `ThemeMeta` entries to the `THEME_META` array (after sakura):

```ts
  {
    id: 'john-frutiger', label: 'John Frutiger', description: 'Bright sky, white glass, glossy clouds',
    icon: <Sparkles className="h-4 w-4" />,
    accent: '#00d4ff', accentSecondary: '#0098e0', gradient: 'linear-gradient(135deg, #5ec8f5, #0098e0, #004a90)',
    bodySnippet: 'linear-gradient(170deg, #b8ecff 0%, #5ec8f5 20%, #0098e0 50%, #0068b8 80%, #004a90 100%)',
    sidebarBg: 'rgba(255,255,255,0.18)', chatBg: 'rgba(255,255,255,0.12)',
    textPrimary: 'rgba(0,40,80,0.90)', textSecondary: 'rgba(0,60,120,0.70)', textMuted: 'rgba(0,80,160,0.45)',
    panelBorder: 'rgba(255,255,255,0.30)', badgeBg: '#0098e0',
    inputBg: 'rgba(255,255,255,0.20)', recvBg: 'rgba(255,255,255,0.25)',
    hoverBg: 'rgba(0,160,255,0.08)',
  },
  {
    id: 'golden-hour', label: 'Golden Hour', description: 'Vista sunset, dark glass, amber glow',
    icon: <Sunset className="h-4 w-4" />,
    accent: '#f5a623', accentSecondary: '#c45e1a', gradient: 'linear-gradient(135deg, #ffe680, #f5a623, #c45e1a, #5c1a3a)',
    bodySnippet: 'linear-gradient(180deg, #1a0a2e 0%, #5c1a3a 25%, #c45e1a 55%, #f5a623 78%, #ffe680 100%)',
    sidebarBg: 'rgba(60,30,10,0.55)', chatBg: 'rgba(40,20,8,0.55)',
    textPrimary: '#ffe0c0', textSecondary: '#c89060', textMuted: '#8a5c38',
    panelBorder: 'rgba(255,180,80,0.22)', badgeBg: '#f5a623',
    inputBg: 'rgba(0,0,0,0.25)', recvBg: 'rgba(255,180,80,0.08)',
    hoverBg: 'rgba(255,180,80,0.08)',
  },
```

- [ ] **Step 2: Add the "Ultra Themes" section to the PremiumPicker theme list**

In the `PremiumPicker` function, after the Aero Chat+ section (after the `PREMIUM_THEMES` map, around line 528), add:

```tsx
                {/* Divider */}
                <div style={{ height: 1, background: 'var(--popup-divider)', margin: '8px 16px' }} />

                {/* Section: Ultra Themes */}
                <div style={{
                  padding: '4px 16px 6px', fontSize: 9, fontWeight: 700,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                  background: 'linear-gradient(90deg, #00d4ff, #f5a623)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>
                  ✦ Ultra Themes
                </div>
                {THEME_META.filter(t => ULTRA_THEMES.includes(t.id)).map(meta => {
                  const isOwned = meta.id === 'john-frutiger'
                    ? useThemeStore.getState().ownsJohnFrutiger
                    : useThemeStore.getState().ownsGoldenHour;
                  const isPrem = useAuthStore.getState().user?.is_premium === true;
                  return (
                    <UltraThemeRow
                      key={meta.id}
                      meta={meta}
                      isActive={theme === meta.id}
                      isSelected={selected === meta.id}
                      isOwned={isOwned}
                      isPremium={isPrem}
                      onSelect={() => {
                        if (isOwned && isPrem) setSelected(meta.id);
                      }}
                      onPurchase={async () => {
                        const userId = useAuthStore.getState().user?.id;
                        if (!userId || !isPrem) return;
                        const ok = await useThemeStore.getState().purchaseTheme(
                          meta.id as 'john-frutiger' | 'golden-hour', userId
                        );
                        if (ok) setSelected(meta.id);
                      }}
                    />
                  );
                })}
```

- [ ] **Step 3: Create the UltraThemeRow component**

Add before the `ThemeRow` component:

```tsx
/* ── Ultra theme row — extravagant presentation ── */
function UltraThemeRow({ meta, isActive, isSelected, isOwned, isPremium, onSelect, onPurchase }: {
  meta: ThemeMeta; isActive: boolean; isSelected: boolean;
  isOwned: boolean; isPremium: boolean;
  onSelect: () => void; onPurchase: () => void;
}) {
  const locked = !isOwned || !isPremium;
  return (
    <button
      onClick={locked ? undefined : onSelect}
      className="w-full text-left transition-all duration-150"
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 16px',
        background: isSelected ? `${meta.accent}12` : 'transparent',
        borderRight: isSelected ? `3px solid ${meta.accent}` : '3px solid transparent',
        opacity: locked ? 0.75 : 1,
        cursor: locked ? 'default' : 'pointer',
      }}
      onMouseEnter={e => {
        if (!isSelected && !locked) (e.currentTarget as HTMLElement).style.background = 'var(--popup-hover)';
      }}
      onMouseLeave={e => {
        if (!isSelected && !locked) (e.currentTarget as HTMLElement).style.background = 'transparent';
      }}
    >
      {/* Gradient swatch — larger for ultra */}
      <div style={{
        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
        background: meta.gradient,
        boxShadow: `0 2px 12px ${meta.accent}40`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        {isActive ? (
          <Check className="h-3.5 w-3.5" style={{ color: '#fff' }} />
        ) : locked ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
        ) : (
          <span style={{ color: '#fff', opacity: 0.7, display: 'flex' }}>{meta.icon}</span>
        )}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12, fontWeight: 700,
          color: isSelected ? meta.accent : 'var(--popup-text)',
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          {meta.label}
          {isActive && (
            <span style={{
              fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
              background: `${meta.accent}18`, color: meta.accent,
            }}>
              IN USE
            </span>
          )}
        </div>
        <div style={{ fontSize: 10, color: 'var(--popup-text-muted)', marginTop: 1 }}>
          {meta.description}
        </div>
      </div>

      {/* Purchase button or status */}
      {locked && isPremium && (
        <button
          onClick={(e) => { e.stopPropagation(); onPurchase(); }}
          className="rounded-lg px-2.5 py-1 text-[9px] font-bold transition-all hover:scale-105 active:scale-95"
          style={{
            background: meta.gradient,
            color: '#fff',
            border: `1px solid ${meta.accent}50`,
            boxShadow: `0 2px 8px ${meta.accent}25`,
            whiteSpace: 'nowrap',
          }}
        >
          Buy €2
        </button>
      )}
      {locked && !isPremium && (
        <span style={{ fontSize: 9, color: 'var(--popup-text-muted)', whiteSpace: 'nowrap' }}>
          Aero+ required
        </span>
      )}
    </button>
  );
}
```

- [ ] **Step 4: Verify the app builds**

Run: `cd aero-chat-app && pnpm build`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/ThemeSwitcher.tsx
git commit -m "feat: add Ultra Themes section to theme picker with purchase flow"
```

---

### Task 8: Transition Wipe Component

**Files:**
- Create: `src/components/ui/TransitionWipe.tsx`

- [ ] **Step 1: Create the cloud wipe + heat haze transition component**

```tsx
// src/components/ui/TransitionWipe.tsx
import { memo, useCallback, useRef, useEffect, useState } from 'react';
import { useThemeStore } from '../../store/themeStore';

type WipeVariant = 'cloud' | 'haze' | null;

interface TransitionWipeProps {
  /** Set to true to trigger the wipe. Resets automatically after completion. */
  active: boolean;
  /** Called at the midpoint when the screen is fully covered — swap views here. */
  onMidpoint?: () => void;
  /** Called when the wipe animation fully completes. */
  onComplete?: () => void;
}

export const TransitionWipe = memo(function TransitionWipe({ active, onMidpoint, onComplete }: TransitionWipeProps) {
  const theme = useThemeStore(s => s.theme);
  const variant: WipeVariant = theme === 'john-frutiger' ? 'cloud' : theme === 'golden-hour' ? 'haze' : null;
  const [wiping, setWiping] = useState(false);
  const midpointFired = useRef(false);
  const prevActive = useRef(false);

  useEffect(() => {
    if (active && !prevActive.current && variant) {
      midpointFired.current = false;
      setWiping(true);

      const midTimer = setTimeout(() => {
        if (!midpointFired.current) {
          midpointFired.current = true;
          onMidpoint?.();
        }
      }, 380);

      const doneTimer = setTimeout(() => {
        setWiping(false);
        onComplete?.();
      }, 1200);

      prevActive.current = true;
      return () => { clearTimeout(midTimer); clearTimeout(doneTimer); };
    }
    if (!active) prevActive.current = false;
  }, [active, variant, onMidpoint, onComplete]);

  if (!variant || !wiping) return null;

  if (variant === 'cloud') return <CloudWipe />;
  return <HazeWipe />;
});

/* ── Cloud Wipe (John Frutiger) ── */
const cloudStyle: React.CSSProperties = {
  position: 'absolute', width: '160%', height: '100%', top: 0,
  background: [
    'radial-gradient(ellipse 500px 400px at 30% 30%, rgba(255,255,255,0.85) 0%, transparent 55%)',
    'radial-gradient(ellipse 600px 350px at 70% 60%, rgba(255,255,255,0.80) 0%, transparent 55%)',
    'radial-gradient(ellipse 400px 500px at 50% 80%, rgba(255,255,255,0.75) 0%, transparent 50%)',
    'radial-gradient(ellipse 300px 300px at 20% 70%, rgba(255,255,255,0.70) 0%, transparent 50%)',
  ].join(', '),
  filter: 'blur(40px)',
};

function CloudWipe() {
  return (
    <div className="ultra-ambient" style={{ position: 'fixed', inset: 0, zIndex: 50, pointerEvents: 'none', overflow: 'hidden' }}>
      {[0, 80, 160].map((delay, i) => (
        <div key={i} style={{
          ...cloudStyle,
          zIndex: 51 + i,
          animation: `cloud-sweep 1.2s cubic-bezier(0.4,0,0.2,1) ${delay}ms forwards`,
        }} />
      ))}
      <style>{`
        @keyframes cloud-sweep {
          0%   { transform: translateX(-170%); }
          100% { transform: translateX(170%); }
        }
      `}</style>
    </div>
  );
}

/* ── Heat Haze (Golden Hour) ── */
function HazeWipe() {
  return (
    <div className="ultra-ambient" style={{ position: 'fixed', inset: 0, zIndex: 50, pointerEvents: 'none', overflow: 'hidden' }}>
      {/* Main haze wall */}
      <div style={{
        position: 'absolute', width: '200%', height: '100%', top: 0,
        background: [
          'radial-gradient(ellipse 400px 100% at 50% 50%, rgba(255,200,80,0.80) 0%, transparent 50%)',
          'radial-gradient(ellipse 600px 100% at 50% 40%, rgba(255,140,40,0.55) 0%, transparent 55%)',
          'linear-gradient(90deg, transparent 20%, rgba(255,180,60,0.45) 40%, rgba(255,220,100,0.65) 50%, rgba(255,180,60,0.45) 60%, transparent 80%)',
        ].join(', '),
        filter: 'blur(60px)',
        animation: 'haze-sweep 1.0s cubic-bezier(0.4,0,0.2,1) forwards',
      }} />
      {/* Bright flare core */}
      <div style={{
        position: 'absolute', width: '150%', height: '100%', top: 0,
        background: [
          'radial-gradient(ellipse 200px 100% at 50% 50%, rgba(255,255,200,0.65) 0%, transparent 45%)',
          'radial-gradient(ellipse 350px 100% at 50% 50%, rgba(255,200,80,0.35) 0%, transparent 50%)',
        ].join(', '),
        filter: 'blur(40px)',
        animation: 'haze-sweep 0.9s cubic-bezier(0.4,0,0.2,1) 60ms forwards',
      }} />
      {/* Heat ripple */}
      <div style={{
        position: 'absolute', width: '180%', height: '100%', top: 0,
        background: 'repeating-linear-gradient(0deg, transparent 0px, rgba(255,200,80,0.05) 2px, transparent 4px, transparent 12px)',
        mixBlendMode: 'overlay',
        animation: 'haze-sweep 1.1s cubic-bezier(0.4,0,0.2,1) 20ms forwards',
      }} />
      <style>{`
        @keyframes haze-sweep {
          0%   { transform: translateX(-200%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/TransitionWipe.tsx
git commit -m "feat: add TransitionWipe component (cloud wipe + heat haze)"
```

---

### Task 9: Hook Transitions into Corner Navigation

**Files:**
- Modify: `src/components/chat/ChatLayout.tsx`

- [ ] **Step 1: Add transition wipe state and import**

Add import:

```ts
import { TransitionWipe } from '../ui/TransitionWipe';
```

Add state inside `ChatLayout()`, after the existing state declarations:

```ts
const [cornerWipeActive, setCornerWipeActive] = useState(false);
const pendingCornerAction = useRef<(() => void) | null>(null);
```

- [ ] **Step 2: Add a helper to trigger transitions for ultra themes**

```ts
const triggerCornerTransition = useCallback((action: () => void) => {
  if (isUltraTheme(activeTheme)) {
    pendingCornerAction.current = action;
    setCornerWipeActive(true);
  } else {
    action();
  }
}, [activeTheme]);
```

- [ ] **Step 3: Render the TransitionWipe component**

Add just before the closing `</div>` of the desktop return (before the `</div>` on line ~472):

```tsx
<TransitionWipe
  active={cornerWipeActive}
  onMidpoint={() => {
    pendingCornerAction.current?.();
    pendingCornerAction.current = null;
  }}
  onComplete={() => setCornerWipeActive(false)}
/>
```

- [ ] **Step 4: Export `triggerCornerTransition` for use by CornerRail**

Instead of prop-drilling, expose via a store or ref. The simplest approach: add `triggerCornerTransition` to the `cornerStore` as an optional callback, or pass it as a prop to `CornerRail`. Check how `CornerRail` currently triggers corners and wire the transition function into that path. The corner store's `openGameView`, `openWriterView`, etc. are the functions that need to be wrapped.

For now, the integration point is identified. The implementing agent should wrap the corner store's `open*View` calls in `ChatLayout` with `triggerCornerTransition`. The exact wiring depends on how CornerRail currently invokes those functions (it likely calls store actions directly).

- [ ] **Step 5: Commit**

```bash
git add src/components/chat/ChatLayout.tsx
git commit -m "feat: wire transition wipe into corner navigation"
```

---

### Task 10: Server Picker — Ultra Theme Variants

**Files:**
- Modify: `src/components/servers/ServerOverlay.tsx`

- [ ] **Step 1: Add ultra theme detection**

At the top of `ServerOverlay.tsx`, add:

```ts
import { useThemeStore } from '../../store/themeStore';
```

Inside the component, add:

```ts
const activeTheme = useThemeStore(s => s.theme);
const isUltra = activeTheme === 'john-frutiger' || activeTheme === 'golden-hour';
```

- [ ] **Step 2: Wrap the overlay content conditionally**

When `isUltra` is true, render the themed picker overlay instead of the standard grid. The themed picker has:
- **John Frutiger:** A breathing cloud background with server cards inside (cloud picker)
- **Golden Hour:** A golden sun burst with orbiting sparks and server cards (sun burst picker)

For both: the DM view (behind the overlay) gets dimmed via the existing backdrop. Server cards use the same `ServerCard` component but with theme-appropriate wrapper styling.

Add a new `UltraServerPicker` component inside the file:

```tsx
function UltraServerPicker({ servers, onlineCount, unreadMap, userId, onSelect, onClose }: {
  servers: Server[];
  onlineCount: Map<string, number>;
  unreadMap: Map<string, number>;
  userId: string;
  onSelect: (serverId: string) => void;
  onClose: () => void;
}) {
  const theme = useThemeStore(s => s.theme);
  const isFrutiger = theme === 'john-frutiger';

  return (
    <div
      className="animate-fade-in"
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={onClose}
    >
      <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
        {/* Themed glow background */}
        <div style={{
          position: 'absolute', inset: -80, borderRadius: '50%',
          background: isFrutiger
            ? 'radial-gradient(circle, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.10) 40%, transparent 65%)'
            : 'radial-gradient(circle, rgba(255,220,100,0.35) 0%, rgba(255,180,50,0.15) 40%, transparent 65%)',
          filter: 'blur(30px)',
          animation: 'burst-breathe 4s ease-in-out infinite',
          pointerEvents: 'none',
        }} />

        {/* Picker title */}
        <div style={{
          textAlign: 'center', marginBottom: 16,
          fontSize: 14, fontWeight: 700,
          color: isFrutiger ? 'rgba(255,255,255,0.85)' : '#ffe0a0',
          textShadow: '0 2px 8px rgba(0,0,0,0.4)',
        }}>
          Choose a Server
        </div>

        {/* Server cards grid */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 14,
          justifyContent: 'center', maxWidth: 480,
          position: 'relative', zIndex: 2,
        }}>
          {servers.map((server, i) => (
            <div
              key={server.id}
              className="animate-fade-in"
              style={{
                animationDelay: `${200 + i * 120}ms`,
                animationFillMode: 'backwards',
              }}
            >
              <ServerCard
                server={server}
                onlineCount={onlineCount.get(server.id) ?? 0}
                unread={unreadMap.get(server.id) ?? 0}
                isOwner={server.owner_id === userId}
                onClick={() => onSelect(server.id)}
                onDelete={() => {}}
              />
            </div>
          ))}
        </div>

        {/* Orbiting sparks for Golden Hour */}
        {!isFrutiger && (
          <div className="ultra-ambient" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {[0, -2, -4].map((d, i) => (
              <div key={i} style={{
                position: 'absolute', left: '50%', top: '50%',
                width: 5, height: 5, borderRadius: '50%',
                background: '#ffe080',
                boxShadow: '0 0 10px rgba(255,200,80,0.7), 0 0 20px rgba(255,140,40,0.3)',
                animation: `spark-orbit 6s linear ${d}s infinite`,
              }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Use `UltraServerPicker` conditionally in the main component**

In the main `ServerOverlay` render, conditionally return the ultra picker:

```tsx
if (isUltra) {
  return (
    <UltraServerPicker
      servers={servers}
      onlineCount={onlineCounts}
      unreadMap={unreadCounts}
      userId={user?.id ?? ''}
      onSelect={(serverId) => {
        // Use existing server selection logic
        selectServer(serverId);
        enterServer();
      }}
      onClose={closeServerOverlay}
    />
  );
}
// ... existing standard overlay below
```

The implementing agent should read the existing overlay code to identify the correct variable names for `servers`, `onlineCounts`, `unreadCounts`, `selectServer`, `enterServer`, and `closeServerOverlay`.

- [ ] **Step 4: Commit**

```bash
git add src/components/servers/ServerOverlay.tsx
git commit -m "feat: add ultra theme server picker variants (cloud + sun burst)"
```

---

### Task 11: Bubble Sky Server Interior

**Files:**
- Modify: `src/components/servers/BubbleHub.tsx`

- [ ] **Step 1: Add ultra theme detection**

```ts
import { useThemeStore } from '../../store/themeStore';
```

Inside the component:

```ts
const activeTheme = useThemeStore(s => s.theme);
const isUltra = activeTheme === 'john-frutiger' || activeTheme === 'golden-hour';
const isFrutiger = activeTheme === 'john-frutiger';
```

- [ ] **Step 2: Create BubbleSky sub-component**

Add inside the file:

```tsx
const BubbleSky = memo(function BubbleSky({ bubbles, onBubbleClick, isFrutiger }: {
  bubbles: Bubble[];
  onBubbleClick: (id: string) => void;
  isFrutiger: boolean;
}) {
  const positions = getBubblePositions(bubbles.length, 600, 400);

  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden"
      style={{ background: 'transparent' }}>
      {/* Floating breadcrumb */}
      <div style={{
        position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
        padding: '5px 16px', borderRadius: 10, zIndex: 2,
        background: isFrutiger ? 'rgba(255,255,255,0.14)' : 'rgba(60,30,10,0.50)',
        border: `1px solid ${isFrutiger ? 'rgba(255,255,255,0.22)' : 'rgba(255,180,80,0.20)'}`,
        backdropFilter: 'blur(12px)',
        fontSize: 11, fontWeight: 600,
        color: isFrutiger ? 'rgba(255,255,255,0.70)' : 'rgba(255,220,150,0.70)',
      }}>
        {/* Server name injected by parent */}
      </div>

      {/* Bubbles */}
      <div style={{ position: 'relative', width: 600, height: 400 }}>
        {bubbles.map((bubble, i) => {
          const pos = positions[i];
          if (!pos) return null;
          const ringColor = isFrutiger
            ? `${bubble.color}50`
            : `${bubble.color}40`;

          return (
            <div
              key={bubble.id}
              onClick={() => onBubbleClick(bubble.id)}
              className="absolute cursor-pointer"
              style={{
                width: 75, height: 75, borderRadius: '50%',
                left: pos.x - 37.5, top: pos.y - 37.5,
                background: isFrutiger
                  ? `rgba(255,255,255,0.12)`
                  : `rgba(255,200,100,0.08)`,
                border: `1.5px solid ${ringColor}`,
                backdropFilter: 'blur(6px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column',
                boxShadow: isFrutiger
                  ? `0 4px 16px rgba(0,0,0,0.06), inset 0 1px 1px rgba(255,255,255,0.30)`
                  : `0 4px 16px rgba(0,0,0,0.10), inset 0 1px 1px rgba(255,220,150,0.12)`,
                animation: `orb-drift ${6 + (i % 3)}s ease-in-out ${i * 0.5}s infinite`,
                transition: 'box-shadow 0.2s, transform 0.2s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.boxShadow = `0 0 20px ${bubble.color}30`;
                (e.currentTarget as HTMLElement).style.transform = 'scale(1.08)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.boxShadow = '';
                (e.currentTarget as HTMLElement).style.transform = '';
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 600, color: bubble.color }}>
                {bubble.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
});
```

- [ ] **Step 3: Conditionally render BubbleSky**

In the main `BubbleHub` render, wrap the existing layout:

```tsx
if (isUltra) {
  return (
    <BubbleSky
      bubbles={bubbles}
      onBubbleClick={(id) => {
        selectBubble(id);
        enterBubble();
      }}
      isFrutiger={isFrutiger}
    />
  );
}
// ... existing standard BubbleHub layout below
```

The implementing agent should identify the correct variable names (`bubbles`, `selectBubble`, `enterBubble`) from the existing component code.

- [ ] **Step 4: Commit**

```bash
git add src/components/servers/BubbleHub.tsx
git commit -m "feat: add Bubble Sky layout for ultra theme server interiors"
```

---

### Task 12: Sent Bubble Gloss & Vista Window Buttons

**Files:**
- Modify: `src/components/chat/ChatWindow.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Add theme-aware gloss class to sent bubbles**

In `src/index.css`, add after the ultra theme keyframes section:

```css
/* Ultra theme sent bubble gloss */
[data-theme="john-frutiger"] .ultra-sent-gloss,
[data-theme="golden-hour"] .ultra-sent-gloss {
  position: relative;
  overflow: hidden;
}
[data-theme="john-frutiger"] .ultra-sent-gloss::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 40%;
  background: linear-gradient(180deg, rgba(255,255,255,0.10) 0%, transparent 100%);
  pointer-events: none;
  border-radius: inherit;
  z-index: 1;
}
[data-theme="golden-hour"] .ultra-sent-gloss::before {
  content: '';
  position: absolute;
  top: 0; left: 5%; right: 5%;
  height: 45%;
  background: linear-gradient(180deg, rgba(255,255,255,0.10) 0%, transparent 100%);
  pointer-events: none;
  border-radius: 14px 14px 50% 50%;
  z-index: 1;
}

/* Pause entry animations for ultra ambient layer in idle */
.paused [data-theme="john-frutiger"] .ultra-ambient,
.paused [data-theme="golden-hour"] .ultra-ambient {
  animation-play-state: paused;
}
```

- [ ] **Step 2: Add `ultra-sent-gloss` class to sent message bubbles in ChatWindow**

In `src/components/chat/ChatWindow.tsx`, find the sent bubble `<div>` (the one with `rounded-aero-lg px-4 py-2.5` or similar styling for `isMine`). Add the class `ultra-sent-gloss` to it:

```tsx
className={`rounded-aero-lg px-4 py-2.5 ultra-sent-gloss`}
```

The implementing agent should read the exact sent bubble JSX (around lines 525-540) to find the correct element and add the class.

- [ ] **Step 3: Commit**

```bash
git add src/index.css src/components/chat/ChatWindow.tsx
git commit -m "feat: add ultra theme sent bubble gloss effect"
```

---

### Task 13: Server Rail Ultra Styling

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Add ultra theme rail overrides**

Add after the sent bubble gloss CSS:

```css
/* Ultra theme server rail — glossy orbs */
[data-theme="john-frutiger"] .corner-rail-icon {
  border-radius: 14px !important;
  background: rgba(255,255,255,0.20) !important;
  border: 1.5px solid rgba(255,255,255,0.30) !important;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06), inset 0 1px 1px rgba(255,255,255,0.40) !important;
}
[data-theme="john-frutiger"] .corner-rail-icon:hover {
  box-shadow: 0 4px 16px rgba(0,180,255,0.25), inset 0 1px 1px rgba(255,255,255,0.40) !important;
}

[data-theme="golden-hour"] .corner-rail-icon {
  border-radius: 50% !important;
  background: linear-gradient(180deg, rgba(255,200,100,0.28) 0%, rgba(200,100,30,0.32) 50%, rgba(120,50,10,0.40) 100%) !important;
  border: 1.5px solid rgba(255,180,80,0.28) !important;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15), inset 0 -2px 4px rgba(0,0,0,0.10) !important;
  position: relative;
  overflow: hidden;
}
[data-theme="golden-hour"] .corner-rail-icon::before {
  content: '';
  position: absolute;
  top: 0; left: 10%; right: 10%; height: 45%;
  background: linear-gradient(180deg, rgba(255,255,255,0.25) 0%, transparent 100%);
  border-radius: 50%;
  pointer-events: none;
}
[data-theme="golden-hour"] .corner-rail-icon:hover {
  box-shadow: 0 0 14px rgba(255,180,50,0.30), inset 0 -2px 4px rgba(0,0,0,0.10) !important;
}
```

- [ ] **Step 2: Verify the `corner-rail-icon` class exists on CornerRail icons**

Check `src/components/corners/CornerRail.tsx` — if the rail icons don't have a `corner-rail-icon` class, add it. The implementing agent should read the file and add the class to each icon button element.

- [ ] **Step 3: Commit**

```bash
git add src/index.css src/components/corners/CornerRail.tsx
git commit -m "feat: add ultra theme server rail styling (glossy orbs)"
```

---

### Task 14: Scrollbar Styling

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Add themed scrollbars**

```css
/* Ultra theme scrollbars */
[data-theme="john-frutiger"] ::-webkit-scrollbar { width: 6px; }
[data-theme="john-frutiger"] ::-webkit-scrollbar-track { background: transparent; }
[data-theme="john-frutiger"] ::-webkit-scrollbar-thumb {
  background: rgba(0,180,255,0.20);
  border-radius: 3px;
}
[data-theme="john-frutiger"] ::-webkit-scrollbar-thumb:hover {
  background: rgba(0,180,255,0.30);
}

[data-theme="golden-hour"] ::-webkit-scrollbar { width: 6px; }
[data-theme="golden-hour"] ::-webkit-scrollbar-track { background: transparent; }
[data-theme="golden-hour"] ::-webkit-scrollbar-thumb {
  background: rgba(255,180,80,0.15);
  border-radius: 3px;
}
[data-theme="golden-hour"] ::-webkit-scrollbar-thumb:hover {
  background: rgba(255,180,80,0.25);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/index.css
git commit -m "feat: add ultra theme scrollbar styling"
```

---

### Task 15: Visual Testing & Polish

- [ ] **Step 1: Start dev server and test both themes**

Run: `cd aero-chat-app && pnpm dev`

Test checklist:
1. Open theme picker → verify "Ultra Themes" section appears below Aero Chat+
2. Click "Buy €2" on John Frutiger → verify instant unlock toast + theme selectable
3. Apply John Frutiger → verify sky background with clouds, god rays, sparkles, glass spheres
4. Check sidebar, chat, input bar, messages all use correct glass styling
5. Verify sent bubble gloss (white sheen on top 40%)
6. Check date separator styling
7. Verify rail icons have glossy rounded square treatment
8. Switch to Golden Hour → verify sunset background with aurora, sun, embers, sparkles
9. Check Vista-style dark glass panels
10. Verify amber aura rings on online avatars
11. Check server picker opens with themed overlay (cloud vs sun burst)
12. Enter a server → verify Bubble Sky layout (floating channel bubbles)
13. Switch back to standard theme (e.g., "night") → verify all ultra elements disappear
14. Tab away from app → verify `.paused` system stops all ultra animations
15. Both themes: check games corner, writer's corner transitions (cloud wipe / heat haze)

- [ ] **Step 2: Fix any visual issues found during testing**

- [ ] **Step 3: Final commit with any polish fixes**

```bash
git add -A
git commit -m "fix: ultra theme visual polish from testing"
```

---

### Task 16: Production Build Verification

- [ ] **Step 1: Run production build**

Run: `cd aero-chat-app && pnpm build`
Expected: Build completes with no errors

- [ ] **Step 2: Commit the migration note**

Update `CLAUDE.md` pre-launch checklist to include migration 026:

Add to the migration list in CLAUDE.md:
```
   - Migration 026 — `owns_john_frutiger` + `owns_golden_hour` columns on `profiles` (ultra themes)
```

```bash
git add CLAUDE.md
git commit -m "docs: add migration 026 to pre-launch checklist"
```
