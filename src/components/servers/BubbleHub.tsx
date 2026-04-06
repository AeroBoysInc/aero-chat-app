// src/components/servers/BubbleHub.tsx
import { memo, useState, useMemo, useCallback, useRef } from 'react';
import { Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
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

function BubbleCircle({ bubble, x, y, index, unread, onClick }: {
  bubble: Bubble;
  x: number; y: number;
  index: number;
  unread: number;
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
        {bubble.restricted_to_roles.length > 0 && (
          <div style={{
            position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)',
            fontSize: 8, color: `${bubble.color}80`,
            display: 'flex', alignItems: 'center', gap: 2,
          }}>
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
        )}
        {unread > 0 && (
          <div style={{
            position: 'absolute', top: -2, right: -2,
            minWidth: 18, height: 18, padding: '0 5px',
            borderRadius: 9, background: '#ff2e63',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 700, color: 'white',
            boxShadow: '0 2px 8px rgba(255,46,99,0.4)',
          }}>
            {unread > 99 ? '99+' : unread}
          </div>
        )}
      </div>
    </>
  );
}

export const BubbleHub = memo(function BubbleHub() {
  const { selectBubble, selectedServerId, loadServerData, bubbleUnreads } = useServerStore();
  const { enterBubble } = useCornerStore();
  const bubbles = useServerStore(s => s.bubbles);
  const server = useServerStore(s => s.servers.find(sv => sv.id === s.selectedServerId));
  const user = useAuthStore(s => s.user);
  const members = useServerStore(s => s.members);
  const { hasPermission } = useServerRoleStore();

  const canManageBubbles = user && server
    ? hasPermission(server.id, user.id, members, 'manage_bubbles')
    : false;

  // Inline create-bubble state
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#00d4ff');
  const [creating, setCreating] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const handleCreateBubble = useCallback(async () => {
    if (!selectedServerId || !newName.trim() || creating) return;
    setCreating(true);
    await supabase.from('bubbles').insert({
      server_id: selectedServerId, name: newName.trim(), color: newColor, restricted_to_roles: [],
    });
    await loadServerData(selectedServerId);
    setNewName('');
    setNewColor('#00d4ff');
    setShowCreate(false);
    setCreating(false);
  }, [selectedServerId, newName, newColor, creating]);

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
              unread={bubbleUnreads[bubble.id] ?? 0}
              onClick={() => handleBubbleClick(bubble)}
            />
          ))}

          {/* Add bubble button */}
          {canManageBubbles && (
            <div
              onClick={() => { setShowCreate(true); setTimeout(() => nameInputRef.current?.focus(), 50); }}
              className="absolute cursor-pointer transition-all hover:scale-110"
              style={{
                right: 20, bottom: 20,
                width: 42, height: 42, borderRadius: '50%',
                border: '1.5px dashed rgba(0,212,255,0.4)',
                background: 'rgba(0,212,255,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 12px rgba(0,212,255,0.15)',
              }}
            >
              <Plus className="h-4 w-4" style={{ color: '#00d4ff' }} />
            </div>
          )}
        </div>
      </div>

      {/* Create bubble modal */}
      {showCreate && (
        <div
          className="animate-fade-in"
          style={{
            position: 'absolute', inset: 0, zIndex: 20,
            background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowCreate(false); }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 320, borderRadius: 16, padding: 24,
              background: 'var(--sidebar-bg)', border: '1px solid var(--panel-divider)',
              boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
            }}
          >
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, textAlign: 'center' }}>
              New Bubble
            </h3>
            <div className="flex flex-col gap-3">
              <input
                ref={nameInputRef}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 10, fontSize: 13,
                  background: 'var(--input-bg)', border: '1px solid var(--input-border)',
                  color: 'var(--text-primary)', outline: 'none',
                }}
                value={newName}
                onChange={e => setNewName(e.target.value.slice(0, 30))}
                placeholder="Bubble name..."
                onKeyDown={e => e.key === 'Enter' && handleCreateBubble()}
              />
              <div className="flex items-center gap-3">
                <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Color</label>
                <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)}
                  style={{ width: 32, height: 32, border: 'none', cursor: 'pointer', borderRadius: 8 }} />
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: newColor, boxShadow: `0 0 12px ${newColor}40` }} />
              </div>
            </div>
            <div className="flex justify-center gap-3" style={{ marginTop: 20 }}>
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-aero px-4 py-2 text-xs font-medium transition-opacity hover:opacity-80"
                style={{ color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--panel-divider)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBubble}
                disabled={!newName.trim() || creating}
                className="rounded-aero px-4 py-2 text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ background: 'rgba(0,212,255,0.15)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.3)' }}
              >
                {creating ? 'Creating...' : 'Create Bubble'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
