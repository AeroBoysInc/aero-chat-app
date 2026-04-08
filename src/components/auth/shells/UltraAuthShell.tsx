import { ReactNode, useRef } from 'react';
import { AeroLogo } from '../../ui/AeroLogo';
import { useThemeStore } from '../../../store/themeStore';
import { useParallax } from '../../../hooks/useParallax';

interface Props {
  children: ReactNode;
}

function FrutigerLoginBg() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Volumetric clouds */}
      <div style={{
        position: 'absolute', width: 600, height: 200, top: -40, left: -80,
        borderRadius: '50%',
        background: 'radial-gradient(ellipse at 50% 40%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.15) 45%, transparent 70%)',
        filter: 'blur(30px)',
        animation: 'cloud-float 12s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', width: 500, height: 180, top: 10, right: -60,
        borderRadius: '50%',
        background: 'radial-gradient(ellipse at 50% 40%, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.12) 45%, transparent 70%)',
        filter: 'blur(30px)',
        animation: 'cloud-float 15s ease-in-out 3s infinite', opacity: 0.7,
      }} />
      <div style={{
        position: 'absolute', width: 400, height: 150, bottom: 20, left: '30%',
        borderRadius: '50%',
        background: 'radial-gradient(ellipse at 50% 40%, rgba(255,255,255,0.40) 0%, rgba(255,255,255,0.10) 45%, transparent 70%)',
        filter: 'blur(30px)',
        animation: 'cloud-float 10s ease-in-out 6s infinite', opacity: 0.5,
      }} />

      {/* God rays */}
      <div style={{
        position: 'absolute', width: 200, height: '100%', top: 0, left: '15%',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, transparent 100%)',
        transformOrigin: 'top center', transform: 'skewX(-8deg)',
        animation: 'ray-pulse 6s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', width: 150, height: '80%', top: 0, left: '55%',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 100%)',
        transformOrigin: 'top center', transform: 'skewX(5deg)',
        animation: 'ray-pulse 8s ease-in-out 2s infinite', opacity: 0.7,
      }} />

      {/* Glass spheres */}
      {[
        { size: 35, left: '12%', top: '30%', delay: 0 },
        { size: 25, right: '18%', top: '20%', delay: 2 },
        { size: 20, left: '60%', bottom: '25%', delay: 4 },
      ].map((s, i) => (
        <div key={i} style={{
          position: 'absolute', width: s.size, height: s.size,
          left: s.left, right: (s as any).right, top: s.top, bottom: (s as any).bottom,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.50) 0%, rgba(255,255,255,0.08) 60%, transparent 80%)',
          border: '1px solid rgba(255,255,255,0.25)',
          boxShadow: '0 0 20px rgba(0,180,255,0.12), inset 0 -2px 6px rgba(0,0,0,0.06)',
          animation: `orb-drift ${7 + i}s ease-in-out ${s.delay}s infinite`,
        }} />
      ))}

      {/* Sparkles */}
      {[
        { top: '12%', left: '20%', delay: '0s' },
        { top: '25%', left: '70%', delay: '1s' },
        { top: '60%', left: '35%', delay: '2s' },
        { top: '75%', left: '85%', delay: '0.5s' },
      ].map((p, i) => (
        <div key={i} style={{
          position: 'absolute', width: 4, height: 4, ...p,
          background: 'white', borderRadius: '50%',
          boxShadow: '0 0 8px rgba(255,255,255,0.8), 0 0 16px rgba(0,200,255,0.4)',
          animation: `sparkle-twinkle 3s ease-in-out ${p.delay} infinite`,
        }} />
      ))}
    </div>
  );
}

