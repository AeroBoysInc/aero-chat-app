import { ReactNode } from 'react';
import { AeroLogo } from '../../ui/AeroLogo';

interface Props {
  children: ReactNode;
}

export function FreeAuthShell({ children }: Props) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      {/* Bokeh orbs — use theme accent colours */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="orb h-72 w-72 animate-pulse-glow" style={{ background: 'radial-gradient(circle, var(--input-focus-border) 0%, transparent 70%)', opacity: 0.25, left: '5%', top: '60%' }} />
        <div className="orb h-56 w-56 animate-pulse-glow" style={{ background: 'radial-gradient(circle, var(--sent-bubble-bg, rgba(80,210,80,0.22)) 0%, transparent 70%)', opacity: 0.2, left: '2%', top: '25%', animationDelay: '1s' }} />
        <div className="orb h-80 w-80 animate-pulse-glow" style={{ background: 'radial-gradient(circle, var(--input-focus-border) 0%, transparent 70%)', opacity: 0.2, right: '-4%', top: '5%', animationDelay: '0.5s' }} />
        <div className="orb h-52 w-52 animate-pulse-glow" style={{ background: 'radial-gradient(circle, var(--sent-bubble-bg, rgba(0,150,220,0.18)) 0%, transparent 70%)', opacity: 0.18, right: '5%', bottom: '10%', animationDelay: '1.8s' }} />
        {/* Horizontal light stripe */}
        <div
          className="absolute w-full h-px opacity-30"
          style={{ top: '40%', background: 'linear-gradient(90deg, transparent, var(--text-muted, rgba(255,255,255,0.9)), transparent)' }}
        />
      </div>

      <div className="glass-elevated w-full max-w-sm p-8 animate-fade-in">
        {/* Logo */}
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
  );
}
