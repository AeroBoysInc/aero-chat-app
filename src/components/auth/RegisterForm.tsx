import { useState } from 'react';
import { UserPlus, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { generateKeyPair, savePrivateKey } from '../../lib/crypto';

interface Props { onSuccess: () => void; }

export function RegisterForm({ onSuccess }: Props) {
  const [username, setUsername] = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Generate E2E keypair and persist the private key BEFORE signUp so that
    // the onAuthStateChange handler in App.tsx sees it and does not generate
    // a second keypair that would mismatch the public key we store in the profile.
    const { publicKey, privateKey } = generateKeyPair();

    // Create auth user
    const { data, error: authErr } = await supabase.auth.signUp({ email, password });
    if (authErr || !data.user) {
      setError(authErr?.message ?? 'Registration failed');
      setLoading(false);
      return;
    }

    // Scope private key to this user so multiple accounts on the same browser don't conflict
    savePrivateKey(privateKey, data.user.id);

    // Insert profile with public key
    const { error: profileErr } = await supabase.from('profiles').insert({
      id:         data.user.id,
      username:   username.trim(),
      public_key: publicKey,
    });

    if (profileErr) {
      setError(profileErr.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Username</label>
        <input className="aero-input" type="text" required minLength={2} value={username} onChange={e => setUsername(e.target.value)} placeholder="cooluser" />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Email</label>
        <input className="aero-input" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Password</label>
        <input className="aero-input" type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder="min 8 characters" />
      </div>
      {error && <p className="rounded-aero px-3 py-2 text-sm" style={{ background: 'rgba(220,60,60,0.10)', border: '1px solid rgba(200,60,60,0.30)', color: '#8a2020' }}>{error}</p>}
      <button type="submit" disabled={loading} className="aero-btn-primary mt-1 w-full py-3">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><UserPlus className="h-4 w-4" /> Create Account</>}
      </button>
      <p className="text-center text-xs" style={{ color: '#8ab4cc' }}>
        A unique encryption keypair is generated on your device. Your private key never leaves it.
      </p>
    </form>
  );
}
