// src/components/servers/BubbleHub.tsx
import { memo, useState, useMemo, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { useCornerStore } from '../../store/cornerStore';
import { useServerStore } from '../../store/serverStore';
import { useServerRoleStore } from '../../store/serverRoleStore';
import { useAuthStore } from '../../store/authStore';
import type { Bubble } from '../../lib/serverTypes';

// Distribute bubbles in a circle around center
function getBubblePositions(count: number, containerW: number, containerH: number) {
  const cx = containerW / 2;
  const cy = containerH / 2;
  const radius = Math.min(cx, cy) * 0.55;
  return Array.from({ length: count }, (_, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  });
}

// Generate a stable random float from a seed string (bubble id)
function seededRandom(seed: string, offset: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  h = ((h + offset) * 2654435761) >>> 0;
  return (h & 0xffff) / 0xffff;
}

function BubbleCircle({ bubble, x, y, index, onClick }: {
  bubble: Bubble;
  x: number; y: number;
  index: number;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const size = 80;

  // Each bubble gets unique drift parameters from its id
  const drift = useMemo(() => {
    const r = (off: number) => seededRandom(bubble.id, off);
    const dx1 = 6 + r(0) * 10;   // 6–16px horizontal wander
    const dy1 = 6 + r(1) * 10;
    const dx2 = -(4 + r(2) * 8);
    const dy2 = 4 + r(3) * 8;
    const dx3 = -(3 + r(4) * 7);
    const dy3 = -(5 + r(5) * 9);
    const duration = 5 + r(6) * 5;  // 5–10s per cycle
    const delay = r(7) * -8;        // stagger start up to -8s

    const name = `bubble-float-${index}`;
    const keyframes = `@keyframes ${name} {
      0%, 100% { transform: translate(0px, 0px) scale(1); }
      25%  { transform: translate(${dx1}px, ${-dy1}px) scale(1.03); }
      50%  { transform: translate(${dx2}px, ${dy2}px) scale(0.97); }
      75%  { transform: translate(${dx3}px, ${dy3}px) scale(1.02); }
    }`;
    return { name, keyframes, duration, delay };
  }, [bubble.id, index]);

  return (
    <>
      <style>{drift.keyframes}</style>
      <div
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="absolute cursor-pointer"
        style={{
          width: size, height: size, borderRadius: '50%',
          left: x - size / 2, top: y - size / 2,
          background: `${bubble.color}14`,
          backdropFilter: 'blur(4px)',
          border: `1.5px solid ${bubble.color}40`,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          animation: `${drift.name} ${drift.duration}s ease-in-out ${drift.delay}s infinite`,
          boxShadow: hovered ? `0 0 20px ${bubble.color}30` : `0 0 10px ${bubble.color}10`,
          transition: 'box-shadow 0.2s',
        }}
      >
        <div style={{
          transform: hovered ? 'scale(1.1)' : 'scale(1)',
          transition: 'transform 0.2s',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: bubble.color }}>{bubble.name}</span>
        </div>
      </div>
    </>
  );
}

export const BubbleHub = memo(function BubbleHub() {
  const { selectBubble } = useServerStore();
  const { enterBubble } = useCornerStore();
  const bubbles = useServerStore(s => s.bubbles);
  const server = useServerStore(s => s.servers.find(sv => sv.id === s.selectedServerId));
  const user = useAuthStore(s => s.user);
  const members = useServerStore(s => s.members);
  const { hasPermission } = useServerRoleStore();

  const canManageBubbles = user && server
    ? hasPermission(server.id, user.id, members, 'manage_bubbles')
    : false;

  const handleBubbleClick = useCallback((bubble: Bubble) => {
    selectBubble(bubble.id);
    enterBubble();
  }, []);

  // Use a fixed 800x500 virtual space for positioning
  const W = 800, H = 500;
  const positions = useMemo(() => getBubblePositions(bubbles.length, W, H), [bubbles.length]);

  const initial = server?.name.charAt(0).toUpperCase() ?? '?';

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Background orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="orb" style={{ width: 200, height: 200, left: '5%', top: '5%', background: 'radial-gradient(circle, rgba(0,180,255,0.08) 0%, transparent 70%)', animation: 'orb-drift 8s ease-in-out infinite' }} />
        <div className="orb" style={{ width: 160, height: 160, right: '8%', bottom: '10%', background: 'radial-gradient(circle, rgba(120,0,255,0.06) 0%, transparent 70%)', animation: 'orb-drift 7s ease-in-out 2s infinite' }} />
      </div>

      {/* Bubble area — centered with aspect ratio */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div style={{ position: 'relative', width: W, height: H, maxWidth: '95%', maxHeight: '90%' }}>

          {/* Center server icon */}
          <div
            className="absolute"
            style={{
              left: W / 2 - 32, top: H / 2 - 32,
              width: 64, height: 64, borderRadius: 18,
              background: server?.icon_url
                ? `url(${server.icon_url}) center/cover`
                : 'linear-gradient(135deg, var(--sent-bubble-bg), var(--input-focus-border))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, fontWeight: 700, color: 'white',
              boxShadow: '0 0 30px rgba(0,212,255,0.25)',
              zIndex: 2,
            }}
          >
            {!server?.icon_url && initial}
          </div>

          {/* Bubbles */}
          {bubbles.map((bubble, i) => (
            <BubbleCircle
              key={bubble.id}
              bubble={bubble}
              x={positions[i]?.x ?? 0}
              y={positions[i]?.y ?? 0}
              index={i}
              onClick={() => handleBubbleClick(bubble)}
            />
          ))}

          {/* Add bubble button */}
          {canManageBubbles && (
            <div
              className="absolute cursor-pointer"
              style={{
                right: 20, bottom: 20,
                width: 42, height: 42, borderRadius: '50%',
                border: '1.5px dashed var(--panel-divider)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'opacity 0.2s',
              }}
            >
              <Plus className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
