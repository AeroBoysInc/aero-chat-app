import { useState, useEffect } from 'react';
import { Search, LogOut, MessageCircle, Bell, UserPlus, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore, type Profile } from '../../store/authStore';
import { useFriendStore } from '../../store/friendStore';
import { AvatarImage } from '../ui/AvatarImage';
import { FriendRequestModal } from './FriendRequestModal';
import { SettingsPanel } from '../settings/SettingsPanel';

interface Props {
  selectedUser: Profile | null;
  onSelectUser: (user: Profile) => void;
}

export function Sidebar({ selectedUser, onSelectUser }: Props) {
  const { user, signOut } = useAuthStore();
  const { friends, pendingIncoming, pendingSent, sendFriendRequest } = useFriendStore();
  const [query,          setQuery]          = useState('');
  const [results,        setResults]        = useState<Profile[]>([]);
  const [searching,      setSearching]      = useState(false);
  const [requestsOpen,   setRequestsOpen]   = useState(false);
  const [settingsOpen,   setSettingsOpen]   = useState(false);

  // Search users by username
  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from('profiles')
        .select('id, username, public_key, avatar_url')
        .ilike('username', `%${query}%`)
        .neq('id', user?.id)
        .limit(8);
      setResults(data ?? []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [query, user]);

  function friendStatus(profileId: string): 'friend' | 'pending_sent' | 'pending_incoming' | 'none' {
    if (friends.some((f) => f.id === profileId)) return 'friend';
    if (pendingSent.some((r) => r.receiver_id === profileId)) return 'pending_sent';
    if (pendingIncoming.some((r) => r.sender_id === profileId)) return 'pending_incoming';
    return 'none';
  }

  async function handleAddFriend(profileId: string) {
    if (!user) return;
    await sendFriendRequest(user.id, profileId);
  }

  return (
    <aside className="relative flex h-full w-64 flex-col border-r border-white/15 bg-white/5">
      {/* Header */}
      <div className="drag-region flex items-center justify-between px-4 py-4 border-b border-white/10">
        <div className="flex items-center gap-2 no-drag">
          <MessageCircle className="h-5 w-5 text-aero-cyan" />
          <span className="font-bold text-white text-shadow">AeroChat</span>
        </div>
        <div className="flex items-center gap-1 no-drag">
          {/* Friend requests bell */}
          <button
            onClick={() => setRequestsOpen(true)}
            className="relative rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition-colors"
            title="Friend Requests"
          >
            <Bell className="h-4 w-4" />
            {pendingIncoming.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-aero-cyan text-[9px] font-bold text-white">
                {pendingIncoming.length}
              </span>
            )}
          </button>
          <button
            onClick={signOut}
            className="no-drag rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition-colors"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
          <input
            className="aero-input pl-8 py-2 text-sm"
            placeholder="Search users..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Section label */}
      <div className="px-4 pb-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35">
          {query ? 'Search Results' : 'Friends'}
        </p>
      </div>

      {/* Contact / search list */}
      <nav className="flex-1 overflow-y-auto scrollbar-aero px-2 pb-2">
        {/* Search results with friend actions */}
        {query && (
          <>
            {searching && <p className="px-2 py-4 text-center text-xs text-white/40">Searching…</p>}
            {!searching && results.length === 0 && (
              <p className="px-2 py-4 text-center text-xs text-white/40">No users found</p>
            )}
            {results.map((profile) => {
              const status = friendStatus(profile.id);
              return (
                <div key={profile.id} className="flex items-center gap-2 rounded-aero px-2 py-2 hover:bg-white/5">
                  <AvatarImage username={profile.username} avatarUrl={profile.avatar_url} size="md" />
                  <span className="flex-1 truncate text-sm text-white/80">{profile.username}</span>
                  {status === 'friend' && (
                    <button
                      onClick={() => { onSelectUser(profile); setQuery(''); }}
                      className="rounded px-2 py-1 text-[10px] font-semibold text-aero-cyan hover:bg-aero-cyan/10 transition-colors"
                    >
                      Message
                    </button>
                  )}
                  {status === 'pending_sent' && (
                    <span className="flex items-center gap-1 text-[10px] text-white/35">
                      <Clock className="h-3 w-3" /> Pending
                    </span>
                  )}
                  {status === 'pending_incoming' && (
                    <span className="text-[10px] text-aero-cyan">Sent you a request</span>
                  )}
                  {status === 'none' && (
                    <button
                      onClick={() => handleAddFriend(profile.id)}
                      className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white transition-colors"
                      title="Add Friend"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* Friends list */}
        {!query && (
          <>
            {friends.length === 0 && (
              <p className="px-2 py-4 text-center text-xs text-white/40">
                No friends yet. Search for someone to add them!
              </p>
            )}
            {friends.map(friend => (
              <button
                key={friend.id}
                onClick={() => onSelectUser(friend)}
                className={`flex w-full items-center gap-3 rounded-aero px-3 py-2.5 text-left transition-all duration-100 ${
                  selectedUser?.id === friend.id
                    ? 'bg-white/20 text-white'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                <AvatarImage username={friend.username} avatarUrl={friend.avatar_url} size="md" />
                <span className="truncate text-sm font-medium">{friend.username}</span>
              </button>
            ))}
          </>
        )}
      </nav>

      {/* Current user footer */}
      <div className="relative border-t border-white/10 px-3 py-3">
        <button
          onClick={() => setSettingsOpen((o) => !o)}
          className="flex w-full items-center gap-2 rounded-aero px-1 py-1 hover:bg-white/10 transition-colors"
          title="Profile settings"
        >
          <AvatarImage username={user?.username ?? '?'} avatarUrl={user?.avatar_url} size="md" />
          <div className="min-w-0 text-left">
            <p className="truncate text-sm font-semibold text-white">{user?.username}</p>
            <p className="text-[10px] text-aero-green">● Encrypted</p>
          </div>
        </button>
        {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
      </div>

      {requestsOpen && <FriendRequestModal onClose={() => setRequestsOpen(false)} />}
    </aside>
  );
}
