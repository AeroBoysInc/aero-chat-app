// src/components/corners/CornerRail.tsx
import { useState } from 'react';
import { Gamepad2, Terminal, PenTool, CalendarDays, Globe, User } from 'lucide-react';
import { useCornerStore } from '../../store/cornerStore';
import { useServerStore } from '../../store/serverStore';

interface RailBtnProps {
  icon: React.ComponentType<{ style?: React.CSSProperties; className?: string }>;
  isActive: boolean;
  color: string;
  tooltip: string;
  onClick: () => void;
}

function RailBtn({ icon: Icon, isActive, color, tooltip, onClick }: RailBtnProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {isActive && (
        <div
          className="absolute top-1/2 -translate-y-1/2 rounded-r-full"
          style={{ left: -13, width: 4, height: 32, background: color, boxShadow: `0 0 8px ${color}` }}
        />
      )}

      <button
        onClick={onClick}
        style={{
          width: 36, height: 36,
          borderRadius: isActive || hovered ? '30%' : '50%',
          background: isActive
            ? `linear-gradient(135deg, ${color}35, ${color}18)`
            : hovered ? 'var(--rail-bg-hover)' : 'var(--rail-bg-idle)',
          border: `1px solid ${isActive ? `${color}55` : 'var(--rail-border)'}`,
          color: isActive ? color : hovered ? 'var(--rail-icon-hover)' : 'var(--rail-icon)',
          boxShadow: isActive ? `0 0 14px ${color}40` : 'none',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', outline: 'none',
        }}
      >
        <Icon style={{ width: 16, height: 16 }} />
      </button>

      {hovered && (
        <div
          className="absolute left-11 top-1/2 -translate-y-1/2 z-50 animate-fade-in"
          style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}
        >
          <div
            className="rounded-aero px-3 py-1.5 text-xs font-medium"
            style={{
              background: 'rgba(8,18,45,0.95)',
              border: '1px solid rgba(255,255,255,0.14)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
              backdropFilter: 'blur(10px)',
              color: 'rgba(255,255,255,0.88)',
            }}
          >
            {tooltip}
          </div>
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-full"
            style={{
              left: 0,
              borderTop: '5px solid transparent',
              borderBottom: '5px solid transparent',
              borderRight: '5px solid rgba(8,18,45,0.95)',
            }}
          />
        </div>
      )}
    </div>
  );
}

export function CornerRail({ onCornerTransition }: { onCornerTransition?: (action: () => void) => void }) {
  const {
    gameViewActive, openGameHub, closeGameView,
    devViewActive, openDevView, closeDevView,
    writerViewActive, openWriterHub, closeWriterView,
    calendarViewActive, openCalendarView, closeCalendarView,
    avatarViewActive, openAvatarView, closeAvatarView,
    serverView, openServerOverlay, closeServerOverlay,
  } = useCornerStore();

  const transition = (action: () => void) => onCornerTransition ? onCornerTransition(action) : action();

  const serverUnreads = useServerStore(s => s.serverUnreads);
  const totalUnread = Object.values(serverUnreads).reduce((a, b) => a + b, 0);

  return (
    <div
      className="flex flex-col items-center py-4"
      style={{
        width: 52, flexShrink: 0,
        background: 'var(--sidebar-bg)',
        borderRadius: 16,
        border: '1px solid var(--sidebar-border)',
        boxShadow: 'var(--sidebar-shadow)',
        zIndex: 10,
      }}
    >
      <div className="flex flex-col items-center gap-3">
        <RailBtn
          icon={Gamepad2}
          isActive={gameViewActive}
          color="#00d4ff"
          tooltip={gameViewActive ? 'Back to Chat' : 'Games Corner'}
          onClick={() => transition(gameViewActive ? closeGameView : openGameHub)}
        />
        <RailBtn
          icon={PenTool}
          isActive={writerViewActive}
          color="#a855f7"
          tooltip={writerViewActive ? 'Back to Chat' : 'Writers Corner'}
          onClick={() => transition(writerViewActive ? closeWriterView : openWriterHub)}
        />
        <RailBtn
          icon={CalendarDays}
          isActive={calendarViewActive}
          color="#3dd87a"
          tooltip={calendarViewActive ? 'Back to Chat' : 'Calendar & Tasks'}
          onClick={() => transition(calendarViewActive ? closeCalendarView : openCalendarView)}
        />
        <RailBtn
          icon={User}
          isActive={avatarViewActive}
          color="#f59e0b"
          tooltip={avatarViewActive ? 'Back to Chat' : 'Avatar Corner'}
          onClick={() => transition(avatarViewActive ? closeAvatarView : openAvatarView)}
        />

      </div>

      {/* Bottom section — Servers (with glow) + Dev */}
      <div className="mt-auto flex flex-col items-center gap-3">
        {import.meta.env.DEV && (
          <RailBtn
            icon={Terminal}
            isActive={devViewActive}
            color="#ff9d3d"
            tooltip={devViewActive ? 'Back to Chat' : 'Dev Board'}
            onClick={() => transition(devViewActive ? closeDevView : openDevView)}
          />
        )}

        {/* Separator */}
        <div style={{ width: 20, height: 1, background: 'var(--panel-divider)', opacity: 0.5 }} />

        {/* Servers — bottom with glow */}
        <div className="relative">
          <RailBtn
            icon={Globe}
            isActive={serverView === 'overlay' || serverView === 'server' || serverView === 'bubble'}
            color="#00d4ff"
            tooltip={serverView ? 'Close Servers' : 'Servers'}
            onClick={() => transition(serverView ? closeServerOverlay : openServerOverlay)}
          />
          {/* Persistent glow ring */}
          <div
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{
              boxShadow: '0 0 12px rgba(0,212,255,0.3), 0 0 24px rgba(0,212,255,0.12)',
              animation: 'server-rail-glow 3s ease-in-out infinite',
            }}
          />
          <style>{`@keyframes server-rail-glow {
            0%, 100% { box-shadow: 0 0 12px rgba(0,212,255,0.3), 0 0 24px rgba(0,212,255,0.12); }
            50% { box-shadow: 0 0 18px rgba(0,212,255,0.45), 0 0 36px rgba(0,212,255,0.2); }
          }`}</style>
          {totalUnread > 0 && !serverView && (
            <div
              className="absolute -top-1 -right-1 flex items-center justify-center rounded-full"
              style={{
                minWidth: 16, height: 16, padding: '0 4px',
                background: '#ff2e63', fontSize: 9, fontWeight: 700,
                color: 'white', border: '2px solid var(--sidebar-bg)',
              }}
            >
              {totalUnread > 99 ? '99+' : totalUnread}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
