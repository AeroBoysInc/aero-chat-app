# Ultra Themes — Design Specification

Two premium-only purchasable themes that completely transform the visual layout and experience of AeroChat. Each theme overhauls backgrounds, glass styling, transitions, server navigation, and component aesthetics. Available only to premium (`is_premium = true`) subscribers.

---

## Purchase Model

- **Price:** €2 per theme, one-time unlock
- **Persistence:** Once purchased, the unlock persists forever in the user's profile
- **Availability:** Only usable while `is_premium = true`. If the user downgrades, the themes are hidden but not lost — they reappear on re-subscription
- **Storage:** New columns on `profiles` table: `owns_john_frutiger BOOLEAN DEFAULT false`, `owns_golden_hour BOOLEAN DEFAULT false`
- **Purchase flow (temporary):** Mock purchase button that instantly sets the flag to `true` and shows a success toast. No real payment integration yet.
- **Theme selector:** Ultra themes live in a dedicated "Ultra Themes" section in the theme picker, positioned below the Aero Chat+ area — more extravagant presentation than standard themes (larger cards, preview imagery, glow effects). Lock icon if not purchased, "Buy €2" button if premium but not owned, selectable if owned + premium

---

## Scope — What Changes

Both themes override ALL of the following (standard themes keep current behavior):

1. **Background** — CSS-only painted backgrounds replace the current solid color
2. **Glass panels** — Different glass tint, border glow, and shadow treatment
3. **Message bubbles** — Custom shapes, gloss effects, and glow
4. **Input bar** — Restyled with theme-specific materials
5. **Chat header** — Gradient wash, themed styling
6. **Profile card** — Theme-specific card in sidebar
7. **Scrollbars** — Themed scrollbar thumb and track
8. **Server rail** — Themed server icons (glossy orbs vs flat circles)
9. **Transitions** — Unique corner and server transitions per theme
10. **Server interior** — Bubble Sky hub with theme-appropriate coloring
11. **Server picker** — Theme-specific overlay (cloud vs sun burst)
12. **Ambient effects** — Background particles, sparkles, god rays, depth orbs

---

## Theme 1: John Frutiger

### Visual Identity
Heavy Frutiger Aero — bright sky, white glass, glossy everything. Maximum skeuomorphism. The app feels like it's floating in the clouds.

