import { memo, useState } from 'react';
import { Bell, Settings, ChevronDown } from 'lucide-react';
import { AvatarImage, type Status } from '../ui/AvatarImage';
import { useAuthStore } from '../../store/authStore';
import { useStatusStore } from '../../store/statusStore';
import { usePresenceStore } from '../../store/presenceStore';
import { useCallStore } from '../../store/callStore';
import { useXpStore } from '../../store/xpStore';
import { deriveLevel, BAR_META } from '../../lib/xpConfig';
import { useIsMobile } from '../../lib/useIsMobile';

const ALL_STATUSES: Status[] = ['online', 'busy', 'away', 'offline'];
const STATUS_LABELS: Record<Status, string> = { online: 'Online', busy: 'Do Not Disturb', away: 'Away', offline: 'Invisible' };

export const GlassBannerProfile = memo(function GlassBannerProfile({
  onSettingsClick,
  onBellClick,
}: {
  onSettingsClick?: () => void;
  onBellClick?: () => void;
}) {
  const user = useAuthStore(s => s.user);
  const { status: myStatus, setStatus } = useStatusStore();
  const callStatus = useCallStore(s => s.status);
  const playingGame = usePresenceStore(s => s.playingGames.get(user?.id ?? '') ?? null);
  const [statusOpen, setStatusOpen] = useState(false);
  const isMobile = useIsMobile();
  const chatterXp = useXpStore(s => s.chatter_xp);
  const chatterMeta = BAR_META.chatter;
  const { level: chatterLevel, currentXp, nextXp } = deriveLevel(chatterXp);
  const chatterProgress = chatterLevel >= 100 ? 100 : nextXp > 0 ? Math.round((currentXp / nextXp) * 100) : 0;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 14,
      padding: isMobile ? '10px 10px' : '12px 16px',
      borderBottom: '1px solid rgba(0,230,118,0.08)',
      position: 'relative', overflow: 'visible',
      background: 'linear-gradient(135deg, rgba(0,230,118,0.06), rgba(0,230,118,0.02))',
      zIndex: 10,
    }}>
      {/* Decorative orb — clipped to banner area */}
      <div style={{
        position: 'absolute', width: 120, height: 120, top: -40, right: 40,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,230,118,0.08) 0%, transparent 70%)',
        filter: 'blur(16px)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* Avatar */}
      <div style={{ position: 'relative', zIndex: 1, flexShrink: 0 }}>
        <AvatarImage
          username={user?.username ?? '?'}
          avatarUrl={user?.avatar_url}
          size="lg"
          status={myStatus}
          isInCall={callStatus === 'connected'}
          playingGame={playingGame}
        />
      </div>

      <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.75)', letterSpacing: -0.2 }}>
          {user?.username}
          {callStatus === 'connected' && (
            <span style={{ marginLeft: 8, fontSize: 9, color: '#00e676', fontWeight: 600 }}>
              ● In call
            </span>
          )}
        </div>

        {/* Status row */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setStatusOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, marginTop: 2,
              background: 'none', border: 'none', cursor: 'pointer', padding: 0, outline: 'none',
            }}
          >
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: myStatus === 'online' ? '#00e676' : myStatus === 'busy' ? '#ff5032' : myStatus === 'away' ? '#ffa000' : 'rgba(255,255,255,0.22)',
              boxShadow: myStatus === 'online' ? '0 0 6px rgba(0,230,118,0.40)' : 'none',
              display: 'inline-block',
            }} />
            <span style={{ fontSize: 10, fontWeight: 500, color: 'rgba(0,230,118,0.50)' }}>
              {STATUS_LABELS[myStatus]}
            </span>
            <ChevronDown style={{
              width: 10, height: 10, color: 'rgba(0,230,118,0.30)',
              transform: statusOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s',
            }} />
          </button>

          {playingGame && (
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.20)', marginTop: 2 }}>
              Playing {playingGame}
            </div>
          )}

          {/* Status dropdown */}
          {statusOpen && (
            <div
              className="animate-fade-in"
              style={{
                position: 'absolute', top: '100%', left: 0, zIndex: 50,
                marginTop: 4, borderRadius: 10, overflow: 'hidden',
                background: 'rgba(8,20,12,0.95)',
                border: '1px solid rgba(0,230,118,0.15)',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                minWidth: 140,
              }}
            >
              {ALL_STATUSES.map(s => (
                <button
                  key={s}
                  onClick={() => { setStatus(s); setStatusOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', padding: '8px 12px',
                    background: s === myStatus ? 'rgba(0,230,118,0.08)' : 'transparent',
                    border: 'none', cursor: 'pointer', outline: 'none',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { if (s !== myStatus) e.currentTarget.style.background = 'rgba(0,230,118,0.05)'; }}
                  onMouseLeave={e => { if (s !== myStatus) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: s === 'online' ? '#00e676' : s === 'busy' ? '#ff5032' : s === 'away' ? '#ffa000' : 'rgba(255,255,255,0.22)',
                  }} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.55)' }}>
                    {STATUS_LABELS[s]}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Chatter XP bar */}
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 7, fontWeight: 700, color: `${chatterMeta.color}cc`, textTransform: 'uppercase', flexShrink: 0 }}>
            Chat Lv.{chatterLevel}
          </span>
          <div style={{
            flex: 1, height: 5, borderRadius: 3,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.04)',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 3,
              width: `${Math.max(chatterProgress, 2)}%`,
              background: `linear-gradient(90deg, ${chatterMeta.color}99, ${chatterMeta.color})`,
              boxShadow: `0 0 4px ${chatterMeta.color}50`,
              transition: 'width 0.3s ease',
            }} />
          </div>
          <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.22)', flexShrink: 0 }}>
            {chatterLevel >= 100 ? 'MAX' : `${currentXp}/${nextXp}`}
          </span>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: isMobile ? 4 : 6, position: 'relative', zIndex: 1 }}>
        <button
          onClick={onBellClick}
          style={{
            width: isMobile ? 36 : 28, height: isMobile ? 36 : 28, borderRadius: 8,
            background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.10)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', outline: 'none', color: 'rgba(0,230,118,0.40)',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,230,118,0.12)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,230,118,0.05)')}
        >
          <Bell style={{ width: isMobile ? 15 : 13, height: isMobile ? 15 : 13 }} />
        </button>
        <button
          onClick={onSettingsClick}
          style={{
            width: isMobile ? 36 : 28, height: isMobile ? 36 : 28, borderRadius: 8,
            background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.10)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', outline: 'none', color: 'rgba(0,230,118,0.40)',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,230,118,0.12)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,230,118,0.05)')}
        >
          <Settings style={{ width: isMobile ? 15 : 13, height: isMobile ? 15 : 13 }} />
        </button>
      </div>
    </div>
  );
});
