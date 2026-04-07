# Master Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a €5 "Master" premium theme with a 3D parallax tile dashboard, FLIP expand animations, emerald-on-black frosted glassmorphism, and compact fullscreen layouts.

**Architecture:** `ChatLayout` detects `theme === 'master'` and renders `<MasterThemeDashboard />` instead of the normal sidebar+chat layout. The dashboard uses a Metro Mosaic grid of 6 parallax tiles. Clicking a tile FLIP-expands it fullscreen, rendering the existing corner components wrapped in `.master-compact` CSS overrides. State is shared via `useCornerStore`.

**Tech Stack:** React 19, Zustand, CSS custom properties, CSS Grid, `requestAnimationFrame` parallax, FLIP animation pattern, Supabase (migration).

**Spec:** `docs/superpowers/specs/2026-04-07-master-theme-design.md`

---

### Task 1: Supabase Migration + Theme Store

**Files:**
- Create: `supabase/migrations/027_master_theme.sql`
- Modify: `src/store/themeStore.ts`

- [ ] **Step 1: Create the migration file**

```sql
-- 027_master_theme.sql
-- Add master theme ownership column to profiles
ALTER TABLE profiles ADD COLUMN owns_master BOOLEAN NOT NULL DEFAULT false;
```

- [ ] **Step 2: Extend the Theme type and add MASTER_THEMES**

In `src/store/themeStore.ts`, update the type and add the new tier:

```ts
export type Theme = 'day' | 'night' | 'ocean' | 'sunset' | 'aurora' | 'sakura' | 'john-frutiger' | 'golden-hour' | 'master';
```

Add after `ULTRA_THEMES`:

```ts
export const MASTER_THEMES: Theme[] = ['master'];

export function isMasterTheme(t: Theme): boolean {
  return MASTER_THEMES.includes(t);
}
```

- [ ] **Step 3: Add ownsMaster to the store interface and initial state**

Add to the `ThemeStore` interface:

```ts
ownsMaster: boolean;
```

Add to the initial state:

```ts
ownsMaster: false,
```

- [ ] **Step 4: Update loadOwnership to fetch owns_master**

Change the select query from:
```ts
.select('owns_john_frutiger, owns_golden_hour')
```
to:
```ts
.select('owns_john_frutiger, owns_golden_hour, owns_master')
```

And add to the set call:
```ts
ownsMaster: data.owns_master ?? false,
```

- [ ] **Step 5: Update purchaseTheme to handle 'master'**

Extend the `purchaseTheme` method. Change the type from:
```ts
purchaseTheme: (theme: 'john-frutiger' | 'golden-hour', userId: string) => Promise<boolean>;
```
to:
```ts
purchaseTheme: (theme: 'john-frutiger' | 'golden-hour' | 'master', userId: string) => Promise<boolean>;
```

Update the column mapping:
```ts
const col = theme === 'john-frutiger' ? 'owns_john_frutiger'
  : theme === 'golden-hour' ? 'owns_golden_hour'
  : 'owns_master';
```

Update the set call:
```ts
if (error) return false;
if (theme === 'john-frutiger') set({ ownsJohnFrutiger: true });
else if (theme === 'golden-hour') set({ ownsGoldenHour: true });
else set({ ownsMaster: true });
return true;
```

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/027_master_theme.sql src/store/themeStore.ts
git commit -m "feat: add master theme type, ownership, and migration"
```

---

### Task 2: CSS Theme Variables

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Add `[data-theme="master"]` CSS variable block**

Add after the `[data-theme="golden-hour"]` block (which ends around line 930). Insert the full master theme variable block:

```css
/* ═══ MASTER THEME — Emerald Hacker Glass ═══ */
[data-theme="master"] {
  --body-bg: #050505;

  --sidebar-bg:      rgba(0,230,118,0.06);
  --sidebar-border:  rgba(0,230,118,0.14);
  --sidebar-shadow:  0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(0,230,118,0.08);
  --sidebar-gloss:   linear-gradient(180deg, rgba(0,230,118,0.06) 0%, transparent 50%);

  --chat-bg:         rgba(0,230,118,0.04);
  --chat-border:     rgba(0,230,118,0.12);
  --chat-shadow:     0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(0,230,118,0.06);
  --chat-gloss:      linear-gradient(180deg, rgba(0,230,118,0.05) 0%, transparent 45%);

  --card-bg:         rgba(0,230,118,0.08);
  --card-bg-solid:   #0a1a10;
  --card-border:     rgba(0,230,118,0.18);
  --card-shadow:     0 12px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(0,230,118,0.10);
  --card-gloss:      linear-gradient(180deg, rgba(0,230,118,0.08) 0%, transparent 50%);

  --panel-header-bg: rgba(0,230,118,0.04);
  --panel-divider:   rgba(0,230,118,0.10);

  --text-primary:    rgba(255,255,255,0.70);
  --text-secondary:  rgba(255,255,255,0.45);
  --text-muted:      rgba(255,255,255,0.22);
  --text-label:      rgba(0,230,118,0.40);
  --text-title:      #00e676;

  --rail-icon:       rgba(0,230,118,0.40);
  --rail-icon-hover: rgba(0,230,118,0.70);
  --rail-bg-idle:    rgba(0,230,118,0.06);
  --rail-bg-hover:   rgba(0,230,118,0.12);
  --rail-border:     rgba(0,230,118,0.12);

  --input-bg:        rgba(0,230,118,0.04);
  --input-border:    rgba(0,230,118,0.12);
  --input-focus-border: rgba(0,230,118,0.35);
  --input-placeholder: rgba(255,255,255,0.18);

  --sent-bg:         linear-gradient(135deg, rgba(0,230,118,0.18), rgba(0,200,83,0.12));
  --sent-border:     rgba(0,230,118,0.22);
  --sent-text:       rgba(255,255,255,0.75);
  --recv-bg:         rgba(0,230,118,0.06);
  --recv-border:     rgba(0,230,118,0.10);
  --recv-text:       rgba(255,255,255,0.55);

  --badge-bg:        rgba(0,230,118,0.22);
  --badge-text:      #00e676;
  --hover-bg:        rgba(0,230,118,0.06);
  --active-bg:       rgba(0,230,118,0.10);

  --popup-bg:        rgba(8,20,12,0.95);
  --popup-border:    rgba(0,230,118,0.15);
  --popup-shadow:    0 24px 80px rgba(0,0,0,0.6);
  --popup-divider:   rgba(0,230,118,0.08);
  --popup-text:      rgba(255,255,255,0.70);
  --popup-text-muted: rgba(255,255,255,0.30);
  --popup-icon:      rgba(0,230,118,0.50);
  --popup-hover:     rgba(0,230,118,0.06);

  --accent:          #00e676;
  --accent-secondary: #00c853;

  --switcher-bg:     rgba(0,230,118,0.06);
  --switcher-border: rgba(0,230,118,0.14);

  --game-tile-bg:    rgba(0,230,118,0.06);
  --game-tile-border: rgba(0,230,118,0.14);
  --game-tile-glow:  rgba(0,230,118,0.08);

  --aura-online:     rgba(0,230,118,0.60);
  --aura-gaming:     rgba(0,230,118,0.60);
  --aura-incall:     rgba(255,160,0,0.70);
  --aura-busy:       rgba(255,80,50,0.60);
  --aura-away:       rgba(0,230,118,0.25);
  --aura-glow-online:  rgba(0,230,118,0.30);
  --aura-glow-gaming:  rgba(0,230,118,0.30);
  --aura-glow-incall:  rgba(200,120,0,0.35);
  --aura-glow-busy:    rgba(220,60,20,0.30);
  --date-sep-line:   rgba(0,230,118,0.10);
  --date-sep-text:   rgba(0,230,118,0.30);
}
```

- [ ] **Step 2: Add `.tile-paused` utility class**

Add after the `.paused` idle rules (around line 560):

```css
/* Master theme — freeze tile preview animations */
.tile-paused,
.tile-paused * {
  animation-play-state: paused !important;
}
```

- [ ] **Step 3: Add `.master-compact` override classes**

Add after the tile-paused rule:

```css
/* Master theme — compact layout overrides */
.master-compact .glass-sidebar,
.master-compact .glass-chat {
  border-radius: 0;
  border: none;
  box-shadow: none;
}
.master-compact input,
.master-compact textarea {
  height: 28px;
  font-size: 12px;
}
.master-compact .rounded-aero { border-radius: 10px; }
.master-compact .rounded-aero-lg { border-radius: 12px; }
```

- [ ] **Step 4: Add master theme scrollbar**

Add after existing scrollbar rules (around line 1072):

```css
[data-theme="master"] ::-webkit-scrollbar { width: 6px; }
[data-theme="master"] ::-webkit-scrollbar-track { background: transparent; }
[data-theme="master"] ::-webkit-scrollbar-thumb {
  background: rgba(0,230,118,0.15); border-radius: 3px;
}
[data-theme="master"] ::-webkit-scrollbar-thumb:hover {
  background: rgba(0,230,118,0.25);
}
```

- [ ] **Step 5: Commit**

```bash
git add src/index.css
git commit -m "feat: add master theme CSS variables and compact overrides"
```

---

### Task 3: useParallax Hook

**Files:**
- Create: `src/hooks/useParallax.ts`

- [ ] **Step 1: Create the parallax hook**

```ts
// src/hooks/useParallax.ts
import { useRef, useCallback, useEffect, type RefObject, type CSSProperties } from 'react';

