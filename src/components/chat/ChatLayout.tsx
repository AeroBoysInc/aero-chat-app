import { Lock, Bell, LogOut } from 'lucide-react';
import { lazy, Suspense, useRef, useState, useCallback, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { ChatWindow } from './ChatWindow';
import { AeroLogo } from '../ui/AeroLogo';
import { ThemeSwitcher } from '../ui/ThemeSwitcher';
import { CornerRail } from '../corners/CornerRail';
import { TransitionWipe } from '../ui/TransitionWipe';
import { GamesCorner } from '../corners/GamesCorner';
import { GameChatOverlay } from '../corners/GameChatOverlay';
import { DevCorner } from '../corners/DevCorner';
const WritersCorner = lazy(() => import('../corners/WritersCorner').then(m => ({ default: m.WritersCorner })));
const CalendarCorner = lazy(() => import('../corners/CalendarCorner').then(m => ({ default: m.CalendarCorner })));
const AvatarCorner = lazy(() => import('../corners/AvatarCorner').then(m => ({ default: m.AvatarCorner })));
import { CallView } from '../call/CallView';
import { GroupCallView } from '../call/GroupCallView';
import { MiniCallWidget } from '../call/MiniCallWidget';
import { FriendRequestModal } from './FriendRequestModal';
import { ServerOverlay } from '../servers/ServerOverlay';
import { ServerView } from '../servers/ServerView';
import { CreateServerWizard } from '../servers/CreateServerWizard';
import { JoinServerModal } from '../servers/JoinServerModal';
import { PremiumModal } from '../ui/PremiumModal';
import { AmbientBackground } from '../ui/AmbientBackground';
import { playSwoosh } from '../../lib/swooshSound';
import { useChatStore } from '../../store/chatStore';
import { useCornerStore } from '../../store/cornerStore';
import { useCallStore } from '../../store/callStore';
import { useGroupCallStore } from '../../store/groupCallStore';
import { useAuthStore } from '../../store/authStore';
import { useFriendStore } from '../../store/friendStore';
import { useThemeStore, isUltraTheme, isMasterTheme } from '../../store/themeStore';

const MasterThemeDashboard = lazy(() => import('../master/MasterThemeDashboard').then(m => ({ default: m.MasterThemeDashboard })));
import { useIsMobile } from '../../lib/useIsMobile';

const SIDEBAR_MIN = 200;
const SIDEBAR_MAX = 480;
const SIDEBAR_DEFAULT = 260;
const STORAGE_KEY = 'aero_sidebar_width';

function getSavedWidth(): number {
  const v = localStorage.getItem(STORAGE_KEY);
  const n = v ? parseInt(v, 10) : NaN;
  return isNaN(n) ? SIDEBAR_DEFAULT : Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, n));
}

