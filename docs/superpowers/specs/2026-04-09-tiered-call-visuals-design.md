# Tiered Call Visuals — Design Spec

**Date:** 2026-04-09
**Scope:** Visual differentiation of call screens across 4 user tiers (Free, Premium, Ultra, Master). No functional differences — same call features for everyone, purely aesthetic progression.

---

## Core Decisions

- **Tier determines visuals for the caller's own view only** — each person sees their own tier's visuals regardless of who they're calling (Option A)
- **Audio calls go heavy on effects** — users stare at a static screen, so tier effects are prominent
- **Video calls stay subtle** — video content is the star; tier shows as border glow and faint corner accents
- **Ringing/Calling screen gets tier effects** — first impression when initiating a call

---

## Tier Detection

Determine the caller's tier from the user's profile:

```ts
type CallTier = 'free' | 'premium' | 'ultra' | 'master';

function getCallTier(user: Profile, activeTheme: Theme): CallTier {
  if (isMasterTheme(activeTheme)) return 'master';
  if (isUltraTheme(activeTheme)) return 'ultra';
  if (user.is_premium) return 'premium';
  return 'free';
}
```

Tier is based on the currently active theme, not just `is_premium`. A premium user on the John Frutiger theme gets Ultra visuals. A premium user on Ocean gets Premium visuals. This ties call visuals to the theme purchase — a natural "you get what you paid for" progression.

---

## Tier Visual Palettes

### Free
- **Background:** Flat dark gradient `linear-gradient(180deg, #1a3050 0%, #0a1628 100%)`
- **Avatar border:** `2px solid rgba(255,255,255,0.15)` — no glow
- **Audio bars:** 5 bars, static white `rgba(255,255,255,0.15)` when silent, `rgba(255,255,255,0.4)` when speaking
- **Ambient effects:** None — no orbs, no particles, no rings
- **Name color:** `rgba(255,255,255,0.85)`

### Premium
- **Background:** Card gradient bleed — user's card_gradient color faded into dark bg: `linear-gradient(180deg, {cardColor}40 0%, {cardColor}18 40%, rgba(6,14,31,0.95) 100%)`
- **Avatar border:** `2px solid rgba(0,200,255,0.4)` with `box-shadow: 0 0 20px rgba(0,180,255,0.25)`
- **Audio bars:** 5 bars, cyan `rgba(0,212,255,0.4–0.7)` — intensity scales with audio level
- **Ambient effects:**
  - 1 radial glow orb behind avatar: `rgba(0,180,255,0.15)`, 160px, blur 20px
  - 3 floating particles: small dots (3–4px) with `rgba(0,200,255,0.2–0.3)` and matching box-shadow glow
- **Name color:** `rgba(255,255,255,0.9)`

### Ultra
- **Background:** Deeper gradient with dual-color influence: `linear-gradient(145deg, #0a1628 0%, #1a2a50 40%, #0d1830 100%)`
- **Avatar border:** `2px solid rgba(0,200,255,0.5)` with `box-shadow: 0 0 28px rgba(0,180,255,0.35), 0 0 60px rgba(120,0,255,0.15)`
- **Audio visualizer:** Waveform style — 13 bars in two frequency band groups (7 cyan + 6 purple), separated by a gap. Heights scale with audio level. Bar width: 2px.
- **Ambient effects:**
  - 2 orbs: cyan `rgba(0,160,255,0.12)` top-left + purple `rgba(120,0,255,0.10)` bottom-right, both with blur 18–20px
  - 5 floating particles: mix of cyan and purple dots (3–5px)
  - 2 pulse rings around avatar: inner 90px `1.5px solid rgba(0,200,255,0.15)` with `box-shadow: 0 0 20px rgba(0,180,255,0.1)`, outer 110px `1px solid rgba(0,200,255,0.08)`. Both animate with `aura-pulse 3s ease-in-out infinite`
- **Name color:** `rgba(255,255,255,0.95)`, font-weight 700

