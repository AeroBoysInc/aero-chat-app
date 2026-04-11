// src/components/servers/toolkits/ToolkitTab.tsx
import { memo, useState } from 'react';
import { useAuthStore } from '../../../store/authStore';
import { useServerStore } from '../../../store/serverStore';
import { useServerRoleStore } from '../../../store/serverRoleStore';
import { supabase } from '../../../lib/supabase';
import { ToolkitInfoModal } from './ToolkitInfoModal';

export const ToolkitTab = memo(function ToolkitTab() {
  const user = useAuthStore(s => s.user);
  const { selectedServerId, servers, activeToolkit, loadServerData } = useServerStore();
  const { roles, loadRoles } = useServerRoleStore();
  const [infoOpen, setInfoOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const server = servers.find(s => s.id === selectedServerId);
  const isOwner = server?.owner_id === user?.id;
  const isPremium = user?.is_premium === true;
  const isActive = !!activeToolkit;

  const handleActivate = async () => {
    if (!selectedServerId || !user || !isOwner || !isPremium) return;
    setLoading(true);
    try {
      // 1. Insert toolkit activation
      const { error } = await supabase.from('server_toolkits').insert({
        server_id: selectedServerId,
        toolkit_id: 'dnd',
        activated_by: user.id,
      });
      if (error) { console.error('[ToolkitTab] Activate failed:', error); return; }

      // 2. Grant dungeon_master to Owner role
      const ownerRole = roles.find(r => r.is_owner_role);
      if (ownerRole) {
        await supabase.from('server_role_permissions')
          .update({ dungeon_master: true })
          .eq('role_id', ownerRole.id);
      }

      // 3. Refresh data
      await Promise.all([loadServerData(selectedServerId), loadRoles(selectedServerId)]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async () => {
    if (!selectedServerId || !isOwner) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('server_toolkits')
        .delete()
        .eq('server_id', selectedServerId);
      if (error) { console.error('[ToolkitTab] Deactivate failed:', error); return; }
      await loadServerData(selectedServerId);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
        Toolkits transform your server with specialized features. Premium server owners can activate them for free — all members benefit.
      </p>

      {/* Dungeons & Servers card */}
      <div style={{
        padding: 20, borderRadius: 16, position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(145deg, rgba(139,69,19,0.10), rgba(255,215,0,0.05))',
        border: '1px solid rgba(139,69,19,0.20)',
      }}>
        {/* Decorative icon */}
        <div style={{ position: 'absolute', top: -20, right: -20, fontSize: 80, opacity: 0.05, pointerEvents: 'none' }}>⚔️</div>

        <div className="flex items-center gap-3" style={{ marginBottom: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: 'linear-gradient(135deg, #8B4513, #D2691E)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
          }}>🐉</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>Dungeons & Servers</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>DnD Campaign Toolkit</div>
          </div>
          {isActive ? (
            <span style={{
              padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
              background: 'rgba(76,175,80,0.15)', color: '#4CAF50', border: '1px solid rgba(76,175,80,0.25)',
            }}>ACTIVE</span>
          ) : (
            <span style={{
              padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
              background: 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,165,0,0.10))',
              color: '#FFD700', border: '1px solid rgba(255,215,0,0.25)',
            }}>PREMIUM</span>
          )}
        </div>

        <p style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)', marginBottom: 14 }}>
          Transform your server into a DnD campaign hub. Character cards from D&D Beyond, interactive world maps, quest tracking, dice rolls, and DM tools — all wrapped in a medieval-accented UI.
        </p>

        {/* Feature tags */}
        <div className="flex flex-wrap gap-1.5" style={{ marginBottom: 16 }}>
          {['Character Cards', 'World Map', 'Quest Log', 'Dice Roller', 'DM Notebook'].map(tag => (
            <span key={tag} style={{
              padding: '2px 8px', borderRadius: 6, fontSize: 10,
              background: 'rgba(139,69,19,0.08)', border: '1px solid rgba(139,69,19,0.15)',
              color: 'var(--text-muted)',
            }}>{tag}</span>
          ))}
        </div>

        {/* Buttons */}
        <div className="flex gap-2.5">
          <button
            onClick={() => setInfoOpen(true)}
            className="flex-1 transition-all active:scale-[0.98]"
            style={{
              padding: '9px 0', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: 'rgba(139,69,19,0.06)',
              border: '1px solid rgba(139,69,19,0.20)',
              color: 'var(--text-secondary)',
            }}
          >
            More Info
          </button>
          {isOwner && isPremium && !isActive && (
            <button
              onClick={handleActivate}
              disabled={loading}
              className="flex-1 transition-all active:scale-[0.98] disabled:opacity-50"
              style={{
                padding: '9px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                background: 'linear-gradient(135deg, #8B4513, #D2691E)',
                border: 'none', color: '#fff',
              }}
            >
              {loading ? 'Activating…' : 'Activate Toolkit'}
            </button>
          )}
          {isOwner && isActive && (
            <button
              onClick={handleDeactivate}
              disabled={loading}
              className="flex-1 transition-all active:scale-[0.98] disabled:opacity-50"
              style={{
                padding: '9px 0', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: 'rgba(220,60,60,0.08)',
                border: '1px solid rgba(220,60,60,0.20)',
                color: '#cc4444',
              }}
            >
              {loading ? 'Deactivating…' : 'Deactivate'}
            </button>
          )}
          {isOwner && !isPremium && !isActive && (
            <button
              className="flex-1"
              style={{
                padding: '9px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'not-allowed',
                background: 'rgba(139,69,19,0.08)', border: '1px solid rgba(139,69,19,0.12)',
                color: 'var(--text-muted)', opacity: 0.6,
              }}
              disabled
            >
              Requires Aero+
            </button>
          )}
          {!isOwner && !isActive && (
            <span style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center' }}>
              Only the server owner can activate toolkits
            </span>
          )}
        </div>
      </div>

      {infoOpen && <ToolkitInfoModal onClose={() => setInfoOpen(false)} />}
    </div>
  );
});
