# AeroChat Freemium Model — Product Specification

**Version:** 1.0
**Date:** 2026-04-06
**Status:** Draft

---

## Executive Summary

AeroChat operates on a freemium SaaS model. The core communication platform is free for all users. Revenue comes from **Aero Chat+**, a monthly subscription that unlocks premium cosmetic customization, enhanced media capabilities, and access to the **Exclusive Shop** for ultra-rare items.

The monetization strategy is built around three pillars:
1. **Visual identity** — Avatar customization, profile cards, themes, bubble styles
2. **Media quality** — Higher upload limits, HD content, custom emoji
3. **Progression rewards** — Unlimited XP earning, premium milestone cosmetics

---

## Tier Overview

| Feature | Free | Aero Chat+ |
|---------|------|------------|
| DMs, Servers, Bubbles, Calls | Yes | Yes |
| Emoji Picker + GIF Search | Yes | Yes |
| Games (Chess, future games) | Yes | Yes |
| Writer's Corner | Yes | Yes |
| Avatar Corner (base avatar + XP bars) | Yes | Yes |
| Free cosmetic items at level milestones | Yes | Yes |
| Daily XP cap | **Capped** | **Uncapped** |
| File upload limit | **10 MB** | **100 MB** |
| Profile card gradients | **3 presets** | **Full library + custom colors** |
| Animated profile card effects | No | Yes |
| Custom aura ring colors | No | Yes |
| Chat themes | **Day / Night only** | **Full theme library** |
| Chat bubble styles | **Default only** | **Multiple styles + custom colors** |
| Sound packs | **Default only** | **Multiple packs** |
| Custom server emoji uploads | No | Yes |
| Premium avatar cosmetics catalog | No | Yes |
| Exclusive Shop access | No | Yes |

---

## Free Tier

### What's Included

Every user gets the full AeroChat communication platform at no cost:

- **Messaging** — DMs with end-to-end encryption, server bubble chat, GIF & emoji picker, reactions, message deletion
- **Voice & Video** — 1-on-1 and group calls with audio, video, and screen sharing
- **Servers** — Create and join servers, manage bubbles, roles, and permissions
- **Games** — Chess (and future games) with full functionality
- **Writer's Corner** — Publish and read stories
- **Avatar Corner** — Base Frutiger Aero avatar with 3 XP progression bars (Chatter, Gamer, Writer)
- **File Sharing** — Images, documents, and files up to 10 MB
- **Profile Card** — 3 gradient presets to choose from

### Free Milestone Rewards

Free users earn cosmetic items at XP level milestones to keep progression rewarding:

| Milestone | Reward |
|-----------|--------|
| Chatter Lv. 5 | Speech bubble accessory |
| Gamer Lv. 5 | Controller badge |
| Writer Lv. 5 | Quill pen accessory |
| Any bar Lv. 10 | Second accessory slot |
| Any bar Lv. 25 | Animated XP bar glow |
| Any bar Lv. 50 | Unique title color |

### Limitations

- **Daily XP cap** — Free users earn up to a fixed amount of XP per day per bar. Prevents spam grinding and creates incentive to upgrade.
- **10 MB uploads** — Standard quality images, documents, and small files only.
- **Default visuals** — Day/Night theme only, default bubble style, default notification sounds, basic profile card options.
- **No custom emoji** — Can use the built-in emoji picker but cannot upload custom server emoji.
- **Base avatar only** — The Frutiger Aero character with no cosmetic customization beyond free milestone items.

---

## Aero Chat+ (Subscription)

### Visual Customization

**Profile Cards**
- Full gradient preset library (20+ options)
- Custom color picker for gradient creation
- Animated glass effects (shimmer, particle drift, aura pulse)

**Aura Rings**
- Custom aura ring colors beyond the default status-based colors
- Special animated ring styles (double ring, prismatic, ember trail)

**Chat Themes**
- Full theme library beyond Day/Night (Ocean, Sunset, Midnight, Aurora, Sakura, etc.)
- Each theme adjusts backgrounds, glass tints, accent colors, and orb colors

**Chat Bubble Styles**
- Multiple bubble shapes (rounded, sharp, cloud, minimal)
- Custom sent-bubble color picker
- Gloss/matte/gradient bubble finishes
- Custom bubble opacity

**Sound Packs**
- Multiple notification sound sets (Aero Classic, Chime, Retro, Nature, Synth)
- Custom call ringtones
- UI interaction sounds (send, receive, react)

**Animated Profile Cards**
- Floating orbs, particle effects, subtle motion
- Animated avatar frames
- Seasonal animated effects (snow, cherry blossoms, fireflies)

### Media & Uploads

**File Uploads**
- Raised cap: up to 100 MB per file
- Higher quality image preservation (less compression)

**Custom Server Emoji**
- Upload custom emoji for your servers
- Animated emoji support (GIF-based custom emoji)
- Use custom emoji from any server you're a member of

### Avatar Corner — Premium Cosmetics

**Large cosmetic catalog unlocked**, organized by category:
- **Headwear** — Hats, headphones, crowns, halos, horns
- **Eyewear** — Glasses, goggles, monocles, VR headsets
- **Outfits** — Jackets, hoodies, suits, armor sets, themed costumes
- **Accessories** — Backpacks, wings, capes, pets, floating items
- **Backgrounds** — Scene backdrops for the avatar display
- **Effects** — Particle trails, auras, ambient animations

