import { Lock } from 'lucide-react';
import { useRef, useState, useCallback } from 'react';
import { Sidebar } from './Sidebar';
import { ChatWindow } from './ChatWindow';
import { AeroLogo } from '../ui/AeroLogo';
import { ThemeSwitcher } from '../ui/ThemeSwitcher';
import { CornerRail } from '../corners/CornerRail';
import { GamesCorner } from '../corners/GamesCorner';
import { useChatStore } from '../../store/chatStore';
import { useCornerStore } from '../../store/cornerStore';
import { useUnreadStore } from '../../store/unreadStore';
import { useAuthStore } from '../../store/authStore';
import { useFriendStore } from '../../store/friendStore';

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
  const { gameViewActive, closeGameView } = useCornerStore();
  const { counts: unreadCounts } = useUnreadStore();
  const { user: me } = useAuthStore();
  const { friends } = useFriendStore();
  const [sidebarWidth, setSidebarWidth] = useState(getSavedWidth);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

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

  // Compute unread senders while in game view
  const unreadSenders = gameViewActive
    ? Object.entries(unreadCounts)
        .filter(([id, count]) => count > 0 && id !== me?.id)
        .map(([id, count]) => {
          const friend = friends.find(f => f.id === id);
          return { id, count, username: friend?.username ?? '?' };
        })
    : [];

  const totalUnread = unreadSenders.reduce((s, u) => s + u.count, 0);

  return (
    <div className="relative flex h-screen overflow-hidden p-3 gap-2">

      {/* Theme switcher — hidden during game view so it doesn't overlap */}
      {!gameViewActive && (
        <div className="fixed top-4 right-5 z-50 drag-region">
          <ThemeSwitcher />
        </div>
      )}

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
            transform: gameViewActive ? 'translateX(-3%) scale(0.97)' : 'translateX(0) scale(1)',
            opacity: gameViewActive ? 0 : 1,
            transition: 'transform 0.38s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.32s ease',
            pointerEvents: gameViewActive ? 'none' : 'auto',
            willChange: 'transform, opacity',
          }}
        >
          {/* Sidebar */}
          <div style={{ width: sidebarWidth, flexShrink: 0 }}>
            <Sidebar selectedUser={selectedContact} onSelectUser={setSelectedContact} />
          </div>

          {/* Drag handle */}
          <div
            onMouseDown={onMouseDown}
            className="group relative z-10 flex-shrink-0"
            style={{ width: 12, cursor: 'col-resize', display: 'flex', alignItems: 'stretch', justifyContent: 'center', padding: '0 4px' }}
          >
            <div
              className="rounded-full transition-all duration-150"
              style={{ width: 4, background: 'var(--panel-divider)', opacity: 0.6 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; (e.currentTarget as HTMLElement).style.background = 'var(--input-focus-border)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0.6'; (e.currentTarget as HTMLElement).style.background = 'var(--panel-divider)'; }}
            />
          </div>

          {/* Chat area */}
          <main className="glass-chat flex flex-1 flex-col overflow-hidden min-w-0">
            {selectedContact ? (
              <ChatWindow contact={selectedContact} />
            ) : (
              <div className="relative flex h-full items-center justify-center overflow-hidden">
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                  <div className="orb h-60 w-60 animate-pulse-glow"
                    style={{ background: 'rgba(0,190,255,0.14)', left: '18%', top: '8%' }} />
                  <div className="orb h-48 w-48 animate-pulse-glow"
                    style={{ background: 'rgba(255,160,0,0.12)', right: '12%', bottom: '18%', animationDelay: '1.5s' }} />
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
            transition: 'transform 0.38s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.32s ease',
            pointerEvents: gameViewActive ? 'auto' : 'none',
            willChange: 'transform',
          }}
        >
          <GamesCorner />
        </div>

        {/* ── In-game message notification ── */}
        {gameViewActive && totalUnread > 0 && (
          <button
            onClick={closeGameView}
            style={{
              position: 'fixed',
              bottom: 28,
              right: 28,
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 16px 10px 12px',
              borderRadius: 999,
              background: 'radial-gradient(circle at 30% 28%, rgba(255,255,255,0.22) 0%, rgba(0,180,255,0.18) 35%, rgba(0,100,220,0.12) 70%, rgba(0,60,180,0.06) 100%)',
              border: '1px solid rgba(255,255,255,0.55)',
              boxShadow: '0 0 18px rgba(0,180,255,0.35), inset 0 0 12px rgba(255,255,255,0.18), inset -1px -2px 6px rgba(120,190,255,0.22)',
              backdropFilter: 'blur(14px)',
              cursor: 'pointer',
              animation: 'bubble-notify-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards, bubble-notify-pulse 2.2s 0.5s ease-in-out infinite',
            }}
          >
            {/* Bubble highlight */}
            <div style={{
              position: 'absolute', top: '14%', left: '10%',
              width: '28%', height: '32%',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.55)',
              filter: 'blur(3px)',
              pointerEvents: 'none',
            }} />

            {/* Avatar stack or single */}
            <div className="relative flex-shrink-0" style={{ width: 32, height: 32 }}>
              {unreadSenders.slice(0, 2).map((s, i) => (
                <div
                  key={s.id}
                  style={{
                    position: 'absolute',
                    top: i * 6,
                    left: i * 6,
                    width: 26 - i * 4,
                    height: 26 - i * 4,
                    borderRadius: '50%',
                    background: `hsl(${(s.username.charCodeAt(0) * 37) % 360}, 65%, 55%)`,
                    border: '1.5px solid rgba(255,255,255,0.6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11 - i, fontWeight: 700, color: '#fff',
                    zIndex: 2 - i,
                  }}
                >
                  {s.username[0].toUpperCase()}
                </div>
              ))}
            </div>

            {/* Text */}
            <div style={{ lineHeight: 1.25 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.95)', whiteSpace: 'nowrap' }}>
                {unreadSenders.length === 1
                  ? unreadSenders[0].username
                  : `${unreadSenders.length} chats`}
              </p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.60)', whiteSpace: 'nowrap' }}>
                {totalUnread} new {totalUnread === 1 ? 'message' : 'messages'} · tap to view
              </p>
            </div>

            {/* Unread badge */}
            <div style={{
              position: 'absolute',
              top: -4, right: -4,
              minWidth: 18, height: 18,
              borderRadius: 9,
              background: '#ff4757',
              border: '2px solid rgba(2,13,36,0.8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 800, color: '#fff',
              padding: '0 4px',
            }}>
              {totalUnread > 99 ? '99+' : totalUnread}
            </div>
          </button>
        )}

      </div>
    </div>
  );
}
