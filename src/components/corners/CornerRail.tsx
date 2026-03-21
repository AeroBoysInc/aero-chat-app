import { useState } from 'react';
import { Gamepad2, Music2 } from 'lucide-react';
import { useCornerStore, type CornerPanel } from '../../store/cornerStore';

interface RailItem {
  id: Exclude<CornerPanel, null>;
  Icon: React.FC<{ style?: React.CSSProperties }>;
  label: string;
  color: string;
}

const ITEMS: RailItem[] = [
  { id: 'games', Icon: Gamepad2 as any, label: 'Games Corner', color: '#00d4ff' },
  { id: 'music', Icon: Music2   as any, label: 'Music Corner', color: '#1DB954' },
];

export function CornerRail() {
  const { activePanel, setActivePanel, musicTitle, spotifyConnected } = useCornerStore();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div
      className="flex flex-col items-center gap-3 py-4"
      style={{
        width: 52,
        flexShrink: 0,
        background: 'var(--sidebar-bg)',
        borderRadius: 16,
        border: '1px solid var(--sidebar-border)',
        boxShadow: 'var(--sidebar-shadow)',
        zIndex: 10,
      }}
    >
      {ITEMS.map(({ id, Icon, label, color }) => {
        const isActive = activePanel === id;
        const isHovered = hoveredId === id;

        // Tooltip — show track name when music is loaded
        let tooltip = label;
        if (id === 'music' && spotifyConnected && musicTitle) {
          tooltip = `♫  ${musicTitle.length > 32 ? musicTitle.slice(0, 32) + '…' : musicTitle}`;
        }

        return (
          <div
            key={id}
            className="relative"
            onMouseEnter={() => setHoveredId(id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            {/* Active left-edge indicator */}
            {isActive && (
              <div
                className="absolute top-1/2 -translate-y-1/2 rounded-r-full"
                style={{
                  left: -13, width: 4, height: 32,
                  background: color,
                  boxShadow: `0 0 8px ${color}`,
                }}
              />
            )}

            {/* Icon button */}
            <button
              onClick={() => setActivePanel(isActive ? null : id)}
              style={{
                width: 36, height: 36,
                borderRadius: isActive || isHovered ? '30%' : '50%',
                background: isActive
                  ? `linear-gradient(135deg, ${color}35, ${color}18)`
                  : isHovered
                    ? 'rgba(255,255,255,0.16)'
                    : 'rgba(255,255,255,0.08)',
                border: `1px solid ${isActive ? `${color}55` : 'rgba(255,255,255,0.12)'}`,
                color: isActive ? color : isHovered ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.35)',
                boxShadow: isActive ? `0 0 14px ${color}40` : 'none',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', outline: 'none',
              }}
            >
              <Icon style={{ width: 16, height: 16 }} />
            </button>

            {/* Tooltip */}
            {isHovered && (
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
                    color: id === 'music' && musicTitle && spotifyConnected ? '#1DB954' : 'rgba(255,255,255,0.88)',
                  }}
                >
                  {tooltip}
                </div>
                {/* Arrow */}
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
      })}
    </div>
  );
}
