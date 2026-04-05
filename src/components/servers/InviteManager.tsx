// src/components/servers/InviteManager.tsx
import { memo, useState, useEffect } from 'react';
import { Copy, Trash2, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useServerStore } from '../../store/serverStore';
import { useAuthStore } from '../../store/authStore';
import type { ServerInvite } from '../../lib/serverTypes';

function generateCode(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map(b => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 8);
}

export const InviteManager = memo(function InviteManager() {
  const user = useAuthStore(s => s.user);
  const { selectedServerId } = useServerStore();
  const [invites, setInvites] = useState<ServerInvite[]>([]);
  const [expiry, setExpiry] = useState<string>('24h');
  const [maxUses, setMaxUses] = useState<string>('unlimited');
  const [copied, setCopied] = useState<string | null>(null);

  const loadInvites = async () => {
    if (!selectedServerId) return;
    const { data } = await supabase
      .from('server_invites')
      .select('*')
      .eq('server_id', selectedServerId)
      .order('created_at', { ascending: false });
    if (data) setInvites(data);
  };

  useEffect(() => { loadInvites(); }, [selectedServerId]);

  const handleCreate = async () => {
    if (!selectedServerId || !user) return;
    const expiryMap: Record<string, string | null> = {
      '1h': new Date(Date.now() + 3600000).toISOString(),
      '24h': new Date(Date.now() + 86400000).toISOString(),
      '7d': new Date(Date.now() + 604800000).toISOString(),
      'never': null,
    };
    const usesMap: Record<string, number | null> = {
      '1': 1, '10': 10, '50': 50, 'unlimited': null,
    };
    await supabase.from('server_invites').insert({
      server_id: selectedServerId,
      created_by: user.id,
      code: generateCode(),
      expires_at: expiryMap[expiry],
      max_uses: usesMap[maxUses],
    });
    await loadInvites();
  };

  const handleRevoke = async (id: string) => {
    await supabase.from('server_invites').delete().eq('id', id);
    await loadInvites();
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Create invite */}
      <div className="flex items-center gap-2 flex-wrap">
        <select value={expiry} onChange={e => setExpiry(e.target.value)}
          className="rounded-aero px-2 py-1.5 text-xs"
          style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}>
          <option value="1h">Expires: 1 hour</option>
          <option value="24h">Expires: 24 hours</option>
          <option value="7d">Expires: 7 days</option>
          <option value="never">Never expires</option>
        </select>
        <select value={maxUses} onChange={e => setMaxUses(e.target.value)}
          className="rounded-aero px-2 py-1.5 text-xs"
          style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}>
          <option value="1">Max: 1 use</option>
          <option value="10">Max: 10 uses</option>
          <option value="50">Max: 50 uses</option>
          <option value="unlimited">Unlimited</option>
        </select>
        <button onClick={handleCreate}
          className="flex items-center gap-1 rounded-aero px-3 py-1.5 text-xs"
          style={{ background: 'rgba(0,212,255,0.12)', color: '#00d4ff' }}>
          <Plus className="h-3 w-3" /> Generate
        </button>
      </div>

      {/* Invite list */}
      {invites.map(inv => (
        <div key={inv.id} className="flex items-center gap-3 rounded-aero px-3 py-2" style={{ border: '1px solid var(--panel-divider)' }}>
          <code className="flex-1 text-xs font-mono" style={{ color: 'var(--text-primary)' }}>{inv.code}</code>
          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
            {inv.use_count}{inv.max_uses ? `/${inv.max_uses}` : ''} uses
          </span>
          <button onClick={() => handleCopy(inv.code)} className="transition-opacity hover:opacity-70" style={{ color: '#00d4ff' }}>
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => handleRevoke(inv.id)} className="transition-opacity hover:opacity-70" style={{ color: '#ff5032' }}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          {copied === inv.code && <span style={{ fontSize: 9, color: '#4fc97a' }}>Copied!</span>}
        </div>
      ))}
      {invites.length === 0 && (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: 12 }}>No active invites</p>
      )}
    </div>
  );
});