interface ParallaxResult {
  style: CSSProperties;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export function useParallax(
  ref: RefObject<HTMLElement | null>,
  maxRotate = 15,
  bgShift = 20,
): ParallaxResult {
  const mouseX = useRef(0);
  const mouseY = useRef(0);
  const currentRX = useRef(0);
  const currentRY = useRef(0);
  const rafId = useRef(0);
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>();
  const styleRef = useRef<CSSProperties>({
    transform: 'perspective(800px) rotateY(0deg) rotateX(0deg)',
    transition: 'transform 0.1s ease-out',
  });

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    mouseX.current = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2);
    mouseY.current = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2);
  }, [ref]);

  const onMouseEnter = useCallback(() => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    const el = ref.current;
    if (el) el.style.willChange = 'transform';
  }, [ref]);

  const onMouseLeave = useCallback(() => {
    mouseX.current = 0;
    mouseY.current = 0;
    leaveTimer.current = setTimeout(() => {
      const el = ref.current;
      if (el) el.style.willChange = '';
    }, 600);
  }, [ref]);

  useEffect(() => {
    const animate = () => {
      const targetRX = mouseX.current * maxRotate;
      const targetRY = mouseY.current * -maxRotate;
      currentRX.current += (targetRX - currentRX.current) * 0.12;
      currentRY.current += (targetRY - currentRY.current) * 0.12;

      const el = ref.current;
      if (el) {
        el.style.transform =
          `perspective(800px) rotateY(${currentRX.current.toFixed(2)}deg) rotateX(${currentRY.current.toFixed(2)}deg)`;
      }
      rafId.current = requestAnimationFrame(animate);
    };
    rafId.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId.current);
  }, [ref, maxRotate]);

  return { style: styleRef.current, onMouseMove, onMouseEnter, onMouseLeave };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useParallax.ts
git commit -m "feat: add useParallax hook for 3D tilt tracking"
```

---

### Task 4: useFlip Hook

**Files:**
- Create: `src/hooks/useFlip.ts`

- [ ] **Step 1: Create the FLIP animation hook**

```ts
// src/hooks/useFlip.ts
import { useRef, useCallback } from 'react';

interface FlipState {
  captureFirst: (el: HTMLElement) => void;
  playExpand: (el: HTMLElement, onDone?: () => void) => void;
  playCollapse: (el: HTMLElement, targetRect: DOMRect, onDone?: () => void) => void;
}

export function useFlip(): FlipState {
  const firstRect = useRef<DOMRect | null>(null);

  const captureFirst = useCallback((el: HTMLElement) => {
    firstRect.current = el.getBoundingClientRect();
  }, []);

  const playExpand = useCallback((el: HTMLElement, onDone?: () => void) => {
    const first = firstRect.current;
    if (!first) {
      onDone?.();
      return;
    }

    const last = el.getBoundingClientRect();
    const dx = first.left - last.left + (first.width - last.width) / 2;
    const dy = first.top - last.top + (first.height - last.height) / 2;
    const sx = first.width / last.width;
    const sy = first.height / last.height;

    el.style.willChange = 'transform';
    el.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
    el.style.transformOrigin = 'top left';
    el.style.borderRadius = '18px';

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = 'transform 0.45s cubic-bezier(0.23, 1, 0.32, 1), border-radius 0.45s cubic-bezier(0.23, 1, 0.32, 1)';
        el.style.transform = 'translate(0, 0) scale(1, 1)';
        el.style.borderRadius = '0px';

        const cleanup = () => {
          el.style.willChange = '';
          el.style.transition = '';
          el.style.transformOrigin = '';
          el.removeEventListener('transitionend', cleanup);
          onDone?.();
        };
        el.addEventListener('transitionend', cleanup, { once: true });
      });
    });
  }, []);

  const playCollapse = useCallback((el: HTMLElement, targetRect: DOMRect, onDone?: () => void) => {
    const last = el.getBoundingClientRect();
    const dx = targetRect.left - last.left + (targetRect.width - last.width) / 2;
    const dy = targetRect.top - last.top + (targetRect.height - last.height) / 2;
    const sx = targetRect.width / last.width;
    const sy = targetRect.height / last.height;

    el.style.willChange = 'transform';
    el.style.transition = 'transform 0.35s cubic-bezier(0.445, 0.05, 0.55, 0.95), border-radius 0.35s cubic-bezier(0.445, 0.05, 0.55, 0.95)';
    el.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
    el.style.transformOrigin = 'top left';
    el.style.borderRadius = '18px';

    const cleanup = () => {
      el.style.willChange = '';
      el.style.transition = '';
      el.style.transform = '';
      el.style.transformOrigin = '';
      el.style.borderRadius = '';
      el.removeEventListener('transitionend', cleanup);
      onDone?.();
    };
    el.addEventListener('transitionend', cleanup, { once: true });
  }, []);

  return { captureFirst, playExpand, playCollapse };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useFlip.ts
