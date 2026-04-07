// src/components/ui/TransitionWipe.tsx
import { memo, useRef, useEffect, useState } from 'react';
import { useThemeStore } from '../../store/themeStore';

type WipeVariant = 'cloud' | 'haze' | null;

interface TransitionWipeProps {
  active: boolean;
  onMidpoint?: () => void;
  onComplete?: () => void;
}

export const TransitionWipe = memo(function TransitionWipe({ active, onMidpoint, onComplete }: TransitionWipeProps) {
  const theme = useThemeStore(s => s.theme);
  const variant: WipeVariant = theme === 'john-frutiger' ? 'cloud' : theme === 'golden-hour' ? 'haze' : null;
  const [phase, setPhase] = useState<'idle' | 'wiping'>('idle');
  const midpointFired = useRef(false);
  const onMidpointRef = useRef(onMidpoint);
  const onCompleteRef = useRef(onComplete);
  onMidpointRef.current = onMidpoint;
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!active || !variant) return;
    if (phase !== 'idle') return;

    midpointFired.current = false;
    setPhase('wiping');

    const midTimer = setTimeout(() => {
      if (!midpointFired.current) {
        midpointFired.current = true;
        onMidpointRef.current?.();
      }
    }, 550); // midpoint at 550ms — when clouds fully obscure the screen

    const doneTimer = setTimeout(() => {
      setPhase('idle');
      onCompleteRef.current?.();
    }, 1500); // total animation 1.4s + buffer

    return () => { clearTimeout(midTimer); clearTimeout(doneTimer); };
  }, [active, variant]); // removed callback deps — use refs instead

  if (!variant || phase !== 'wiping') return null;

  if (variant === 'cloud') return <CloudWipe />;
  return <HazeWipe />;
});

/* ── Cloud Wipe (John Frutiger) — fat viewport-filling clouds that roll across ── */
function CloudWipe() {
  return (
    <div className="ultra-ambient" style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none', overflow: 'hidden' }}>
      {/* Cloud layers — back to front, staggered */}
      <div className="cloud-wipe-layer cloud-wipe-l3" />
      <div className="cloud-wipe-layer cloud-wipe-l2" />
      <div className="cloud-wipe-layer cloud-wipe-l1" />

      {/* Sparkles that pop mid-wipe */}
      {[
        { left: '30%', top: '30%', delay: '0.3s', size: 4 },
        { left: '55%', top: '60%', delay: '0.45s', size: 3 },
        { left: '70%', top: '25%', delay: '0.5s', size: 5 },
        { left: '40%', top: '70%', delay: '0.55s', size: 3 },
        { left: '80%', top: '50%', delay: '0.6s', size: 4 },
      ].map((s, i) => (
        <div key={i} style={{
          position: 'absolute', left: s.left, top: s.top,
          width: s.size, height: s.size, borderRadius: '50%',
          background: 'white',
          animation: `wipe-sparkle 0.6s ease-out ${s.delay} forwards`,
          opacity: 0,
        }} />
      ))}

      <style>{`
        .cloud-wipe-layer {
          position: absolute;
          width: 160%;
          height: 100%;
          left: -160%;
        }
        .cloud-wipe-l1 {
          background:
            radial-gradient(ellipse 35% 80% at 20% 50%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.50) 40%, transparent 70%),
            radial-gradient(ellipse 30% 70% at 50% 40%, rgba(255,255,255,0.90) 0%, rgba(255,255,255,0.40) 45%, transparent 70%),
            radial-gradient(ellipse 25% 90% at 75% 55%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.35) 40%, transparent 70%),
            radial-gradient(ellipse 40% 60% at 90% 45%, rgba(255,255,255,0.80) 0%, rgba(255,255,255,0.30) 50%, transparent 70%);
          z-index: 3;
          animation: cloud-roll 1.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .cloud-wipe-l2 {
          background:
            radial-gradient(ellipse 30% 90% at 15% 60%, rgba(200,235,255,0.85) 0%, rgba(200,235,255,0.35) 45%, transparent 70%),
            radial-gradient(ellipse 35% 75% at 45% 35%, rgba(200,235,255,0.80) 0%, rgba(200,235,255,0.30) 40%, transparent 70%),
            radial-gradient(ellipse 28% 85% at 70% 50%, rgba(200,235,255,0.75) 0%, rgba(200,235,255,0.25) 45%, transparent 70%),
            radial-gradient(ellipse 32% 70% at 95% 55%, rgba(200,235,255,0.70) 0%, rgba(200,235,255,0.20) 50%, transparent 70%);
          z-index: 2;
          animation: cloud-roll 1.4s cubic-bezier(0.4, 0, 0.2, 1) 0.08s forwards;
        }
        .cloud-wipe-l3 {
          background:
            radial-gradient(ellipse 40% 100% at 25% 45%, rgba(180,225,255,0.70) 0%, rgba(180,225,255,0.25) 50%, transparent 70%),
            radial-gradient(ellipse 35% 80% at 55% 55%, rgba(180,225,255,0.65) 0%, rgba(180,225,255,0.20) 45%, transparent 70%),
            radial-gradient(ellipse 30% 95% at 80% 40%, rgba(180,225,255,0.60) 0%, rgba(180,225,255,0.18) 50%, transparent 70%);
          z-index: 1;
          animation: cloud-roll 1.4s cubic-bezier(0.4, 0, 0.2, 1) 0.15s forwards;
        }

        @keyframes cloud-roll {
          0%   { left: -160%; }
          35%  { left: -20%; }
          50%  { left: -5%; }
          65%  { left: -20%; }
          100% { left: 120%; }
        }

        @keyframes wipe-sparkle {
          0%   { opacity: 0; transform: scale(0.3); }
          40%  { opacity: 1; transform: scale(2); box-shadow: 0 0 12px 4px rgba(255,255,255,0.9); }
          100% { opacity: 0; transform: scale(0.5); }
        }
      `}</style>
    </div>
  );
}

