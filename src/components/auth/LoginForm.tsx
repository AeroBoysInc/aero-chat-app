import { useState } from 'react';
import { LogIn, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';

export function LoginForm() {
  const setUser = useAuthStore((s) => s.setUser);
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
    if (authErr || !data.user) {
      setError(authErr?.message ?? 'Login failed');
      setLoading(false);
      return;
    }

    // Load profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, username, public_key')
      .eq('id', data.user.id)
      .single();

    if (profile) setUser(profile);

    // Private key should already be in localStorage from registration.
    // If on a new device, the user would need to re-import — for v0.1 we skip that flow.
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-white/70 uppercase tracking-wide">Email</label>
        <input className="aero-input" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-white/70 uppercase tracking-wide">Password</label>
        <input className="aero-input" type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
      </div>
      {error && <p className="rounded-aero bg-aero-red/15 border border-aero-red/30 px-3 py-2 text-sm text-aero-red">{error}</p>}
      <button type="submit" disabled={loading} className="aero-btn-primary mt-1 w-full py-3">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><LogIn className="h-4 w-4" /> Sign In</>}
      </button>
    </form>
  );
}