git commit -m "feat: add useFlip hook for FLIP expand/collapse animations"
```

---

### Task 5: BackBar Component

**Files:**
- Create: `src/components/master/BackBar.tsx`

- [ ] **Step 1: Create the BackBar component**

```tsx
// src/components/master/BackBar.tsx
import { memo, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';

interface BackBarProps {
  title: string;
  onBack: () => void;
}

export const BackBar = memo(function BackBar({ title, onBack }: BackBarProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onBack]);

  return (
    <div
      style={{
        height: 36,
        display: 'flex',
        alignItems: 'center',
        padding: '0 14px',
        gap: 10,
        borderBottom: '1px solid rgba(0,230,118,0.08)',
        background: 'rgba(0,230,118,0.03)',
        flexShrink: 0,
      }}
    >
      <button
        onClick={onBack}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '4px 10px',
          borderRadius: 8,
          background: 'rgba(0,230,118,0.06)',
          border: '1px solid rgba(0,230,118,0.12)',
          color: 'rgba(0,230,118,0.55)',
          fontSize: 10,
          fontWeight: 700,
          cursor: 'pointer',
          outline: 'none',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,230,118,0.12)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,230,118,0.06)')}
      >
        <ArrowLeft style={{ width: 12, height: 12 }} />
        Dashboard
      </button>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(0,230,118,0.60)' }}>
        {title}
      </span>
    </div>
  );
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/master/BackBar.tsx
git commit -m "feat: add BackBar navigation component for master theme"
```

---

### Task 6: GlassBannerProfile Component

**Files:**
- Create: `src/components/master/GlassBannerProfile.tsx`

- [ ] **Step 1: Create the glass banner profile card**

```tsx
// src/components/master/GlassBannerProfile.tsx
import { memo, useState } from 'react';
import { Bell, Settings, ChevronDown } from 'lucide-react';
import { AvatarImage } from '../ui/AvatarImage';
import { useAuthStore } from '../../store/authStore';
import { useStatusStore, type Status } from '../../store/statusStore';
import { usePresenceStore } from '../../store/presenceStore';
import { useCallStore } from '../../store/callStore';

const ALL_STATUSES: Status[] = ['online', 'busy', 'away', 'offline'];
const STATUS_LABELS: Record<Status, string> = { online: 'Online', busy: 'Do Not Disturb', away: 'Away', offline: 'Invisible' };

export const GlassBannerProfile = memo(function GlassBannerProfile({
  onSettingsClick,
  onBellClick,
}: {
  onSettingsClick?: () => void;
  onBellClick?: () => void;
}) {
  const user = useAuthStore(s => s.user);
  const { status: myStatus, setStatus } = useStatusStore();
  const callStatus = useCallStore(s => s.status);
  const playingGame = usePresenceStore(s => s.playingGames.get(user?.id ?? '') ?? null);
  const [statusOpen, setStatusOpen] = useState(false);

  const avatarSize = 42;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '12px 16px',
      borderBottom: '1px solid rgba(0,230,118,0.08)',
      position: 'relative', overflow: 'hidden',
      background: 'linear-gradient(135deg, rgba(0,230,118,0.06), rgba(0,230,118,0.02))',
    }}>
      {/* Decorative orb */}
      <div style={{
        position: 'absolute', width: 120, height: 120, top: -40, right: 40,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,230,118,0.08) 0%, transparent 70%)',
        filter: 'blur(16px)',
        pointerEvents: 'none',
      }} />

      {/* Avatar — render at 2x for crisp display */}
      <div style={{ position: 'relative', zIndex: 1, flexShrink: 0 }}>
        <AvatarImage
          username={user?.username ?? '?'}
          avatarUrl={user?.avatar_url}
          size="lg"
          status={myStatus}
          isInCall={callStatus === 'connected'}
          playingGame={playingGame}
        />
      </div>

      <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.75)', letterSpacing: -0.2 }}>
          {user?.username}
          {callStatus === 'connected' && (
            <span style={{ marginLeft: 8, fontSize: 9, color: '#00e676', fontWeight: 600 }}>
              ● In call
            </span>
          )}
        </div>

        {/* Status row — clickable dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setStatusOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, marginTop: 2,
              background: 'none', border: 'none', cursor: 'pointer', padding: 0, outline: 'none',
            }}
          >
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: myStatus === 'online' ? '#00e676' : myStatus === 'busy' ? '#ff5032' : myStatus === 'away' ? '#ffa000' : 'rgba(255,255,255,0.22)',
              boxShadow: myStatus === 'online' ? '0 0 6px rgba(0,230,118,0.40)' : 'none',
              display: 'inline-block',
            }} />
            <span style={{ fontSize: 10, fontWeight: 500, color: 'rgba(0,230,118,0.50)' }}>
              {STATUS_LABELS[myStatus]}
            </span>
            <ChevronDown style={{
              width: 10, height: 10, color: 'rgba(0,230,118,0.30)',
              transform: statusOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s',
            }} />
          </button>

          {playingGame && (
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.20)', marginTop: 2 }}>
              Playing {playingGame}
            </div>
          )}

          {/* Status dropdown */}
          {statusOpen && (
            <div
              className="animate-fade-in"
              style={{
                position: 'absolute', top: '100%', left: 0, zIndex: 20,
                marginTop: 4, borderRadius: 10, overflow: 'hidden',
                background: 'rgba(8,20,12,0.95)',
                border: '1px solid rgba(0,230,118,0.15)',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                minWidth: 140,
              }}
            >
              {ALL_STATUSES.map(s => (
                <button
                  key={s}
                  onClick={() => { setStatus(s); setStatusOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', padding: '8px 12px',
                    background: s === myStatus ? 'rgba(0,230,118,0.08)' : 'transparent',
                    border: 'none', cursor: 'pointer', outline: 'none',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { if (s !== myStatus) e.currentTarget.style.background = 'rgba(0,230,118,0.05)'; }}
                  onMouseLeave={e => { if (s !== myStatus) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: s === 'online' ? '#00e676' : s === 'busy' ? '#ff5032' : s === 'away' ? '#ffa000' : 'rgba(255,255,255,0.22)',
                  }} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.55)' }}>
                    {STATUS_LABELS[s]}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 6, position: 'relative', zIndex: 1 }}>
        <button
          onClick={onBellClick}
          style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.10)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', outline: 'none', color: 'rgba(0,230,118,0.40)',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,230,118,0.12)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,230,118,0.05)')}
        >
          <Bell style={{ width: 13, height: 13 }} />
        </button>
        <button
          onClick={onSettingsClick}
          style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.10)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', outline: 'none', color: 'rgba(0,230,118,0.40)',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,230,118,0.12)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,230,118,0.05)')}
        >
          <Settings style={{ width: 13, height: 13 }} />
        </button>
      </div>
    </div>
  );
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/master/GlassBannerProfile.tsx
git commit -m "feat: add GlassBannerProfile component for master theme home"
```

---

### Task 7: CompactSidebar Component

**Files:**
- Create: `src/components/master/CompactSidebar.tsx`

- [ ] **Step 1: Create the compact sidebar friend list**

```tsx
// src/components/master/CompactSidebar.tsx
import { memo, useMemo, useState, useCallback } from 'react';
import { Search } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { AvatarImage } from '../ui/AvatarImage';
import { useFriendStore } from '../../store/friendStore';
import { usePresenceStore } from '../../store/presenceStore';
import { useUnreadStore } from '../../store/unreadStore';
import { useMessageStore } from '../../store/messageStore';
import type { Profile, Status } from '../../store/friendStore';

