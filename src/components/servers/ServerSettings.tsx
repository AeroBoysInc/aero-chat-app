// src/components/servers/ServerSettings.tsx
import { memo, useState } from 'react';
import { X } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useServerStore } from '../../store/serverStore';
import { useServerRoleStore } from '../../store/serverRoleStore';
import { RoleEditor } from './RoleEditor';
import { MemberList } from './MemberList';
import { BubbleManager } from './BubbleManager';
import { InviteManager } from './InviteManager';
import { ServerEvents } from './ServerEvents';
import { ToolkitTab } from './toolkits/ToolkitTab';

type Tab = 'roles' | 'members' | 'bubbles' | 'invites' | 'events' | 'toolkits';

export const ServerSettings = memo(function ServerSettings({
  onClose,
}: {
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>('roles');
  const user = useAuthStore(s => s.user);
  const { selectedServerId, members } = useServerStore();
  const { hasPermission } = useServerRoleStore();

  const can = (perm: string) =>
    user && selectedServerId
      ? hasPermission(selectedServerId, user.id, members, perm as any)
      : false;

  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: 'roles', label: 'Roles', show: can('manage_roles') },
    { id: 'members', label: 'Members', show: true },
    { id: 'bubbles', label: 'Bubbles', show: can('manage_bubbles') },
    { id: 'invites', label: 'Invites', show: can('send_invites') },
    { id: 'events', label: 'Events', show: true },
    { id: 'toolkits', label: '✦ Toolkits', show: true },
  ];

  const visibleTabs = tabs.filter(t => t.show);

  return (
    <div
      className="animate-fade-in"
      style={{ position: 'fixed', inset: 0, zIndex: 55, backdropFilter: 'blur(20px)', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ width: 560, maxHeight: '80vh', borderRadius: 18, background: 'var(--sidebar-bg)', border: '1px solid var(--panel-divider)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--panel-divider)' }}>
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Server Settings</h3>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}><X className="h-4 w-4" /></button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--panel-divider)' }}>
          {visibleTabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="rounded-aero px-3 py-1.5 text-xs font-medium transition-all"
              style={{
                background: tab === t.id ? 'rgba(0,212,255,0.12)' : 'transparent',
                color: tab === t.id ? '#00d4ff' : 'var(--text-muted)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === 'roles' && <RoleEditor />}
          {tab === 'members' && <MemberList />}
          {tab === 'bubbles' && <BubbleManager />}
          {tab === 'invites' && <InviteManager />}
          {tab === 'events' && <ServerEvents />}
          {tab === 'toolkits' && <ToolkitTab />}
        </div>
      </div>
    </div>
  );
});