### Master
- **Background:** Dark emerald-black: `linear-gradient(145deg, #050a05 0%, #0a1a0a 40%, #040804 100%)`
- **Avatar border:** `2px solid rgba(255,200,0,0.5)` with `box-shadow: 0 0 32px rgba(255,200,0,0.3), 0 0 60px rgba(0,200,100,0.1), inset 0 0 15px rgba(255,200,0,0.05)`
- **Audio visualizer:** Dual-band waveform — 9 gold bars + 5 emerald bars. Gold: `rgba(255,215,0,0.45–0.85)`, Emerald: `rgba(0,200,100,0.3–0.6)`. Bar width: 2px.
- **Ambient effects:**
  - 2 orbs: gold `rgba(255,200,0,0.08)` top-right + emerald `rgba(0,200,100,0.08)` bottom-left, blur 18–20px
  - 6 floating particles: mix of gold and emerald dots (3–5px) with matching glow shadows
  - 3 rings around avatar: inner 90px `1.5px solid rgba(255,200,0,0.25)` with `box-shadow: 0 0 30px rgba(255,200,0,0.12)`, middle 110px `1px solid rgba(255,200,0,0.08)`, outer 130px `1px solid rgba(255,200,0,0.08)`. Inner and middle animate with `aura-pulse 2.5s ease-in-out infinite`
- **Name color:** `rgba(255,215,0,0.9)`, font-weight 700, `text-shadow: 0 0 10px rgba(255,200,0,0.2)`

---

## Call Screen Breakdown

### 1:1 Audio Call

The existing 50/50 split panel layout is preserved. Each half (`SplitPanel` component) is enhanced with the caller's tier effects.

**What changes per tier in each panel:**
1. Background gradient/color
2. Avatar border + glow
3. Audio visualizer style (simple bars vs waveform)
4. Ambient orbs (0, 1, or 2)
5. Floating particles (0, 3, 5, or 6)
6. Pulse rings around avatar (0, 0, 2, or 3)
7. Name text styling

The `panelBackground()` function currently uses card gradients for all users. For tiered visuals:
- **Free:** Ignore card gradient, use flat dark bg
- **Premium:** Keep existing card gradient behavior (already implemented)
- **Ultra/Master:** Use tier-specific gradient, not card gradient

### 1:1 Video Call

Video content dominates. Tier effects are minimal:
- **PiP border:** Colored to match tier (white for Free, cyan for Premium/Ultra, gold for Master) with matching box-shadow glow
- **Corner accents:** Faint radial gradients in the corners of the main frame. Free: none. Premium: 1 corner (top-left, cyan). Ultra: 2 corners (top-left cyan, bottom-right purple). Master: 2 corners (top-left gold, bottom-right emerald).
- **No particles or orbs** in video calls — they'd compete with the video feed

### Group Audio Call

Grid layout (already exists in `GroupCallView.tsx`). Each cell in the grid is effectively a mini `SplitPanel` with scaled-down tier effects:
- Avatar size: 40px (vs 50px in 1:1)
- Orbs scaled to 60–70% of 1:1 sizes
- Fewer particles (0, 2, 3, 4 per tier instead of 0, 3, 5, 6)
- Rings scaled to 70–80px inner
- Small tier badge label below audio bars: "FREE" / "PREMIUM" / "ULTRA" / "MASTER" in tier color, font-size 8px, letter-spacing 0.05em

### Group Video Call

Grid of video feeds. Same minimal approach as 1:1 video:
- **Cell border glow:** Faint inset box-shadow in tier color
- **Corner accents:** Smaller than 1:1 (40px radial vs 80px)
- **Name badge:** Bottom-left overlay, text color matches tier palette
- **No particles or orbs**

### Ringing / Calling Screen

The outgoing "Calling..." and "Ringing..." overlay gets tier visuals:

