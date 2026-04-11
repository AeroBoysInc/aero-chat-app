// src/components/servers/toolkits/DndTabBar.tsx
import { memo } from 'react';
import { useServerRoleStore } from '../../../store/serverRoleStore';
import { useServerStore } from '../../../store/serverStore';
import { useAuthStore } from '../../../store/authStore';

export type DndTab = 'bubbles' | 'characters' | 'worldmap' | 'quests' | 'dm-notes';

const TAB_ITEMS: { id: DndTab; label: string; icon: string; dmOnly?: boolean }[] = [
  { id: 'bubbles',    label: 'Bubbles',    icon: '💬' },
  { id: 'characters', label: 'Characters', icon: '🃏' },
  { id: 'worldmap',   label: 'World Map',  icon: '🗺️' },
  { id: 'quests',     label: 'Quests',     icon: '📜' },
  { id: 'dm-notes',   label: 'DM Notes',   icon: '📖', dmOnly: true },
];

export const DndTabBar = memo(function DndTabBar({
  activeTab,
  onTabChange,
}: {
  activeTab: DndTab;
  onTabChange: (tab: DndTab) => void;
}) {
  const user = useAuthStore(s => s.user);
  const { selectedServerId, members } = useServerStore();
  const { hasPermission } = useServerRoleStore();

  const isDm = user && selectedServerId
    ? hasPermission(selectedServerId, user.id, members, 'dungeon_master')
    : false;

  const visibleTabs = TAB_ITEMS.filter(t => !t.dmOnly || isDm);

  return (
    <div
      className="flex gap-1 px-3 py-1.5 flex-shrink-0 overflow-x-auto scrollbar-none"
      style={{ borderBottom: '1px solid var(--tk-border, var(--panel-divider))' }}
    >
      {visibleTabs.map(t => (
        <button
          key={t.id}
          onClick={() => onTabChange(t.id)}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap"
          style={{
            background: activeTab === t.id ? 'var(--tk-accent-glow, rgba(0,212,255,0.12))' : 'transparent',
            color: activeTab === t.id ? 'var(--tk-accent-light, #00d4ff)' : 'var(--tk-text-muted, var(--text-muted))',
            border: activeTab === t.id ? '1px solid var(--tk-border, rgba(0,212,255,0.2))' : '1px solid transparent',
          }}
        >
          <span style={{ fontSize: 13 }}>{t.icon}</span>
          {t.label}
        </button>
      ))}
    </div>
  );
});
