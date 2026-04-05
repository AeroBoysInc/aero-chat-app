// src/components/servers/InviteManager.tsx
import { memo, useState, useMemo } from 'react';
import { Send, Check, Search } from 'lucide-react';
import { useServerStore, insertServerInviteMessage } from '../../store/serverStore';
import { useAuthStore } from '../../store/authStore';
import { useFriendStore } from '../../store/friendStore';
import { AvatarImage } from '../ui/AvatarImage';

export const InviteManager = memo(function InviteManager() {
  const user = useAuthStore(s => s.user);
  const { selectedServerId, servers, members } = useServerStore();
  const friends = useFriendStore(s => s.friends);
  const [search, setSearch] = useState('');
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState<string | null>(null);

  const server = servers.find(s => s.id === selectedServerId);

  // Filter friends: exclude those already members, then by search
  const filteredFriends = useMemo(() => {
    const memberIds = new Set(members.map(m => m.user_id));
    return friends
      .filter(f => !memberIds.has(f.id))
      .filter(f => !search || f.username.toLowerCase().includes(search.toLowerCase()));
  }, [friends, members, search]);

  const alreadyMembers = useMemo(() => {
    const memberIds = new Set(members.map(m => m.user_id));
    return friends.filter(f => memberIds.has(f.id));
  }, [friends, members]);

  const handleSendInvite = async (friendId: string) => {
    if (!user || !server || sending) return;
    setSending(friendId);
    await insertServerInviteMessage(user.id, friendId, {
      id: server.id,
      name: server.name,
      description: server.description,
      icon_url: server.icon_url,
      banner_url: server.banner_url,
      member_count: members.length,
    });
    setSentTo(prev => new Set(prev).add(friendId));
    setSending(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Send a server invite as a DM. Your friend will see a card they can tap to join.
      </p>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search friends..."
          style={{
            width: '100%', padding: '8px 12px 8px 32px', borderRadius: 10, fontSize: 12,
            background: 'var(--input-bg)', border: '1px solid var(--input-border)',
            color: 'var(--text-primary)', outline: 'none',
          }}
        />
      </div>

      {/* Friend list */}
      <div className="flex flex-col gap-1.5" style={{ maxHeight: 320, overflowY: 'auto' }}>
        {filteredFriends.map(friend => {
          const isSent = sentTo.has(friend.id);
          const isSending = sending === friend.id;
          return (
            <div
              key={friend.id}
              className="flex items-center gap-3 rounded-[10px] px-3 py-2 transition-colors"
              style={{
                border: '1px solid var(--panel-divider)',
                background: isSent ? 'rgba(0,212,255,0.06)' : 'transparent',
              }}
            >
              <AvatarImage username={friend.username} avatarUrl={friend.avatar_url} size="sm" />
              <span className="flex-1 truncate" style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
                {friend.username}
              </span>
              {isSent ? (
                <div className="flex items-center gap-1" style={{ color: '#4fc97a', fontSize: 10, fontWeight: 600 }}>
                  <Check className="h-3 w-3" />
                  Sent
                </div>
              ) : (
                <button
                  onClick={() => handleSendInvite(friend.id)}
                  disabled={isSending}
                  className="flex items-center gap-1 rounded-aero px-2.5 py-1 text-[10px] font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
                  style={{ background: 'rgba(0,212,255,0.12)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.25)' }}
                >
                  <Send className="h-3 w-3" />
                  {isSending ? 'Sending...' : 'Invite'}
                </button>
              )}
            </div>
          );
        })}

        {filteredFriends.length === 0 && !search && alreadyMembers.length === friends.length && (
          <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>
            All your friends are already members
          </p>
        )}
        {filteredFriends.length === 0 && !search && friends.length === 0 && (
          <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>
            Add friends first to send invites
          </p>
        )}
        {filteredFriends.length === 0 && search && (
          <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>
            No friends match "{search}"
          </p>
        )}
      </div>

      {/* Already members section */}
      {alreadyMembers.length > 0 && (
        <div>
          <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
            Already members
          </p>
          <div className="flex flex-wrap gap-1.5">
            {alreadyMembers.map(f => (
              <div
                key={f.id}
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--panel-divider)' }}
              >
                <AvatarImage username={f.username} avatarUrl={f.avatar_url} size="sm" />
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{f.username}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