### Background
CSS-only painted sky:
- Base: Linear gradient from light blue (#b8ecff) through sky blue (#5ec8f5, #0098e0) to deep blue (#004a90)
- 4 volumetric clouds: Large radial gradients with white cores, `filter: blur(30px)`, animated with `cloud-float` keyframes (12-15s cycles, staggered)
- 3 god rays: Tall skewed rectangles with white-to-transparent gradient, pulsing opacity (6-10s cycles)
- 3 glass spheres: Circular elements with radial gradient and `box-shadow` glow (NOT `filter: blur()` — uses shadow instead to stay within the 3-orb performance limit), subtle `transform: translateY` float animation
- 4+ sparkle particles: Tiny white dots with cyan glow, twinkling on 3s cycles with staggered delays

### Glass Treatment
- **Panels:** `background: rgba(255,255,255,0.18)`, `border: 1px solid rgba(255,255,255,0.30)`, `backdrop-filter: blur(24px)`, `box-shadow: inset 0 1px 1px rgba(255,255,255,0.5), 0 8px 32px rgba(0,0,0,0.08)`
- **Chrome variant:** Additional top highlight line `rgba(255,255,255,0.40)` for primary panels
- **Accent color:** Aqua/cyan (#00d4ff) for active states, glows, and highlights

### Message Bubbles
- Sent: `background: linear-gradient(135deg, rgba(0,160,255,0.35), rgba(0,120,220,0.30))`, border `rgba(0,200,255,0.20)`, `backdrop-filter: blur(8px)`
- Triple-layer gloss: `::before` pseudo-element with white-to-transparent gradient covering top 40%
- Received: Standard glass treatment with slight blue tint

### Server Rail
- Icons are glossy rounded squares with white glass, `inset 0 1px 1px rgba(255,255,255,0.5)` highlight
- Active: Aqua tint `rgba(0,180,255,0.35)` with cyan border glow
- Home icon: Slightly more rounded (14px radius)

### Profile Card
- Glass card at top of sidebar with `profile-card-bg` gradient
- Decorative corner orb (radial gradient, blurred)
- Avatar with aura ring (cyan pulse)

### Scrollbars
- Thumb: Aqua-tinted glass `rgba(0,180,255,0.20)`, 6px wide, 3px radius
- Track: Transparent
- Hover: `rgba(0,180,255,0.30)`

### Input Bar
- Raised skeuomorphic: Glass background with `inset 0 1px 2px rgba(0,0,0,0.06)` inner shadow
- Focus: Cyan border glow `0 0 12px rgba(0,180,255,0.15)`
- Send button: Glossy gradient pill (#0098e0 → #00d4ff) with top highlight

### Chat Header
- Gradient wash: `linear-gradient(180deg, rgba(0,100,255,0.08) 0%, transparent 100%)` over panel header
- `backdrop-filter: blur(12px)`, rounded top corners

### Depth Orbs
- 2 orbs in chat area: Faint blue/purple, `orb-drift` animation (7-9s), `z-index: 0` behind messages
- 3 orbs behind main layout (ChatLayout level): Larger, fainter, different colors per theme

### Date Separators
- Thin flanking lines: `rgba(120,180,220,0.25)`
- Text: 10px, `rgba(80,130,170,0.50)`, "Today" / "Yesterday" / "Mar 23"

---

## Theme 2: Golden Hour

### Visual Identity
Windows Vista Aero reimagined as a sunset. Dark translucent glass, warm amber/gold accents, glossy orb buttons. The app feels like golden hour on a summer evening.

### Background
CSS-only painted sunset:
- Base: Linear gradient from deep purple (#1a0a2e) through wine (#5c1a3a) to burnt orange (#c45e1a) to gold (#f5a623) to pale yellow (#ffe680)
- Sun orb: Radial gradient at bottom center, warm white core fading to golden, `box-shadow: 0 0 80px rgba(255,180,50,0.40)`
- 2 aurora waves: Wide horizontal bands of warm light (pink/amber/gold), `filter: blur(50px)`, `aurora-drift` animation (15-20s)
- 4 sun rays: Tall skewed rectangles from bottom, `rgba(255,200,80,0.12)` → transparent, pulsing
- 5+ ember particles: Tiny orange dots rising from bottom with `ember-rise` animation (8s), fading as they ascend
- 5 golden sparkles: Warm yellow dots with amber glow, twinkling on staggered 3s cycles

### Glass Treatment (Vista-style)
- **Panels:** `background: linear-gradient(180deg, rgba(60,30,10,0.55), rgba(40,20,8,0.60), rgba(30,15,5,0.55))`, `border: 1px solid rgba(255,180,80,0.22)`, `backdrop-filter: blur(24px) saturate(1.3)`, `box-shadow: inset 0 1px 0 rgba(255,220,150,0.20), 0 8px 32px rgba(0,0,0,0.30)`
- **Chrome variant:** Top gradient line `rgba(255,200,100,0.16)` → `rgba(255,160,60,0.07)`, thicker top border `rgba(255,220,150,0.35)`
- **Accent color:** Amber/gold (#ffe0a0, #f5a623) for active states, glows, and highlights

### Message Bubbles
- Sent: `background: linear-gradient(135deg, rgba(255,160,40,0.30), rgba(200,80,10,0.25))`, border `rgba(255,180,80,0.18)`
- Vista-style gloss: `::before` with `rgba(255,255,255,0.12)` top highlight, rounded pill shape covering top 45%
- Received: Dark glass with warm amber text tint

### Server Rail
- Icons are **glossy orbs** (fully round, 50% radius) — Vista Start Menu button style
- Gradient: `rgba(255,200,100,0.30)` → `rgba(200,100,30,0.35)` → `rgba(120,50,10,0.45)`
- `::before` pseudo: Top-half specular highlight `rgba(255,255,255,0.28)` → transparent
- Active: Brighter gold with amber border glow
- Home icon: Rounded square (14px radius), same gradient

### Vista Window Buttons
- Chat header gets decorative close/minimize/maximize orbs (red/amber/green)
- Each is a glossy sphere with `::before` top-half highlight
- Purely decorative in the ultra theme (no additional functionality)

### Profile Card
- Dark glass card with warm gradient background
- Golden aura ring on avatar
- Status text in amber tones

### Scrollbars
- Thumb: Amber `rgba(255,180,80,0.15)`, 6px wide, 3px radius
- Track: Transparent
- Hover: `rgba(255,180,80,0.25)`

### Input Bar
- Dark recessed: `background: rgba(0,0,0,0.25)`, `border-top: 1px solid rgba(0,0,0,0.20)` (inset shadow), bottom border warm
- Focus: Amber glow `0 0 8px rgba(255,180,50,0.15)`
- Send button: Glossy orb (fully round) with warm gradient and Vista-style top highlight

### Chat Header
- Gradient wash: Vista-style `rgba(255,200,120,0.18)` → transparent
- Decorative Vista orb buttons (close/min/max) on the right side

### Depth Orbs
- 2 orbs in chat area: Warm orange/red tints, same `orb-drift` animation
- 3 orbs behind main layout: Amber/pink/warm tones

### Date Separators
- Flanking lines: `linear-gradient(90deg, transparent, rgba(255,180,80,0.18), transparent)`
- Text: 10px, `rgba(255,200,120,0.35)`

---

## Transitions

### Corner Transitions (entering Games Corner, Writer's Corner, etc.)

**John Frutiger — Cloud Wipe:**
- 3 staggered cloud layers (radial white gradients, `filter: blur(40px)`) roll across from left to right
- Cloud A at t=0, Cloud B at t+80ms, Cloud C at t+160ms
- Duration: 1.2s cubic-bezier(0.4, 0, 0.2, 1)
- Sparkle particles burst forward with the cloud wall
- At midpoint (~380ms), views swap underneath the cloud cover
- Only plays on ultra themes — standard themes keep instant swap

**Golden Hour — Heat Haze Flare:**
- 3 layers sweep across: main haze wall (warm golden radial gradients, `filter: blur(60px)`), bright flare core (white-gold, `blur(40px)`), and heat ripple distortion lines (repeating-linear-gradient with `mix-blend-mode: overlay`)
- Golden spark particles burst forward with the haze
- Same timing as cloud wipe: 1.0s sweep, midpoint swap at ~380ms
- Heat ripple gives a "rising from hot pavement" distortion feel

### Server Transitions

**Both themes share a 3-step flow:**

1. **Picker opens** — Click server icon on rail → DM view dims and blurs (`filter: blur(8px) brightness(0.6)`, `transform: scale(0.97)`) → themed overlay materializes at center
2. **Server cards appear** — Cards stagger in (200ms + 120ms per card) inside the overlay
3. **Enter server** — Click a card → overlay fades → themed wipe sweeps across → server interior (Bubble Sky) appears

**John Frutiger — Cloud Picker:**
- A breathing volumetric cloud materializes at center (3 radial white gradients, `filter: blur(30px)`, `breathe` animation at 4s cycle)
- Server cards float inside the cloud with glass styling
- Clicking outside closes the picker (cloud fades, DM un-blurs)
- Entering a server triggers the cloud wipe

**Golden Hour — Sun Burst Picker:**
- A golden light burst materializes at center (layered radial gradients: bright core `rgba(255,220,100,0.40)` → amber → transparent)
- Glowing ring pulses around the burst (`ring-pulse` 3s cycle)
- 3 spark particles orbit the burst on `spark-orbit` 6s linear animation
- Server cards use dark Vista glass with warm banners
- Entering a server triggers the heat haze wipe

---

## Server Interior — Bubble Sky

Both themes use the **Bubble Sky** layout for the server interior (replacing the standard BubbleHub view when an ultra theme is active):

- No sidebar channel list — channels ARE the floating glass bubbles
- Bubbles are larger than current (70-80px diameter), each showing channel name and last message preview
- Online members appear as tiny avatar dots (10px) orbiting whichever bubble they're chatting in
- Each bubble has a colored ring that breathes (3s ease-in-out cycle)
- Bubbles drift independently with unique `bubble-float` keyframes (seeded from bubble ID)
- Floating glass breadcrumb bar at top: "Server Name — X online"
- Click a bubble → it scales up (0.3s ease) to ~1.5x while other bubbles fade to 0 opacity, then the chat view fades in over the expanded bubble position. Reverse on exit.
- "Float up" button (glass pill, top-left) to return to the hub — chat shrinks back into the bubble, other bubbles fade back in

**John Frutiger variant:** Bright sky behind bubbles, white glass orbs, cyan ring accents
**Golden Hour variant:** Sunset sky behind bubbles, dark glass orbs with amber borders, warm gold ring accents

---

## Performance Considerations

- **`.paused` system:** All CSS animations auto-pause when app loses focus (idle = `document.hidden || !document.hasFocus()`). This is critical for ultra themes which have many concurrent animations
- **Orb limit:** Maximum 3 `filter: blur()` orbs visible at any time per the existing performance standard. Background clouds/aurora use blur but are static layers, not orbs
- **GPU compositing:** Sparkles, embers, and floating elements use `transform` animations only (no layout-triggering properties). Blur is on static background elements, not animating ones
- **Transitions are CSS-only:** Cloud wipe and heat haze are CSS transitions on transform, not JS frame loops
- **Entry animations:** `.paused .animate-* { animation: none }` so content doesn't freeze at `opacity: 0` when entering idle during an animation
- **Conditional rendering:** All ultra theme ambient layers (clouds, aurora, particles, orbs) are only rendered when the corresponding theme is active. Standard themes render none of this
- **No image assets:** Everything is CSS gradients, box-shadows, and pseudo-elements — zero network requests for theme visuals

---

## Data Model Changes

### profiles table
```sql
ALTER TABLE profiles ADD COLUMN owns_john_frutiger BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN owns_golden_hour BOOLEAN NOT NULL DEFAULT false;
```

### Theme selection
- Stored in `localStorage` as current theme key (e.g., `aero-chat-theme: 'john-frutiger'` or `'golden-hour'`)
- On load, validate: if selected theme is ultra but user is not premium or doesn't own it, fall back to default day/night theme
- Theme CSS variables and ambient layers are conditionally applied based on the active theme

### Theme store (new or extend existing)
```ts
interface UltraThemeState {
  activeTheme: 'day' | 'night' | 'john-frutiger' | 'golden-hour';
  ownsJohnFrutiger: boolean;
  ownsGoldenHour: boolean;
  setTheme: (theme: string) => void;
  purchaseTheme: (theme: 'john-frutiger' | 'golden-hour') => Promise<void>;
}
```

---

## File Impact Summary

| File | Changes |
|------|---------|
| `src/index.css` | New CSS variables, keyframes, component classes for both themes |
| `src/store/themeStore.ts` | New store (or extend settings) for theme state + purchase |
| `src/components/chat/ChatLayout.tsx` | Conditional ambient layers (clouds/aurora/orbs/particles) |
| `src/components/chat/Sidebar.tsx` | Theme-aware profile card, scrollbar, rail styling |
| `src/components/chat/ChatWindow.tsx` | Theme-aware bubbles, header, depth orbs, date separators |
| `src/components/ui/AvatarImage.tsx` | Theme-aware aura ring colors |
| `src/components/servers/ServerOverlay.tsx` | Cloud picker (Frutiger) / Sun burst picker (Golden Hour) |
| `src/components/servers/BubbleHub.tsx` | Bubble Sky mode when ultra theme active |
| `src/components/servers/ServerView.tsx` | Theme-aware header and transitions |
| `src/components/ui/ThemePicker.tsx` | Ultra theme cards with purchase/lock UI |
| `src/components/ui/TransitionLayer.tsx` | New — cloud wipe and heat haze wipe components |
| `src/components/ui/PremiumModal.tsx` | Add ultra themes section |
| `supabase/migrations/026_ultra_themes.sql` | Add `owns_john_frutiger`, `owns_golden_hour` columns |
