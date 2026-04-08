// src/lib/identityConstants.ts

// ── Free accent color presets (12 colors) ───────────────────────────
export const ACCENT_PRESETS = [
  { id: 'cyan',   hex: '#00d4ff', label: 'Cyan' },
  { id: 'blue',   hex: '#3d8bfd', label: 'Blue' },
  { id: 'purple', hex: '#a060ff', label: 'Purple' },
  { id: 'pink',   hex: '#ff60b0', label: 'Pink' },
  { id: 'red',    hex: '#ff4060', label: 'Red' },
  { id: 'orange', hex: '#ff9a4d', label: 'Orange' },
  { id: 'gold',   hex: '#ffd740', label: 'Gold' },
  { id: 'green',  hex: '#4fc97a', label: 'Green' },
  { id: 'teal',   hex: '#20c9b0', label: 'Teal' },
  { id: 'silver', hex: '#e0e8f0', label: 'Silver' },
  { id: 'rose',   hex: '#f5c6d0', label: 'Rose' },
  { id: 'steel',  hex: '#b0c4de', label: 'Steel' },
] as const;

export type AccentPresetId = (typeof ACCENT_PRESETS)[number]['id'];

export const DEFAULT_ACCENT = '#00d4ff';

// ── Banner gradient presets (6 gradients) ───────────────────────────
export const BANNER_PRESETS = [
  { id: 'ocean',  css: 'linear-gradient(135deg, #0044aa, #0088cc)',  preview: '#0066bb' },
  { id: 'sunset', css: 'linear-gradient(135deg, #cc4400, #ff8800)',  preview: '#e06600' },
  { id: 'forest', css: 'linear-gradient(135deg, #006644, #00aa66)',  preview: '#008855' },
  { id: 'cosmic', css: 'linear-gradient(135deg, #2a0066, #6600cc)',  preview: '#4a0099' },
  { id: 'rose',   css: 'linear-gradient(135deg, #aa2255, #ff6699)',  preview: '#cc4477' },
  { id: 'steel',  css: 'linear-gradient(135deg, #2a3a4a, #4a6a8a)',  preview: '#3a5060' },
] as const;

export type BannerPresetId = (typeof BANNER_PRESETS)[number]['id'];

export function getBannerCss(id: string | null | undefined): string | null {
  if (!id) return null;
  return BANNER_PRESETS.find(b => b.id === id)?.css ?? null;
}

// ── Card effects (premium only) ─────────────────────────────────────
export const CARD_EFFECTS = [
  { id: 'shimmer',   label: 'Shimmer',   description: 'Diagonal light sweep' },
  { id: 'bubbles',   label: 'Bubbles',   description: 'Floating translucent circles' },
  { id: 'sparkles',  label: 'Sparkles',  description: 'Twinkling star particles' },
  { id: 'aurora',    label: 'Aurora',     description: 'Slow color bands' },
  { id: 'rain',      label: 'Rain',      description: 'Soft diagonal droplets' },
  { id: 'fireflies', label: 'Fireflies', description: 'Warm floating dots' },
] as const;

export type CardEffectId = (typeof CARD_EFFECTS)[number]['id'];

// ── Name effects ────────────────────────────────────────────────────
export const NAME_EFFECTS_FREE = [
  { id: 'glow',     label: 'Glow' },
  { id: 'shadow',   label: 'Shadow' },
  { id: 'metallic', label: 'Metallic' },
  { id: 'spaced',   label: 'Spaced' },
  { id: 'italic',   label: 'Italic' },
] as const;

export const NAME_EFFECTS_PREMIUM = [
  { id: 'rainbow',  label: 'Rainbow' },
  { id: 'wave',     label: 'Wave' },
  { id: 'pulse',    label: 'Pulse' },
  { id: 'glitch',   label: 'Glitch' },
  { id: 'sparkle',  label: 'Sparkle' },
] as const;

export const NAME_EFFECTS = [...NAME_EFFECTS_FREE, ...NAME_EFFECTS_PREMIUM] as const;
export type NameEffectId = (typeof NAME_EFFECTS)[number]['id'];

// ── Shared identity type ────────────────────────────────────────────
export interface IdentityFields {
  bio: string | null;
  custom_status_text: string | null;
  custom_status_emoji: string | null;
  accent_color: string | null;
  accent_color_secondary: string | null;
  banner_gradient: string | null;
  banner_image_url: string | null;
  card_effect: string | null;
  avatar_gif_url: string | null;
  name_effect: string | null;
}

export const IDENTITY_COLUMNS = [
  'bio', 'custom_status_text', 'custom_status_emoji',
  'accent_color', 'accent_color_secondary',
  'banner_gradient', 'banner_image_url', 'card_effect',
  'avatar_gif_url', 'name_effect',
] as const;

/** Max bio length by tier */
export const BIO_MAX_FREE = 150;
export const BIO_MAX_PREMIUM = 500;
export const STATUS_TEXT_MAX = 128;
