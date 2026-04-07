// src/components/ui/TransitionWipe.tsx
import { memo, useRef, useEffect, useState } from 'react';
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
