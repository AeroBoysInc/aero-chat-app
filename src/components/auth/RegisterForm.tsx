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

    // Generate E2E keypair
    const { publicKey, privateKey } = generateKeyPair();

    // Create auth user
    const { data, error: authErr } = await supabase.auth.signUp({ email, password });
    if (authErr || !data.user) {
      setError(authErr?.message ?? 'Registration failed');
      setLoading(false);
      return;
    }

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

    // Save private key locally
    savePrivateKey(privateKey);
    setLoading(false);
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-white/70 uppercase tracking-wide">Username</label>
        <input className="aero-input" type="text" required minLength={2} value={username} onChange={e => setUsername(e.target.value)} placeholder="cooluser" />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-white/70 uppercase tracking-wide">Email</label>
        <input className="aero-input" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-white/70 uppercase tracking-wide">Password</label>
        <input className="aero-input" type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder="min 8 characters" />
      </div>
      {error && <p className="rounded-aero bg-aero-red/15 border border-aero-red/30 px-3 py-2 text-sm text-aero-red">{error}</p>}
      <button type="submit" disabled={loading} className="aero-btn-primary mt-1 w-full py-3">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><UserPlus className="h-4 w-4" /> Create Account</>}
      </button>
      <p className="text-center text-xs text-white/40">
        A unique encryption keypair is generated on your device. Your private key never leaves it.
      </p>
    </form>
  );
}
