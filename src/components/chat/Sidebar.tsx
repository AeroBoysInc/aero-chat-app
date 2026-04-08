import { useState, useEffect, useRef, useMemo, memo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, LogOut, Bell, UserPlus, Clock, ChevronUp, ChevronDown, UserMinus, Gamepad2, PenTool } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore, type Profile } from '../../store/authStore';
import { useFriendStore } from '../../store/friendStore';
import { useUnreadStore } from '../../store/unreadStore';
import { useTypingStore } from '../../store/typingStore';
import { useStatusStore } from '../../store/statusStore';
import { usePresenceStore } from '../../store/presenceStore';
import { useShallow } from 'zustand/react/shallow';
import { AvatarImage, statusLabel, statusColor, type Status } from '../ui/AvatarImage';
import { AeroLogo } from '../ui/AeroLogo';
import { ProfileTooltip } from '../ui/ProfileTooltip';
import { ThemeSwitcher } from '../ui/ThemeSwitcher';
import { FriendRequestModal } from './FriendRequestModal';
import { SettingsPanel } from '../settings/SettingsPanel';
import { SecurityPanel } from '../settings/SecurityPanel';
import { GeneralPanel } from '../settings/GeneralPanel';
import { useCornerStore } from '../../store/cornerStore';
import { useCallStore } from '../../store/callStore';
import { CARD_GRADIENTS } from '../../lib/cardGradients';
import { XpMiniBar } from '../ui/XpMiniBar';
import { AccentName } from '../ui/AccentName';
import { CustomStatusBadge } from '../ui/CustomStatusBadge';
import { CardEffect } from '../ui/CardEffect';
import { ProfilePopout } from '../ui/ProfilePopout';
import { IdentityEditor } from '../ui/IdentityEditor';
import { useThemeStore, FREE_THEMES } from '../../store/themeStore';
import { useParallax } from '../../hooks/useParallax';


interface Props {
  selectedUser: Profile | null;
  onSelectUser: (user: Profile) => void;
  isMobile?: boolean;
}


const ALL_STATUSES: Status[] = ['online', 'busy', 'away', 'offline'];

