import { Lock } from 'lucide-react';
import { useRef, useState, useCallback } from 'react';
import { Sidebar } from './Sidebar';
import { ChatWindow } from './ChatWindow';
import { AeroLogo } from '../ui/AeroLogo';
import { ThemeSwitcher } from '../ui/ThemeSwitcher';
import { CornerRail } from '../corners/CornerRail';
import { GamesCorner } from '../corners/GamesCorner';
import { VideoCorner } from '../corners/VideoCorner';
import { useChatStore } from '../../store/chatStore';
import { useCornerStore } from '../../store/cornerStore';

const SIDEBAR_MIN = 200;
const SIDEBAR_MAX = 480;
const SIDEBAR_DEFAULT = 260;
const STORAGE_KEY = 'aero_sidebar_width';
const PANEL_WIDTH = 308; // corner panel width + 8px gap

function getSavedWidth(): number {
  const v = localStorage.getItem(STORAGE_KEY);
  const n = v ? parseInt(v, 10) : NaN;
  return isNaN(n) ? SIDEBAR_DEFAULT : Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, n));
}

export function ChatLayout() {
  const { selectedContact, setSelectedContact } = useChatStore();
  const { activePanel, setActivePanel } = useCornerStore();
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

  return (
    <div className="relative flex h-screen overflow-hidden p-3 gap-2">

      {/* Theme switcher — fixed top-right */}
      <div className="fixed top-4 right-5 z-50 drag-region">
        <ThemeSwitcher />
      </div>

      {/* ── Corner Rail — always visible ── */}
      <CornerRail />

      {/* ── Corner Panels — width-animated, always mounted so video keeps playing ── */}

      {/* Games panel */}
      <div
        style={{
          width: activePanel === 'games' ? PANEL_WIDTH : 0,
          flexShrink: 0,
          overflow: 'hidden',
          transition: 'width 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <GamesCorner />
      </div>

      {/* Video panel — stays mounted so audio continues when panel is closed */}
      <div
        style={{
          width: activePanel === 'video' ? PANEL_WIDTH : 0,
          flexShrink: 0,
          overflow: 'hidden',
          transition: 'width 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <VideoCorner />
      </div>

      {/* ── Main content — clicking here closes the active panel ── */}
      <div
        className="flex flex-1 gap-0 min-w-0"
        onClick={() => { if (activePanel) setActivePanel(null); }}
      >
        {/* Sidebar */}
        <div style={{ width: sidebarWidth, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <Sidebar selectedUser={selectedContact} onSelectUser={setSelectedContact} />
        </div>

        {/* Drag handle */}
        <div
          onMouseDown={onMouseDown}
          className="group relative z-10 flex-shrink-0"
          style={{ width: 12, cursor: 'col-resize', display: 'flex', alignItems: 'stretch', justifyContent: 'center', padding: '0 4px' }}
          onClick={e => e.stopPropagation()}
        >
          <div
            className="rounded-full transition-all duration-150"
            style={{ width: 4, background: 'var(--panel-divider)', opacity: 0.6 }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; (e.currentTarget as HTMLElement).style.background = 'var(--input-focus-border)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0.6'; (e.currentTarget as HTMLElement).style.background = 'var(--panel-divider)'; }}
          />
        </div>

        {/* Chat area */}
        <main className="glass-chat flex flex-1 flex-col overflow-hidden min-w-0" onClick={e => e.stopPropagation()}>
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
    </div>
  );
}
