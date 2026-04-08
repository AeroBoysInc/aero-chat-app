import { useState } from 'react';
import { useThemeStore, getThemeTier } from '../../store/themeStore';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import { FreeAuthShell } from './shells/FreeAuthShell';
import { PremiumAuthShell } from './shells/PremiumAuthShell';
import { UltraAuthShell } from './shells/UltraAuthShell';
import { MasterAuthShell } from './shells/MasterAuthShell';

const SHELLS = {
  free: FreeAuthShell,
  premium: PremiumAuthShell,
  ultra: UltraAuthShell,
  master: MasterAuthShell,
} as const;

function TabSwitcher({ mode, setMode }: { mode: 'login' | 'register'; setMode: (m: 'login' | 'register') => void }) {
  return (
    <div
      className="mb-6 flex rounded-aero p-1"
      style={{ background: 'var(--hover-bg, rgba(180,215,240,0.35))', border: '1px solid var(--panel-divider, rgba(180,215,240,0.60))' }}
    >
      {(['login', 'register'] as const).map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          className="flex-1 rounded-[10px] py-2 text-sm font-semibold capitalize transition-all duration-200"
          style={mode === m ? {
            background: 'var(--card-bg, linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(220,238,255,0.80) 100%))',
            boxShadow: 'var(--card-shadow, 0 2px 8px rgba(0,80,160,0.14))',
            border: '1px solid var(--card-border, rgba(180,215,240,0.80))',
            color: 'var(--text-primary)',
          } : {
            color: 'var(--text-muted)',
          }}
        >
          {m === 'login' ? 'Sign In' : 'Register'}
        </button>
      ))}
    </div>
  );
}

export function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const theme = useThemeStore(s => s.theme);
  const tier = getThemeTier(theme);
  const Shell = SHELLS[tier];

  return (
    <Shell>
      <TabSwitcher mode={mode} setMode={setMode} />
      {mode === 'login' ? <LoginForm /> : <RegisterForm onSuccess={() => setMode('login')} />}
    </Shell>
  );
}