export function Sidebar({ selectedUser, onSelectUser, isMobile = false }: Props) {
  const { user, signOut } = useAuthStore();
  const friends           = useFriendStore(useShallow(s => s.friends));
  const pendingIncoming   = useFriendStore(useShallow(s => s.pendingIncoming));
  const pendingSent       = useFriendStore(useShallow(s => s.pendingSent));
  const sendFriendRequest = useFriendStore(s => s.sendFriendRequest);
  const clear             = useUnreadStore(s => s.clear);
  const { status: myStatus, setStatus: setMyStatus } = useStatusStore();
  const myPlayingGame     = usePresenceStore(s => s.playingGames.get(user?.id ?? '') ?? null);
  const { openGameHub, openWriterHub } = useCornerStore();
  const callStatus = useCallStore(s => s.status);
  const onlineIds = usePresenceStore(s => s.onlineIds);
  const presenceReady = usePresenceStore(s => s.presenceReady);
  const currentTheme = useThemeStore(s => s.theme);
  const hasParallax = !FREE_THEMES.includes(currentTheme as any);
  const cardRef = useRef<HTMLDivElement>(null);
  const parallax = useParallax(cardRef, 4);

  // Group friends by effective status
  const STATUS_ORDER: Status[] = ['online', 'busy', 'away', 'offline'];
  const groupedFriends = useMemo(() => {
    const groups: Record<Status, Profile[]> = { online: [], busy: [], away: [], offline: [] };
    for (const f of friends) {
      const storedStatus = (f.status as Status | undefined) ?? 'online';
      const effective: Status = !presenceReady ? 'offline' : !onlineIds.has(f.id) ? 'offline' : storedStatus;
      groups[effective].push(f);
    }
    return groups;
  }, [friends, onlineIds, presenceReady]);

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const toggleGroup = useCallback((status: string) => {
    setCollapsedGroups(prev => ({ ...prev, [status]: !prev[status] }));
  }, []);

  const [query,           setQuery]           = useState('');
  const [results,         setResults]         = useState<Profile[]>([]);
  const [searching,       setSearching]       = useState(false);
  const [requestsOpen,    setRequestsOpen]    = useState(false);
  const [settingsView,    setSettingsView]    = useState<null | 'menu' | 'profile' | 'security' | 'general'>(null);
  const [statusMenuOpen,  setStatusMenuOpen]  = useState(false);
  const [identityEditorOpen,  setIdentityEditorOpen]  = useState(false);
  const [isOwnCardHovered,    setIsOwnCardHovered]    = useState(false);
  const statusMenuRef  = useRef<HTMLDivElement>(null);
  const asideRef       = useRef<HTMLElement>(null);

  const cardGradient = user?.card_gradient ?? 'ocean';
  const cardImage = user?.card_image_url ?? null;
  const cardCropParams = (user?.card_image_params as { zoom: number; x: number; y: number } | null) ?? { zoom: 1.5, x: 50, y: 50 };

  const isPanelOpen = settingsView === 'profile' || settingsView === 'general' || settingsView === 'security';

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

  const handleFriendSelect = useCallback((friend: Profile) => {
    onSelectUser(friend);
    clear(friend.id);
  }, [onSelectUser, clear]);

  return (
    <aside
      ref={asideRef}
      className="glass-sidebar relative flex h-full flex-col"
      style={{ isolation: 'isolate', width: '100%', flexShrink: 0 }}
    >
      {/* ── Header — mobile only (desktop header lives in ChatLayout top bar) ── */}
      {isMobile && (
        <div
          className="flex items-center justify-between pl-20 pr-4 py-4"
          style={{ borderBottom: '1px solid var(--panel-divider)', position: 'relative', overflow: 'visible' }}
        >
          {/* Logo — integrated circle, left edge */}
          <div style={{
            position: 'absolute', left: -4, top: '50%', transform: 'translateY(-50%)', zIndex: 10,
            width: 60, height: 60, borderRadius: '50%',
            background: 'var(--bg-solid, #e8f4fc)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AeroLogo size={84} />
          </div>
          <div className="flex items-center gap-1">
            <span style={{ fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 800, fontSize: 18, color: 'var(--text-title)', letterSpacing: '-0.4px' }}>
              AeroChat
            </span>
            {user?.is_premium && (
              <span style={{
                fontWeight: 900, fontSize: 20,
                background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                +
              </span>
            )}
          </div>
          <div className="flex items-center gap-0.5">
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
            <button
              onClick={openWriterHub}
              className="relative rounded-aero p-2 transition-all duration-150"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--hover-bg)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
              title="Writers Corner"
            >
              <PenTool className="h-4 w-4" />
            </button>
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
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold"
                  style={{ background: 'var(--badge-bg)', color: 'var(--badge-text)' }}>
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
      )}

      {/* ── Profile Card ── */}
      <div
        className="relative mx-3 my-2 rounded-[14px] overflow-visible"
        ref={(el) => {
          // Share the ref between statusMenuRef and cardRef (for parallax)
          (statusMenuRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
          (cardRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
        }}
        onMouseEnter={() => { setIsOwnCardHovered(true); if (hasParallax) parallax.onMouseEnter(); }}
        onMouseLeave={() => { setIsOwnCardHovered(false); if (hasParallax) parallax.onMouseLeave(); }}
        onMouseMove={hasParallax ? parallax.onMouseMove : undefined}
        style={{
          border: user?.is_premium
            ? '1px solid rgba(255,215,0,0.22)'
            : '1px solid var(--panel-divider)',
          padding: '10px 12px',
          flexShrink: 0,
          ...(cardImage
            ? {
                backgroundImage: `url(${cardImage})`,
                backgroundSize: `${cardCropParams.zoom * 100}%`,
                backgroundPosition: `${cardCropParams.x}% ${cardCropParams.y}%`,
                backgroundRepeat: 'no-repeat',
              }
            : { background: CARD_GRADIENTS.find(g => g.id === cardGradient)?.css ?? CARD_GRADIENTS[0].css }),
          boxShadow: user?.is_premium
            ? '0 4px 20px rgba(255,180,0,0.10), 0 0 30px rgba(255,215,0,0.04), inset 0 1px 0 rgba(255,255,255,0.18)'
            : '0 4px 16px rgba(0,80,200,0.08), inset 0 1px 0 rgba(255,255,255,0.18)',
          ...(hasParallax ? { transformStyle: 'preserve-3d' as const } : {}),
        }}
      >
        {/* Dark overlay when image is set — keeps text readable */}
        {cardImage && (
          <div className="pointer-events-none absolute inset-0 rounded-[14px]"
            style={{ background: 'rgba(0,0,0,0.42)', zIndex: 0 }} />
        )}

        {/* Premium shimmer animation */}
        {user?.is_premium && (
          <div className="pointer-events-none absolute inset-0 rounded-[14px] overflow-hidden" style={{ zIndex: 0 }}>
            <div style={{
              position: 'absolute', top: 0, left: '-100%', width: '50%', height: '100%',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)',
              animation: 'card-shimmer 4s ease-in-out infinite',
            }} />
          </div>
        )}

        {/* Decorative corner orb (non-premium only) */}
        {!user?.is_premium && (
          <div className="pointer-events-none absolute" style={{
            width: 80, height: 80, top: -20, right: -20,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0,180,255,0.18) 0%, transparent 70%)',
            filter: 'blur(12px)',
            zIndex: 0,
          }} />
        )}

        {/* Premium "Aero Chat+" badge — top-right corner */}
        {user?.is_premium && (
          <span style={{
            position: 'absolute', top: 6, right: 8, zIndex: 5,
            padding: '2px 8px', borderRadius: 10,
            fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
            background: 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,165,0,0.10))',
            color: '#FFD700',
            border: '1px solid rgba(255,215,0,0.28)',
          }}>
            Aero Chat+
          </span>
        )}

        {/* Card effect overlay — plays on hover */}
        <CardEffect effect={user?.card_effect} playing={isOwnCardHovered} />

        <div className="relative flex items-center gap-3" style={{ zIndex: 1 }}>
          <AvatarImage
            username={user?.username ?? '?'}
            avatarUrl={user?.avatar_url}
            size="xl"
            status={myStatus}
            isInCall={callStatus === 'connected'}
            playingGame={myPlayingGame}
            gifUrl={user?.avatar_gif_url}
            alwaysAnimate
          />
          <div className="flex-1 min-w-0">
            <p className="truncate font-bold" style={{ fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '-0.1px' }}>
              <AccentName name={user?.username ?? '?'} accentColor={user?.accent_color} accentColorSecondary={user?.accent_color_secondary} nameEffect={user?.name_effect} playing style={{ fontSize: 14, fontWeight: 700 }} />
              {callStatus === 'connected' && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  fontSize: 10, color: '#00d4ff', fontWeight: 600,
                  padding: '1px 6px',
                  background: 'rgba(0,180,255,0.12)',
                  border: '1px solid rgba(0,180,255,0.3)',
                  borderRadius: 10, marginLeft: 6, letterSpacing: '0.02em',
                }}>
                  <span style={{ fontSize: 8 }}>●</span> In call
                </span>
              )}
            </p>
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
            {/* Custom status badge */}
            {(user?.custom_status_emoji || user?.custom_status_text) && (
              <div style={{ marginTop: 2 }}>
                <CustomStatusBadge emoji={user.custom_status_emoji} text={user.custom_status_text} size="sm" />
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setIdentityEditorOpen(o => !o)}
              className="rounded-aero p-1.5 transition-all"
              style={{ color: identityEditorOpen ? 'var(--text-primary)' : 'var(--text-muted)', background: identityEditorOpen ? 'var(--hover-bg)' : '' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--hover-bg)'}
              onMouseLeave={e => { if (!identityEditorOpen) (e.currentTarget as HTMLElement).style.background = ''; }}
              title="Edit identity"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button
              onClick={() => setSettingsView(v => v === 'menu' ? null : 'menu')}
              className="rounded-aero p-1.5 transition-all"
              style={{ color: settingsView ? 'var(--text-primary)' : 'var(--text-muted)', background: settingsView === 'menu' ? 'var(--hover-bg)' : '' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--hover-bg)'}
              onMouseLeave={e => { if (settingsView !== 'menu') (e.currentTarget as HTMLElement).style.background = ''; }}
              title="Settings"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Status menu — opens downward */}
        {statusMenuOpen && (
          <div
            className="absolute left-0 right-0 mt-2 rounded-[14px] overflow-hidden animate-fade-in"
            style={{
              top: '100%',
              zIndex: 20,
              background: 'var(--sidebar-bg)',
              border: '1px solid var(--panel-divider)',
              boxShadow: '0 8px 20px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.50)',
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
                <span className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ background: statusColor[s], boxShadow: `0 0 6px ${statusColor[s]}bb` }} />
                <span style={{ fontFamily: 'Inter, system-ui, sans-serif', textTransform: 'capitalize' }}>
                  {statusLabel[s]}
                </span>
                {myStatus === s && <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>✓</span>}
              </button>
            ))}
          </div>
        )}

        {/* Settings dropdown menu */}
        {settingsView === 'menu' && (
          <div
            className="absolute right-0 mt-2 z-50 w-52 py-1.5 shadow-xl animate-fade-in"
            style={{
              top: '100%',
              borderRadius: 16,
              border: '1px solid var(--popup-border)',
              background: 'var(--popup-bg)',
              boxShadow: 'var(--popup-shadow)',
              backdropFilter: 'blur(28px)',
            }}
          >
            <button
              onClick={() => setSettingsView('profile')}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors"
              style={{ color: 'var(--popup-text-secondary)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--popup-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--popup-text)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = 'var(--popup-text-secondary)'; }}
            >
              <svg className="h-4 w-4" style={{ opacity: 0.55, color: 'var(--popup-icon)' }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
              Profile Settings
            </button>
            <div className="mx-3 h-px" style={{ background: 'var(--popup-divider)' }} />
            <button
              onClick={() => setSettingsView('general')}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors"
              style={{ color: 'var(--popup-text-secondary)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--popup-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--popup-text)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = 'var(--popup-text-secondary)'; }}
            >
              <svg className="h-4 w-4" style={{ opacity: 0.55, color: 'var(--popup-icon)' }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 18v-2a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v2"/><path d="M9 10a3 3 0 1 0 6 0 3 3 0 0 0-6 0"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="18" x2="12" y2="21"/></svg>
              General
            </button>
            <div className="mx-3 h-px" style={{ background: 'var(--popup-divider)' }} />
            <button
              onClick={() => setSettingsView('security')}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors"
              style={{ color: 'var(--popup-text-secondary)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--popup-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--popup-text)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = 'var(--popup-text-secondary)'; }}
            >
              <svg className="h-4 w-4" style={{ opacity: 0.55, color: 'var(--popup-icon)' }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Security
            </button>
          </div>
        )}

        {/* Identity Editor — opens below profile card */}
        {identityEditorOpen && (
          <IdentityEditor onClose={() => setIdentityEditorOpen(false)} />
        )}
      </div>

      {/* ── XP Bar (premium) — connected underneath the card ── */}
      {user?.is_premium && (
        <div className="mx-3 -mt-1 px-1" style={{ position: 'relative', zIndex: 0 }}>
          <XpMiniBar bar="chatter" />
        </div>
      )}

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

            {STATUS_ORDER.map(status => {
              const group = groupedFriends[status];
              if (group.length === 0) return null;
              const collapsed = collapsedGroups[status] ?? false;
              return (
                <div key={status}>
                  <button
                    onClick={() => toggleGroup(status)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors duration-100"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    {collapsed
                      ? <ChevronDown className="h-3 w-3" style={{ color: 'var(--text-muted)', opacity: 0.6 }} />
                      : <ChevronUp className="h-3 w-3" style={{ color: 'var(--text-muted)', opacity: 0.6 }} />}
                    <span
                      className="inline-block rounded-full shrink-0"
                      style={{ width: 7, height: 7, background: statusColor[status], boxShadow: `0 0 4px ${statusColor[status]}88` }}
                    />
                    <span style={{
                      fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
                      color: 'var(--text-muted)', fontFamily: 'Inter, system-ui, sans-serif',
                    }}>
                      {statusLabel[status]}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', opacity: 0.6 }}>
                      — {group.length}
                    </span>
                  </button>
                  {!collapsed && group.map(f => (
                    <FriendItem
                      key={f.id}
                      friend={f}
                      isSelected={selectedUser?.id === f.id}
                      onSelect={handleFriendSelect}
                      currentUserId={user!.id}
                    />
                  ))}
                </div>
              );
            })}
          </>
        )}
      </nav>


      {/* Settings panels — centered modal overlay */}
      {isPanelOpen && createPortal(
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
          }}
          onClick={() => setSettingsView(null)}
        >
          <div onClick={e => e.stopPropagation()}>
            {settingsView === 'profile'  && <SettingsPanel  onClose={() => setSettingsView(null)} />}
            {settingsView === 'general'  && <GeneralPanel   onClose={() => setSettingsView(null)} />}
            {settingsView === 'security' && <SecurityPanel  onClose={() => setSettingsView(null)} />}
          </div>
        </div>,
        document.body
      )}

      {requestsOpen && <FriendRequestModal onClose={() => setRequestsOpen(false)} />}
    </aside>
  );
}

// ── FriendItem ─────────────────────────────────────────────────────────────────
// Memoized per-friend row. Each instance subscribes to primitive selectors
// for its own friend.id so only the affected row re-renders on presence/typing/
// unread changes.

interface FriendItemProps {
  friend: Profile;
  isSelected: boolean;
  onSelect: (friend: Profile) => void;
  currentUserId: string;
}

const FriendItem = memo(function FriendItem({
  friend, isSelected, onSelect, currentUserId,
}: FriendItemProps) {
  const isOnline      = usePresenceStore(s => s.presenceReady && s.onlineIds.has(friend.id));
  const presenceReady = usePresenceStore(s => s.presenceReady);
  const playingGame   = usePresenceStore(s => s.playingGames.get(friend.id) ?? null);
  const isTyping      = useTypingStore(s => s.typing[friend.id] === true);
  const unread        = useUnreadStore(s => s.counts[friend.id] ?? 0);
  const removeFriend  = useFriendStore(s => s.removeFriend);
  const [isHovered, setIsHovered] = useState(false);
  const [showPopout, setShowPopout] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popoutHoveredRef = useRef(false);
  const cardRef = useRef<HTMLButtonElement>(null);

  const storedStatus = (friend.status as Status | undefined) ?? 'online';
  const liveStatus: Status = !presenceReady ? 'offline' : !isOnline ? 'offline' : storedStatus;

  // Identity fields
  const accentColor = friend.accent_color || null;
  const accentSecondary = friend.accent_color_secondary || null;
  const cardGradientCss = CARD_GRADIENTS.find(g => g.id === friend.card_gradient)?.css ?? null;
  const cardImage = friend.card_image_url;
  const cardEffect = friend.card_effect || null;
  const nameEffect = friend.name_effect || null;
  const avatarGifUrl = friend.avatar_gif_url || null;

  // Custom status line: custom status emoji/text
  const statusLine = (friend.custom_status_emoji || friend.custom_status_text)
    ? { emoji: friend.custom_status_emoji, text: friend.custom_status_text }
    : null;

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    hoverTimerRef.current = setTimeout(() => setShowPopout(true), 200);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    // Close popout after delay unless mouse entered the popout
    closeTimerRef.current = setTimeout(() => {
      if (!popoutHoveredRef.current) setShowPopout(false);
    }, 300);
  }, []);

  const handlePopoutMouseEnter = useCallback(() => {
    popoutHoveredRef.current = true;
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  const handlePopoutMouseLeave = useCallback(() => {
    popoutHoveredRef.current = false;
    setShowPopout(false);
    setIsHovered(false);
  }, []);

  const handlePopoutClose = useCallback(() => {
    popoutHoveredRef.current = false;
    setShowPopout(false);
    setIsHovered(false);
  }, []);

  return (
    <>
    <button
      ref={cardRef}
      onClick={() => onSelect(friend)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="w-full text-left transition-all"
      style={{
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 4,
        border: isSelected
          ? `1px solid ${accentColor ? accentColor + '40' : 'rgba(0,212,255,0.25)'}`
          : isHovered
            ? '1px solid rgba(255,255,255,0.08)'
            : '1px solid rgba(255,255,255,0.04)',
        opacity: liveStatus === 'offline' ? 0.5 : 1,
        cursor: 'pointer',
        background: isSelected
          ? 'linear-gradient(135deg, rgba(26,111,212,0.16) 0%, rgba(0,190,255,0.12) 100%)'
          : isHovered
            ? 'var(--hover-bg)'
            : 'transparent',
      }}
    >
      {/* Card background layer */}
      {cardImage ? (
        <>
          <div style={{ position: 'absolute', inset: 0, background: `url(${cardImage}) center/cover`, borderRadius: 12 }} />
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', borderRadius: 12 }} />
        </>
      ) : cardGradientCss ? (
        <div style={{ position: 'absolute', inset: 0, background: cardGradientCss, opacity: 0.12, borderRadius: 12 }} />
      ) : null}

      {/* Card effect overlay (plays on hover) */}
      <CardEffect effect={cardEffect} playing={isHovered && liveStatus !== 'offline'} />

      {/* Avatar */}
      <div style={{ position: 'relative', zIndex: 3, flexShrink: 0 }}>
        <ProfileTooltip data={{
          username: friend.username,
          avatarUrl: friend.avatar_url,
          status: liveStatus,
          cardGradient: friend.card_gradient,
          cardImageUrl: friend.card_image_url,
          cardImageParams: friend.card_image_params,
        }}>
          <AvatarImage
            username={friend.username}
            avatarUrl={friend.avatar_url}
            size="sm"
            status={liveStatus}
            playingGame={playingGame}
            gifUrl={avatarGifUrl}
          />
        </ProfileTooltip>
      </div>

      {/* Name + status */}
      <div style={{ position: 'relative', zIndex: 3, flex: 1, minWidth: 0 }}>
        <AccentName
          name={friend.username}
          accentColor={accentColor}
          accentColorSecondary={accentSecondary}
          nameEffect={nameEffect}
          animateOnHover
          playing={isHovered}
          style={{ fontSize: '12.5px', fontWeight: 600 }}
        />
        <div style={{ marginTop: 1 }}>
          {isTyping ? (
            <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', fontStyle: 'italic' }}>typing...</span>
          ) : statusLine ? (
            <CustomStatusBadge emoji={statusLine.emoji} text={statusLine.text} size="sm" />
          ) : playingGame ? (
            <span style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>🎮 {playingGame}</span>
          ) : (
            <span style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>{liveStatus}</span>
          )}
        </div>
      </div>

      {/* Remove friend button (hover, no unread) */}
      {isHovered && unread === 0 && (
        <button
          onClick={e => { e.stopPropagation(); removeFriend(currentUserId, friend.id); }}
          className="rounded-aero p-1 transition-all shrink-0"
          style={{ position: 'relative', zIndex: 4, color: 'var(--text-muted)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#e03f3f'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
          title="Remove friend"
        >
          <UserMinus className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Unread badge */}
      {unread > 0 && (
        <div style={{
          position: 'relative', zIndex: 4,
          background: '#ff4060', color: 'white',
          fontSize: 9, fontWeight: 700,
          borderRadius: 10, padding: '1px 6px',
          minWidth: 18, textAlign: 'center',
          flexShrink: 0,
        }}>
          {unread > 99 ? '99+' : unread}
        </div>
      )}
    </button>
    {showPopout && cardRef.current && (
      <ProfilePopout
        friend={friend}
        status={liveStatus}
        game={playingGame}
        anchorRect={cardRef.current.getBoundingClientRect()}
        direction="right"
        onClose={handlePopoutClose}
        onMessage={() => { handlePopoutClose(); onSelect(friend); }}
        onPopoutMouseEnter={handlePopoutMouseEnter}
        onPopoutMouseLeave={handlePopoutMouseLeave}
      />
    )}
    </>
  );
});

