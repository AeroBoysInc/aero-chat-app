import { useState, useEffect, useRef } from 'react';
import { Search, LogOut, Bell, UserPlus, Clock, ChevronUp, UserMinus, Gamepad2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore, type Profile } from '../../store/authStore';
import { useFriendStore } from '../../store/friendStore';
import { useUnreadStore } from '../../store/unreadStore';
import { useTypingStore } from '../../store/typingStore';
import { useStatusStore } from '../../store/statusStore';
import { usePresenceStore } from '../../store/presenceStore';
import { AvatarImage, statusLabel, statusColor, type Status } from '../ui/AvatarImage';
import { AeroLogo } from '../ui/AeroLogo';
import { ThemeSwitcher } from '../ui/ThemeSwitcher';
import { FriendRequestModal } from './FriendRequestModal';
import { SettingsPanel } from '../settings/SettingsPanel';
import { SecurityPanel } from '../settings/SecurityPanel';
import { GeneralPanel } from '../settings/GeneralPanel';
import { useCornerStore } from '../../store/cornerStore';

interface Props {
  selectedUser: Profile | null;
  onSelectUser: (user: Profile) => void;
  isMobile?: boolean;
}


const ALL_STATUSES: Status[] = ['online', 'busy', 'away', 'offline'];

export function Sidebar({ selectedUser, onSelectUser, isMobile = false }: Props) {
  const { user, signOut } = useAuthStore();
  const { friends, pendingIncoming, pendingSent, sendFriendRequest, removeFriend } = useFriendStore();
  const { counts, clear } = useUnreadStore();
  const { typing } = useTypingStore();
  const { status: myStatus, setStatus: setMyStatus } = useStatusStore();
  const onlineIds = usePresenceStore(s => s.onlineIds);
  const presenceReady = usePresenceStore(s => s.presenceReady);
  const { openGameHub } = useCornerStore();

  const [query,          setQuery]          = useState('');
  const [results,        setResults]        = useState<Profile[]>([]);
  const [searching,      setSearching]      = useState(false);
  const [requestsOpen,   setRequestsOpen]   = useState(false);
  const [settingsView,   setSettingsView]   = useState<null | 'menu' | 'profile' | 'security' | 'general'>(null);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [hoveredFriend,  setHoveredFriend]  = useState<string | null>(null);
  const statusMenuRef = useRef<HTMLDivElement>(null);

  // Close status menu on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node))
        setStatusMenuOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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

  function friendStatus(id: string): 'friend' | 'pending_sent' | 'pending_incoming' | 'none' {
    if (friends.some(f => f.id === id))                return 'friend';
    if (pendingSent.some(r => r.receiver_id === id))   return 'pending_sent';
    if (pendingIncoming.some(r => r.sender_id === id)) return 'pending_incoming';
    return 'none';
  }

  async function handleAddFriend(profileId: string) {
    if (!user) return;
    await sendFriendRequest(user.id, profileId);
  }

  return (
    <aside
      className="glass-sidebar relative flex h-full flex-col"
      style={{ isolation: 'isolate', width: '100%', flexShrink: 0 }}
    >
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-4 py-4"
        style={{ borderBottom: '1px solid var(--panel-divider)' }}
      >
        <div className="flex items-center gap-2.5">
          <AeroLogo size={30} />
          <span style={{ fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 800, fontSize: 16, color: 'var(--text-title)', letterSpacing: '-0.3px' }}>
            AeroChat
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          {/* Mobile-only: theme switcher + games button */}
          {isMobile && (
            <>
              <ThemeSwitcher />
              <button
                onClick={openGameHub}
                className="relative rounded-aero p-2 transition-all duration-150"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--hover-bg)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
                title="Games"
              >
                <Gamepad2 className="h-4 w-4" />
              </button>
            </>
          )}
          <button
            onClick={() => setRequestsOpen(true)}
            className="relative rounded-aero p-2 transition-all duration-150"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--hover-bg)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
            title="Friend Requests"
          >
            <Bell className="h-4 w-4" />
            {pendingIncoming.length > 0 && (
              <span
                className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold"
                style={{ background: 'var(--badge-bg)', color: 'var(--badge-text)' }}
              >
                {pendingIncoming.length}
              </span>
            )}
          </button>
          <button
            onClick={signOut}
            className="no-drag rounded-aero p-2 transition-all duration-150"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--hover-bg)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            className="aero-input pl-9 py-2 text-sm"
            placeholder="Search users…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* ── Section label ── */}
      <div className="px-4 pb-2 pt-1">
        <p style={{ fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 700, fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-label)' }}>
          {query ? 'Search Results' : 'Friends'}
        </p>
      </div>

      {/* ── List ── */}
      <nav className="flex-1 overflow-y-auto scrollbar-aero px-2 pb-2">

        {query && (
          <>
            {searching && <p className="px-2 py-4 text-center text-xs" style={{ color: 'var(--text-muted)' }}>Searching…</p>}
            {!searching && results.length === 0 && (
              <p className="px-2 py-4 text-center text-xs" style={{ color: 'var(--text-muted)' }}>No users found</p>
            )}
            {results.map((profile) => {
              const fs = friendStatus(profile.id);
              return (
                <div key={profile.id} className="flex items-center gap-3 rounded-aero px-3 py-2.5 transition-colors"
                  style={{ cursor: 'default' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--hover-bg)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
                >
                  <AvatarImage username={profile.username} avatarUrl={profile.avatar_url} size="lg"
                    status={fs === 'friend' ? ((profile.status as Status | undefined) ?? 'online') : null} />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)', fontFamily: 'Inter, system-ui, sans-serif' }}>
                      {profile.username}
                    </p>
                    {fs === 'friend' && <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Friend</p>}
                  </div>
                  {fs === 'friend' && (
                    <button onClick={() => { onSelectUser(profile); setQuery(''); }}
                      className="rounded-aero px-2.5 py-1 text-xs font-bold transition-colors"
                      style={{ color: '#1a6fd4', border: '1px solid rgba(26,111,212,0.25)' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--hover-bg)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
                    >Message</button>
                  )}
                  {fs === 'pending_sent' && (
                    <span className="flex items-center gap-1 text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                      <Clock className="h-3 w-3" /> Pending
                    </span>
                  )}
                  {fs === 'pending_incoming' && (
                    <span className="text-[10px] font-bold" style={{ color: '#1a6fd4' }}>Sent request</span>
                  )}
                  {fs === 'none' && (
                    <button onClick={() => handleAddFriend(profile.id)}
                      className="rounded-aero p-1.5 transition-all"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--hover-bg)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
                      title="Add Friend"
                    ><UserPlus className="h-4 w-4" /></button>
                  )}
                </div>
              );
            })}
          </>
        )}

        {!query && (
          <>
            {friends.length === 0 && (
              <div className="flex flex-col items-center px-2 py-10 text-center gap-3">
                <UserPlus className="h-9 w-9" style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  No friends yet.<br />Search for someone to add them!
                </p>
              </div>
            )}

            {friends.map(friend => {
              // Use presence to determine if actually connected; fall back to stored status before presence syncs
              const storedStatus = (friend.status as Status | undefined) ?? 'online';
              const effectiveStatus: Status = presenceReady && !onlineIds.has(friend.id) ? 'offline' : storedStatus;
              const isSelected = selectedUser?.id === friend.id;
              const unread = counts[friend.id] ?? 0;
              const isTyping = typing[friend.id] === true;
              const isHovered = hoveredFriend === friend.id;

              return (
                <button
                  key={friend.id}
                  onClick={() => { onSelectUser(friend); clear(friend.id); }}
                  className="flex w-full items-center gap-3 rounded-aero px-3 py-3 text-left transition-all duration-150"
                  style={isSelected ? {
                    background: 'linear-gradient(135deg, rgba(26,111,212,0.16) 0%, rgba(0,190,255,0.12) 100%)',
                    boxShadow: 'inset 0 0 0 1.5px rgba(26,111,212,0.30), 0 2px 8px rgba(26,111,212,0.10)',
                  } : {}}
                  onMouseEnter={e => { setHoveredFriend(friend.id); if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--hover-bg)'; }}
                  onMouseLeave={e => { setHoveredFriend(null); if (!isSelected) (e.currentTarget as HTMLElement).style.background = ''; }}
                >
                  <AvatarImage username={friend.username} avatarUrl={friend.avatar_url} size="xl" status={effectiveStatus} />

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold" style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: 14, color: 'var(--text-primary)', letterSpacing: '-0.1px' }}>
                      {friend.username}
                    </p>

                    {isTyping ? (
                      <p className="flex items-center gap-1 mt-0.5" style={{ fontSize: 11, color: '#1a6fd4', fontStyle: 'italic' }}>
                        <span className="typing-dots" style={{ color: '#1a6fd4' }}>
                          <span className="typing-dot" />
                          <span className="typing-dot" />
                          <span className="typing-dot" />
                        </span>
                        <span>typing…</span>
                      </p>
                    ) : (
                      <StatusLine status={effectiveStatus} />
                    )}
                  </div>

                  {/* Unfriend button on hover (only when no unread) */}
                  {isHovered && unread === 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFriend(user!.id, friend.id); }}
                      className="rounded-aero p-1 transition-all shrink-0"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#e03f3f'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                      title="Remove friend"
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {/* Unread badge */}
                  {unread > 0 && (
                    <span
                      className="flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold shrink-0"
                      style={{ background: 'var(--badge-bg)', color: 'var(--badge-text)', boxShadow: '0 1px 6px rgba(0,80,200,0.30)' }}
                    >
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                </button>
              );
            })}
          </>
        )}
      </nav>

      {/* ── Footer: current user + status change ── */}
      <div className="relative" style={{ borderTop: '1px solid var(--panel-divider)' }} ref={statusMenuRef}>
        {/* Status change popup */}
        {statusMenuOpen && (
          <div
            className="absolute bottom-full left-3 right-3 mb-2 rounded-aero-lg overflow-hidden"
            style={{
              background: 'var(--sidebar-bg)',
              border: '1px solid var(--panel-divider)',
              boxShadow: '0 -4px 20px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.50)',
              backdropFilter: 'blur(20px)',
            }}
          >
            <p className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-label)' }}>
              Set Status
            </p>
            {ALL_STATUSES.map(s => (
              <button
                key={s}
                onClick={() => { setMyStatus(s); setStatusMenuOpen(false); }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors"
                style={{ color: 'var(--text-primary)' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--hover-bg)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ background: statusColor[s], boxShadow: `0 0 6px ${statusColor[s]}bb` }}
                />
                <span style={{ fontFamily: 'Inter, system-ui, sans-serif', textTransform: 'capitalize' }}>
                  {statusLabel[s]}
                </span>
                {myStatus === s && <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>✓</span>}
              </button>
            ))}
          </div>
        )}

        {/* Footer row */}
        <div className="flex items-center gap-2.5 px-4 py-3">
          <AvatarImage username={user?.username ?? '?'} avatarUrl={user?.avatar_url} size="lg" status={myStatus} />
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate font-bold" style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: 13, color: 'var(--text-primary)' }}>
              {user?.username}
            </p>
            {/* Clickable status — opens menu */}
            <button
              onClick={() => setStatusMenuOpen(o => !o)}
              className="flex items-center gap-1.5 mt-0.5 rounded transition-opacity hover:opacity-70"
              style={{ fontSize: 11, color: statusColor[myStatus], fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 500 }}
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                style={{ background: statusColor[myStatus], boxShadow: `0 0 5px ${statusColor[myStatus]}cc` }} />
              {statusLabel[myStatus]}
              <ChevronUp className="h-3 w-3" style={{ transform: statusMenuOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
            </button>
          </div>
          <button
            onClick={() => setSettingsView(v => v === 'menu' ? null : 'menu')}
            className="rounded-aero p-1.5 transition-all"
            style={{ color: settingsView ? 'var(--text-primary)' : 'var(--text-muted)', background: settingsView === 'menu' ? 'var(--hover-bg)' : '' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--hover-bg)'}
            onMouseLeave={e => { if (settingsView !== 'menu') (e.currentTarget as HTMLElement).style.background = ''; }}
            title="Settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
        </div>

        {/* Settings dropdown menu */}
        {settingsView === 'menu' && (
          <div className="absolute bottom-14 left-2 z-50 w-52 rounded-aero-lg border border-white/20 bg-aero-deep/90 py-1.5 shadow-xl backdrop-blur-xl animate-fade-in">
            <button
              onClick={() => setSettingsView('profile')}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors"
            >
              <svg className="h-4 w-4 opacity-60" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
              Profile Settings
            </button>
            <div className="mx-3 h-px bg-white/10" />
            <button
              onClick={() => setSettingsView('general')}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors"
            >
              <svg className="h-4 w-4 opacity-60" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 18v-2a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v2"/><path d="M9 10a3 3 0 1 0 6 0 3 3 0 0 0-6 0"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="18" x2="12" y2="21"/></svg>
              General
            </button>
            <div className="mx-3 h-px bg-white/10" />
            <button
              onClick={() => setSettingsView('security')}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors"
            >
              <svg className="h-4 w-4 opacity-60" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Security
            </button>
          </div>
        )}
        {settingsView === 'profile'  && <SettingsPanel  onClose={() => setSettingsView(null)} />}
        {settingsView === 'general'  && <GeneralPanel   onClose={() => setSettingsView(null)} />}
        {settingsView === 'security' && <SecurityPanel  onClose={() => setSettingsView(null)} />}
      </div>

      {requestsOpen && <FriendRequestModal onClose={() => setRequestsOpen(false)} />}
    </aside>
  );
}

function StatusLine({ status }: { status: Status }) {
  const color = statusColor[status];
  return (
    <p className="flex items-center gap-1.5 mt-0.5" style={{ fontSize: 11, color }}>
      <span className="inline-block rounded-full shrink-0"
        style={{ width: 7, height: 7, background: color, boxShadow: `0 0 5px ${color}cc` }} />
      <span style={{ fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 500 }}>
        {statusLabel[status]}
      </span>
    </p>
  );
}
