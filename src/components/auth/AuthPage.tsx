import { useState } from 'react';
import { AeroLogo } from '../ui/AeroLogo';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';

export function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      {/* Extra bokeh orbs layered on the auth screen */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="orb h-72 w-72 animate-pulse-glow" style={{ background: 'rgba(255,180,40,0.30)', left: '5%', top: '60%' }} />
        <div className="orb h-56 w-56 animate-pulse-glow" style={{ background: 'rgba(80,210,80,0.22)', left: '2%', top: '25%', animationDelay: '1s' }} />
        <div className="orb h-80 w-80 animate-pulse-glow" style={{ background: 'rgba(0,185,255,0.22)', right: '-4%', top: '5%', animationDelay: '0.5s' }} />
        <div className="orb h-52 w-52 animate-pulse-glow" style={{ background: 'rgba(0,150,220,0.18)', right: '5%', bottom: '10%', animationDelay: '1.8s' }} />
        {/* Horizontal light stripe */}
        <div
          className="absolute w-full h-px opacity-30"
          style={{ top: '40%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)' }}
        />
      </div>

      <div className="glass-elevated w-full max-w-sm p-8 animate-fade-in">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center animate-float">
            <AeroLogo size={58} />
          </div>
          <h1 className="text-2xl font-black tracking-tight" style={{ fontFamily: 'Inter, system-ui, sans-serif', color: 'var(--text-title)', letterSpacing: '-0.5px' }}>
            Aero<span style={{ color: '#1a6fd4' }}>Chat</span>
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Private. Fast. Beautiful.</p>
        </div>

        {/* Tab switcher */}
        <div
          className="mb-6 flex rounded-aero p-1"
          style={{ background: 'rgba(180,215,240,0.35)', border: '1px solid rgba(180,215,240,0.60)' }}
        >
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="flex-1 rounded-[10px] py-2 text-sm font-semibold capitalize transition-all duration-200"
              style={mode === m ? {
                background: 'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(220,238,255,0.80) 100%)',
                boxShadow: '0 2px 8px rgba(0,80,160,0.14), inset 0 1px 0 rgba(255,255,255,1)',
                border: '1px solid rgba(180,215,240,0.80)',
                color: 'var(--text-title)',
              } : {
                color: 'var(--text-muted)',
              }}
            >
              {m === 'login' ? 'Sign In' : 'Register'}
            </button>
          ))}
        </div>

        {mode === 'login' ? <LoginForm /> : <RegisterForm onSuccess={() => setMode('login')} />}
      </div>
    </div>
  );
}