**Premium milestone cosmetics** — Additional items unlocked at level milestones that are only available to Aero Chat+ subscribers.

### Progression

- **Daily XP cap removed** — Earn unlimited XP per day
- **XP boost events** — Occasional double-XP weekends for subscribers

---

## Exclusive Shop

> **Requires an active Aero Chat+ subscription to browse and purchase.**

The Exclusive Shop offers one-time-purchase items that are a tier above the standard premium catalog:

### Item Types

- **Ultra-rare avatar sets** — Complete themed outfits with matching accessories and effects (e.g., "Cosmic Voyager", "Neon Samurai", "Frutiger Original")
- **Limited edition drops** — Seasonal or event-based items available for a limited time (holiday sets, anniversary items, collaboration pieces)
- **Unique animated effects** — Premium particle systems, custom avatar animations, rare aura styles
- **Collector badges** — Display badges on your profile showing exclusive items owned

### Rules

- Items are purchased with real currency (not an in-app currency)
- Purchased items are permanently owned, even if the subscription lapses — but new purchases require an active subscription
- Limited edition items are clearly marked with availability windows
- No gameplay advantage — all items are purely cosmetic

---

## Avatar Corner — Full System Design

### The Avatar

Every user has a Frutiger Aero-style character avatar displayed in the Avatar Corner. The character is a stylized humanoid figure rendered in the signature glossy, translucent Aero aesthetic — soft gradients, glass-like materials, rounded forms.

- **Base avatar** — A default Frutiger character with neutral styling (free for all users)
- **Customizable slots** — Headwear, eyewear, outfit, accessory (left), accessory (right), background, effect
- **Preview** — Users can preview items on their avatar before equipping

### XP System

Three independent XP bars track activity across the app:

**Chatter XP** — Earned through messaging
| Action | XP |
|--------|----|
| Send a message (DM or bubble) | +2 |
| Send a GIF | +3 |
| React to a message | +1 |
| Daily streak bonus (consecutive days) | +10 per day in streak |

**Gamer XP** — Earned through games
| Action | XP |
|--------|----|
| Complete a game | +15 |
| Win a game | +25 |
| Daily first game bonus | +10 |

**Writer XP** — Earned through Writer's Corner
| Action | XP |
|--------|----|
| Publish a story | +30 |
| Receive a like on a story | +5 |
| Word count bonus (per 500 words published) | +10 |

**Daily XP Cap (free users):** 100 XP per bar per day.
**Aero Chat+ users:** No cap.

### Rank Progression

Each XP bar has its own rank title system. Ranks are the primary display; numeric levels are secondary detail.

**Chatter Ranks:**
| Level Range | Rank Title |
|-------------|------------|
| 1–4 | Newcomer |
| 5–14 | Chatterbox |
| 15–29 | Storyteller |
| 30–49 | Socialite |
| 50–74 | Orator |
| 75–99 | Legend |
| 100 | Aero Voice |

**Gamer Ranks:**
| Level Range | Rank Title |
|-------------|------------|
| 1–4 | Rookie |
| 5–14 | Player |
| 15–29 | Competitor |
| 30–49 | Strategist |
| 50–74 | Champion |
| 75–99 | Grandmaster |
| 100 | Aero Champion |

**Writer Ranks:**
| Level Range | Rank Title |
|-------------|------------|
| 1–4 | Scribbler |
| 5–14 | Wordsmith |
| 15–29 | Author |
| 30–49 | Novelist |
| 50–74 | Laureate |
| 75–99 | Sage |
| 100 | Aero Muse |

### XP Per Level

XP required scales with level:
- **Level 1→2:** 50 XP
- **Level 2→3:** 75 XP
- **Level N→N+1:** `50 + (N * 25)` XP
- **Level 99→100:** 2,525 XP

Total XP to reach Level 100: ~128,800 XP per bar.

---

## Anti-Abuse

- **Free daily XP cap** prevents message spam for XP farming
- **Duplicate message detection** — Identical consecutive messages don't earn XP
- **Minimum message length** — Messages under 3 characters don't earn Chatter XP
- **Rate limiting** — Max 1 XP event per action type per 5 seconds
- **Story quality gate** — Stories under 50 words don't earn Writer XP

---

## Visual Reference

See the companion mockup file for visual representations of each feature:
**`docs/freemium-mockups.html`** — Open in a browser to view styled Frutiger Aero mockups of:
- Tier comparison cards
- Avatar Corner with XP bars and rank display
- Free vs Premium profile card comparison
- Chat bubble style options
- Theme preview grid

---

## Implementation Priority

1. **Phase 1 — Subscription Infrastructure** — Payment integration (Stripe), subscription state in profiles table, gate checks in UI
2. **Phase 2 — Visual Perks** — Profile card customization, chat themes, bubble styles, sound packs, custom aura rings
3. **Phase 3 — Avatar Corner** — Avatar display, XP tracking, rank system, base cosmetics, milestone rewards
4. **Phase 4 — Premium Cosmetics** — Full cosmetic catalog, equip system, avatar customization UI
5. **Phase 5 — Exclusive Shop** — Storefront UI, purchase flow, limited edition item system
6. **Phase 6 — Custom Emoji** — Server emoji upload, animated emoji, cross-server usage
