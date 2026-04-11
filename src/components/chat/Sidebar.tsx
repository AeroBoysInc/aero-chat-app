import { useState, useEffect, useRef, useMemo, memo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, LogOut, Bell, BellOff, UserPlus, Clock, ChevronUp, ChevronDown, UserMinus, Gamepad2, PenTool, Plus, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore, type Profile } from '../../store/authStore';
import { useFriendStore } from '../../store/friendStore';
import { useUnreadStore } from '../../store/unreadStore';
import { useTypingStore } from '../../store/typingStore';
import { useStatusStore } from '../../store/statusStore';
import { usePresenceStore } from '../../store/presenceStore';
import { useMuteStore } from '../../store/muteStore';
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
import { useGroupChatStore, type GroupChat } from '../../store/groupChatStore';
import { useChatStore } from '../../store/chatStore';
import { CreateGroupModal } from './CreateGroupModal';
import { CARD_GRADIENTS } from '../../lib/cardGradients';
import { XpMiniBar } from '../ui/XpMiniBar';
import { AccentName } from '../ui/AccentName';
import { CustomStatusBadge } from '../ui/CustomStatusBadge';
import { CardEffect } from '../ui/CardEffect';
import { ProfilePopout } from '../ui/ProfilePopout';
import { IdentityEditor } from '../ui/IdentityEditor';
import { useThemeStore, FREE_THEMES } from '../../store/themeStore';
import { useTourStore } from '../../store/tourStore';
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

  const [activeTab, setActiveTab] = useState<'friends' | 'groups'>('friends');
  const groups = useGroupChatStore(s => s.groups);
  const selectedGroupId = useChatStore(s => s.selectedGroupId);
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  const [query,           setQuery]           = useState('');
  const [results,         setResults]         = useState<Profile[]>([]);
  const [searching,       setSearching]       = useState(false);
  const [requestsOpen,    setRequestsOpen]    = useState(false);
  const [settingsView,    setSettingsView]    = useState<null | 'menu' | 'profile' | 'security' | 'general'>(null);
  const [statusMenuOpen,  setStatusMenuOpen]  = useState(false);
  const [identityEditorOpen,  setIdentityEditorOpen]  = useState(false);
  const [isOwnCardHovered,    setIsOwnCardHovered]    = useState(false);
  const [profileExpanded, setProfileExpanded] = useState(false);
  const mobileProfileRef = useRef<HTMLDivElement>(null);
  const statusMenuRef  = useRef<HTMLDivElement>(null);
  const footerRef      = useRef<HTMLDivElement>(null);
  const asideRef       = useRef<HTMLElement>(null);

  // Consume tour pendingAction for identity-editor and settings
  const tourPendingAction = useTourStore(s => s.pendingAction);
  const clearPendingAction = useTourStore(s => s.clearPendingAction);
  const openTour = useTourStore(s => s.openTour);

  useEffect(() => {
    if (tourPendingAction === 'identity-editor') {
      clearPendingAction();
      setIdentityEditorOpen(true);
    } else if (tourPendingAction === 'settings') {
      clearPendingAction();
      setSettingsView('profile');
    }
  }, [tourPendingAction, clearPendingAction]);

  const cardGradient = user?.card_gradient ?? 'ocean';
  const cardImage = user?.card_image_url ?? null;
  const cardCropParams = (user?.card_image_params as { zoom: number; x: number; y: number } | null) ?? { zoom: 1.5, x: 50, y: 50 };

  // Resizable card height
  const CARD_MIN_H = 70;
  const CARD_MAX_H = 280;
  const CARD_KEY = 'aero-card-height';
  const [cardHeight, setCardHeight] = useState<number | null>(() => {
    const v = localStorage.getItem(CARD_KEY);
    return v ? Math.min(CARD_MAX_H, Math.max(CARD_MIN_H, parseInt(v, 10))) : null;
  });
  const cardDragging = useRef(false);
  const cardStartY = useRef(0);
  const cardStartH = useRef(0);

  const onCardResizeDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    cardDragging.current = true;
    cardStartY.current = e.clientY;
    const el = statusMenuRef.current;
    cardStartH.current = el ? el.offsetHeight : (cardHeight ?? CARD_MIN_H);
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent) => {
      if (!cardDragging.current) return;
      const next = Math.min(CARD_MAX_H, Math.max(CARD_MIN_H, cardStartH.current + ev.clientY - cardStartY.current));
      setCardHeight(next);
    };
    const onUp = () => {
      cardDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setCardHeight(h => { if (h != null) localStorage.setItem(CARD_KEY, String(h)); return h; });
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [cardHeight]);

  const isPanelOpen = settingsView === 'profile' || settingsView === 'general' || settingsView === 'security';

  // Close menus on outside click (portaled menus use data-attr to self-identify)
  useEffect(() => {
    function handler(e: MouseEvent) {
      const t = e.target as HTMLElement;
      const inCard = statusMenuRef.current?.contains(t);
      const inFooter = footerRef.current?.contains(t);
      const inPortaledMenu = t.closest?.('[data-card-popup]');
      if (!inCard && !inFooter && !inPortaledMenu) {
        setStatusMenuOpen(false);
        if (settingsView === 'menu') setSettingsView(null);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [settingsView]);

  // Collapse mobile profile card on outside tap
  useEffect(() => {
    if (!profileExpanded) return;
    function handler(e: MouseEvent) {
      if (mobileProfileRef.current && !mobileProfileRef.current.contains(e.target as Node)) {
        setProfileExpanded(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [profileExpanded]);

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
          className="flex items-center justify-between pl-16 pr-4 py-2"
          style={{ borderBottom: '1px solid var(--panel-divider)', position: 'relative', overflow: 'visible' }}
        >
          {/* Logo circle + logo layered separately so logo isn't clipped */}
          <div
            onClick={() => user?.is_premium ? openTour() : undefined}
            style={{
              position: 'absolute', left: -16, top: -2, zIndex: 15,
              width: 52, height: 52,
              cursor: user?.is_premium ? 'pointer' : 'default',
            }}
            title={user?.is_premium ? 'Premium Tour' : undefined}
          >
            {/* Circle backdrop */}
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: 'var(--card-bg-solid, var(--bg-solid, #dceefb))',
              border: '3px solid var(--panel-divider)',
              boxShadow: '0 2px 16px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.10)',
            }} />
            {/* Logo — sits on top, not clipped by circle */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 16,
              pointerEvents: 'none',
            }}>
              <AeroLogo size={43} />
            </div>
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

      {/* ── Mobile Profile Card — collapsible ── */}
      {isMobile && (
        <div
          ref={mobileProfileRef}
          style={{
            background: 'var(--card-bg, linear-gradient(145deg, rgba(0,120,255,0.10), rgba(255,255,255,0.30)))',
            borderBottom: '1px solid var(--panel-divider)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Decorative orbs */}
          <div className="pointer-events-none absolute" style={{
            width: profileExpanded ? 80 : 50, height: profileExpanded ? 80 : 50,
            top: -15, right: -15, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0,180,255,0.18) 0%, transparent 70%)',
            filter: 'blur(8px)', transition: 'all 0.3s ease',
          }} />
          <div className="pointer-events-none absolute" style={{
            width: 35, height: 35, bottom: -8, left: 20, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(120,0,255,0.10) 0%, transparent 70%)',
            filter: 'blur(6px)',
          }} />

          {/* Collapsed row — always visible */}
          <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
            <button onClick={() => setProfileExpanded(e => !e)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <AvatarImage
                username={user?.username ?? '?'}
                avatarUrl={user?.avatar_url}
                size={profileExpanded ? 'lg' : 'md'}
                status={myStatus}
                isInCall={callStatus === 'connected'}
                playingGame={myPlayingGame}
              />
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="truncate font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                {user?.username}
              </p>
              <div style={{ fontSize: 10, color: statusColor[myStatus], display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: statusColor[myStatus] }} />
                {statusLabel[myStatus]}
              </div>
            </div>
            {/* Friend requests badge */}
            {(pendingIncoming.length > 0) && (
              <button
                onClick={() => setRequestsOpen(true)}
                style={{
                  width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,0.06)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
                  position: 'relative', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                }}
              >
                <Bell className="h-3.5 w-3.5" />
                <span style={{
                  position: 'absolute', top: -3, right: -3, width: 14, height: 14, borderRadius: '50%',
                  background: 'var(--badge-bg)', color: 'var(--badge-text)', fontSize: 8, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {pendingIncoming.length}
                </span>
              </button>
            )}
            {/* Settings gear */}
            <button
              onClick={() => setSettingsView(v => v === 'menu' ? null : 'menu')}
              style={{
                width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
            </button>
            {/* Expand/collapse chevron */}
            <ChevronUp
              className="h-3.5 w-3.5"
              style={{
                color: 'var(--text-muted)',
                transform: profileExpanded ? 'rotate(0)' : 'rotate(180deg)',
                transition: 'transform 0.2s',
                cursor: 'pointer',
              }}
              onClick={() => setProfileExpanded(e => !e)}
            />
          </div>

          {/* Expanded section — status chips */}
          <div style={{
            maxHeight: profileExpanded ? 120 : 0,
            overflow: 'hidden',
            transition: 'max-height 0.3s ease',
            padding: profileExpanded ? '0 14px 10px' : '0 14px 0',
          }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {ALL_STATUSES.map(s => (
                <button
                  key={s}
                  onClick={() => { setMyStatus(s); setProfileExpanded(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '4px 10px', borderRadius: 12, fontSize: 10,
                    background: myStatus === s ? `${statusColor[s]}22` : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${myStatus === s ? `${statusColor[s]}55` : 'rgba(255,255,255,0.08)'}`,
                    color: myStatus === s ? statusColor[s] : 'rgba(255,255,255,0.5)',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor[s] }} />
                  {statusLabel[s]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Profile Card ── */}
      {!isMobile && (
        <>
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
          ...(cardHeight != null ? { height: cardHeight } : {}),
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
        </div>

        {/* Resize handle — bottom-right corner */}
        <div
          onMouseDown={onCardResizeDown}
          style={{
            position: 'absolute', bottom: 0, right: 0,
            width: 20, height: 20, cursor: 'ns-resize', zIndex: 5,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
            padding: 3, borderRadius: '14px 0 14px 0',
          }}
          title="Resize card"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: 0.35 }}>
            <path d="M9 1L1 9M9 5L5 9M9 9L9 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" style={{ color: 'var(--text-muted)' }} />
          </svg>
        </div>

      </div>
        </>
      )}

      {/* Status menu — portaled to escape 3D card transform */}
      {statusMenuOpen && statusMenuRef.current && createPortal(
        <div
          data-card-popup
          className="rounded-[14px] overflow-hidden animate-fade-in"
          style={{
            position: 'fixed',
            zIndex: 9998,
            top: statusMenuRef.current.getBoundingClientRect().bottom + 8,
            left: statusMenuRef.current.getBoundingClientRect().left,
            width: statusMenuRef.current.getBoundingClientRect().width,
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
        </div>,
        document.body
      )}

      {/* Settings dropdown menu — portaled, anchored above footer */}
      {settingsView === 'menu' && footerRef.current && createPortal(
        <div
          data-card-popup
          className="w-52 py-1.5 shadow-xl animate-fade-in"
          style={{
            position: 'fixed',
            zIndex: 9998,
            bottom: window.innerHeight - footerRef.current.getBoundingClientRect().top + 4,
            left: footerRef.current.getBoundingClientRect().left + footerRef.current.getBoundingClientRect().width / 2 - 104,
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
        </div>,
        document.body
      )}

      {/* Identity Editor — portaled to body to escape sidebar stacking context */}
      {identityEditorOpen && createPortal(
        <IdentityEditor onClose={() => setIdentityEditorOpen(false)} />,
        document.body
      )}

      {/* ── XP Bar (premium) — connected underneath the card ── */}
      {!isMobile && user?.is_premium && (
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

      {/* ── Friends / Groups tab bar ── */}
      {!query && (
        <div className="flex items-center gap-0 mx-3 mb-2 mt-1" style={{ borderBottom: '1px solid var(--panel-divider)' }}>
          <button
            onClick={() => setActiveTab('friends')}
            className="flex-1 text-center py-2 transition-colors"
            style={{
              fontFamily: 'Inter, system-ui, sans-serif',
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: activeTab === 'friends' ? '#00d4ff' : 'var(--text-muted)',
              borderBottom: activeTab === 'friends' ? '2px solid #00d4ff' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            Friends
          </button>
          <button
            onClick={() => setActiveTab('groups')}
            className="flex-1 text-center py-2 transition-colors"
            style={{
              fontFamily: 'Inter, system-ui, sans-serif',
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: activeTab === 'groups' ? '#00d4ff' : 'var(--text-muted)',
              borderBottom: activeTab === 'groups' ? '2px solid #00d4ff' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            Groups
          </button>
        </div>
      )}
      {query && (
        <div className="px-4 pb-2 pt-1">
          <p style={{ fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 700, fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-label)' }}>
            Search Results
          </p>
        </div>
      )}

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

        {!query && activeTab === 'friends' && (
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

        {!query && activeTab === 'groups' && (
          <>
            {/* Create group button */}
            <button
              onClick={() => setShowCreateGroup(true)}
              className="flex items-center gap-2 w-full rounded-aero px-3 py-2 mb-2 text-xs font-semibold transition-colors"
              style={{ color: '#00d4ff', border: '1px dashed rgba(0,212,255,0.25)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(0,212,255,0.06)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
            >
              <Plus className="h-3.5 w-3.5" />
              Create Group
            </button>

            {groups.length === 0 && (
              <div className="flex flex-col items-center px-2 py-10 text-center gap-3">
                <Users className="h-9 w-9" style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  No groups yet.<br />Create one to get started!
                </p>
              </div>
            )}

            {groups.map(g => (
              <GroupItem
                key={g.id}
                group={g}
                isSelected={selectedGroupId === g.id}
                onSelect={() => {
                  useChatStore.getState().setSelectedGroupId(g.id);
                  useUnreadStore.getState().clear(`group:${g.id}`);
                }}
                currentUserId={user!.id}
              />
            ))}
          </>
        )}
      </nav>

      {/* ── Footer: Edit Identity + Settings ── */}
      {!isMobile && (
      <div
        ref={footerRef}
        className="flex items-center justify-center gap-2 px-3 py-2 flex-shrink-0"
        style={{ borderTop: '1px solid var(--panel-divider)' }}
      >
        <button
          onClick={() => setIdentityEditorOpen(o => !o)}
          className="flex items-center gap-1.5 rounded-aero px-3 py-1.5 text-xs font-medium transition-all"
          style={{
            color: identityEditorOpen ? 'var(--text-primary)' : 'var(--text-secondary)',
            background: identityEditorOpen ? 'var(--hover-bg)' : 'transparent',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--hover-bg)'}
          onMouseLeave={e => { if (!identityEditorOpen) (e.currentTarget as HTMLElement).style.background = ''; }}
          title="Edit identity"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          Edit Identity
        </button>
        <button
          onClick={() => setSettingsView(v => v === 'menu' ? null : 'menu')}
          className="flex items-center gap-1.5 rounded-aero px-3 py-1.5 text-xs font-medium transition-all"
          style={{
            color: settingsView ? 'var(--text-primary)' : 'var(--text-secondary)',
            background: settingsView === 'menu' ? 'var(--hover-bg)' : 'transparent',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--hover-bg)'}
          onMouseLeave={e => { if (settingsView !== 'menu') (e.currentTarget as HTMLElement).style.background = ''; }}
          title="Settings"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          Settings
        </button>
      </div>
      )}

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

      {showCreateGroup && (
        <CreateGroupModal onClose={() => setShowCreateGroup(false)} />
      )}
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
  const isMuted       = useMuteStore(s => s.mutedIds.has(friend.id));
  const toggleMute    = useMuteStore(s => s.toggleMute);
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

      {/* Mute / Remove buttons (hover, no unread) */}
      {isHovered && unread === 0 && (
        <div style={{ position: 'relative', zIndex: 4, display: 'flex', gap: 2, flexShrink: 0 }}>
          <button
            onClick={e => { e.stopPropagation(); toggleMute(friend.id); }}
            className="rounded-aero p-1 transition-all"
            style={{ color: isMuted ? '#f59e0b' : 'var(--text-muted)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = isMuted ? '#fbbf24' : '#f59e0b'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = isMuted ? '#f59e0b' : 'var(--text-muted)'; }}
            title={isMuted ? 'Unmute notifications' : 'Mute notifications'}
          >
            {isMuted ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={e => { e.stopPropagation(); removeFriend(currentUserId, friend.id); }}
            className="rounded-aero p-1 transition-all"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#e03f3f'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
            title="Remove friend"
          >
            <UserMinus className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Muted indicator (always visible when muted and not hovered) */}
      {isMuted && !isHovered && unread === 0 && (
        <div style={{
          position: 'relative', zIndex: 4, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 20, height: 20, borderRadius: 6,
          background: 'rgba(245,158,11,0.10)',
        }}>
          <BellOff className="h-3 w-3" style={{ color: '#f59e0b', opacity: 0.7 }} />
        </div>
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

// ── GroupItem ────────────────────────────────────────────────────────────────

interface GroupItemProps {
  group: GroupChat;
  isSelected: boolean;
  onSelect: () => void;
  currentUserId: string;
}

const GroupItem = memo(function GroupItem({
  group, isSelected, onSelect, currentUserId,
}: GroupItemProps) {
  const unread = useUnreadStore(s => s.counts[`group:${group.id}`] ?? 0);
  const isMuted = useMuteStore(s => s.mutedIds.has(`group:${group.id}`));
  const toggleMute = useMuteStore(s => s.toggleMute);
  const [isHovered, setIsHovered] = useState(false);
  const leaveGroup = useGroupChatStore(s => s.leaveGroup);

  const groupOnlineIds = usePresenceStore(s => s.onlineIds);

  const memberNames = group.members
    .filter(m => m.user_id !== currentUserId)
    .map(m => m.profile?.username ?? '?')
    .join(', ');

  const onlineCount = group.members.filter(m => {
    return groupOnlineIds.has(m.user_id);
  }).length;

  const cardGradientCss = CARD_GRADIENTS.find(g2 => g2.id === group.card_gradient)?.css ?? null;

  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
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
          ? '1px solid rgba(0,212,255,0.25)'
          : isHovered
            ? '1px solid rgba(255,255,255,0.08)'
            : '1px solid rgba(255,255,255,0.04)',
        cursor: 'pointer',
        background: isSelected
          ? 'linear-gradient(135deg, rgba(26,111,212,0.16) 0%, rgba(0,190,255,0.12) 100%)'
          : isHovered
            ? 'var(--hover-bg)'
            : 'transparent',
      }}
    >
      {/* Card background bleed */}
      {group.card_image_url ? (
        <>
          <div style={{ position: 'absolute', inset: 0, background: `url(${group.card_image_url}) center/cover`, borderRadius: 12 }} />
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', borderRadius: 12 }} />
        </>
      ) : cardGradientCss ? (
        <div style={{ position: 'absolute', inset: 0, background: cardGradientCss, opacity: 0.12, borderRadius: 12 }} />
      ) : null}

      {/* Stacked avatars */}
      <div style={{ position: 'relative', width: Math.min(group.members.length, 3) * 10 + 24, height: 28, flexShrink: 0, zIndex: 1 }}>
        {group.members.slice(0, 3).map((m, i) => (
          <div key={m.user_id} style={{
            position: 'absolute',
            left: i * 10,
            top: i % 2 === 0 ? 0 : 2,
            width: 24,
            height: 24,
            borderRadius: '50%',
            border: '2px solid rgba(10,22,40,0.8)',
            zIndex: 3 - i,
            overflow: 'hidden',
            background: 'var(--sidebar-bg)',
          }}>
            {m.profile?.avatar_url ? (
              <img src={m.profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{
                width: '100%', height: '100%',
                background: 'linear-gradient(135deg, #1a6fd4, #00d4ff)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, color: '#fff',
              }}>
                {(m.profile?.username ?? '?')[0].toUpperCase()}
              </div>
            )}
          </div>
        ))}
        {group.members.length > 3 && (
          <div style={{
            position: 'absolute', left: 30, top: 0,
            width: 24, height: 24, borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)',
            border: '2px solid rgba(10,22,40,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.6)',
            zIndex: 0,
          }}>
            +{group.members.length - 3}
          </div>
        )}
      </div>

      {/* Group info */}
      <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }} className="truncate">
          {group.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }} className="truncate">
            {memberNames}
          </span>
          {onlineCount > 0 && (
            <>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.15)' }}>·</span>
              <span style={{
                display: 'inline-block', width: 5, height: 5, borderRadius: '50%',
                background: '#3dd87a', boxShadow: '0 0 4px rgba(61,216,122,0.5)',
              }} />
              <span style={{ fontSize: 8, color: 'rgba(61,216,122,0.7)' }}>
                {onlineCount} online
              </span>
            </>
          )}
        </div>
      </div>

      {/* Right side: unread badge + hover actions */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
        {isHovered && (
          <>
            <div
              onClick={e => { e.stopPropagation(); toggleMute(`group:${group.id}`); }}
              className="rounded-lg p-1 transition-colors cursor-pointer"
              style={{ color: isMuted ? '#f59e0b' : 'var(--text-muted)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <BellOff className="h-3 w-3" /> : <Bell className="h-3 w-3" />}
            </div>
            <div
              onClick={e => { e.stopPropagation(); leaveGroup(group.id, currentUserId); }}
              className="rounded-lg p-1 transition-colors cursor-pointer"
              style={{ color: '#f87171' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.12)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
              title="Leave Group"
            >
              <LogOut className="h-3 w-3" />
            </div>
          </>
        )}
        {!isHovered && isMuted && (
          <div style={{
            width: 20, height: 20, borderRadius: 6,
            background: 'rgba(245,158,11,0.10)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <BellOff className="h-3 w-3" style={{ color: '#f59e0b', opacity: 0.7 }} />
          </div>
        )}
        {unread > 0 && (
          <div style={{
            background: '#ff4060', color: 'white',
            fontSize: 9, fontWeight: 700, borderRadius: 10,
            padding: '1px 6px', minWidth: 18, textAlign: 'center',
          }}>
            {unread}
          </div>
        )}
      </div>
    </button>
  );
});
