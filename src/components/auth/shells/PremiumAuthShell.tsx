import { ReactNode } from 'react';
import { AeroLogo } from '../../ui/AeroLogo';

interface Props {
  children: ReactNode;
}

export function PremiumAuthShell({ children }: Props) {
  return (
    <div className="flex min-h-screen">
      {/* ── Left panel: Ambient Art (55%) ── */}
      <div
        className="relative hidden md:flex w-[55%] items-center justify-center overflow-hidden"
        style={{ background: 'linear-gradient(180deg, var(--sidebar-bg), transparent)' }}
      >
        {/* Drifting orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="orb" style={{
            position: 'absolute', width: 180, height: 180, top: '10%', left: '15%',
            background: 'radial-gradient(circle, var(--input-focus-border) 0%, transparent 70%)',
            opacity: 0.25, animation: 'orb-drift 8s ease-in-out infinite',
          }} />
          <div className="orb" style={{
            position: 'absolute', width: 140, height: 140, bottom: '20%', left: '40%',
            background: 'radial-gradient(circle, var(--sent-bubble-bg, rgba(120,80,255,0.18)) 0%, transparent 70%)',
            opacity: 0.2, animation: 'orb-drift 10s ease-in-out 2s infinite',
          }} />
          <div className="orb" style={{
            position: 'absolute', width: 200, height: 200, top: '40%', left: '5%',
            background: 'radial-gradient(circle, var(--input-focus-border) 0%, transparent 70%)',
            opacity: 0.15, animation: 'orb-drift 7s ease-in-out 4s infinite',
          }} />

          {/* Floating particles */}
          {[
            { left: '20%', bottom: '10%', delay: 0 },
            { left: '35%', bottom: '5%', delay: 1.2 },
            { left: '55%', bottom: '15%', delay: 2.4 },
            { left: '70%', bottom: '8%', delay: 0.8 },
            { left: '45%', bottom: '20%', delay: 3.2 },
            { left: '15%', bottom: '25%', delay: 1.8 },
          ].map((p, i) => (
            <div key={i} className="particle-rise-anim" style={{
              position: 'absolute', width: 4, height: 4, borderRadius: '50%',
              background: 'var(--input-focus-border)', opacity: 0.5,
              left: p.left, bottom: p.bottom,
              animation: `particle-rise 8s ease-out ${p.delay}s infinite`,
            }} />
          ))}
        </div>

        {/* Centered logo + text */}
        <div className="relative z-10 text-center">
          <div style={{ filter: 'drop-shadow(0 0 20px var(--input-focus-border))' }}>
            <AeroLogo size={48} />
          </div>
          <h1
            className="mt-3 text-2xl font-black tracking-tight"
            style={{ color: 'var(--text-primary)', fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '-0.5px' }}
          >
            AeroChat
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            Private. Fast. Beautiful.
          </p>
        </div>
      </div>

      {/* ── Vertical divider ── */}
      <div
        className="divider-pulse-anim hidden md:block w-px self-stretch my-[10%]"
        style={{
          background: 'linear-gradient(180deg, transparent, var(--input-focus-border) 30%, var(--input-focus-border) 70%, transparent)',
          opacity: 0.25,
          animation: 'divider-pulse 3s ease-in-out infinite',
        }}
      />

      {/* ── Right panel: Glass Form (45%) ── */}
      <div
        className="flex flex-1 items-center justify-center p-8"
        style={{ background: 'var(--sidebar-bg)', backdropFilter: 'blur(20px)' }}
      >
        <div className="w-full max-w-sm animate-fade-in">
          {children}
        </div>
      </div>

      {/* ── Mobile fallback: centered card (uses premium orb colors) ── */}
      <div className="flex md:hidden min-h-screen items-center justify-center p-4 absolute inset-0">
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="orb" style={{
            position: 'absolute', width: 200, height: 200, top: '15%', left: '5%',
            background: 'radial-gradient(circle, var(--input-focus-border) 0%, transparent 70%)',
            opacity: 0.25, animation: 'orb-drift 8s ease-in-out infinite',
          }} />
          <div className="orb" style={{
            position: 'absolute', width: 160, height: 160, bottom: '20%', right: '10%',
            background: 'radial-gradient(circle, var(--sent-bubble-bg, rgba(120,80,255,0.18)) 0%, transparent 70%)',
            opacity: 0.2, animation: 'orb-drift 9s ease-in-out 2s infinite',
          }} />
        </div>
        <div className="glass-elevated w-full max-w-sm p-8 animate-fade-in relative z-10">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center animate-float">
              <AeroLogo size={58} />
            </div>
            <h1 className="text-2xl font-black tracking-tight" style={{ fontFamily: 'Inter, system-ui, sans-serif', color: 'var(--text-title)', letterSpacing: '-0.5px' }}>
              Aero<span style={{ color: 'var(--input-focus-border, #1a6fd4)' }}>Chat</span>
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Private. Fast. Beautiful.</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