/* ── Heat Haze Wipe (Golden Hour) — warm light sweep with sparks ── */
function HazeWipe() {
  return (
    <div className="ultra-ambient" style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none', overflow: 'hidden' }}>
      {/* Main haze wall */}
      <div style={{
        position: 'absolute', width: '200%', height: '100%', top: 0,
        background: [
          'radial-gradient(ellipse 400px 100% at 50% 50%, rgba(255,200,80,0.85) 0%, transparent 50%)',
          'radial-gradient(ellipse 600px 100% at 50% 40%, rgba(255,140,40,0.60) 0%, transparent 55%)',
          'radial-gradient(ellipse 500px 100% at 55% 60%, rgba(255,100,120,0.35) 0%, transparent 50%)',
          'linear-gradient(90deg, transparent 20%, rgba(255,180,60,0.50) 40%, rgba(255,220,100,0.70) 50%, rgba(255,180,60,0.50) 60%, transparent 80%)',
        ].join(', '),
        filter: 'blur(60px)',
        animation: 'haze-sweep-wall 1.0s cubic-bezier(0.4,0,0.2,1) forwards',
      }} />
      {/* Bright flare core */}
      <div style={{
        position: 'absolute', width: '150%', height: '100%', top: 0,
        background: [
          'radial-gradient(ellipse 200px 100% at 50% 50%, rgba(255,255,200,0.70) 0%, transparent 45%)',
          'radial-gradient(ellipse 350px 100% at 50% 50%, rgba(255,200,80,0.40) 0%, transparent 50%)',
        ].join(', '),
        filter: 'blur(40px)',
        animation: 'haze-sweep-flare 0.9s cubic-bezier(0.4,0,0.2,1) 0.06s forwards',
      }} />
      {/* Heat ripple */}
      <div style={{
        position: 'absolute', width: '180%', height: '100%', top: 0,
        background: 'repeating-linear-gradient(0deg, transparent 0px, rgba(255,200,80,0.06) 2px, transparent 4px, transparent 12px)',
        mixBlendMode: 'overlay' as const,
        animation: 'haze-sweep-ripple 1.1s cubic-bezier(0.4,0,0.2,1) 0.02s forwards',
      }} />

      {/* Traveling sparks */}
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} style={{
          position: 'absolute',
          width: 6, height: 6, borderRadius: '50%',
          background: '#ffe080',
          boxShadow: '0 0 12px rgba(255,200,80,0.80), 0 0 24px rgba(255,140,40,0.40)',
          animation: `haze-spark-travel 0.7s ease-out ${0.2 + i * 0.08}s forwards`,
          top: `${15 + Math.random() * 70}%`,
          left: '-5%',
          opacity: 0,
        }} />
      ))}

      <style>{`
        @keyframes haze-sweep-wall {
          0%   { transform: translateX(-200%); }
          100% { transform: translateX(200%); }
        }
        @keyframes haze-sweep-flare {
          0%   { transform: translateX(-200%); }
          100% { transform: translateX(200%); }
        }
        @keyframes haze-sweep-ripple {
          0%   { transform: translateX(-200%); }
          100% { transform: translateX(200%); }
        }
        @keyframes haze-spark-travel {
          0%   { left: -5%; opacity: 0; }
          20%  { opacity: 1; }
          70%  { opacity: 0.8; }
          100% { left: 105%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
