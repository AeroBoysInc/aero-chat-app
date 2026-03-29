import { Lock, Bell, LogOut } from 'lucide-react';
import { lazy, Suspense, useRef, useState, useCallback, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { ChatWindow } from './ChatWindow';
import { AeroLogo } from '../ui/AeroLogo';
import { ThemeSwitcher } from '../ui/ThemeSwitcher';
import { CornerRail } from '../corners/CornerRail';
import { GamesCorner } from '../corners/GamesCorner';
import { GameChatOverlay } from '../corners/GameChatOverlay';
import { DevCorner } from '../corners/DevCorner';
const WritersCorner = lazy(() => import('../corners/WritersCorner').then(m => ({ default: m.WritersCorner })));
import { CallView } from '../call/CallView';
import { FriendRequestModal } from './FriendRequestModal';
import { useChatStore } from '../../store/chatStore';
import { useCornerStore } from '../../store/cornerStore';
import { useCallStore } from '../../store/callStore';
import { useAuthStore } from '../../store/authStore';
import { useFriendStore } from '../../store/friendStore';
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
  const { gameViewActive, devViewActive, writerViewActive } = useCornerStore();
  const anyViewActive = gameViewActive || devViewActive || writerViewActive;
  const callStatus = useCallStore(s => s.status);
  const callViewActive = callStatus !== 'idle';
  const { signOut } = useAuthStore();
  const { pendingIncoming } = useFriendStore();
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(getSavedWidth);
  const [isNight, setIsNight] = useState(() => document.documentElement.dataset.theme === 'night');
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const isMobile = useIsMobile();
  const [mobilePaneShowChat, setMobilePaneShowChat] = useState(false);

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

  // ── Desktop layout ──────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen overflow-hidden">

      {/* ── Glass top bar — AeroChat header + actions ── */}
      <div className="drag-region flex-shrink-0 px-3 pt-3 pb-2">
        <div style={{
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
          padding: '8px 16px',
          borderRadius: 14,
          background: 'var(--sidebar-bg)',
          border: '1px solid var(--panel-divider)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          boxShadow: '0 2px 16px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.10)',
        }}>
          {/* Logo + title — absolutely centered */}
          <div style={{
            position: 'absolute', left: 0, right: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            pointerEvents: 'none',
          }}>
            <AeroLogo size={26} />
            <span style={{ fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 800, fontSize: 15, color: 'var(--text-title)', letterSpacing: '-0.3px' }}>
              AeroChat
            </span>
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
            {!anyViewActive && <ThemeSwitcher />}
          </div>
        </div>

        {requestsOpen && <FriendRequestModal onClose={() => setRequestsOpen(false)} />}
      </div>

      <div className="relative flex flex-1 min-h-0 overflow-hidden px-3 pb-3 gap-2">

      {/* ── Corner Rail — always visible ── */}
      <CornerRail />

      {/* ── Layer host — chat and game views stacked ── */}
      <div className="relative flex-1 min-w-0 overflow-hidden" style={{ borderRadius: 16 }}>

        {/* CHAT LAYER */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            gap: 0,
            transform: anyViewActive ? 'translateX(-3%) scale(0.97)' : 'translateX(0) scale(1)',
            opacity: anyViewActive ? 0 : 1,
            transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.18s ease',
            pointerEvents: anyViewActive ? 'none' : 'auto',
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

          {/* Chat area */}
          <main className="glass-chat flex flex-1 flex-col overflow-hidden min-w-0" style={{ position: 'relative', zIndex: 1 }}>
            {selectedContact ? (
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
                    <AeroLogo size={72} className="opacity-40" />
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
            transform: gameViewActive ? 'translateX(0)' : 'translateX(102%)',
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
            transform: writerViewActive ? 'translateX(0)' : 'translateX(102%)',
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

        {/* DEV LAYER — only rendered in dev builds */}
        {import.meta.env.DEV && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              transform: devViewActive ? 'translateX(0)' : 'translateX(102%)',
              opacity: devViewActive ? 1 : 0,
              transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.18s ease',
              pointerEvents: devViewActive ? 'auto' : 'none',
            }}
          >
            <DevCorner />
          </div>
        )}

        {/* CALL OVERLAY — above all layers so incoming calls are always visible */}
        {callViewActive && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 50 }}>
            <CallView />
          </div>
        )}

      </div>

      </div>
    </div>
  );
}
