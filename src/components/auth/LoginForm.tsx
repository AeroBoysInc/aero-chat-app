import { useState } from 'react';
import { LogIn, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { setPendingPassword } from '../../lib/keyRestoration';
export function LoginForm() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Make the password available to App.tsx's resolveSession so it can decrypt
    // the stored encrypted private key blob on a new device.
    setPendingPassword(password);
    const { data, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
    if (authErr || !data.user) {
      setError(authErr?.message ?? 'Login failed');
      setLoading(false);
      return;
    }

    // Keypair generation and profile loading are handled by App.tsx's
    // onAuthStateChange, which fires automatically after signInWithPassword.
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Email</label>
        <input className="aero-input" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Password</label>
        <input className="aero-input" type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
      </div>
      {error && <p className="rounded-aero px-3 py-2 text-sm" style={{ background: 'rgba(220,60,60,0.10)', border: '1px solid rgba(200,60,60,0.30)', color: '#8a2020' }}>{error}</p>}
      <button type="submit" disabled={loading} className="aero-btn-primary mt-1 w-full py-3">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><LogIn className="h-4 w-4" /> Sign In</>}
      </button>
    </form>
  );
}
