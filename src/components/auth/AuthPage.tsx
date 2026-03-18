import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';

export function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      {/* Glow orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/4 top-1/3 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-aero-cyan/15 blur-3xl" />
        <div className="absolute right-1/4 bottom-1/3 h-64 w-64 rounded-full bg-aero-blue/20 blur-3xl" />
      </div>

      <div className="glass-elevated w-full max-w-sm p-8 animate-fade-in">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/30 bg-gradient-to-br from-aero-cyan/60 to-aero-blue shadow-gloss">
            <MessageCircle className="h-7 w-7 text-white drop-shadow" />
            <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-white/30 to-transparent" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white text-shadow">
            Aero<span className="text-aero-cyan">Chat</span>
          </h1>
          <p className="mt-1 text-sm text-white/60">Private. Fast. Free.</p>
        </div>

        {/* Tab switcher */}
        <div className="mb-6 flex rounded-aero bg-white/10 p-1">
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 rounded-[8px] py-1.5 text-sm font-semibold capitalize transition-all duration-150 ${
                mode === m
                  ? 'bg-white/20 text-white shadow-glass'
                  : 'text-white/50 hover:text-white/80'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {mode === 'login' ? <LoginForm /> : <RegisterForm onSuccess={() => setMode('login')} />}
      </div>
    </div>
  );
}
