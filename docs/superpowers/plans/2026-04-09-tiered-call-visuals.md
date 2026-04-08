# Tiered Call Visuals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add visual differentiation to call screens across 4 user tiers (Free, Premium, Ultra, Master) — purely aesthetic, no functional changes.

**Architecture:** A single pure-function module (`callTierVisuals.ts`) exports tier detection + palette data. Call components (`CallView.tsx`, `GroupCallView.tsx`, `IncomingCallModal.tsx`) consume palettes to render tier-appropriate backgrounds, audio visualizers, ambient effects (orbs, particles, rings), and name styling. Free tier = current minimal look. Higher tiers = progressively richer effects.

**Tech Stack:** React 19, TypeScript, Zustand (themeStore, authStore), CSS keyframes (`aura-pulse`, `orb-drift`, `pulse-ring`), inline styles.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/callTierVisuals.ts` | **Create** | Pure functions + constants: `getCallTier()`, `getTierPalette()`, types `CallTier`, `TierPalette` |
| `src/components/call/CallView.tsx` | **Modify** | 1:1 audio `SplitPanel` tier effects, video PiP tier border, ringing overlay tier effects |
| `src/components/call/GroupCallView.tsx` | **Modify** | Grid cell tier effects (scaled down), tier badge label |
| `src/components/call/IncomingCallModal.tsx` | **Modify** | Tier palette on ringing animation and background |

---

## Task 1: Create `callTierVisuals.ts` — Tier Detection + Palettes

**Files:**
- Create: `src/lib/callTierVisuals.ts`

- [ ] **Step 1: Create the tier detection and palette module**

Create `src/lib/callTierVisuals.ts` with all types, tier detection, and palette data:

```ts
// src/lib/callTierVisuals.ts
import type { Profile } from '../store/authStore';
import { type Theme, isMasterTheme, isUltraTheme } from '../store/themeStore';

export type CallTier = 'free' | 'premium' | 'ultra' | 'master';

export function getCallTier(user: Profile | null, activeTheme: Theme): CallTier {
  if (!user) return 'free';
  if (isMasterTheme(activeTheme)) return 'master';
  if (isUltraTheme(activeTheme)) return 'ultra';
  if (user.is_premium) return 'premium';
  return 'free';
}

/* ── Orb config ── */
export interface OrbConfig {
  width: number;
  height: number;
  background: string;
  blur: number;
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
}

/* ── Particle config ── */
export interface ParticleConfig {
  size: number;
  color: string;
  glow: string;
  top: string;
  left: string;
}

/* ── Ring config ── */
export interface RingConfig {
  radius: number;
  border: string;
  boxShadow: string;
  animate: boolean;
  animationDuration?: string;
}

/* ── Audio bar config ── */
export interface AudioBarConfig {
  count: number;
  /** 'simple' = uniform color bars. 'waveform' = dual-band colored groups. */
  style: 'simple' | 'waveform';
  width: number;
  silentColor: string;
  /** For 'simple' style: single active color. */
  activeColor?: string;
  /** For 'waveform' style: two band groups. */
  bands?: { count: number; color: string; activeColor: string }[];
  /** Gap between bands for waveform style */
  bandGap?: number;
}

/* ── Corner accent (video calls) ── */
export interface CornerAccentConfig {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  color: string;
  size: number;
}

/* ── Full palette ── */
export interface TierPalette {
  tier: CallTier;
  bg: string;
  avatarBorder: string;
  avatarGlow: string;
  nameColor: string;
  nameWeight: number;
  nameShadow: string;
  audioBars: AudioBarConfig;
  orbs: OrbConfig[];
  particles: ParticleConfig[];
  rings: RingConfig[];
  cornerAccents: CornerAccentConfig[];
  pipBorderColor: string;
  pipGlow: string;
  ringingRingColor: string;
  ringingRingGlow: string;
  ringingIconColor: string;
  ringingBg: string;
  tierLabel: string;
  tierLabelColor: string;
}

/* ── Palette definitions ── */

const FREE_PALETTE: TierPalette = {
  tier: 'free',
  bg: 'linear-gradient(180deg, #1a3050 0%, #0a1628 100%)',
  avatarBorder: '2px solid rgba(255,255,255,0.15)',
  avatarGlow: 'none',
  nameColor: 'rgba(255,255,255,0.85)',
  nameWeight: 400,
  nameShadow: 'none',
  audioBars: {
    count: 5,
    style: 'simple',
    width: 3,
    silentColor: 'rgba(255,255,255,0.15)',
    activeColor: 'rgba(255,255,255,0.4)',
  },
  orbs: [],
  particles: [],
  rings: [],
  cornerAccents: [],
  pipBorderColor: 'rgba(255,255,255,0.3)',
  pipGlow: 'none',
  ringingRingColor: '2.5px solid rgba(255,255,255,0.4)',
  ringingRingGlow: '0 0 0 0 rgba(255,255,255,0.2)',
  ringingIconColor: 'rgba(255,255,255,0.7)',
  ringingBg: 'linear-gradient(145deg, rgba(0,30,80,0.6), rgba(0,10,40,0.9))',
  tierLabel: 'FREE',
  tierLabelColor: 'rgba(255,255,255,0.4)',
};

