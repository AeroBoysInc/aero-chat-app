// src/components/servers/ServerView.tsx
import { memo, useEffect } from 'react';
import { ArrowLeft, Settings } from 'lucide-react';
import { useCornerStore } from '../../store/cornerStore';
import { useServerStore } from '../../store/serverStore';
import { useServerRoleStore } from '../../store/serverRoleStore';
import { BubbleHub } from './BubbleHub';

export const ServerView = memo(function ServerView() {
  const { serverView, exitToDMs, exitToHub } = useCornerStore();
  const { selectedServerId, selectedBubbleId, servers, members, loadServerData } = useServerStore();
  const { loadRoles } = useServerRoleStore();

  const server = servers.find(s => s.id === selectedServerId);

  useEffect(() => {
    if (selectedServerId) {
      loadServerData(selectedServerId);
      loadRoles(selectedServerId);
    }
  }, [selectedServerId]);

  if (!server) return null;

  const initial = server.name.charAt(0).toUpperCase();

  return (
    <div className="flex h-full flex-col overflow-hidden" style={{ background: 'var(--chat-bg)' }}>
      {/* Header */}
      <div
        className="flex items-center px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--panel-divider)' }}
      >
        <button
          onClick={serverView === 'bubble' ? exitToHub : exitToDMs}
          className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-70"
          style={{ color: 'var(--text-muted)' }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {serverView === 'bubble' ? 'Hub' : 'Back to DMs'}
        </button>

        <div className="flex-1 flex items-center justify-center gap-2">
          <div style={{
            width: 24, height: 24, borderRadius: 6, flexShrink: 0,
            background: server.icon_url ? `url(${server.icon_url}) center/cover` : 'linear-gradient(135deg, var(--sent-bubble-bg), var(--input-focus-border))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: 'white',
          }}>
            {!server.icon_url && initial}
          </div>
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {server.name}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {members.length} member{members.length !== 1 ? 's' : ''}
          </span>
          <button
            className="transition-opacity hover:opacity-70"
            style={{ color: 'var(--text-muted)' }}
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        <BubbleHub />
      </div>
    </div>
  );
});
