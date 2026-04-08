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
  style: 'simple' | 'waveform';
  width: number;
  silentColor: string;
  activeColor?: string;
  bands?: { count: number; color: string; activeColor: string }[];
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

export function getGroupTierPalette(tier: CallTier): TierPalette {
  const base = { ...PALETTES[tier] };
  base.orbs = base.orbs.map(o => ({
    ...o,
    width: Math.round(o.width * 0.65),
    height: Math.round(o.height * 0.65),
  }));
  const particleCounts: Record<CallTier, number> = { free: 0, premium: 2, ultra: 3, master: 4 };
  base.particles = base.particles.slice(0, particleCounts[tier]);
  base.rings = base.rings.map(r => ({
    ...r,
    radius: Math.round(r.radius * 0.75),
  }));
  return base;
}