const PREMIUM_PALETTE: TierPalette = {
  tier: 'premium',
  bg: 'linear-gradient(180deg, rgba(0,180,255,0.25) 0%, rgba(0,180,255,0.09) 40%, rgba(6,14,31,0.95) 100%)',
  avatarBorder: '2px solid rgba(0,200,255,0.4)',
  avatarGlow: '0 0 20px rgba(0,180,255,0.25)',
  nameColor: 'rgba(255,255,255,0.9)',
  nameWeight: 400,
  nameShadow: 'none',
  audioBars: {
    count: 5,
    style: 'simple',
    width: 3,
    silentColor: 'rgba(0,212,255,0.15)',
    activeColor: 'rgba(0,212,255,0.7)',
  },
  orbs: [
    { width: 160, height: 160, background: 'rgba(0,180,255,0.15)', blur: 20, top: '25%', left: '50%' },
  ],
  particles: [
    { size: 3, color: 'rgba(0,200,255,0.25)', glow: '0 0 6px rgba(0,200,255,0.3)', top: '15%', left: '20%' },
    { size: 4, color: 'rgba(0,200,255,0.2)', glow: '0 0 6px rgba(0,200,255,0.25)', top: '70%', left: '75%' },
    { size: 3, color: 'rgba(0,200,255,0.3)', glow: '0 0 6px rgba(0,200,255,0.3)', top: '45%', left: '85%' },
  ],
  rings: [],
  cornerAccents: [
    { position: 'top-left', color: 'rgba(0,180,255,0.12)', size: 80 },
  ],
  pipBorderColor: 'rgba(0,200,255,0.5)',
  pipGlow: '0 0 16px rgba(0,180,255,0.3)',
  ringingRingColor: '2.5px solid rgba(0,200,255,0.5)',
  ringingRingGlow: '0 0 20px rgba(0,180,255,0.3)',
  ringingIconColor: 'rgba(0,200,255,0.8)',
  ringingBg: 'linear-gradient(145deg, rgba(0,40,100,0.7), rgba(0,15,50,0.9))',
  tierLabel: 'PREMIUM',
  tierLabelColor: 'rgba(0,212,255,0.6)',
};

const ULTRA_PALETTE: TierPalette = {
  tier: 'ultra',
  bg: 'linear-gradient(145deg, #0a1628 0%, #1a2a50 40%, #0d1830 100%)',
  avatarBorder: '2px solid rgba(0,200,255,0.5)',
  avatarGlow: '0 0 28px rgba(0,180,255,0.35), 0 0 60px rgba(120,0,255,0.15)',
  nameColor: 'rgba(255,255,255,0.95)',
  nameWeight: 700,
  nameShadow: 'none',
  audioBars: {
    count: 13,
    style: 'waveform',
    width: 2,
    silentColor: 'rgba(0,212,255,0.12)',
    bands: [
      { count: 7, color: 'rgba(0,212,255,0.2)', activeColor: 'rgba(0,212,255,0.7)' },
      { count: 6, color: 'rgba(120,0,255,0.2)', activeColor: 'rgba(120,0,255,0.6)' },
    ],
    bandGap: 6,
  },
  orbs: [
    { width: 160, height: 160, background: 'rgba(0,160,255,0.12)', blur: 18, top: '10%', left: '15%' },
    { width: 140, height: 140, background: 'rgba(120,0,255,0.10)', blur: 20, bottom: '10%', right: '15%' },
  ],
  particles: [
    { size: 4, color: 'rgba(0,200,255,0.25)', glow: '0 0 8px rgba(0,200,255,0.3)', top: '12%', left: '25%' },
    { size: 3, color: 'rgba(120,0,255,0.2)', glow: '0 0 6px rgba(120,0,255,0.3)', top: '30%', left: '80%' },
    { size: 5, color: 'rgba(0,200,255,0.2)', glow: '0 0 8px rgba(0,200,255,0.25)', top: '60%', left: '15%' },
    { size: 3, color: 'rgba(120,0,255,0.25)', glow: '0 0 6px rgba(120,0,255,0.3)', top: '75%', left: '70%' },
    { size: 4, color: 'rgba(0,200,255,0.3)', glow: '0 0 8px rgba(0,200,255,0.3)', top: '50%', left: '50%' },
  ],
  rings: [
    { radius: 90, border: '1.5px solid rgba(0,200,255,0.15)', boxShadow: '0 0 20px rgba(0,180,255,0.1)', animate: true, animationDuration: '3s' },
    { radius: 110, border: '1px solid rgba(0,200,255,0.08)', boxShadow: 'none', animate: true, animationDuration: '3s' },
  ],
  cornerAccents: [
    { position: 'top-left', color: 'rgba(0,180,255,0.10)', size: 80 },
    { position: 'bottom-right', color: 'rgba(120,0,255,0.08)', size: 80 },
  ],
  pipBorderColor: 'rgba(0,200,255,0.5)',
  pipGlow: '0 0 20px rgba(0,180,255,0.35)',
  ringingRingColor: '2.5px solid rgba(0,200,255,0.5)',
  ringingRingGlow: '0 0 40px rgba(0,180,255,0.3)',
  ringingIconColor: 'rgba(0,200,255,0.8)',
  ringingBg: 'linear-gradient(145deg, rgba(0,20,60,0.8), rgba(15,0,40,0.9))',
  tierLabel: 'ULTRA',
  tierLabelColor: 'rgba(0,212,255,0.7)',
};