export function ChatLayout() {
  const { selectedContact, setSelectedContact } = useChatStore();
  const { gameViewActive, devViewActive, writerViewActive, calendarViewActive, avatarViewActive, serverView, cornerPosition, rearrangeMode, setCornerPosition, setRearrangeMode } = useCornerStore();
  const anyViewActive = gameViewActive || devViewActive || writerViewActive || calendarViewActive || avatarViewActive;
  const serverActive = serverView === 'server' || serverView === 'bubble';
  const prevServerActive = useRef(false);
  useEffect(() => {
    if (serverActive && !prevServerActive.current) playSwoosh();
    prevServerActive.current = serverActive;
  }, [serverActive]);
  const callStatus = useCallStore(s => s.status);
  const callActive = callStatus !== 'idle';
  const groupCallStatus = useGroupCallStore(s => s.status);
  const groupCallActive = groupCallStatus !== 'idle' && groupCallStatus !== 'ringing';
  const anyCallActive = callActive || groupCallActive;
  const { user, signOut } = useAuthStore();
  const isPremium = user?.is_premium === true;
  const activeTheme = useThemeStore(s => s.theme);

  // Load ultra theme ownership on mount
  useEffect(() => {
    if (user?.id) useThemeStore.getState().loadOwnership(user.id);
  }, [user?.id]);

  // If user loses premium, fall back from ultra theme
  useEffect(() => {
    if (!isPremium && (isUltraTheme(activeTheme) || isMasterTheme(activeTheme))) {
      useThemeStore.getState().setTheme('day');
    }
  }, [isPremium, activeTheme]);

  const { pendingIncoming } = useFriendStore();
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [premiumModalOpen, setPremiumModalOpen] = useState(false);
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(getSavedWidth);
  const [isNight, setIsNight] = useState(() => document.documentElement.dataset.theme === 'night');
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const isMobile = useIsMobile();
  const [mobilePaneShowChat, setMobilePaneShowChat] = useState(false);
  const [cornerWipeActive, setCornerWipeActive] = useState(false);
  const pendingCornerAction = useRef<(() => void) | null>(null);

  // Compute off-screen transform for corner layers based on rail position
  const cornerOffTransform =
    cornerPosition === 'right'  ? 'translateX(-102%)' :
    cornerPosition === 'bottom' ? 'translateY(102%)' :
    cornerPosition === 'top'    ? 'translateY(-102%)' :
                                  'translateX(102%)';
  const chatDismissTransform =
    cornerPosition === 'right'  ? 'translateX(3%) scale(0.97)' :
    cornerPosition === 'bottom' ? 'translateY(-3%) scale(0.97)' :
    cornerPosition === 'top'    ? 'translateY(3%) scale(0.97)' :
                                  'translateX(-3%) scale(0.97)';

  // Track theme changes for orb colour switching
  useEffect(() => {
    const obs = new MutationObserver(() => setIsNight(document.documentElement.dataset.theme === 'night'));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  // Slide to chat pane whenever a contact is selected on mobile
  useEffect(() => {
    if (isMobile && selectedContact) setMobilePaneShowChat(true);
  }, [selectedContact, isMobile]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    startX.current = e.clientX;
    startWidth.current = sidebarWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const next = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startWidth.current + ev.clientX - startX.current));
      setSidebarWidth(next);
    };
    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setSidebarWidth(w => { localStorage.setItem(STORAGE_KEY, String(w)); return w; });
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [sidebarWidth]);

  const triggerCornerTransition = useCallback((action: () => void) => {
    if (isUltraTheme(activeTheme)) {
      pendingCornerAction.current = action;
      setCornerWipeActive(true);
    } else {
      action();
    }
  }, [activeTheme]);

  // ── Mobile layout — single-pane slide navigation ──────────────────────────
  if (isMobile) {
    return (
      <div className="relative h-screen overflow-hidden" style={{ background: 'var(--sidebar-bg)' }}>

        {/* Theme switcher — top right */}
        <div className="fixed top-3 right-3 z-50">
          <ThemeSwitcher />
        </div>

        {/* Sidebar pane — slides out left when chat opens */}
        <div style={{
          position: 'absolute', inset: 0,
          transform: mobilePaneShowChat ? 'translateX(-100%)' : 'translateX(0)',
          transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        }}>
          <Sidebar selectedUser={selectedContact} onSelectUser={setSelectedContact} isMobile />
        </div>

        {/* Chat pane — slides in from right */}
        <div style={{
          position: 'absolute', inset: 0,
          transform: mobilePaneShowChat ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        }}>
          {selectedContact && (
            <div className="flex h-full flex-col" style={{ background: 'var(--sidebar-bg)' }}>
              <ChatWindow
                contact={selectedContact}
                onBack={() => setMobilePaneShowChat(false)}
              />
            </div>
          )}
        </div>

      </div>
    );
  }

  // ── Master Theme — completely different layout ──
  if (isMasterTheme(activeTheme)) {
    return (
      <Suspense fallback={<div style={{ background: '#050505', height: '100vh' }} />}>
        <MasterThemeDashboard />
      </Suspense>
    );
  }

  // ── Desktop layout ──────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ position: 'relative' }}>
      <AmbientBackground />

      {/* ── Glass top bar — AeroChat header + actions ── */}
      <div className="drag-region flex-shrink-0 px-3 pt-3 pb-2" style={{ paddingLeft: 40 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
          padding: '4px 16px 4px 50px',
          borderRadius: 14,
          background: 'var(--sidebar-bg)',
          border: '1px solid var(--panel-divider)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          boxShadow: '0 2px 16px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.10)',
          overflow: 'visible',
        }}>
          {/* Logo circle + logo layered separately so logo isn't clipped */}
          <div style={{
            position: 'absolute', left: -30, top: -6, zIndex: 15,
            width: 52, height: 52,
          }}>
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
              <AeroLogo size={80} />
            </div>
          </div>

          {/* Left side — Unlock Aero+ button for free users */}
          {!isPremium && (
            <button
              onClick={() => setPremiumModalOpen(true)}
              className="no-drag flex items-center gap-1.5 rounded-full transition-all hover:scale-[1.03] active:scale-[0.97]"
              style={{
                position: 'relative', zIndex: 1,
                padding: '5px 12px',
                fontSize: 11, fontWeight: 700,
                fontFamily: 'Inter, system-ui, sans-serif',
                letterSpacing: '0.01em',
                background: 'linear-gradient(135deg, rgba(255,215,0,0.12), rgba(255,165,0,0.08))',
                border: '1px solid rgba(255,215,0,0.25)',
                color: '#FFD700',
                cursor: 'pointer',
              }}
            >
              Unlock Aero<span style={{ fontWeight: 900 }}>+</span>
            </button>
          )}

          {/* Title — sits after the protruding logo */}
          <div style={{
            position: 'absolute', left: 44, top: 0, bottom: 0,
            display: 'flex', alignItems: 'center', gap: 4,
            pointerEvents: 'none',
          }}>
            <span style={{ fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 800, fontSize: 17, color: 'var(--text-title)', letterSpacing: '-0.4px' }}>
              AeroChat
            </span>
            {isPremium && (
              <span style={{
                fontWeight: 900, fontSize: 18,
                background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                +
              </span>
            )}
          </div>

          {/* Actions — right side */}
          <div className="flex items-center gap-0.5 ml-auto" style={{ position: 'relative', zIndex: 1 }}>
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
            <ThemeSwitcher />
          </div>
        </div>

        {requestsOpen && <FriendRequestModal onClose={() => setRequestsOpen(false)} />}
        <PremiumModal open={premiumModalOpen} onClose={() => setPremiumModalOpen(false)} />
      </div>

      <div
        className={`relative flex flex-1 min-h-0 overflow-hidden px-3 pb-3 gap-2 ${cornerPosition === 'bottom' ? 'flex-col-reverse' : cornerPosition === 'top' ? 'flex-col' : cornerPosition === 'right' ? 'flex-row-reverse' : 'flex-row'}`}
      >

      {/* ── Corner Rail — always visible ── */}
      <CornerRail onCornerTransition={triggerCornerTransition} />

      {/* ── Layer host — chat and game views stacked ── */}
      <div className="relative flex-1 min-w-0 min-h-0 overflow-hidden" style={{ borderRadius: 18 }}>

        {/* CHAT LAYER */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            gap: 0,
            transform: serverActive ? 'scale(0.92) translateY(-15px)' : (anyViewActive ? chatDismissTransform : 'translateX(0) scale(1)'),
            opacity: (anyViewActive || serverActive) ? 0 : 1,
            filter: serverActive ? 'blur(12px)' : 'none',
            transition: serverActive
              ? 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s ease, filter 0.4s ease'
              : 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.18s ease',
            pointerEvents: (anyViewActive || serverActive) ? 'none' : 'auto',
          }}
        >
          {/* Atmospheric background orbs — behind both glass panels */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 0 }}>
            <div className="orb" style={{
              width: 320, height: 320, left: '8%', top: '10%',
              background: `radial-gradient(circle, ${isNight ? 'rgba(0,160,255,0.10)' : 'rgba(0,180,255,0.12)'} 0%, transparent 70%)`,
              animation: 'orb-drift 8s ease-in-out infinite',
            }} />
            <div className="orb" style={{
              width: 260, height: 260, right: '6%', bottom: '20%',
              background: `radial-gradient(circle, ${isNight ? 'rgba(120,0,200,0.08)' : 'rgba(255,160,0,0.10)'} 0%, transparent 70%)`,
              animation: 'orb-drift 7s ease-in-out 2s infinite',
            }} />
            <div className="orb" style={{
              width: 200, height: 200, left: '40%', bottom: '8%',
              background: `radial-gradient(circle, ${isNight ? 'rgba(0,200,160,0.09)' : 'rgba(80,200,120,0.08)'} 0%, transparent 70%)`,
              animation: 'orb-drift 9s ease-in-out 4s infinite',
            }} />
          </div>

          {/* Sidebar */}
          <div style={{ width: sidebarWidth, flexShrink: 0, position: 'relative', zIndex: 1 }}>
            <Sidebar selectedUser={selectedContact} onSelectUser={setSelectedContact} />
          </div>

          {/* Drag handle */}
          <div
            onMouseDown={onMouseDown}
            className="group relative flex-shrink-0"
            style={{ width: 12, cursor: 'col-resize', display: 'flex', alignItems: 'stretch', justifyContent: 'center', padding: '0 4px', position: 'relative', zIndex: 1 }}
          >
            <div
              className="rounded-full transition-all duration-150"
              style={{ width: 4, background: 'var(--panel-divider)', opacity: 0.6 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; (e.currentTarget as HTMLElement).style.background = 'var(--input-focus-border)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0.6'; (e.currentTarget as HTMLElement).style.background = 'var(--panel-divider)'; }}
            />
          </div>

          {/* Chat area / Call area */}
          <main className="glass-chat flex flex-1 flex-col overflow-hidden min-w-0" style={{ position: 'relative', zIndex: 1 }}>
            {/* 1:1 call — replaces chat window */}
            {callActive ? (
              <CallView />
            ) : groupCallActive ? (
              <GroupCallView />
            ) : selectedContact ? (
              <ChatWindow contact={selectedContact} />
            ) : (
              <div className="relative flex h-full items-center justify-center overflow-hidden">
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                  <div className="orb h-60 w-60"
                    style={{ background: 'radial-gradient(circle, rgba(0,190,255,0.14) 0%, transparent 70%)', left: '18%', top: '8%', animation: 'orb-drift 8s ease-in-out infinite' }} />
                  <div className="orb h-48 w-48"
                    style={{ background: 'radial-gradient(circle, rgba(255,160,0,0.12) 0%, transparent 70%)', right: '12%', bottom: '18%', animation: 'orb-drift 6s ease-in-out 1.5s infinite' }} />
                </div>

                <div className="relative text-center animate-fade-in">
                  <div className="mx-auto mb-5 animate-float">
                    <AeroLogo size={140} className="opacity-40" />
                  </div>
                  <p className="text-base font-bold" style={{ color: 'var(--text-secondary)' }}>
                    Select a conversation
                  </p>
                  <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                    Choose a friend from the sidebar to start chatting
                  </p>
                  <div className="mt-5 flex items-center justify-center gap-1.5 text-xs"
                    style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
                    <Lock className="h-3 w-3" />
                    <span>All messages are end-to-end encrypted</span>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>

        {/* GAME LAYER */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transform: gameViewActive ? 'translateX(0)' : cornerOffTransform,
            opacity: gameViewActive ? 1 : 0,
            transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.18s ease',
            pointerEvents: gameViewActive ? 'auto' : 'none',
          }}
        >
          <GamesCorner />
          <GameChatOverlay />
        </div>

        {/* ── WRITER LAYER ──────────────────────────────────── */}
        <div
          style={{
            position: 'absolute', inset: 0,
            transform: writerViewActive ? 'translateX(0)' : cornerOffTransform,
            opacity: writerViewActive ? 1 : 0,
            transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.18s ease',
            pointerEvents: writerViewActive ? 'auto' : 'none',
          }}
        >
          <Suspense fallback={
            <div className="flex h-full items-center justify-center" style={{ color: 'rgba(168,85,247,0.7)', fontSize: 13 }}>
              Loading Writers Corner...
            </div>
          }>
            <WritersCorner />
          </Suspense>
        </div>

        {/* ── CALENDAR LAYER ──────────────────────────────────── */}
        <div
          style={{
            position: 'absolute', inset: 0,
            transform: calendarViewActive ? 'translateX(0)' : cornerOffTransform,
            opacity: calendarViewActive ? 1 : 0,
            transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.18s ease',
            pointerEvents: calendarViewActive ? 'auto' : 'none',
          }}
        >
          <Suspense fallback={
            <div className="flex h-full items-center justify-center" style={{ color: 'rgba(61,216,122,0.7)', fontSize: 13 }}>
              Loading Calendar...
            </div>
          }>
            <CalendarCorner />
          </Suspense>
        </div>

        {/* ── AVATAR LAYER ──────────────────────────────────── */}
        <div
          style={{
            position: 'absolute', inset: 0,
            transform: avatarViewActive ? 'translateX(0)' : cornerOffTransform,
            opacity: avatarViewActive ? 1 : 0,
            transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.18s ease',
            pointerEvents: avatarViewActive ? 'auto' : 'none',
          }}
        >
          <Suspense fallback={
            <div className="flex h-full items-center justify-center" style={{ color: 'rgba(245,158,11,0.7)', fontSize: 13 }}>
              Loading Avatar Corner...
            </div>
          }>
            <AvatarCorner />
          </Suspense>
        </div>

        {/* DEV LAYER — only rendered in dev builds */}
        {import.meta.env.DEV && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              transform: devViewActive ? 'translateX(0)' : cornerOffTransform,
              opacity: devViewActive ? 1 : 0,
              transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.18s ease',
              pointerEvents: devViewActive ? 'auto' : 'none',
            }}
          >
            <DevCorner />
          </div>
        )}

        {/* ── SERVER LAYER (full takeover — dramatic zoom-in) ──────── */}
        <div
          style={{
            position: 'absolute', inset: 0,
            transform: serverActive ? 'scale(1) translateY(0)' : 'scale(0.85) translateY(30px)',
            opacity: serverActive ? 1 : 0,
            filter: serverActive ? 'blur(0px)' : 'blur(6px)',
            transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease, filter 0.4s ease',
            pointerEvents: serverActive ? 'auto' : 'none',
            borderRadius: 18, overflow: 'hidden',
          }}
        >
          <ServerView />
        </div>

        {/* MINI CALL WIDGET — shown over corners when a call is active */}
        {anyCallActive && anyViewActive && <MiniCallWidget />}

        {/* GROUP CALL RINGING MODAL — always on top */}
        {groupCallStatus === 'ringing' && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
            <GroupCallView />
          </div>
        )}

      </div>

      {/* Server overlay + modals — rendered outside the layer host */}
      {serverView === 'overlay' && (
        <ServerOverlay
          onCreateClick={() => setShowCreateWizard(true)}
          onJoinClick={() => setShowJoinModal(true)}
        />
      )}
      {showCreateWizard && <CreateServerWizard onClose={() => setShowCreateWizard(false)} />}
      {showJoinModal && <JoinServerModal onClose={() => setShowJoinModal(false)} />}

      <TransitionWipe
        active={cornerWipeActive}
        onMidpoint={() => {
          pendingCornerAction.current?.();
          pendingCornerAction.current = null;
        }}
        onComplete={() => setCornerWipeActive(false)}
      />

      {/* ── Ghost drop zones — shown during rearrange mode ── */}
      {rearrangeMode && (
        <div
          className="absolute inset-0 animate-fade-in"
          style={{ zIndex: 50, pointerEvents: 'auto' }}
          onClick={() => setRearrangeMode(false)}
        >
          {/* Backdrop dimmer */}
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }} />

          {/* LEFT ghost zone — only if not already there */}
          {cornerPosition !== 'left' && (
            <button
              onClick={(e) => { e.stopPropagation(); setCornerPosition('left'); }}
              style={{
                position: 'absolute', left: 12, top: 12, bottom: 12, width: 64,
                borderRadius: 16,
                background: 'rgba(0,212,255,0.06)',
                border: '2px dashed rgba(0,212,255,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                animation: 'ghost-zone-pulse 2s ease-in-out infinite',
                transition: 'background 0.2s, border-color 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,212,255,0.14)'; e.currentTarget.style.borderColor = 'rgba(0,212,255,0.5)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,212,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(0,212,255,0.25)'; }}
            >
              <span style={{ writingMode: 'vertical-lr', fontSize: 11, fontWeight: 700, color: 'rgba(0,212,255,0.5)', letterSpacing: '0.06em' }}>
                LEFT
              </span>
            </button>
          )}

          {/* TOP ghost zone — only if not already there */}
          {cornerPosition !== 'top' && (
            <button
              onClick={(e) => { e.stopPropagation(); setCornerPosition('top'); }}
              style={{
                position: 'absolute', left: 88, right: 88, top: 12, height: 64,
                borderRadius: 16,
                background: 'rgba(0,212,255,0.06)',
                border: '2px dashed rgba(0,212,255,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                animation: 'ghost-zone-pulse 2s ease-in-out 0.3s infinite',
                transition: 'background 0.2s, border-color 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,212,255,0.14)'; e.currentTarget.style.borderColor = 'rgba(0,212,255,0.5)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,212,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(0,212,255,0.25)'; }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(0,212,255,0.5)', letterSpacing: '0.06em' }}>
                TOP
              </span>
            </button>
          )}

          {/* BOTTOM ghost zone — only if not already there */}
          {cornerPosition !== 'bottom' && (
            <button
              onClick={(e) => { e.stopPropagation(); setCornerPosition('bottom'); }}
              style={{
                position: 'absolute', left: 88, right: 88, bottom: 12, height: 64,
                borderRadius: 16,
                background: 'rgba(0,212,255,0.06)',
                border: '2px dashed rgba(0,212,255,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                animation: 'ghost-zone-pulse 2s ease-in-out 0.5s infinite',
                transition: 'background 0.2s, border-color 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,212,255,0.14)'; e.currentTarget.style.borderColor = 'rgba(0,212,255,0.5)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,212,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(0,212,255,0.25)'; }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(0,212,255,0.5)', letterSpacing: '0.06em' }}>
                BOTTOM
              </span>
            </button>
          )}

          {/* RIGHT ghost zone — only if not already there */}
          {cornerPosition !== 'right' && (
            <button
              onClick={(e) => { e.stopPropagation(); setCornerPosition('right'); }}
              style={{
                position: 'absolute', right: 12, top: 12, bottom: 12, width: 64,
                borderRadius: 16,
                background: 'rgba(0,212,255,0.06)',
                border: '2px dashed rgba(0,212,255,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                animation: 'ghost-zone-pulse 2s ease-in-out 1s infinite',
                transition: 'background 0.2s, border-color 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,212,255,0.14)'; e.currentTarget.style.borderColor = 'rgba(0,212,255,0.5)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,212,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(0,212,255,0.25)'; }}
            >
              <span style={{ writingMode: 'vertical-lr', fontSize: 11, fontWeight: 700, color: 'rgba(0,212,255,0.5)', letterSpacing: '0.06em' }}>
                RIGHT
              </span>
            </button>
          )}

          {/* Instructions */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            textAlign: 'center', pointerEvents: 'none',
          }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.8)', marginBottom: 4 }}>
              Move Corners Rail
            </p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
              Click a zone to place it &middot; Click anywhere to cancel
            </p>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}
