// src/components/ui/ProfileTooltip.tsx
import { useState, useRef, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CARD_GRADIENTS } from '../../lib/cardGradients';

export interface ProfileTooltipData {
  username: string;
  avatarUrl?: string | null;
  status?: string | null;
  cardGradient?: string | null;
  cardImageUrl?: string | null;
  cardImageParams?: { x: number; y: number } | null;
  /** Server role — only shown when provided */
  role?: { name: string; color: string } | null;
}

const STATUS_COLOR: Record<string, string> = {
  online: '#00d4ff',
  away: '#f0a020',
  busy: '#ff5a36',
  offline: '#5a6a7a',
};
const STATUS_LABEL: Record<string, string> = {
  online: 'Online',
  away: 'Away',
  busy: 'Busy',
  offline: 'Offline',
};

export function ProfileTooltip({ data, children }: { data: ProfileTooltipData; children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => {
      if (!wrapRef.current) return;
      const rect = wrapRef.current.getBoundingClientRect();
      // Position to the right of the avatar, vertically centered
      setPos({ x: rect.right, y: rect.top + rect.height / 2 });
      setVisible(true);
    }, 350);
  }, []);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setVisible(false);
  }, []);

  const status = data.status ?? 'offline';
  const color = STATUS_COLOR[status] ?? STATUS_COLOR.offline;
  const label = STATUS_LABEL[status] ?? 'Offline';

  const preset = CARD_GRADIENTS.find(g => g.id === (data.cardGradient ?? 'ocean')) ?? CARD_GRADIENTS[0];
  const hasBannerImage = !!data.cardImageUrl;

  // Avatar gradient fallback from username
  const avatarHue = (data.username.charCodeAt(0) * 47) % 360;

  return (
    <>
      <div
        ref={wrapRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        style={{ display: 'inline-flex' }}
      >
        {children}
      </div>
      {visible && createPortal(
        <div
          onMouseEnter={hide}
          style={{
            position: 'fixed',
            left: pos.x,
            top: pos.y,
            transform: 'translate(8px, -50%)',
            zIndex: 99990,
            pointerEvents: 'none',
          }}
        >
          <style>{`@keyframes profile-tooltip-fade {
            from { opacity: 0; }
            to { opacity: 1; }
          }`}</style>
          <div style={{
            width: 220,
            borderRadius: 14,
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 1px rgba(255,255,255,0.1)',
            border: '1px solid rgba(80,145,255,0.12)',
            backdropFilter: 'blur(20px)',
            animation: 'profile-tooltip-fade 0.18s ease-out',
          }}>

          {/* Banner */}
          <div style={{ height: 48, position: 'relative', overflow: 'hidden' }}>
            {hasBannerImage ? (
              <div style={{
                position: 'absolute', inset: 0,
                backgroundImage: `url(${data.cardImageUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: `${data.cardImageParams?.x ?? 50}% ${data.cardImageParams?.y ?? 50}%`,
              }} />
            ) : (
              <div style={{ position: 'absolute', inset: 0, background: preset.css }} />
            )}
          </div>

          {/* Body */}
          <div style={{
            background: 'rgba(12,20,40,0.95)',
            padding: '26px 12px 10px',
            position: 'relative',
          }}>
            {/* Overlapping avatar */}
            <div style={{
              width: 42, height: 42, borderRadius: '50%',
              position: 'absolute', top: -21, left: 12,
              border: '3px solid rgba(12,20,40,0.95)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              background: data.avatarUrl
                ? `url(${data.avatarUrl}) center/cover`
                : `linear-gradient(135deg, hsl(${avatarHue},60%,45%), hsl(${avatarHue + 40},60%,55%))`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15, fontWeight: 700, color: 'white',
            }}>
              {!data.avatarUrl && data.username.charAt(0).toUpperCase()}
            </div>

            {/* Name + role */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#e0e6f0' }}>
                {data.username}
              </span>
              {data.role && (
                <span style={{
                  fontSize: 9, padding: '1px 6px', borderRadius: 4,
                  background: `${data.role.color}20`,
                  color: data.role.color,
                }}>
                  {data.role.name}
                </span>
              )}
            </div>

            {/* Status */}
            <div style={{ fontSize: 10, color, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{
                width: 5, height: 5, borderRadius: '50%',
                background: color, boxShadow: `0 0 4px ${color}cc`,
                display: 'inline-block',
              }} />
              {label}
            </div>
          </div>
          </div> {/* /inner card wrapper */}
        </div>,
        document.body
      )}
    </>
  );
}