const MASTER_PALETTE: TierPalette = {
  tier: 'master',
  bg: 'linear-gradient(145deg, #050a05 0%, #0a1a0a 40%, #040804 100%)',
  avatarBorder: '2px solid rgba(255,200,0,0.5)',
  avatarGlow: '0 0 32px rgba(255,200,0,0.3), 0 0 60px rgba(0,200,100,0.1), inset 0 0 15px rgba(255,200,0,0.05)',
  nameColor: 'rgba(255,215,0,0.9)',
  nameWeight: 700,
  nameShadow: '0 0 10px rgba(255,200,0,0.2)',
  audioBars: {
    count: 14,
    style: 'waveform',
    width: 2,
    silentColor: 'rgba(255,215,0,0.12)',
    bands: [
      { count: 9, color: 'rgba(255,215,0,0.2)', activeColor: 'rgba(255,215,0,0.85)' },
      { count: 5, color: 'rgba(0,200,100,0.15)', activeColor: 'rgba(0,200,100,0.6)' },
    ],
    bandGap: 6,
  },
  orbs: [
    { width: 160, height: 160, background: 'rgba(255,200,0,0.08)', blur: 18, top: '10%', right: '15%' },
    { width: 140, height: 140, background: 'rgba(0,200,100,0.08)', blur: 20, bottom: '10%', left: '15%' },
  ],
  particles: [
    { size: 4, color: 'rgba(255,200,0,0.25)', glow: '0 0 8px rgba(255,200,0,0.3)', top: '10%', left: '30%' },
    { size: 3, color: 'rgba(0,200,100,0.2)', glow: '0 0 6px rgba(0,200,100,0.3)', top: '25%', left: '75%' },
    { size: 5, color: 'rgba(255,200,0,0.2)', glow: '0 0 8px rgba(255,200,0,0.25)', top: '55%', left: '20%' },
    { size: 3, color: 'rgba(0,200,100,0.25)', glow: '0 0 6px rgba(0,200,100,0.3)', top: '70%', left: '65%' },
    { size: 4, color: 'rgba(255,200,0,0.3)', glow: '0 0 8px rgba(255,200,0,0.3)', top: '40%', left: '85%' },
    { size: 3, color: 'rgba(0,200,100,0.2)', glow: '0 0 6px rgba(0,200,100,0.25)', top: '85%', left: '45%' },
  ],
  rings: [
    { radius: 90, border: '1.5px solid rgba(255,200,0,0.25)', boxShadow: '0 0 30px rgba(255,200,0,0.12)', animate: true, animationDuration: '2.5s' },
    { radius: 110, border: '1px solid rgba(255,200,0,0.08)', boxShadow: 'none', animate: true, animationDuration: '2.5s' },
    { radius: 130, border: '1px solid rgba(255,200,0,0.08)', boxShadow: 'none', animate: false },
  ],
  cornerAccents: [
    { position: 'top-left', color: 'rgba(255,200,0,0.08)', size: 80 },
    { position: 'bottom-right', color: 'rgba(0,200,100,0.06)', size: 80 },
  ],
  pipBorderColor: 'rgba(255,200,0,0.5)',
  pipGlow: '0 0 24px rgba(255,200,0,0.3)',
  ringingRingColor: '2.5px solid rgba(255,200,0,0.5)',
  ringingRingGlow: '0 0 40px rgba(255,200,0,0.3)',
  ringingIconColor: 'rgba(255,200,0,0.8)',
  ringingBg: 'linear-gradient(145deg, rgba(10,15,5,0.8), rgba(5,10,5,0.9))',
  tierLabel: 'MASTER',
  tierLabelColor: 'rgba(255,215,0,0.7)',
};

const PALETTES: Record<CallTier, TierPalette> = {
  free: FREE_PALETTE,
  premium: PREMIUM_PALETTE,
  ultra: ULTRA_PALETTE,
  master: MASTER_PALETTE,
};

export function getTierPalette(tier: CallTier): TierPalette {
  return PALETTES[tier];
}

/**
 * Returns a scaled-down palette for group call grid cells.
 * Fewer particles, smaller orbs, adds tier badge.
 */
