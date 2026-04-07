import { memo, useMemo, useState, useCallback } from 'react';
import { Search } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { AvatarImage, type Status } from '../ui/AvatarImage';
import { useFriendStore } from '../../store/friendStore';
import { usePresenceStore } from '../../store/presenceStore';
import { useUnreadStore } from '../../store/unreadStore';
import type { Profile } from '../../store/authStore';

interface CompactSidebarProps {
  selectedUserId: string | null;
  onSelectUser: (user: Profile) => void;
}

export const CompactSidebar = memo(function CompactSidebar({ selectedUserId, onSelectUser }: CompactSidebarProps) {
  const friends = useFriendStore(useShallow(s => s.friends));
  const onlineIds = usePresenceStore(s => s.onlineIds);
  const presenceReady = usePresenceStore(s => s.presenceReady);
  const unreads = useUnreadStore(s => s.unreads);
  const clear = useUnreadStore(s => s.clear);
  const [query, setQuery] = useState('');

  const sortedFriends = useMemo(() => {
    const arr = [...friends];
    arr.sort((a, b) => {
      const aOnline = presenceReady ? onlineIds.has(a.id) : true;
      const bOnline = presenceReady ? onlineIds.has(b.id) : true;
      if (aOnline !== bOnline) return aOnline ? -1 : 1;
      const aUnread = unreads[a.id] ?? 0;
      const bUnread = unreads[b.id] ?? 0;
      if (aUnread !== bUnread) return bUnread - aUnread;
      return 0;
    });
    if (query) {
      const q = query.toLowerCase();
      return arr.filter(f => f.username.toLowerCase().includes(q));
    }
    return arr;
  }, [friends, onlineIds, presenceReady, unreads, query]);

  const handleSelect = useCallback((friend: Profile) => {
    onSelectUser(friend);
    if (unreads[friend.id]) clear(friend.id);
  }, [onSelectUser, unreads, clear]);

  return (
    <div style={{
      width: 200, flexShrink: 0,
      borderRight: '1px solid rgba(0,230,118,0.08)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Search */}
      <div style={{ padding: '8px 8px 4px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          height: 26, borderRadius: 8,
          background: 'rgba(0,230,118,0.04)',
          border: '1px solid rgba(0,230,118,0.10)',
          padding: '0 8px',
        }}>
          <Search style={{ width: 11, height: 11, color: 'rgba(0,230,118,0.25)', flexShrink: 0 }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search..."
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: 10, color: 'rgba(255,255,255,0.55)',
            }}
          />
        </div>
      </div>

      {/* Friend list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {sortedFriends.map(friend => {
          const isActive = friend.id === selectedUserId;
          const unread = unreads[friend.id] ?? 0;
          const isOnline = presenceReady ? onlineIds.has(friend.id) : true;
          const effective: Status = isOnline ? ((friend.status as Status) ?? 'online') : 'offline';

          return (
            <button
              key={friend.id}
              onClick={() => handleSelect(friend)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '7px 10px',
                background: isActive ? 'rgba(0,230,118,0.08)' : 'transparent',
                borderLeft: isActive ? '2px solid rgba(0,230,118,0.50)' : '2px solid transparent',
                border: 'none', cursor: 'pointer', outline: 'none',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(0,230,118,0.05)'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              <AvatarImage
                username={friend.username}
                avatarUrl={friend.avatar_url}
                size="sm"
                status={effective}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 10, fontWeight: 600,
                  color: isActive ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.50)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {friend.username}
                </div>
              </div>
              {unread > 0 && (
                <span style={{
                  fontSize: 8, fontWeight: 700,
                  background: 'rgba(0,230,118,0.22)', color: '#00e676',
                  padding: '1px 5px', borderRadius: 6, flexShrink: 0,
                }}>
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
});
