// src/components/servers/ServerOverlay.tsx
import { memo, useState, useEffect, useCallback } from 'react';
import { X, Plus, Link2, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useCornerStore } from '../../store/cornerStore';
import { useServerStore } from '../../store/serverStore';
import type { Server } from '../../lib/serverTypes';

function ServerCard({ server, onlineCount, unread, isOwner, onClick, onDelete }: {
  server: Server;
  onlineCount: number;
  unread: number;
  isOwner: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const initial = server.name.charAt(0).toUpperCase();

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="cursor-pointer overflow-hidden"
      style={{
        borderRadius: 14,
        border: '1px solid var(--panel-divider)',
        background: 'var(--sidebar-bg)',
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.3)' : 'none',
        transition: 'transform 0.2s, box-shadow 0.2s',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Banner — taller for vertical feel */}
      <div style={{ height: 100, position: 'relative', overflow: 'hidden' }}>
        {server.banner_url ? (
          <img src={server.banner_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, var(--sent-bubble-bg), var(--input-focus-border))` }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.4) 100%)' }} />
        {unread > 0 && (
          <div
            className="absolute flex items-center justify-center rounded-full"
            style={{
              top: 6, right: 6, minWidth: 18, height: 18, padding: '0 5px',
              background: '#ff2e63', fontSize: 9, fontWeight: 700, color: 'white',
            }}
          >
            {unread > 99 ? '99+' : unread}
          </div>
        )}
        {isOwner && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="absolute flex items-center justify-center rounded-full transition-all"
            style={{
              top: 6, left: 6, width: 24, height: 24,
              background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#ff5032',
              opacity: hovered ? 1 : 0,
              pointerEvents: hovered ? 'auto' : 'none',
              transform: hovered ? 'scale(1)' : 'scale(0.8)',
            }}
            title="Delete server"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Info — centered vertical layout */}
      <div style={{ padding: '0 12px 14px', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        {/* Icon overlapping banner */}
        <div style={{
          width: 36, height: 36, borderRadius: 10, marginTop: -18, flexShrink: 0,
          border: '2.5px solid var(--sidebar-bg)',
          background: server.icon_url ? `url(${server.icon_url}) center/cover` : `linear-gradient(135deg, var(--sent-bubble-bg), var(--input-focus-border))`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700, color: 'white',
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        }}>
          {!server.icon_url && initial}
        </div>
        <span className="truncate w-full mt-2 text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
          {server.name}
        </span>
        {server.description && (
          <p className="truncate w-full mt-0.5" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            {server.description}
          </p>
        )}
        <div className="mt-auto pt-2" style={{ fontSize: 9, color: 'var(--text-muted)' }}>
          <span style={{ color: onlineCount > 0 ? '#4fc97a' : undefined }}>{onlineCount} online</span>
        </div>
      </div>
    </div>
  );
}

export const ServerOverlay = memo(function ServerOverlay({
  onCreateClick,
  onJoinClick,
}: {
  onCreateClick: () => void;
  onJoinClick: () => void;
}) {
  const user = useAuthStore(s => s.user);
  const { closeServerOverlay, enterServer } = useCornerStore();
  const { servers, serverUnreads, selectServer, clearUnread, loadServers, removeServer } = useServerStore();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { loadServers(); }, []);

  const handleSelect = useCallback((server: Server) => {
    selectServer(server.id);
    clearUnread(server.id);
    enterServer();
  }, []);

  const handleDelete = useCallback(async (serverId: string) => {
    setDeleting(true);
    const { error } = await supabase.from('servers').delete().eq('id', serverId);
    if (!error) removeServer(serverId);
    setDeleting(false);
    setConfirmDeleteId(null);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') closeServerOverlay();
  }, []);

  return (
    <div
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      className="animate-fade-in"
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        backdropFilter: 'blur(20px)',
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 80, overflow: 'auto',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) closeServerOverlay(); }}
    >
      <div
        style={{
          width: '90%', maxWidth: 900, maxHeight: 'calc(100vh - 120px)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Your Servers</h2>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {servers.length} server{servers.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCreateClick}
              className="flex items-center gap-1.5 rounded-aero px-3 py-1.5 transition-opacity hover:opacity-80"
              style={{
                fontSize: 11, fontWeight: 500, color: '#00d4ff',
                background: 'rgba(0,212,255,0.12)', border: '1px solid rgba(0,212,255,0.25)',
              }}
            >
              <Plus className="h-3 w-3" /> Create
            </button>
            <button
              onClick={onJoinClick}
              className="flex items-center gap-1.5 rounded-aero px-3 py-1.5 transition-opacity hover:opacity-80"
              style={{
                fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)',
                background: 'rgba(255,255,255,0.06)', border: '1px solid var(--panel-divider)',
              }}
            >
              <Link2 className="h-3 w-3" /> Join via Link
            </button>
            <button
              onClick={closeServerOverlay}
              className="ml-1 rounded-full p-1.5 transition-opacity hover:opacity-70"
              style={{ color: 'var(--text-muted)' }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Server card grid — 5 per row */}
        <div
          className="overflow-y-auto"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 12,
            paddingBottom: 24,
          }}
        >
          {servers.map(server => (
            <ServerCard
              key={server.id}
              server={server}
              onlineCount={0}
              unread={serverUnreads[server.id] ?? 0}
              isOwner={server.owner_id === user?.id}
              onClick={() => handleSelect(server)}
              onDelete={() => setConfirmDeleteId(server.id)}
            />
          ))}
          {servers.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40 }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No servers yet</p>
              <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>
                Create one or join via an invite link
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {confirmDeleteId && (() => {
        const serverToDelete = servers.find(s => s.id === confirmDeleteId);
        return (
          <div
            className="animate-fade-in"
            style={{
              position: 'fixed', inset: 0, zIndex: 70,
              background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onClick={() => { if (!deleting) setConfirmDeleteId(null); }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                width: 400, borderRadius: 18, overflow: 'visible',
                background: 'var(--sidebar-bg)', border: '1px solid var(--panel-divider)',
                boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
                position: 'relative',
              }}
            >
              {/* Floating badge — half in, half out */}
              <div style={{
                position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)',
                background: '#ff5032', borderRadius: 12, padding: '6px 18px',
                boxShadow: '0 4px 16px rgba(255,80,50,0.4)',
                display: 'flex', alignItems: 'center', gap: 6,
                whiteSpace: 'nowrap',
              }}>
                <Trash2 className="h-3.5 w-3.5" style={{ color: 'white' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: 'white', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Crucial — Irreversible
                </span>
              </div>

              {/* Body */}
              <div style={{ padding: '40px 28px 24px', textAlign: 'center' }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                  Delete Server
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  You are about to permanently delete
                </p>
                <p style={{
                  fontSize: 15, fontWeight: 700, color: 'var(--text-primary)',
                  margin: '8px 0 12px',
                  padding: '6px 14px', borderRadius: 10,
                  background: 'rgba(255,80,50,0.08)', border: '1px solid rgba(255,80,50,0.15)',
                  display: 'inline-block',
                }}>
                  {serverToDelete?.name}
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, marginTop: 4 }}>
                  All bubbles, messages, roles, members, and invites will be removed forever. This action cannot be undone.
                </p>

                {/* Centered buttons */}
                <div className="flex justify-center gap-3" style={{ marginTop: 24 }}>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    disabled={deleting}
                    className="rounded-aero px-5 py-2 text-xs font-medium transition-all hover:opacity-80 disabled:opacity-40"
                    style={{
                      color: 'var(--text-secondary)',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid var(--panel-divider)',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDelete(confirmDeleteId)}
                    disabled={deleting}
                    className="rounded-aero px-5 py-2 text-xs font-medium transition-all hover:opacity-90 disabled:opacity-40"
                    style={{
                      background: '#ff5032', color: 'white',
                      boxShadow: '0 2px 12px rgba(255,80,50,0.35)',
                    }}
                  >
                    {deleting ? 'Deleting...' : 'Delete Server'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
});
