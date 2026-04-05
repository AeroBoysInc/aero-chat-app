// src/components/servers/JoinServerModal.tsx
import { memo, useState } from 'react';
import { X, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useServerStore } from '../../store/serverStore';
import { useCornerStore } from '../../store/cornerStore';
import type { Server, ServerInvite } from '../../lib/serverTypes';

export const JoinServerModal = memo(function JoinServerModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const user = useAuthStore(s => s.user);
  const { addServer, selectServer, loadServerData } = useServerStore();
  const { enterServer } = useCornerStore();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{ server: Server; invite: ServerInvite } | null>(null);

  const handleLookup = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    try {
      const { data: invite, error: iErr } = await supabase
        .from('server_invites')
        .select('*')
        .eq('code', code.trim())
        .single();
      if (iErr || !invite) throw new Error('Invite not found');

      if (invite.expires_at && new Date(invite.expires_at) < new Date()) throw new Error('This invite has expired');
      if (invite.max_uses && invite.use_count >= invite.max_uses) throw new Error('This invite has reached its use limit');

      const { data: server, error: sErr } = await supabase
        .from('servers')
        .select('*')
        .eq('id', invite.server_id)
        .single();
      if (sErr || !server) throw new Error('Server not found');

      setPreview({ server, invite });
    } catch (err: any) {
      setError(err.message ?? 'Invalid invite');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!user || !preview) return;
    setLoading(true);
    setError('');
    try {
      // Find default Member role
      const { data: memberRole } = await supabase
        .from('server_roles')
        .select('id')
        .eq('server_id', preview.server.id)
        .eq('is_owner_role', false)
        .order('position', { ascending: true })
        .limit(1)
        .single();
      if (!memberRole) throw new Error('No member role found');

      // Insert membership
      const { error: mErr } = await supabase
        .from('server_members')
        .insert({ server_id: preview.server.id, user_id: user.id, role_id: memberRole.id });
      if (mErr) throw new Error(mErr.message.includes('duplicate') ? 'You are already a member' : mErr.message);

      // Increment use_count
      await supabase
        .from('server_invites')
        .update({ use_count: preview.invite.use_count + 1 })
        .eq('id', preview.invite.id);

      // Navigate
      addServer(preview.server);
      selectServer(preview.server.id);
      await loadServerData(preview.server.id);
      enterServer();
      onClose();
    } catch (err: any) {
      setError(err.message ?? 'Failed to join');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="animate-fade-in"
      style={{ position: 'fixed', inset: 0, zIndex: 60, backdropFilter: 'blur(24px)', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ width: 400, borderRadius: 18, background: 'var(--sidebar-bg)', border: '1px solid var(--panel-divider)', overflow: 'hidden' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--panel-divider)' }}>
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Join a Server</h3>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}><X className="h-4 w-4" /></button>
        </div>

        <div className="px-5 py-4">
          {!preview ? (
            <div className="flex flex-col gap-3">
              <label style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>Invite Code</label>
              <div className="flex gap-2">
                <input
                  style={{
                    flex: 1, padding: '10px 12px', borderRadius: 10, fontSize: 13,
                    background: 'var(--input-bg)', border: '1px solid var(--input-border)',
                    color: 'var(--text-primary)', outline: 'none',
                  }}
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  placeholder="Paste invite code..."
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleLookup()}
                />
                <button
                  onClick={handleLookup}
                  disabled={loading || !code.trim()}
                  className="flex items-center gap-1 rounded-aero px-3 py-1.5 text-xs font-medium disabled:opacity-40"
                  style={{ background: 'rgba(0,212,255,0.15)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.3)' }}
                >
                  {loading ? '...' : <><ArrowRight className="h-3 w-3" /> Look up</>}
                </button>
              </div>
              {error && <p style={{ fontSize: 11, color: '#ff5032' }}>{error}</p>}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* Server preview */}
              <div className="overflow-hidden" style={{ borderRadius: 12, border: '1px solid var(--panel-divider)' }}>
                <div style={{ height: 60, background: preview.server.banner_url ? `url(${preview.server.banner_url}) center/cover` : 'linear-gradient(135deg, var(--sent-bubble-bg), var(--input-focus-border))' }} />
                <div className="p-3">
                  <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{preview.server.name}</p>
                  {preview.server.description && (
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{preview.server.description}</p>
                  )}
                </div>
              </div>
              {error && <p style={{ fontSize: 11, color: '#ff5032' }}>{error}</p>}
              <button
                onClick={handleJoin}
                disabled={loading}
                className="w-full rounded-aero py-2 text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ background: 'rgba(0,212,255,0.15)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.3)' }}
              >
                {loading ? 'Joining...' : 'Join Server'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