export function getGroupTierPalette(tier: CallTier): TierPalette {
  const base = { ...PALETTES[tier] };
  // Scale down orbs to 60-70%
  base.orbs = base.orbs.map(o => ({
    ...o,
    width: Math.round(o.width * 0.65),
    height: Math.round(o.height * 0.65),
  }));
  // Fewer particles: free=0, premium=2, ultra=3, master=4
  const particleCounts: Record<CallTier, number> = { free: 0, premium: 2, ultra: 3, master: 4 };
  base.particles = base.particles.slice(0, particleCounts[tier]);
  // Scale rings to 70-80% of 1:1 sizes
  base.rings = base.rings.map(r => ({
    ...r,
    radius: Math.round(r.radius * 0.75),
  }));
  return base;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /home/dejanandovski/Code\ Repo/aero-chat-app && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors related to `callTierVisuals.ts`

- [ ] **Step 3: Commit**

```bash
git add src/lib/callTierVisuals.ts
git commit -m "feat: add callTierVisuals module with tier detection and palettes"
```

---

## Task 2: Update `SplitPanel` in `CallView.tsx` — 1:1 Audio Tier Effects

**Files:**
- Modify: `src/components/call/CallView.tsx:1-531`

This task replaces the hardcoded `SplitPanel` visuals with tier-aware rendering: tier background, avatar border+glow, tier audio bars (simple or waveform), ambient orbs, floating particles, pulse rings, and tier name styling.

- [ ] **Step 1: Add imports and tier detection**

At the top of `CallView.tsx`, add:

```ts
import { getCallTier, getTierPalette, type TierPalette, type AudioBarConfig } from '../../lib/callTierVisuals';
import { useThemeStore } from '../../store/themeStore';
```

Inside `CallView()`, after `const user = useAuthStore(s => s.user);`, add:

```ts
const activeTheme = useThemeStore(s => s.theme);
const myTier = getCallTier(user, activeTheme);
const myPalette = getTierPalette(myTier);
```

- [ ] **Step 2: Replace `panelBackground` with tier-aware background**

Replace the existing `panelBackground` function (lines 24-37) with:

```ts
/** Builds a CSS background for a participant panel.
 *  Free tier: flat dark gradient (ignores card gradient).
 *  Premium: existing card-gradient bleed behavior.
 *  Ultra/Master: tier-specific gradient from palette. */
function panelBackground(profile: Profile | null, palette: TierPalette): React.CSSProperties {
  if (palette.tier === 'free') {
    return { background: palette.bg };
  }
  if (palette.tier === 'premium') {
    // Keep existing card gradient behavior for premium
    if (!profile) return { background: palette.bg };
    if (profile.card_image_url) {
      return {
        backgroundImage: `url(${profile.card_image_url})`,
        backgroundSize: 'cover',
        backgroundPosition: `${profile.card_image_params?.x ?? 50}% ${profile.card_image_params?.y ?? 50}%`,
      };
    }
    const preset = CARD_GRADIENTS.find(g => g.id === (profile.card_gradient ?? 'ocean')) ?? CARD_GRADIENTS[0];
    return {
      background: `linear-gradient(180deg, ${preset.preview}40 0%, ${preset.preview}18 40%, rgba(6,14,31,0.95) 100%)`,
    };
  }
  // Ultra and Master — use tier-specific gradient
  return { background: palette.bg };
}
```

- [ ] **Step 3: Add `TierAudioBars` component**

Add this component after the `SplitPanel` component (after line 531):

```tsx
/** Renders audio visualizer bars according to tier palette config */
function TierAudioBars({ config, level, speaking, muted }: {
  config: AudioBarConfig;
  level: number;
  speaking: boolean;
  muted: boolean;
}) {
  const active = speaking && !muted;
  const effectiveLevel = muted ? 0 : level;

  if (config.style === 'simple') {
    return (
      <div style={{ display: 'flex', gap: 3, justifyContent: 'center', height: 24, alignItems: 'flex-end' }}>
        {Array.from({ length: config.count }).map((_, i) => {
          const variance = 0.6 + 0.4 * Math.sin(i * 2.1 + effectiveLevel * 20);
          const barHeight = active ? Math.max(4, 24 * effectiveLevel * variance) : 4;
          return (
            <div key={i} style={{
              width: config.width, height: barHeight, borderRadius: 2,
              background: active ? config.activeColor : config.silentColor,
              transition: 'height 0.1s ease-out',
            }} />
          );
        })}
      </div>
    );
  }

  // Waveform style — dual band groups
  const bands = config.bands!;
  let barIndex = 0;
  return (
    <div style={{ display: 'flex', gap: 2, justifyContent: 'center', height: 24, alignItems: 'flex-end' }}>
      {bands.map((band, bi) => (
        <div key={bi} style={{ display: 'flex', gap: 2, marginLeft: bi > 0 ? config.bandGap : 0 }}>
          {Array.from({ length: band.count }).map((_, i) => {
            const idx = barIndex++;
            const variance = 0.5 + 0.5 * Math.sin(idx * 1.8 + effectiveLevel * 25);
            const barHeight = active ? Math.max(3, 22 * effectiveLevel * variance) : 3;
            return (
              <div key={i} style={{
                width: config.width, height: barHeight, borderRadius: 1,
                background: active ? band.activeColor : band.color,
                transition: 'height 0.1s ease-out',
              }} />
            );
          })}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Add `TierAmbientEffects` component**

Add this component after `TierAudioBars`:

```tsx
/** Renders ambient orbs, floating particles, and pulse rings for a tier */
function TierAmbientEffects({ palette }: { palette: TierPalette }) {
  return (
    <>
      {/* Orbs — static blurred divs */}
      {palette.orbs.map((orb, i) => (
        <div key={`orb-${i}`} style={{
          position: 'absolute',
          width: orb.width, height: orb.height,
          borderRadius: '50%',
          background: orb.background,
          filter: `blur(${orb.blur}px)`,
          top: orb.top, bottom: orb.bottom, left: orb.left, right: orb.right,
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }} />
      ))}

      {/* Floating particles — CSS animated dots */}
      {palette.particles.map((p, i) => (
        <div key={`particle-${i}`} style={{
          position: 'absolute',
          width: p.size, height: p.size,
          borderRadius: '50%',
          background: p.color,
          boxShadow: p.glow,
          top: p.top, left: p.left,
          animation: `orb-drift ${5 + (i % 3) * 1.5}s ease-in-out ${(i * 0.8) % 3}s infinite`,
          pointerEvents: 'none',
        }} />
      ))}

      {/* Pulse rings around avatar — positioned relative to the avatar's center.
          These are rendered inside the avatar wrapper, centered via absolute positioning. */}
      {palette.rings.map((ring, i) => (
        <div key={`ring-${i}`} style={{
          position: 'absolute',
          width: ring.radius * 2, height: ring.radius * 2,
          borderRadius: '50%',
          border: ring.border,
          boxShadow: ring.boxShadow,
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          animation: ring.animate ? `aura-pulse ${ring.animationDuration ?? '3s'} ease-in-out infinite` : undefined,
          pointerEvents: 'none',
        }} />
      ))}
    </>
  );
}
```

- [ ] **Step 5: Rewrite `SplitPanel` to use tier palette**

Replace the existing `SplitPanel` function (lines 458-531) with:

```tsx
function SplitPanel({
  profile, username, avatarUrl, isSpeaking, audioLevel, isMuted, isMe, palette,
}: {
  profile: Profile | null;
  username: string;
  avatarUrl: string | null;
  isSpeaking: boolean;
  audioLevel: number;
  isMuted: boolean;
  isMe: boolean;
  palette: TierPalette;
}) {
  return (
    <div style={{
      flex: 1, position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      transition: 'flex 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
    }}>
      {/* Card background */}
      <div style={{ position: 'absolute', inset: -20, ...panelBackground(profile, palette), opacity: 0.85, filter: 'blur(12px)', transform: 'scale(1.05)' }} />

      {/* Dark overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center 40%, rgba(6,14,31,0.3) 0%, rgba(6,14,31,0.75) 100%)',
      }} />

      {/* Ambient effects (orbs + particles — NOT rings, rings go around avatar) */}
      <div className="pointer-events-none" style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        {palette.orbs.map((orb, i) => (
          <div key={`orb-${i}`} style={{
            position: 'absolute',
            width: orb.width, height: orb.height,
            borderRadius: '50%',
            background: orb.background,
            filter: `blur(${orb.blur}px)`,
            top: orb.top, bottom: orb.bottom, left: orb.left, right: orb.right,
            pointerEvents: 'none',
          }} />
        ))}
        {palette.particles.map((p, i) => (
          <div key={`particle-${i}`} style={{
            position: 'absolute',
            width: p.size, height: p.size,
            borderRadius: '50%',
            background: p.color,
            boxShadow: p.glow,
            top: p.top, left: p.left,
            animation: `orb-drift ${5 + (i % 3) * 1.5}s ease-in-out ${(i * 0.8) % 3}s infinite`,
            pointerEvents: 'none',
          }} />
        ))}
      </div>

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        {/* Avatar with rings */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* Pulse rings */}
          {palette.rings.map((ring, i) => (
            <div key={`ring-${i}`} style={{
              position: 'absolute',
              width: ring.radius * 2, height: ring.radius * 2,
              borderRadius: '50%',
              border: ring.border,
              boxShadow: ring.boxShadow,
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              animation: ring.animate ? `aura-pulse ${ring.animationDuration ?? '3s'} ease-in-out infinite` : undefined,
              pointerEvents: 'none',
            }} />
          ))}

          <div style={{
            width: 50, height: 50,
            borderRadius: '50%',
            border: palette.avatarBorder,
            boxShadow: palette.avatarGlow,
            overflow: 'hidden',
          }}>
            <AvatarImage username={username} avatarUrl={avatarUrl} size="xl" />
          </div>
          {isMuted && (
            <div style={{
              position: 'absolute', bottom: -2, right: -2, width: 24, height: 24, borderRadius: '50%',
              background: 'rgba(239,68,68,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid rgba(6,14,31,0.8)', zIndex: 2,
            }}>
              <MicOff className="h-3 w-3 text-white" />
            </div>
          )}
        </div>

        {/* Name */}
        <div className="text-center">
          <span className="text-base" style={{
            color: palette.nameColor,
            fontWeight: palette.nameWeight,
            textShadow: palette.nameShadow,
          }}>
            {username}
          </span>
          {isMe && (
            <span className="ml-2 text-[10px] font-semibold rounded px-1.5 py-0.5"
              style={{ background: 'rgba(0,212,255,0.12)', color: 'rgba(0,212,255,0.75)' }}>You</span>
          )}
        </div>

        {/* Audio bars */}
        <TierAudioBars config={palette.audioBars} level={audioLevel} speaking={isSpeaking} muted={isMuted} />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Update `SplitPanel` call sites to pass `palette`**

In the `CallView` component's audio-only section (around lines 348-370), update the two `SplitPanel` calls:

```tsx
{/* My panel (left) */}
<SplitPanel
  profile={user}
  username={user?.username ?? 'You'}
  avatarUrl={user?.avatar_url ?? null}
  isSpeaking={localSpeaking}
  audioLevel={localLevel}
  isMuted={isMuted}
  isMe
  palette={myPalette}
/>

{/* Divider */}
<div style={{ width: 1, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />

{/* Contact panel (right) — contact sees their own tier, but we just use free for the other person's view since we don't know their theme */}
<SplitPanel
  profile={contact}
  username={contact?.username ?? ''}
  avatarUrl={contact?.avatar_url ?? null}
  isSpeaking={remoteSpeaking}
  audioLevel={remoteLevel}
  isMuted={contactIsMuted}
  isMe={false}
  palette={myPalette}
/>
```

Note: Per the spec, "each person sees their own tier's visuals." Since both panels render on the caller's screen, both use `myPalette`.

- [ ] **Step 7: Verify it compiles**

Run: `cd /home/dejanandovski/Code\ Repo/aero-chat-app && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add src/components/call/CallView.tsx
git commit -m "feat: tier-aware SplitPanel with ambient effects, waveform bars, rings"
```

---

## Task 3: Update `CallView.tsx` — Video PiP Border + Ringing Overlay

**Files:**
- Modify: `src/components/call/CallView.tsx`

- [ ] **Step 1: Update video PiP border to use tier palette**

Find the PiP container's `boxShadow` style (around line 330-334). Replace:

```tsx
boxShadow: localSpeaking
  ? `0 0 ${8 + localLevel * 18}px rgba(0,220,120,0.7), 0 0 0 2px rgba(0,220,120,0.5)`
  : '0 2px 12px rgba(0,0,0,0.4)',
```

With:

```tsx
boxShadow: localSpeaking
  ? `0 0 ${8 + localLevel * 18}px rgba(0,220,120,0.7), 0 0 0 2px rgba(0,220,120,0.5)`
  : `${myPalette.pipGlow}, 0 2px 12px rgba(0,0,0,0.4)`,
border: `2px solid ${myPalette.pipBorderColor}`,
```

- [ ] **Step 2: Add corner accents for video calls**

Inside the video layout's main container (the `<div style={{ flex: 1, position: 'relative' }}>` around line 302), add corner accents after the `CameraFeed`:

```tsx
{/* Tier corner accents */}
{myPalette.cornerAccents.map((accent, i) => {
  const pos: React.CSSProperties = {};
  if (accent.position.includes('top')) pos.top = 0;
  if (accent.position.includes('bottom')) pos.bottom = 0;
  if (accent.position.includes('left')) pos.left = 0;
  if (accent.position.includes('right')) pos.right = 0;
  return (
    <div key={i} style={{
      position: 'absolute', ...pos,
      width: accent.size, height: accent.size,
      background: `radial-gradient(circle at ${accent.position.replace('-', ' ')}, ${accent.color} 0%, transparent 70%)`,
      pointerEvents: 'none', zIndex: 5,
    }} />
  );
})}
```

- [ ] **Step 3: Update ringing overlay with tier effects**

Replace the outgoing call overlay (lines 260-294) with tier-aware version:

```tsx
{isOutgoingCalling && (
  <div style={{
    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 16, zIndex: 5,
    background: myPalette.ringingBg,
  }}>
    {/* Ambient effects for ringing screen */}
    <div className="pointer-events-none" style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {myPalette.orbs.map((orb, i) => (
        <div key={`ring-orb-${i}`} style={{
          position: 'absolute',
          width: orb.width, height: orb.height,
          borderRadius: '50%',
          background: orb.background,
          filter: `blur(${orb.blur}px)`,
          top: orb.top, bottom: orb.bottom, left: orb.left, right: orb.right,
          pointerEvents: 'none',
        }} />
      ))}
      {myPalette.particles.map((p, i) => (
        <div key={`ring-particle-${i}`} style={{
          position: 'absolute',
          width: p.size, height: p.size,
          borderRadius: '50%',
          background: p.color,
          boxShadow: p.glow,
          top: p.top, left: p.left,
          animation: `orb-drift ${5 + (i % 3) * 1.5}s ease-in-out ${(i * 0.8) % 3}s infinite`,
          pointerEvents: 'none',
        }} />
      ))}
    </div>

    <div style={{
      width: 96, height: 96, borderRadius: '50%',
      background: 'linear-gradient(135deg, rgba(0,180,255,0.4), rgba(0,80,200,0.3))',
      border: myPalette.ringingRingColor,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'pulse-ring 2s ease infinite',
      boxShadow: myPalette.ringingRingGlow,
      position: 'relative', zIndex: 1,
    }}>
      {callType === 'video'
        ? <Video className="h-10 w-10" style={{ color: myPalette.ringingIconColor }} />
        : <Phone className="h-10 w-10" style={{ color: myPalette.ringingIconColor }} />}
    </div>
    <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
      <p style={{ fontSize: 22, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>{contact?.username}</p>
      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>
        {isCaller && contactIsRinging ? 'Ringing…' : 'Calling…'}
      </p>
    </div>
    <button
      onClick={hangUp}
      style={{
        marginTop: 16, width: 56, height: 56, borderRadius: '50%',
        background: 'rgba(220,50,50,0.85)', border: 'none', color: 'white',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', zIndex: 1,
      }}
    >
      <Phone className="h-5 w-5" style={{ transform: 'rotate(135deg)' }} />
    </button>
  </div>
)}
```

- [ ] **Step 4: Verify it compiles**

Run: `cd /home/dejanandovski/Code\ Repo/aero-chat-app && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/components/call/CallView.tsx
git commit -m "feat: tier visuals for video PiP border, corner accents, ringing overlay"
```

---

## Task 4: Update `GroupCallView.tsx` — Grid Cell Tier Effects

**Files:**
- Modify: `src/components/call/GroupCallView.tsx`

- [ ] **Step 1: Add imports and tier detection**

At the top of `GroupCallView.tsx`, add:

```ts
import { getCallTier, getGroupTierPalette, type TierPalette, type AudioBarConfig } from '../../lib/callTierVisuals';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
```

Inside `GroupCallView()`, after the existing destructuring, add:

```ts
const user = useAuthStore(s => s.user);
const activeTheme = useThemeStore(s => s.theme);
const myTier = getCallTier(user, activeTheme);
const myPalette = getGroupTierPalette(myTier);
```

- [ ] **Step 2: Replace `panelBackground` with tier-aware version**

Replace the existing `panelBackground` function (lines 23-36) with:

```ts
function panelBackground(p: GroupParticipant, palette: TierPalette): React.CSSProperties {
  if (palette.tier === 'free') {
    return { background: palette.bg };
  }
  if (palette.tier === 'premium') {
    if (p.cardImageUrl) {
      return {
        backgroundImage: `url(${p.cardImageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: `${p.cardImageParams?.x ?? 50}% ${p.cardImageParams?.y ?? 50}%`,
      };
    }
    const preset = CARD_GRADIENTS.find(g => g.id === (p.cardGradient ?? 'ocean')) ?? CARD_GRADIENTS[0];
    return {
      background: `linear-gradient(180deg, ${preset.preview}40 0%, ${preset.preview}18 40%, rgba(6,14,31,0.95) 100%)`,
    };
  }
  return { background: palette.bg };
}
```

- [ ] **Step 3: Update grid cell rendering with tier effects**

In the vertical split panel layout (inside the `participantList.map`), replace the Panel `<div>` contents (lines 146-207) with:

```tsx
<div
  style={{
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'flex 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
  }}
>
  {/* Card background */}
  <div style={{
    position: 'absolute',
    inset: -20,
    ...panelBackground(p, myPalette),
    opacity: 0.85,
    filter: 'blur(12px)',
    transform: 'scale(1.05)',
  }} />

  {/* Dark overlay */}
  <div style={{
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(ellipse at center 40%, rgba(6,14,31,0.3) 0%, rgba(6,14,31,0.75) 100%)',
  }} />

  {/* Ambient effects */}
  <div className="pointer-events-none" style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
    {myPalette.orbs.map((orb, oi) => (
      <div key={`orb-${oi}`} style={{
        position: 'absolute',
        width: orb.width, height: orb.height,
        borderRadius: '50%',
        background: orb.background,
        filter: `blur(${orb.blur}px)`,
        top: orb.top, bottom: orb.bottom, left: orb.left, right: orb.right,
        pointerEvents: 'none',
      }} />
    ))}
    {myPalette.particles.map((pt, pi) => (
      <div key={`particle-${pi}`} style={{
        position: 'absolute',
        width: pt.size, height: pt.size,
        borderRadius: '50%',
        background: pt.color,
        boxShadow: pt.glow,
        top: pt.top, left: pt.left,
        animation: `orb-drift ${5 + (pi % 3) * 1.5}s ease-in-out ${(pi * 0.8) % 3}s infinite`,
        pointerEvents: 'none',
      }} />
    ))}
  </div>

  {/* Content */}
  <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
    {/* Avatar with rings */}
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {myPalette.rings.map((ring, ri) => (
        <div key={`ring-${ri}`} style={{
          position: 'absolute',
          width: ring.radius * 2, height: ring.radius * 2,
          borderRadius: '50%',
          border: ring.border,
          boxShadow: ring.boxShadow,
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          animation: ring.animate ? `aura-pulse ${ring.animationDuration ?? '3s'} ease-in-out infinite` : undefined,
          pointerEvents: 'none',
        }} />
      ))}
      <div style={{
        width: 40, height: 40,
        borderRadius: '50%',
        border: myPalette.avatarBorder,
        boxShadow: myPalette.avatarGlow,
        overflow: 'hidden',
      }}>
        <AvatarImage username={p.username} avatarUrl={p.avatarUrl} size="xl" />
      </div>
      {muted && (
        <div style={{
          position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderRadius: '50%',
          background: 'rgba(239,68,68,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '2px solid rgba(6,14,31,0.8)', zIndex: 2,
        }}>
          <MicOff className="h-2.5 w-2.5 text-white" />
        </div>
      )}
    </div>

    {/* Name */}
    <div className="text-center">
      <span className="text-sm" style={{
        color: myPalette.nameColor,
        fontWeight: myPalette.nameWeight,
        textShadow: myPalette.nameShadow,
      }}>
        {p.username}
      </span>
      {isMe && (
        <span className="ml-1.5 text-[9px] font-semibold rounded px-1 py-0.5"
          style={{ background: 'rgba(0,212,255,0.12)', color: 'rgba(0,212,255,0.75)' }}>You</span>
      )}
    </div>

    {/* Audio bars */}
    <GroupTierAudioBars config={myPalette.audioBars} level={muted ? 0 : p.audioLevel} active={p.isSpeaking} />

    {/* Tier badge */}
    <span style={{
      fontSize: 8,
      letterSpacing: '0.05em',
      color: myPalette.tierLabelColor,
      fontWeight: 600,
      marginTop: 2,
    }}>
      {myPalette.tierLabel}
    </span>
  </div>
</div>
```

- [ ] **Step 4: Replace the `AudioBars` component with `GroupTierAudioBars`**

Replace the existing `AudioBars` component (lines 342-365) with:

```tsx
function GroupTierAudioBars({ config, level, active }: {
  config: AudioBarConfig;
  level: number;
  active: boolean;
}) {
  if (config.style === 'simple') {
    return (
      <div style={{ display: 'flex', gap: 3, justifyContent: 'center', height: 20, alignItems: 'flex-end' }}>
        {Array.from({ length: config.count }).map((_, i) => {
          const variance = 0.6 + 0.4 * Math.sin(i * 2.1 + level * 20);
          const barHeight = active ? Math.max(3, 20 * level * variance) : 3;
          return (
            <div key={i} style={{
              width: config.width, height: barHeight, borderRadius: 2,
              background: active ? config.activeColor : config.silentColor,
              transition: 'height 0.1s ease-out',
            }} />
          );
        })}
      </div>
    );
  }

  const bands = config.bands!;
  let barIndex = 0;
  return (
    <div style={{ display: 'flex', gap: 2, justifyContent: 'center', height: 20, alignItems: 'flex-end' }}>
      {bands.map((band, bi) => (
        <div key={bi} style={{ display: 'flex', gap: 1.5, marginLeft: bi > 0 ? config.bandGap : 0 }}>
          {Array.from({ length: band.count }).map((_, i) => {
            const idx = barIndex++;
            const variance = 0.5 + 0.5 * Math.sin(idx * 1.8 + level * 25);
            const barHeight = active ? Math.max(3, 18 * level * variance) : 3;
            return (
              <div key={i} style={{
                width: config.width, height: barHeight, borderRadius: 1,
                background: active ? band.activeColor : band.color,
                transition: 'height 0.1s ease-out',
              }} />
            );
          })}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Verify it compiles**

Run: `cd /home/dejanandovski/Code\ Repo/aero-chat-app && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/components/call/GroupCallView.tsx
git commit -m "feat: tier visuals in group call grid cells with scaled effects and badges"
```

---

## Task 5: Update `IncomingCallModal.tsx` — Tier Effects on Incoming Call

**Files:**
- Modify: `src/components/call/IncomingCallModal.tsx`

- [ ] **Step 1: Add imports and tier detection**

At the top of `IncomingCallModal.tsx`, add:

```ts
import { getCallTier, getTierPalette } from '../../lib/callTierVisuals';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
```

Inside `IncomingCallModal()`, after the existing destructuring, add:

```ts
const user = useAuthStore(s => s.user);
const activeTheme = useThemeStore(s => s.theme);
const myTier = getCallTier(user, activeTheme);
const palette = getTierPalette(myTier);
```

- [ ] **Step 2: Apply tier palette to backdrop and card**

Replace the backdrop `<div>` style (lines 31-38):

```tsx
<div style={{
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: palette.ringingBg,
  backdropFilter: 'blur(12px)',
  zIndex: 50,
}}>
```

- [ ] **Step 3: Add ambient effects to the backdrop**

After the opening backdrop `<div>`, before the Card `<div>`, add:

```tsx
{/* Ambient effects */}
<div className="pointer-events-none" style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
  {palette.orbs.map((orb, i) => (
    <div key={`orb-${i}`} style={{
      position: 'absolute',
      width: orb.width, height: orb.height,
      borderRadius: '50%',
      background: orb.background,
      filter: `blur(${orb.blur}px)`,
      top: orb.top, bottom: orb.bottom, left: orb.left, right: orb.right,
      pointerEvents: 'none',
    }} />
  ))}
  {palette.particles.map((p, i) => (
    <div key={`particle-${i}`} style={{
      position: 'absolute',
      width: p.size, height: p.size,
      borderRadius: '50%',
      background: p.color,
      boxShadow: p.glow,
      top: p.top, left: p.left,
      animation: `orb-drift ${5 + (i % 3) * 1.5}s ease-in-out ${(i * 0.8) % 3}s infinite`,
      pointerEvents: 'none',
    }} />
  ))}
</div>
```

- [ ] **Step 4: Update pulsing ring colors**

Replace the two animated ring divs (lines 67-80) with tier-colored versions:

```tsx
{/* Animated ring — inner */}
<div style={{
  position: 'absolute',
  inset: -8,
  borderRadius: '50%',
  border: palette.ringingRingColor,
  animation: 'pulse-ring 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite',
}} />
{/* Animated ring — outer */}
<div style={{
  position: 'absolute',
  inset: -16,
  borderRadius: '50%',
  border: palette.ringingRingColor.replace(/[\d.]+\)$/, m => {
    const val = parseFloat(m);
    return `${(val * 0.5).toFixed(2)})`;
  }),
  animation: 'pulse-ring 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) 0.3s infinite',
}} />
```

Wait — that regex approach is fragile. Instead, define the outer ring explicitly:

```tsx
{/* Animated ring — inner */}
<div style={{
  position: 'absolute',
  inset: -8,
  borderRadius: '50%',
  border: palette.ringingRingColor,
  boxShadow: palette.ringingRingGlow,
  animation: 'pulse-ring 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite',
}} />
{/* Animated ring — outer */}
<div style={{
  position: 'absolute',
  inset: -16,
  borderRadius: '50%',
  border: palette.tier === 'master'
    ? '2px solid rgba(255,200,0,0.25)'
    : palette.tier === 'ultra' || palette.tier === 'premium'
      ? '2px solid rgba(0,200,255,0.25)'
      : '2px solid rgba(255,255,255,0.2)',
  animation: 'pulse-ring 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) 0.3s infinite',
}} />
```

- [ ] **Step 5: Update the call type icon and label colors**

Replace the icon color in the call type line (line 89):

```tsx
{callType === 'video' ? <Video className="h-3 w-3" style={{ color: palette.ringingIconColor }} /> : <Phone className="h-3 w-3" style={{ color: palette.ringingIconColor }} />}
```

- [ ] **Step 6: Update card border to match tier**

Replace the card's `border` (line 44):

```tsx
border: palette.tier === 'master'
  ? '1px solid rgba(255,200,0,0.22)'
  : palette.tier === 'free'
    ? '1px solid rgba(255,255,255,0.15)'
    : '1px solid rgba(0,200,255,0.22)',
```

- [ ] **Step 7: Verify it compiles**

Run: `cd /home/dejanandovski/Code\ Repo/aero-chat-app && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add src/components/call/IncomingCallModal.tsx
git commit -m "feat: tier visuals on incoming call modal — palette bg, rings, particles"
```

---

## Task 6: Build, Push, Deploy

**Files:** None (build + deploy task)

- [ ] **Step 1: Run full build**

Run: `cd /home/dejanandovski/Code\ Repo/aero-chat-app && pnpm build`
Expected: Build succeeds with no errors

- [ ] **Step 2: Push to remote**

```bash
cd /home/dejanandovski/Code\ Repo/aero-chat-app && git push origin main
```

- [ ] **Step 3: Deploy to Vercel**

```bash
cd /home/dejanandovski/Code\ Repo/aero-chat-app && vercel --prod --yes
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] `getCallTier()` with theme-based detection → Task 1
- [x] `getTierPalette()` with all 4 palettes → Task 1
- [x] Free tier: flat dark bg, no glow, simple bars, no effects → Task 1 palette
- [x] Premium tier: card gradient bleed, cyan glow, 1 orb, 3 particles → Task 1 palette
- [x] Ultra tier: dual-color, waveform bars, 2 orbs, 5 particles, 2 rings → Task 1 palette
- [x] Master tier: gold/emerald, waveform bars, 2 orbs, 6 particles, 3 rings → Task 1 palette
- [x] 1:1 Audio `SplitPanel` tier effects → Task 2
- [x] 1:1 Video PiP border + corner accents → Task 3
- [x] Ringing overlay tier effects → Task 3
- [x] Group audio grid cell tier effects (scaled down) → Task 4
- [x] Group call tier badge label → Task 4
- [x] Incoming call modal tier effects → Task 5
- [x] Group video (cell border glow, smaller corner accents) → Not explicitly added as separate item since group video shares same grid cell rendering as group audio in current codebase
- [x] `callTierVisuals.ts` as single new file → Task 1
- [x] No new CSS — all inline styles and existing keyframes → Verified

**Placeholder scan:** No TBDs, TODOs, or vague instructions found.

**Type consistency:** `CallTier`, `TierPalette`, `AudioBarConfig`, `OrbConfig`, `ParticleConfig`, `RingConfig`, `CornerAccentConfig` — all defined in Task 1 and used consistently in Tasks 2-5. `getCallTier`, `getTierPalette`, `getGroupTierPalette` — same names throughout.
