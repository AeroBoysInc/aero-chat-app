// src/components/servers/ServerOverlay.tsx
import { memo, useState, useEffect, useCallback } from 'react';
import { X, Plus, Link2 } from 'lucide-react';
import { useCornerStore } from '../../store/cornerStore';
import { useServerStore } from '../../store/serverStore';
import type { Server } from '../../lib/serverTypes';

function ServerCard({ server, onlineCount, unread, onClick }: {
  server: Server;
  onlineCount: number;
  unread: number;
  onClick: () => void;
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
      {/* Banner */}
      <div style={{ height: 80, position: 'relative', overflow: 'hidden' }}>
        {server.banner_url ? (
          <img src={server.banner_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, var(--sent-bubble-bg), var(--input-focus-border))` }} />
        )}
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
      </div>

      {/* Info */}
      <div style={{ padding: '10px 12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div className="flex items-center gap-2">
          <div style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0, marginTop: -20,
            border: '2px solid var(--sidebar-bg)',
            background: server.icon_url ? `url(${server.icon_url}) center/cover` : `linear-gradient(135deg, var(--sent-bubble-bg), var(--input-focus-border))`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: 'white',
          }}>
            {!server.icon_url && initial}
          </div>
          <span className="truncate text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
            {server.name}
          </span>
        </div>
        {server.description && (
          <p className="mt-1 truncate" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
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
  const { closeServerOverlay, enterServer } = useCornerStore();
  const { servers, serverUnreads, selectServer, clearUnread, loadServers } = useServerStore();

  useEffect(() => { loadServers(); }, []);

  const handleSelect = useCallback((server: Server) => {
    selectServer(server.id);
    clearUnread(server.id);
    enterServer();
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
              onClick={() => handleSelect(server)}
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
    </div>
  );
});