- **Free:** Current design unchanged — dark gradient bg, white pulsing ring, white icon
- **Premium:** Cyan-tinted bg gradient, cyan pulsing ring (`border: 2.5px solid rgba(0,200,255,0.5)`), 1 glow orb behind ring, 3 particles
- **Ultra:** Deeper blue-purple bg, cyan ring with purple secondary glow, 2 orbs (cyan + purple), 5 particles, `box-shadow: 0 0 40px rgba(0,180,255,0.3)` on the ring
- **Master:** Dark emerald bg, gold pulsing ring (`border: 2.5px solid rgba(255,200,0,0.5)`), gold+emerald orbs, 6 particles, `box-shadow: 0 0 40px rgba(255,200,0,0.3)` on the ring, gold-tinted phone/video icon

The pulsing ring animation is already `pulse-ring 2s ease infinite`. Keep the same keyframe, just change colors.

### Incoming Call Modal

Same tier treatment as ringing screen — the recipient sees their own tier's visuals on the incoming call modal.

---

## Component Architecture

### New file
- **`src/lib/callTierVisuals.ts`** — Pure functions and constants. Exports:
  - `getCallTier(user, activeTheme): CallTier`
  - `getTierPalette(tier): TierPalette` — returns all colors/styles for a tier
  - `TierPalette` type with fields: `bg`, `avatarBorder`, `avatarGlow`, `barColor`, `barActiveColor`, `nameColor`, `nameWeight`, `nameShadow`, `orbConfigs[]`, `particleConfigs[]`, `ringConfigs[]`, `cornerAccentConfigs[]`, `pipBorderColor`, `pipGlow`, `ringingRingColor`, `ringingRingGlow`, `ringingIconColor`, `tierLabel`, `tierLabelColor`

### Modified files
- **`src/components/call/CallView.tsx`** — `SplitPanel` reads tier from `callTierVisuals.ts` and renders ambient effects (orbs, particles, rings) conditionally. `panelBackground` replaced by tier-aware background. PiP border gets tier color. Ringing overlay gets tier effects.
- **`src/components/call/GroupCallView.tsx`** — Grid cells use same tier system, scaled down. Add tier badge label.
- **`src/components/call/IncomingCallModal.tsx`** — Apply tier palette to the ringing animation and background.

### No new CSS
All tier visuals use inline styles and existing keyframes (`aura-pulse`, `pulse-ring`). No new classes or keyframes needed.

---

## Particle Animation

Particles should gently drift to feel alive. Use the existing `orb-drift` keyframe but with smaller translate values:

```tsx
style={{
  animation: `orb-drift ${5 + Math.random() * 4}s ease-in-out ${Math.random() * 3}s infinite`,
}}
```

Each particle gets a random duration (5–9s) and delay (0–3s) for organic feel. Position is absolute within the panel, placed at random-ish but balanced positions (defined in `particleConfigs`).

---

## Performance

- **Particles are CSS-only** — no JS animation, no requestAnimationFrame overhead. Just `position: absolute` divs with `box-shadow` glow and `orb-drift` animation.
- **Rings use existing `aura-pulse`** — already in index.css, already pauses when `.paused` class is active
- **Orbs are static `filter: blur()`** — not animated (they don't drift like the chat layout orbs). Static blurred divs have zero ongoing cost.
- **Free tier = zero ambient elements** — cheapest render path
- **Max element count** (Master, 1:1 audio): 2 orbs + 6 particles + 3 rings = 11 extra DOM nodes per panel. Negligible.

---

## Edge Cases

- **Theme changes during call:** `getCallTier` is reactive (reads from stores). If a user switches theme mid-call, their call visuals update. This is fine — it's just a re-render of background styles.
- **Group calls with 2 participants:** Renders as 2-cell grid (1x2), not 50/50 split. Group calls always use the grid layout.
- **Screen sharing:** During screen share, tier effects are hidden (same as current behavior — screen share takes over the full frame).
- **Idle/paused state:** Particle animations respect `.paused` class via existing CSS rule. Rings use `aura-pulse` which also pauses.
