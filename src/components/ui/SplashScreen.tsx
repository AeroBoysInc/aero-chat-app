import { useState, useEffect, useCallback } from 'react';
import { useThemeStore, getThemeTier } from '../../store/themeStore';
import { FreeSplash } from './splashes/FreeSplash';
import { PremiumSplash } from './splashes/PremiumSplash';
import { UltraSplash } from './splashes/UltraSplash';
import { MasterSplash } from './splashes/MasterSplash';

interface Props {
  /** When true, the splash starts its exit reveal animation */
  ready: boolean;
  /** Called after the reveal animation finishes — parent can unmount */
  onRevealed: () => void;
}

const SPLASHES = {
  free: FreeSplash,
  premium: PremiumSplash,
  ultra: UltraSplash,
  master: MasterSplash,
} as const;

/**
 * Full-screen splash overlay.
 * Shows a tier-specific splash while data loads, then reveals the app.
 * Free: circle clip-path exit. Premium: curtain split. Ultra: fade. Master: glitch cut.
 */
export function SplashScreen({ ready, onRevealed }: Props) {
  const [phase, setPhase] = useState<'loading' | 'revealing' | 'done'>('loading');
  const theme = useThemeStore(s => s.theme);
  const tier = getThemeTier(theme);
  const Splash = SPLASHES[tier];

  useEffect(() => {
    if (ready && phase === 'loading') {
      const t = setTimeout(() => setPhase('revealing'), 200);
      return () => clearTimeout(t);
    }
  }, [ready, phase]);

  // For Free tier, use the existing circle clip-path exit via CSS class
  const handleAnimationEnd = useCallback(() => {
    if (phase === 'revealing') {
      setPhase('done');
      onRevealed();
    }
  }, [phase, onRevealed]);

  // For non-Free tiers, exit after their animation durations
  useEffect(() => {
    if (phase !== 'revealing') return;
    // Premium curtain: 0.2s content fade + 0.8s slide = 1.0s
    // Ultra: 0.4s fade
    // Master: 0.15s glitch
    // Free: handled by onAnimationEnd on the splash-reveal CSS class
    const durations: Record<string, number> = {
      premium: 1100,
      ultra: 500,
      master: 250,
    };
    const dur = durations[tier];
    if (!dur) return; // Free tier uses CSS animation end event
    const t = setTimeout(() => {
      setPhase('done');
      onRevealed();
    }, dur);
    return () => clearTimeout(t);
  }, [phase, tier, onRevealed]);

  if (phase === 'done') return null;

  return (
    <div
      className={tier === 'free' && phase === 'revealing' ? 'splash-reveal' : ''}
      onAnimationEnd={tier === 'free' ? handleAnimationEnd : undefined}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: tier === 'free' && phase === 'revealing' ? 'transparent' : undefined,
        pointerEvents: phase === 'revealing' ? 'none' : 'auto',
      }}
    >
      <Splash phase={phase} />
    </div>
  );
}
