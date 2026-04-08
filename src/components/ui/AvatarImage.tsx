import { useState } from 'react';

export type Status = 'online' | 'busy' | 'away' | 'offline';

type AuraVariant = 'online' | 'gaming' | 'incall' | 'busy' | 'away' | 'offline' | 'none';

interface Props {
  username: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  status?: Status | null;
  playingGame?: string | null;
  isInCall?: boolean;
  gifUrl?: string | null;
  alwaysAnimate?: boolean;
}

const sizeClass = {
  sm: 'h-6  w-6  text-[10px]',
  md: 'h-8  w-8  text-xs',
  lg: 'h-10 w-10 text-sm',
  xl: 'h-12 w-12 text-base',
};

export const statusColor: Record<Status, string> = {
  online:  '#3dd87a',
  busy:    '#ff4f4f',
  away:    '#f5a623',
  offline: '#9bb5c8',
};

export const statusLabel: Record<Status, string> = {
  online:  'online',
  busy:    'busy',
  away:    'away',
  offline: 'offline',
};

function getAuraVariant(
  status: Status | null | undefined,
  playingGame: string | null | undefined,
  isInCall: boolean | undefined,
): AuraVariant {
  if (!status) return 'none';
  if (status === 'offline') return 'offline';
  if (isInCall) return 'incall';
  if (playingGame) return 'gaming';
  if (status === 'busy') return 'busy';
  if (status === 'away') return 'away';
  return 'online';
}

const auraStyles: Record<AuraVariant, { border: string; boxShadow: string; animation?: string; opacity?: number }> = {
  online:  { border: '2px solid var(--aura-online)',  boxShadow: '0 0 8px var(--aura-glow-online)',   animation: 'aura-pulse 2.5s ease-in-out infinite' },
  gaming:  { border: '2px solid var(--aura-gaming)',  boxShadow: '0 0 8px var(--aura-glow-gaming)',   animation: 'aura-pulse 2.5s ease-in-out infinite' },
  incall:  { border: '2px solid var(--aura-incall)',  boxShadow: '0 0 10px var(--aura-glow-incall)',  animation: 'aura-pulse 1.8s ease-in-out infinite' },
  busy:    { border: '2px solid var(--aura-busy)',    boxShadow: '0 0 8px var(--aura-glow-busy)',     animation: 'aura-pulse 2s ease-in-out infinite' },
  away:    { border: '2px solid var(--aura-away)',    boxShadow: 'none',                               animation: 'aura-pulse 4s ease-in-out infinite' },
  offline: { border: '2px solid transparent',         boxShadow: 'none',                               opacity: 0.55 },
  none:    { border: '2px solid transparent',         boxShadow: 'none' },
};

export function AvatarImage({ username, avatarUrl, size = 'md', status, playingGame, isInCall, gifUrl, alwaysAnimate }: Props) {
  const variant = getAuraVariant(status, playingGame, isInCall);
  const ring = auraStyles[variant];

  const [hovered, setHovered] = useState(false);
  const showGif = gifUrl && (alwaysAnimate || hovered);
  const effectiveSrc = showGif ? gifUrl : avatarUrl;

  const avatarInner = effectiveSrc
    ? <img
        src={effectiveSrc}
        alt={username}
        className={`shrink-0 rounded-full object-cover ${sizeClass[size]}`}
        style={{ display: 'block' }}
        onMouseEnter={gifUrl && !alwaysAnimate ? () => setHovered(true) : undefined}
        onMouseLeave={gifUrl && !alwaysAnimate ? () => setHovered(false) : undefined}
      />
    : (
      <div
        className={`${sizeClass[size]} flex items-center justify-center rounded-full font-bold text-white`}
        style={{
          background: 'linear-gradient(135deg, #38ccf8 0%, #1a6fd4 100%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45)',
        }}
      >
        {username[0].toUpperCase()}
      </div>
    );

  if (variant === 'none') {
    return <div className="shrink-0 inline-block">{avatarInner}</div>;
  }

  // The ring is a separate absolutely-positioned element so the aura-pulse
  // animation (which uses scale) never touches the avatar image itself.
  return (
    <div
      className="shrink-0 inline-block"
      style={{ position: 'relative', flexShrink: 0, opacity: ring.opacity ?? 1 }}
    >
      {/* Animated ring — sits outside the avatar, does NOT wrap/scale it */}
      <div
        style={{
          position: 'absolute',
          inset: -3,
          borderRadius: '50%',
          border: ring.border,
          boxShadow: ring.boxShadow,
          animation: ring.animation,
          pointerEvents: 'none',
        }}
      />
      {avatarInner}
    </div>
  );
}
