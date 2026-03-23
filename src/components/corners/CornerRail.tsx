import { useState } from 'react';
import { Gamepad2, Terminal } from 'lucide-react';
import { useCornerStore } from '../../store/cornerStore';

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
      {/* Active left-edge indicator */}
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

      {/* Tooltip */}
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

export function CornerRail() {
  const { gameViewActive, openGameHub, closeGameView, devViewActive, openDevView, closeDevView } = useCornerStore();

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
      {/* Top section */}
      <div className="flex flex-col items-center gap-3">
        <RailBtn
          icon={Gamepad2}
          isActive={gameViewActive}
          color="#00d4ff"
          tooltip={gameViewActive ? 'Back to Chat' : 'Games Corner'}
          onClick={() => gameViewActive ? closeGameView() : openGameHub()}
        />
      </div>

      {/* DEV button pinned to bottom — only in dev builds */}
      {import.meta.env.DEV && (
        <div className="mt-auto">
          <RailBtn
            icon={Terminal}
            isActive={devViewActive}
            color="#ff9d3d"
            tooltip={devViewActive ? 'Back to Chat' : 'Dev Board'}
            onClick={() => devViewActive ? closeDevView() : openDevView()}
          />
        </div>
      )}
    </div>
  );
}