interface CompactSidebarProps {
  selectedUserId: string | null;
  onSelectUser: (user: Profile) => void;
}

export const CompactSidebar = memo(function CompactSidebar({ selectedUserId, onSelectUser }: CompactSidebarProps) {
  const friends = useFriendStore(useShallow(s => s.friends));
  const onlineIds = usePresenceStore(s => s.onlineIds);
  const presenceReady = usePresenceStore(s => s.presenceReady);
  const unreads = useUnreadStore(s => s.unreads);
  const clear = useUnreadStore(s => s.clear);
  const lastMessages = useMessageStore(s => s.lastMessages);
  const [query, setQuery] = useState('');

  const sortedFriends = useMemo(() => {
    const arr = [...friends];
    arr.sort((a, b) => {
      const aOnline = presenceReady ? onlineIds.has(a.id) : true;
      const bOnline = presenceReady ? onlineIds.has(b.id) : true;
      if (aOnline !== bOnline) return aOnline ? -1 : 1;
      const aUnread = unreads[a.id] ?? 0;
      const bUnread = unreads[b.id] ?? 0;
      if (aUnread !== bUnread) return bUnread - aUnread;
      return 0;
    });
    if (query) {
      const q = query.toLowerCase();
      return arr.filter(f => f.username.toLowerCase().includes(q));
    }
    return arr;
  }, [friends, onlineIds, presenceReady, unreads, query]);

  const handleSelect = useCallback((friend: Profile) => {
    onSelectUser(friend);
    if (unreads[friend.id]) clear(friend.id);
  }, [onSelectUser, unreads, clear]);

  return (
    <div style={{
      width: 200, flexShrink: 0,
      borderRight: '1px solid rgba(0,230,118,0.08)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Search */}
      <div style={{ padding: '8px 8px 4px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          height: 26, borderRadius: 8,
          background: 'rgba(0,230,118,0.04)',
          border: '1px solid rgba(0,230,118,0.10)',
          padding: '0 8px',
        }}>
          <Search style={{ width: 11, height: 11, color: 'rgba(0,230,118,0.25)', flexShrink: 0 }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search..."
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: 10, color: 'rgba(255,255,255,0.55)',
            }}
          />
        </div>
      </div>

      {/* Friend list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {sortedFriends.map(friend => {
          const isActive = friend.id === selectedUserId;
          const unread = unreads[friend.id] ?? 0;
          const isOnline = presenceReady ? onlineIds.has(friend.id) : true;
          const effective: Status = isOnline ? ((friend.status as Status) ?? 'online') : 'offline';
          const lastMsg = lastMessages?.[friend.id];

          return (
            <button
              key={friend.id}
              onClick={() => handleSelect(friend)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '7px 10px',
                background: isActive ? 'rgba(0,230,118,0.08)' : 'transparent',
                borderLeft: isActive ? '2px solid rgba(0,230,118,0.50)' : '2px solid transparent',
                border: 'none', cursor: 'pointer', outline: 'none',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(0,230,118,0.05)'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              <AvatarImage
                username={friend.username}
                avatarUrl={friend.avatar_url}
                size="xs"
                status={effective}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 10, fontWeight: 600,
                  color: isActive ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.50)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {friend.username}
                </div>
                {lastMsg && (
                  <div style={{
                    fontSize: 9, color: 'rgba(255,255,255,0.18)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    marginTop: 1,
                  }}>
                    {lastMsg}
                  </div>
                )}
              </div>
              {unread > 0 && (
                <span style={{
                  fontSize: 8, fontWeight: 700,
                  background: 'rgba(0,230,118,0.22)', color: '#00e676',
                  padding: '1px 5px', borderRadius: 6, flexShrink: 0,
                }}>
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/master/CompactSidebar.tsx
git commit -m "feat: add CompactSidebar for master theme home view"
```

---

### Task 8: TileGrid Component (Tile Previews + Parallax)

**Files:**
- Create: `src/components/master/TileGrid.tsx`

- [ ] **Step 1: Create the tile grid with parallax tiles**

This is the largest component. It renders the Metro Mosaic grid with 6 frosted bubble tiles, each showing live data previews. Each tile uses the `useParallax` hook.

```tsx
// src/components/master/TileGrid.tsx
import { memo, useRef, forwardRef, type ReactNode } from 'react';
import { Gamepad2, PenTool, CalendarDays, User, Globe, MessageSquare } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useParallax } from '../../hooks/useParallax';
import { useFriendStore } from '../../store/friendStore';
import { usePresenceStore } from '../../store/presenceStore';
import { useUnreadStore } from '../../store/unreadStore';
import { useServerStore } from '../../store/serverStore';
import { useAuthStore } from '../../store/authStore';
import { AvatarImage } from '../ui/AvatarImage';
import type { Profile, Status } from '../../store/friendStore';

export type TileId = 'home' | 'games' | 'writers' | 'calendar' | 'avatar' | 'servers';

interface TileGridProps {
  onTileClick: (id: TileId, el: HTMLElement) => void;
  tileRefs: React.MutableRefObject<Record<TileId, HTMLElement | null>>;
  visible: boolean;
}

/* ── Individual parallax tile wrapper ── */
const ParallaxTile = forwardRef<HTMLDivElement, {
  children: ReactNode;
  onClick: () => void;
  style?: React.CSSProperties;
}>(function ParallaxTile({ children, onClick, style }, fwdRef) {
  const localRef = useRef<HTMLDivElement>(null);
  const ref = (fwdRef ?? localRef) as React.RefObject<HTMLDivElement>;
  const { onMouseMove, onMouseEnter, onMouseLeave } = useParallax(ref, 12);

  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      onClick={onClick}
      onMouseMove={onMouseMove}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="tile-paused"
      style={{
        borderRadius: 18,
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
        background: 'linear-gradient(145deg, rgba(0,230,118,0.08), rgba(0,30,18,0.92))',
        border: '1px solid rgba(0,230,118,0.18)',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(0,230,118,0.08)',
        transition: 'box-shadow 0.3s ease',
        ...style,
      }}
      onMouseOver={e => {
        (e.currentTarget as HTMLElement).style.boxShadow =
          '0 12px 40px rgba(0,230,118,0.10), 0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(0,230,118,0.12)';
      }}
      onMouseOut={e => {
        (e.currentTarget as HTMLElement).style.boxShadow =
          '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(0,230,118,0.08)';
      }}
    >
      {/* Gloss highlight (convex bubble) */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '45%',
        background: 'linear-gradient(180deg, rgba(0,230,118,0.06) 0%, transparent 100%)',
        borderRadius: '18px 18px 0 0',
        pointerEvents: 'none', zIndex: 1,
      }} />
      {/* Inner glow */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 18,
        boxShadow: 'inset 0 0 40px rgba(0,230,118,0.04)',
        pointerEvents: 'none', zIndex: 1,
      }} />
      {/* Content */}
      <div style={{ position: 'relative', zIndex: 2, height: '100%' }}>
        {children}
      </div>
    </div>
  );
});

/* ── Tile label ── */
function TileLabel({ title, sub, icon: Icon }: { title: string; sub?: string; icon: React.ComponentType<{ style?: React.CSSProperties }> }) {
  return (
    <>
      <div style={{
        position: 'absolute', bottom: 12, left: 14, zIndex: 3,
        textShadow: '0 2px 8px rgba(0,0,0,0.8)',
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#00e676' }}>{title}</div>
        {sub && <div style={{ fontSize: 10, fontWeight: 400, color: 'rgba(0,230,118,0.40)', marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 3, opacity: 0.25 }}>
        <Icon style={{ width: 18, height: 18, color: '#00e676' }} />
      </div>
    </>
  );
}

/* ── Home tile preview ── */
const HomeTilePreview = memo(function HomeTilePreview() {
  const friends = useFriendStore(useShallow(s => s.friends));
  const onlineIds = usePresenceStore(s => s.onlineIds);
  const presenceReady = usePresenceStore(s => s.presenceReady);
  const unreads = useUnreadStore(s => s.unreads);
  const totalUnread = Object.values(unreads).reduce((a, b) => a + b, 0);

  const displayed = friends.slice(0, 7);

  return (
    <div style={{ paddingTop: 14, height: '100%', position: 'relative' }}>
      {displayed.map(f => {
        const isOnline = presenceReady ? onlineIds.has(f.id) : true;
        const effective: Status = isOnline ? ((f.status as Status) ?? 'online') : 'offline';
        const unread = unreads[f.id] ?? 0;
        return (
          <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 14px' }}>
            <AvatarImage username={f.username} avatarUrl={f.avatar_url} size="xs" status={effective} />
            <div style={{
              flex: 1, fontSize: 10, fontWeight: 600,
              color: 'rgba(255,255,255,0.50)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {f.username}
            </div>
            {unread > 0 && (
              <span style={{
                fontSize: 7, fontWeight: 700,
                background: 'rgba(0,230,118,0.22)', color: '#00e676',
                padding: '1px 5px', borderRadius: 6,
              }}>
                {unread}
              </span>
            )}
          </div>
        );
      })}
      <TileLabel title="Home" sub={totalUnread > 0 ? `${totalUnread} unread` : `${friends.length} friends`} icon={MessageSquare} />
    </div>
  );
});

/* ── Games tile preview ── */
const GamesTilePreview = memo(function GamesTilePreview() {
  const games = [
    { icon: '🎯', name: 'Bubble Pop' },
    { icon: '♟', name: 'Chess' },
    { icon: '🧩', name: '2048' },
  ];
  return (
    <div style={{ padding: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {games.map((g, i) => (
        <div key={i} style={{
          width: 34, height: 34, borderRadius: 10,
          background: `rgba(0,230,118,${0.10 - i * 0.02})`,
          border: `1px solid rgba(0,230,118,${0.15 - i * 0.03})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14,
        }}>
          {g.icon}
        </div>
      ))}
      <TileLabel title="Games" sub={`${games.length} available`} icon={Gamepad2} />
    </div>
  );
});

/* ── Writers tile preview ── */
const WritersTilePreview = memo(function WritersTilePreview() {
  return (
    <div style={{ padding: 14 }}>
      {[75, 90, 60, 82, 45].map((w, i) => (
        <div key={i} style={{
          height: 5, borderRadius: 3, marginBottom: 5,
          width: `${w}%`, background: 'rgba(0,230,118,0.10)',
        }} />
      ))}
      <TileLabel title="Writers" sub="2 drafts" icon={PenTool} />
    </div>
  );
});

/* ── Calendar tile preview ── */
const CalendarTilePreview = memo(function CalendarTilePreview() {
  const now = new Date();
  return (
    <div style={{ padding: 14, textAlign: 'center' }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(0,230,118,0.40)', letterSpacing: 1 }}>TODAY</div>
      <div style={{ fontSize: 36, fontWeight: 800, color: 'rgba(0,230,118,0.60)', lineHeight: 1.1 }}>
        {String(now.getDate()).padStart(2, '0')}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(0,230,118,0.35)' }}>
        {now.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
      </div>
      <TileLabel title="Calendar" sub="2 events" icon={CalendarDays} />
    </div>
  );
});

/* ── Avatar tile preview ── */
const AvatarTilePreview = memo(function AvatarTilePreview() {
  const user = useAuthStore(s => s.user);
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        background: 'rgba(0,230,118,0.10)',
        border: '2px solid rgba(0,230,118,0.25)',
        boxShadow: '0 0 16px rgba(0,230,118,0.10)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {user?.avatar_url ? (
          <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: 16, fontWeight: 700, color: 'rgba(0,230,118,0.50)' }}>
            {(user?.username ?? '?')[0].toUpperCase()}
          </span>
        )}
      </div>
      <TileLabel title="Avatar" sub="Customize" icon={User} />
    </div>
  );
});

/* ── Servers tile preview ── */
const ServersTilePreview = memo(function ServersTilePreview() {
  const servers = useServerStore(useShallow(s => s.servers));
  const serverUnreads = useServerStore(s => s.serverUnreads);
  const totalUnread = Object.values(serverUnreads).reduce((a, b) => a + b, 0);
  const displayed = servers.slice(0, 4);

  return (
    <div style={{ padding: '10px 14px', display: 'flex', gap: 12, alignItems: 'center', height: '100%' }}>
      {displayed.map(s => (
        <div key={s.id} style={{
          width: 34, height: 34, borderRadius: 10,
          background: 'rgba(0,230,118,0.08)',
          border: '1px solid rgba(0,230,118,0.14)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: 'rgba(0,230,118,0.45)',
        }}>
          {s.name.slice(0, 2).toUpperCase()}
        </div>
      ))}
      <div style={{ flex: 1 }} />
      {totalUnread > 0 && (
        <span style={{
          fontSize: 8, fontWeight: 700,
          background: 'rgba(0,230,118,0.22)', color: '#00e676',
          padding: '2px 6px', borderRadius: 8,
        }}>
          {totalUnread} new
        </span>
      )}
      <TileLabel title="Servers" sub={`${servers.length} servers`} icon={Globe} />
    </div>
  );
});

/* ── Main TileGrid ── */
export const TileGrid = memo(function TileGrid({ onTileClick, tileRefs, visible }: TileGridProps) {
  const setRef = (id: TileId) => (el: HTMLDivElement | null) => { tileRefs.current[id] = el; };

  return (
    <div style={{
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.2s ease',
      pointerEvents: visible ? 'auto' : 'none',
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      padding: '0 16px 16px',
      minHeight: 0,
    }}>
      {/* Main 3x2 grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2.2fr 1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        gap: 10,
        flex: 1,
        minHeight: 0,
      }}>
        <ParallaxTile ref={setRef('home')} onClick={() => onTileClick('home', tileRefs.current.home!)} style={{ gridRow: '1 / 3' }}>
          <HomeTilePreview />
        </ParallaxTile>
        <ParallaxTile ref={setRef('games')} onClick={() => onTileClick('games', tileRefs.current.games!)}>
          <GamesTilePreview />
        </ParallaxTile>
        <ParallaxTile ref={setRef('writers')} onClick={() => onTileClick('writers', tileRefs.current.writers!)}>
          <WritersTilePreview />
        </ParallaxTile>
        <ParallaxTile ref={setRef('calendar')} onClick={() => onTileClick('calendar', tileRefs.current.calendar!)}>
          <CalendarTilePreview />
        </ParallaxTile>
        <ParallaxTile ref={setRef('avatar')} onClick={() => onTileClick('avatar', tileRefs.current.avatar!)}>
          <AvatarTilePreview />
        </ParallaxTile>
      </div>

      {/* Servers wide bar */}
      <ParallaxTile ref={setRef('servers')} onClick={() => onTileClick('servers', tileRefs.current.servers!)} style={{ height: 62, flexShrink: 0 }}>
        <ServersTilePreview />
      </ParallaxTile>
    </div>
  );
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/master/TileGrid.tsx
git commit -m "feat: add TileGrid with parallax tiles and live previews"
```

---

### Task 9: FullscreenView Component

**Files:**
- Create: `src/components/master/FullscreenView.tsx`

- [ ] **Step 1: Create the fullscreen view wrapper**

```tsx
// src/components/master/FullscreenView.tsx
import { memo, useRef, useEffect, lazy, Suspense } from 'react';
import { BackBar } from './BackBar';
import { GlassBannerProfile } from './GlassBannerProfile';
import { CompactSidebar } from './CompactSidebar';
import { ChatWindow } from '../chat/ChatWindow';
import { CallView } from '../call/CallView';
import { GroupCallView } from '../call/GroupCallView';
import { GamesCorner } from '../corners/GamesCorner';
import { GameChatOverlay } from '../corners/GameChatOverlay';
import { ServerOverlay } from '../servers/ServerOverlay';
import { ServerView } from '../servers/ServerView';
import { FriendRequestModal } from '../chat/FriendRequestModal';
import { useFlip } from '../../hooks/useFlip';
import { useChatStore } from '../../store/chatStore';
import { useCallStore } from '../../store/callStore';
import { useGroupCallStore } from '../../store/groupCallStore';
import { useCornerStore } from '../../store/cornerStore';
import type { TileId } from './TileGrid';

const WritersCorner = lazy(() => import('../corners/WritersCorner').then(m => ({ default: m.WritersCorner })));
const CalendarCorner = lazy(() => import('../corners/CalendarCorner').then(m => ({ default: m.CalendarCorner })));
const AvatarCorner = lazy(() => import('../corners/AvatarCorner').then(m => ({ default: m.AvatarCorner })));

const TILE_LABELS: Record<TileId, string> = {
  home: 'Home',
  games: 'Games',
  writers: 'Writers',
  calendar: 'Calendar',
  avatar: 'Avatar',
  servers: 'Servers',
};

interface FullscreenViewProps {
  tileId: TileId;
  firstRect: DOMRect;
  onCollapse: () => void;
  targetTileRect: () => DOMRect | null;
}

export const FullscreenView = memo(function FullscreenView({
  tileId, firstRect, onCollapse, targetTileRect,
}: FullscreenViewProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const flip = useFlip();
  const { selectedContact, setSelectedContact } = useChatStore();
  const callStatus = useCallStore(s => s.status);
  const callActive = callStatus !== 'idle';
  const groupCallStatus = useGroupCallStore(s => s.status);
  const groupCallActive = groupCallStatus !== 'idle' && groupCallStatus !== 'ringing';

  // FLIP expand on mount
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    flip.captureFirst({ getBoundingClientRect: () => firstRect } as HTMLElement);
    flip.playExpand(el);
  }, []); // intentionally once on mount

  const handleCollapse = () => {
    const el = elRef.current;
    const target = targetTileRect();
    if (!el || !target) {
      onCollapse();
      return;
    }
    flip.playCollapse(el, target, onCollapse);
  };

  return (
    <div
      ref={elRef}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 50,
        background: '#050505',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <BackBar title={TILE_LABELS[tileId]} onBack={handleCollapse} />

      <div className="master-compact" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        {tileId === 'home' && <HomeFullscreen />}
        {tileId === 'games' && (
          <>
            <GamesCorner />
            <GameChatOverlay />
          </>
        )}
        {tileId === 'writers' && (
          <Suspense fallback={<LoadingFallback color="rgba(0,230,118,0.5)" text="Loading Writers Corner..." />}>
            <WritersCorner />
          </Suspense>
        )}
        {tileId === 'calendar' && (
          <Suspense fallback={<LoadingFallback color="rgba(0,230,118,0.5)" text="Loading Calendar..." />}>
            <CalendarCorner />
          </Suspense>
        )}
        {tileId === 'avatar' && (
          <Suspense fallback={<LoadingFallback color="rgba(0,230,118,0.5)" text="Loading Avatar Corner..." />}>
            <AvatarCorner />
          </Suspense>
        )}
        {tileId === 'servers' && <ServersFullscreen />}
      </div>
    </div>
  );
});

/* ── Home fullscreen content ── */
function HomeFullscreen() {
  const { selectedContact, setSelectedContact } = useChatStore();
  const callStatus = useCallStore(s => s.status);
  const callActive = callStatus !== 'idle';
  const groupCallStatus = useGroupCallStore(s => s.status);
  const groupCallActive = groupCallStatus !== 'idle' && groupCallStatus !== 'ringing';

  return (
    <>
      <GlassBannerProfile />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <CompactSidebar
          selectedUserId={selectedContact?.id ?? null}
          onSelectUser={setSelectedContact}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {callActive ? (
            <CallView />
          ) : groupCallActive ? (
            <GroupCallView />
          ) : selectedContact ? (
            <ChatWindow contact={selectedContact} />
          ) : (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(0,230,118,0.25)', fontSize: 12,
            }}>
              Select a conversation
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ── Servers fullscreen ── */
function ServersFullscreen() {
  const serverView = useCornerStore(s => s.serverView);
  return serverView === 'server' || serverView === 'bubble' ? <ServerView /> : <ServerOverlay />;
}

/* ── Loading fallback ── */
function LoadingFallback({ color, text }: { color: string; text: string }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color, fontSize: 13 }}>
      {text}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/master/FullscreenView.tsx
git commit -m "feat: add FullscreenView with FLIP animation and tile content"
```

---

### Task 10: MasterThemeDashboard (Main Component)

**Files:**
- Create: `src/components/master/MasterThemeDashboard.tsx`

- [ ] **Step 1: Create the main dashboard component**

```tsx
// src/components/master/MasterThemeDashboard.tsx
import { memo, useState, useCallback, useRef } from 'react';
import { Bell, LogOut } from 'lucide-react';
import { AeroLogo } from '../ui/AeroLogo';
import { ThemeSwitcher } from '../ui/ThemeSwitcher';
import { FriendRequestModal } from '../chat/FriendRequestModal';
import { PremiumModal } from '../ui/PremiumModal';
import { MiniCallWidget } from '../call/MiniCallWidget';
import { TileGrid, type TileId } from './TileGrid';
import { FullscreenView } from './FullscreenView';
import { useAuthStore } from '../../store/authStore';
import { useFriendStore } from '../../store/friendStore';
import { useCallStore } from '../../store/callStore';
import { useGroupCallStore } from '../../store/groupCallStore';
import { useCornerStore } from '../../store/cornerStore';

export const MasterThemeDashboard = memo(function MasterThemeDashboard() {
  const { user, signOut } = useAuthStore();
  const isPremium = user?.is_premium === true;
  const { pendingIncoming } = useFriendStore();
  const callStatus = useCallStore(s => s.status);
  const groupCallStatus = useGroupCallStore(s => s.status);
  const anyCallActive = callStatus !== 'idle' || (groupCallStatus !== 'idle' && groupCallStatus !== 'ringing');

  const [expandedTile, setExpandedTile] = useState<TileId | null>(null);
  const [flipRect, setFlipRect] = useState<DOMRect | null>(null);
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [premiumModalOpen, setPremiumModalOpen] = useState(false);

  const tileRefs = useRef<Record<TileId, HTMLElement | null>>({
    home: null, games: null, writers: null, calendar: null, avatar: null, servers: null,
  });

  // Open corner store state when expanding tiles that map to corners
  const { openGameHub, openWriterHub, openCalendarView, openAvatarView, openServerOverlay } = useCornerStore();

  const handleTileClick = useCallback((id: TileId, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    setFlipRect(rect);
    setExpandedTile(id);

    // Sync corner store so existing components work
    if (id === 'games') openGameHub();
    else if (id === 'writers') openWriterHub();
    else if (id === 'calendar') openCalendarView();
    else if (id === 'avatar') openAvatarView();
    else if (id === 'servers') openServerOverlay();
  }, [openGameHub, openWriterHub, openCalendarView, openAvatarView, openServerOverlay]);

  const { closeGameView, closeWriterView, closeCalendarView, closeAvatarView, closeServerOverlay } = useCornerStore();

  const handleCollapse = useCallback(() => {
    const tile = expandedTile;
    setExpandedTile(null);
    setFlipRect(null);

    // Reset corner store
    if (tile === 'games') closeGameView();
    else if (tile === 'writers') closeWriterView();
    else if (tile === 'calendar') closeCalendarView();
    else if (tile === 'avatar') closeAvatarView();
    else if (tile === 'servers') closeServerOverlay();
  }, [expandedTile, closeGameView, closeWriterView, closeCalendarView, closeAvatarView, closeServerOverlay]);

  const getTargetTileRect = useCallback(() => {
    if (!expandedTile) return null;
    return tileRefs.current[expandedTile]?.getBoundingClientRect() ?? null;
  }, [expandedTile]);

  const dashboardVisible = expandedTile === null;

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: '#050505',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* ── Header bar — only on dashboard ── */}
      <div style={{
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexShrink: 0,
        opacity: dashboardVisible ? 1 : 0,
        transition: 'opacity 0.2s ease',
        pointerEvents: dashboardVisible ? 'auto' : 'none',
      }}>
        <AeroLogo size={22} />
        <span style={{ fontWeight: 800, fontSize: 14, color: '#00e676', letterSpacing: -0.3 }}>
          AeroChat
        </span>
        <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(0,230,118,0.30)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
          Master
        </span>

        <div style={{ flex: 1 }} />

        {!isPremium && (
          <button
            onClick={() => setPremiumModalOpen(true)}
            className="rounded-full transition-all hover:scale-[1.03] active:scale-[0.97]"
            style={{
              padding: '5px 12px', fontSize: 11, fontWeight: 700,
              background: 'rgba(0,230,118,0.08)',
              border: '1px solid rgba(0,230,118,0.18)',
              color: '#00e676', cursor: 'pointer', outline: 'none',
            }}
          >
            Unlock Aero+
          </button>
        )}

        <button
          onClick={() => setRequestsOpen(true)}
          className="relative rounded-lg p-2 transition-all"
          style={{ color: 'rgba(0,230,118,0.40)', background: 'transparent', border: 'none', cursor: 'pointer', outline: 'none' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,230,118,0.06)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <Bell style={{ width: 16, height: 16 }} />
          {pendingIncoming.length > 0 && (
            <span style={{
              position: 'absolute', top: 2, right: 2,
              width: 14, height: 14, borderRadius: '50%',
              background: '#00e676', fontSize: 8, fontWeight: 700, color: '#050505',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {pendingIncoming.length}
            </span>
          )}
        </button>

        <button
          onClick={signOut}
          className="rounded-lg p-2 transition-all"
          style={{ color: 'rgba(0,230,118,0.40)', background: 'transparent', border: 'none', cursor: 'pointer', outline: 'none' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,230,118,0.06)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <LogOut style={{ width: 16, height: 16 }} />
        </button>

        <ThemeSwitcher />
      </div>

      {/* ── Tile Grid ── */}
      <TileGrid
        onTileClick={handleTileClick}
        tileRefs={tileRefs}
        visible={dashboardVisible}
      />

      {/* ── Fullscreen expanded tile ── */}
      {expandedTile && flipRect && (
        <FullscreenView
          key={expandedTile}
          tileId={expandedTile}
          firstRect={flipRect}
          onCollapse={handleCollapse}
          targetTileRect={getTargetTileRect}
        />
      )}

      {/* ── Mini call widget — always visible ── */}
      {anyCallActive && !expandedTile && <MiniCallWidget />}

      {/* ── Modals ── */}
      {requestsOpen && <FriendRequestModal onClose={() => setRequestsOpen(false)} />}
      <PremiumModal open={premiumModalOpen} onClose={() => setPremiumModalOpen(false)} />
    </div>
  );
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/master/MasterThemeDashboard.tsx
git commit -m "feat: add MasterThemeDashboard with tile grid, FLIP, and header"
```

---

### Task 11: ChatLayout Integration

**Files:**
- Modify: `src/components/chat/ChatLayout.tsx`

- [ ] **Step 1: Import master theme utilities at the top of ChatLayout**

Add after the existing `AmbientBackground` import:

```ts
import { isMasterTheme } from '../../store/themeStore';
```

Add a lazy import for the dashboard:

```ts
const MasterThemeDashboard = lazy(() => import('../master/MasterThemeDashboard').then(m => ({ default: m.MasterThemeDashboard })));
```

Note: `lazy` is already imported from React on line 2. `useThemeStore` and `isUltraTheme` are already imported on line 32.

- [ ] **Step 2: Add master theme early return before the desktop layout**

Find the comment `// ── Desktop layout ──` (around line 176). Insert BEFORE it:

```tsx
  // ── Master Theme — completely different layout ──
  if (isMasterTheme(activeTheme)) {
    return (
      <Suspense fallback={<div style={{ background: '#050505', height: '100vh' }} />}>
        <MasterThemeDashboard />
      </Suspense>
    );
  }
```

Note: `Suspense` is not currently imported. Add it to the React import on line 2:

Change:
```ts
import { lazy, Suspense, useRef, useState, useCallback, useEffect } from 'react';
```

This is already the case — `Suspense` is already imported on line 2. No change needed there.

- [ ] **Step 3: Update the premium fallback to include master themes**

The existing fallback (around line 72) checks `isUltraTheme`. Update it to also catch master:

Change:
```ts
if (!isPremium && isUltraTheme(activeTheme)) {
```
to:
```ts
if (!isPremium && (isUltraTheme(activeTheme) || isMasterTheme(activeTheme))) {
```

- [ ] **Step 4: Commit**

```bash
git add src/components/chat/ChatLayout.tsx
git commit -m "feat: integrate MasterThemeDashboard into ChatLayout"
```

---

### Task 12: ThemeSwitcher — Master Section

**Files:**
- Modify: `src/components/ui/ThemeSwitcher.tsx`

- [ ] **Step 1: Add master theme to imports**

Change line 4 from:
```ts
import { useThemeStore, PREMIUM_THEMES, ULTRA_THEMES, type Theme } from '../../store/themeStore';
```
to:
```ts
import { useThemeStore, PREMIUM_THEMES, ULTRA_THEMES, MASTER_THEMES, type Theme } from '../../store/themeStore';
```

- [ ] **Step 2: Add master theme metadata to THEME_META array**

Add after the `golden-hour` entry (after line 117, before the closing `];`):

```ts
  {
    id: 'master', label: 'Master', description: 'Emerald glass, parallax tile dashboard',
    icon: <Sparkles className="h-4 w-4" />,
    accent: '#00e676', accentSecondary: '#00c853', gradient: 'linear-gradient(135deg, #00e676, #00c853, #0a1a10)',
    bodySnippet: '#050505',
    sidebarBg: 'rgba(0,230,118,0.06)', chatBg: 'rgba(0,230,118,0.04)',
    textPrimary: 'rgba(255,255,255,0.70)', textSecondary: 'rgba(255,255,255,0.45)', textMuted: 'rgba(255,255,255,0.22)',
    panelBorder: 'rgba(0,230,118,0.18)', badgeBg: 'rgba(0,230,118,0.22)',
    inputBg: 'rgba(0,230,118,0.04)', recvBg: 'rgba(0,230,118,0.06)',
    hoverBg: 'rgba(0,230,118,0.06)',
  },
```

- [ ] **Step 3: Exclude master themes from the Free section filter**

Change line 520 from:
```ts
{THEME_META.filter(t => !PREMIUM_THEMES.includes(t.id) && !ULTRA_THEMES.includes(t.id)).map(meta => (
```
to:
```ts
{THEME_META.filter(t => !PREMIUM_THEMES.includes(t.id) && !ULTRA_THEMES.includes(t.id) && !MASTER_THEMES.includes(t.id)).map(meta => (
```

- [ ] **Step 4: Add the Master section after the Ultra section**

Find the end of the ultra themes `.map(...)` block (around line 590, after the closing `})}` of the ultra map). Add:

```tsx
                {/* Divider */}
                <div style={{ height: 1, background: 'var(--popup-divider)', margin: '8px 16px' }} />

                {/* Section: Master Theme */}
                <div style={{
                  padding: '4px 16px 6px', fontSize: 9, fontWeight: 700,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                  background: 'linear-gradient(90deg, #00e676, #00c853)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>
                  ✦ Master
                </div>
                {THEME_META.filter(t => MASTER_THEMES.includes(t.id)).map(meta => {
                  const isOwned = useThemeStore.getState().ownsMaster;
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
                        const ok = await useThemeStore.getState().purchaseTheme('master', userId);
                        if (ok) setSelected(meta.id);
                      }}
                    />
                  );
                })}
```

- [ ] **Step 5: Update the UltraThemeRow "Buy" button to show €5 for master**

In the `UltraThemeRow` component (around line 727), change the buy button text from static `Buy €2` to dynamic:

Change:
```tsx
        >
          Buy €2
        </button>
```
to:
```tsx
        >
          Buy {MASTER_THEMES.includes(meta.id) ? '€5' : '€2'}
        </button>
```

This requires `MASTER_THEMES` to be accessible inside `UltraThemeRow`. Since it's imported at the top of the file, it's already in scope.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/ThemeSwitcher.tsx
git commit -m "feat: add Master section to ThemeSwitcher with €5 pricing"
```

---

### Task 13: Build, Test, Deploy

**Files:** None (verification only)

- [ ] **Step 1: Run the build to check for type errors**

```bash
cd aero-chat-app && pnpm build
```

Expected: Build succeeds with no type errors.

- [ ] **Step 2: Fix any build errors**

If there are import errors or type mismatches, fix them. Common issues:
- Missing exports from stores (e.g., `lastMessages` may not exist on `messageStore` — check and adapt)
- `Profile` and `Status` types may need to be imported from different locations
- `AvatarImage` `size="xs"` may not exist — check valid sizes and use the smallest available

- [ ] **Step 3: Test locally**

```bash
cd aero-chat-app && pnpm dev
```

Open localhost:1420. In theme picker, the Master section should appear. If you have premium + own the theme, selecting it should show the parallax tile dashboard.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve build errors for master theme"
```

- [ ] **Step 5: Push and deploy**

```bash
cd aero-chat-app && git push origin main && vercel --prod --yes
```

---

### Task 14: Post-Deploy Verification

- [ ] **Step 1: Verify on production**

Open https://aero-chat-app.vercel.app. Switch to Master Theme. Verify:
1. Tile dashboard renders with 6 tiles in Metro Mosaic layout
2. Parallax tilt works on hover
3. Clicking a tile FLIP-expands to fullscreen
4. "← Dashboard" and Escape return to tile grid
5. Home tile shows Glass Banner Profile + Compact Split
6. Other tiles render their corners with compact styling
7. All text is readable (emerald on black contrast)
8. No console errors

- [ ] **Step 2: Verify theme switching**

Switch between Master and other themes. Verify:
1. Switching FROM master back to day/night restores normal layout
2. Switching TO master from any theme shows the dashboard
3. No layout artifacts or stuck states

- [ ] **Step 3: Verify premium gating**

If testing without premium, verify the Master Theme shows as locked with "Aero+ required" text.
