// src/components/ui/ProfilePopout.tsx
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Profile } from '../../store/authStore';
import { AvatarImage, type Status } from './AvatarImage';
import { AccentName } from './AccentName';
import { CustomStatusBadge } from './CustomStatusBadge';
import { CardEffect } from './CardEffect';
import { getBannerCss, DEFAULT_ACCENT } from '../../lib/identityConstants';

interface ProfilePopoutProps {
  friend: Profile;
  status: Status;
  game?: string | null;
  isInCall?: boolean;
  anchorRect: DOMRect;
  direction?: 'right' | 'below';
  onClose: () => void;
  onMessage?: () => void;
  onPopoutMouseEnter?: () => void;
  onPopoutMouseLeave?: () => void;
}

const ProfilePopout = React.memo(function ProfilePopout({
  friend,
  status,
  game,
  isInCall,
  anchorRect,
  direction = 'right',
  onClose,
  onMessage,
  onPopoutMouseEnter,
  onPopoutMouseLeave,
}: ProfilePopoutProps) {
  const popoutRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const handleMouseEnter = onPopoutMouseEnter;
  const handleMouseLeave = onPopoutMouseLeave || onClose;

  useEffect(() => {
    if (direction === 'right') {
      setPos({
        top: Math.max(8, Math.min(anchorRect.top, window.innerHeight - 380)),
        left: anchorRect.right + 8,
      });
    } else {
      setPos({
        top: anchorRect.bottom + 8,
        left: Math.max(8, anchorRect.left),
      });
    }
  }, [anchorRect, direction]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoutRef.current && !popoutRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const accent = friend.accent_color || DEFAULT_ACCENT;
  const bannerCss = getBannerCss(friend.banner_gradient);
  const cardImage = friend.card_image_url;

  const bannerStyle: React.CSSProperties = cardImage
    ? { background: `url(${cardImage}) center/cover` }
    : bannerCss
      ? { background: bannerCss }
      : { background: `linear-gradient(135deg, ${accent}40, ${accent}18)` };

  return createPortal(
    <div
      ref={popoutRef}
      className="animate-fade-in"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        width: 280,
        borderRadius: 16,
        overflow: 'hidden',
        background: 'var(--card-bg)',
        border: '1px solid var(--panel-divider)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.4), 0 0 20px rgba(0,100,255,0.06)',
        backdropFilter: 'blur(24px)',
        zIndex: 50,
      }}
    >
      {/* Banner */}
      <div style={{ height: 90, position: 'relative', overflow: 'hidden', ...bannerStyle }}>
        <CardEffect effect={friend.card_effect} playing={true} />
      </div>

      {/* Avatar overlapping banner */}
      <div style={{ padding: '0 16px', marginTop: -26, position: 'relative', zIndex: 3 }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', border: '3px solid var(--card-bg)', overflow: 'hidden' }}>
          <AvatarImage username={friend.username} avatarUrl={friend.avatar_url} size="lg" status={status} playingGame={game} isInCall={isInCall} gifUrl={friend.avatar_gif_url} alwaysAnimate />
        </div>
      </div>

      {/* Identity info */}
      <div style={{ padding: '8px 16px 16px' }}>
        <AccentName name={friend.username} accentColor={friend.accent_color} accentColorSecondary={friend.accent_color_secondary} nameEffect={friend.name_effect} playing style={{ fontSize: 16, fontWeight: 700 }} />

        <div style={{ marginTop: 3 }}>
          <CustomStatusBadge emoji={friend.custom_status_emoji} text={friend.custom_status_text} size="md" />
          {!friend.custom_status_text && !friend.custom_status_emoji && game && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>🎮 {game}</span>
          )}
          {!friend.custom_status_text && !friend.custom_status_emoji && !game && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{status}</span>
          )}
        </div>

        {friend.bio && (
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--panel-divider)' }}>
            <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 5, opacity: 0.6 }}>About Me</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.55, wordBreak: 'break-word' }}>{friend.bio}</div>
          </div>
        )}

        <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
          <button onClick={onMessage} style={{ flex: 1, textAlign: 'center', padding: 7, borderRadius: 10, background: `${accent}18`, border: `1px solid ${accent}28`, fontSize: 11, color: accent, fontWeight: 600, cursor: 'pointer' }}>Message</button>
        </div>
      </div>
    </div>,
    document.body,
  );
});

export { ProfilePopout };