function GoldenHourLoginBg() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Sun orb */}
      <div style={{
        position: 'absolute', bottom: -40, left: '50%', transform: 'translateX(-50%)',
        width: 180, height: 180, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,230,150,0.80) 0%, rgba(255,180,50,0.40) 40%, transparent 70%)',
        boxShadow: '0 0 80px rgba(255,180,50,0.35), 0 0 160px rgba(255,140,0,0.18)',
      }} />

      {/* Aurora waves */}
      <div style={{
        position: 'absolute', top: '5%', left: '-25%', width: '150%', height: '40%',
        background: 'linear-gradient(90deg, transparent 0%, rgba(255,80,120,0.25) 20%, rgba(255,140,60,0.20) 50%, rgba(255,200,80,0.15) 80%, transparent 100%)',
        filter: 'blur(50px)', opacity: 0.35,
        animation: 'aurora-drift 15s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', top: '20%', left: '-10%', width: '150%', height: '40%',
        background: 'linear-gradient(90deg, transparent 0%, rgba(200,60,140,0.18) 30%, rgba(255,120,40,0.20) 60%, transparent 100%)',
        filter: 'blur(50px)', opacity: 0.25,
        animation: 'aurora-drift 20s ease-in-out 5s infinite',
      }} />

      {/* Sun rays from bottom */}
      {[
        { width: 120, height: '70vh', left: '35%', skew: -6, delay: 0, dur: 7 },
        { width: 80, height: '55vh', left: '52%', skew: 4, delay: 2, dur: 9, opacity: 0.6 },
        { width: 100, height: '60vh', left: '62%', skew: 10, delay: 4, dur: 8, opacity: 0.4 },
      ].map((r, i) => (
        <div key={i} style={{
          position: 'absolute', bottom: 0, width: r.width, height: r.height, left: r.left,
          background: 'linear-gradient(0deg, rgba(255,200,80,0.12) 0%, transparent 100%)',
          transformOrigin: 'bottom center', transform: `skewX(${r.skew}deg)`,
          animation: `ray-pulse ${r.dur}s ease-in-out ${r.delay}s infinite`,
          opacity: (r as any).opacity ?? 1,
        }} />
      ))}

      {/* Ember particles */}
      {[
        { left: '18%', delay: 0 }, { left: '42%', delay: 2 }, { left: '68%', delay: 4 },
      ].map((e, i) => (
        <div key={i} style={{
          position: 'absolute', bottom: `${5 + i * 4}%`, left: e.left,
          width: 3, height: 3, borderRadius: '50%',
          background: 'rgba(255,140,40,0.55)',
          boxShadow: '0 0 4px rgba(255,140,40,0.35)',
          animation: `ember-rise 8s ease-out ${e.delay}s infinite`,
        }} />
      ))}

      {/* Golden sparkles */}
      {[
        { top: '15%', left: '22%', delay: '0s' },
        { top: '30%', left: '65%', delay: '1.2s' },
        { top: '55%', left: '40%', delay: '2.4s' },
      ].map((p, i) => (
        <div key={i} style={{
          position: 'absolute', width: 4, height: 4, ...p,
          background: '#ffe080', borderRadius: '50%',
          boxShadow: '0 0 8px rgba(255,200,80,0.7), 0 0 16px rgba(255,140,40,0.3)',
          animation: `sparkle-twinkle 3s ease-in-out ${p.delay} infinite`,
        }} />
      ))}
    </div>
  );
}

export function UltraAuthShell({ children }: Props) {
  const theme = useThemeStore(s => s.theme);
  const cardRef = useRef<HTMLDivElement>(null);
  const parallax = useParallax(cardRef, 3);

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4" style={{ background: 'var(--body-bg)' }}>
      {/* Full-screen ambient scene */}
      {theme === 'golden-hour' ? <GoldenHourLoginBg /> : <FrutigerLoginBg />}

      {/* Floating glass form card */}
      <div
        ref={cardRef}
        onMouseMove={parallax.onMouseMove}
        onMouseEnter={parallax.onMouseEnter}
        onMouseLeave={parallax.onMouseLeave}
        className="relative z-10 w-full max-w-md animate-fade-in"
        style={{
          padding: 32,
          backdropFilter: 'blur(28px)',
          background: 'var(--card-bg)',
          borderRadius: 20,
          border: '1px solid var(--card-border)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4), 0 0 40px color-mix(in srgb, var(--input-focus-border) 8%, transparent)',
        }}
      >
        {/* Logo inside card */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-28 w-28 items-center justify-center" style={{ filter: 'drop-shadow(0 0 20px var(--input-focus-border))' }}>
            <AeroLogo size={110} />
          </div>
          <h1 className="text-2xl font-black tracking-tight" style={{ fontFamily: 'Inter, system-ui, sans-serif', color: 'var(--text-title)', letterSpacing: '-0.5px' }}>
            Aero<span style={{ color: 'var(--input-focus-border, #1a6fd4)' }}>Chat</span>
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Private. Fast. Beautiful.</p>
        </div>

        {children}
      </div>
    </div>
  );
}
