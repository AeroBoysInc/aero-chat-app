// src/components/call/ParticipantCard.tsx
import { memo } from 'react';
import { MicOff } from 'lucide-react';
import { AvatarImage } from '../ui/AvatarImage';

interface ParticipantCardProps {
  username: string;
  avatarUrl: string | null;
  isMuted: boolean;
  isSpeaking: boolean;
  audioLevel: number;
  isMe: boolean;
  compact?: boolean;
}

const AUDIO_BAR_COUNT = 7;

export const ParticipantCard = memo(function ParticipantCard({
  username, avatarUrl, isMuted, isSpeaking, audioLevel, isMe, compact,
}: ParticipantCardProps) {
  const statusLabel = isMuted ? 'Muted' : isSpeaking ? 'Speaking' : 'Listening';
  const statusColor = isMuted ? 'rgba(239,68,68,0.60)' : isSpeaking ? '#00d4ff' : 'var(--text-muted)';

  if (compact) {
    return (
      <div
        className="flex items-center gap-2.5 rounded-2xl px-3 py-2"
        style={{
          background: isSpeaking ? 'rgba(0,212,255,0.07)' : 'rgba(255,255,255,0.03)',
          border: isSpeaking ? '1px solid rgba(0,212,255,0.25)' : '1px solid rgba(255,255,255,0.08)',
          minWidth: 110,
        }}
      >
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {isSpeaking && (
            <div style={{
              position: 'absolute', inset: -3, borderRadius: '50%',
              border: '2px solid rgba(0,212,255,0.45)',
              boxShadow: '0 0 10px rgba(0,212,255,0.30)',
              pointerEvents: 'none',
            }} />
          )}
          <AvatarImage username={username} avatarUrl={avatarUrl} size="sm" />
          {isMuted && (
            <div style={{
              position: 'absolute', bottom: -1, right: -1, width: 14, height: 14, borderRadius: '50%',
              background: 'rgba(239,68,68,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1.5px solid var(--bg-primary)',
            }}>
              <MicOff className="h-2 w-2 text-white" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold" style={{ color: isSpeaking ? 'white' : 'rgba(255,255,255,0.70)' }}>{username}</p>
          <AudioBars level={isMuted ? 0 : audioLevel} active={isSpeaking} barCount={5} height={8} />
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center gap-2 rounded-2xl p-5 text-center"
      style={{
        background: isSpeaking ? 'rgba(0,212,255,0.07)' : 'rgba(255,255,255,0.03)',
        border: isSpeaking ? '1px solid rgba(0,212,255,0.30)' : '1px solid rgba(255,255,255,0.10)',
        boxShadow: isSpeaking ? '0 0 24px rgba(0,212,255,0.12), inset 0 1px 0 rgba(255,255,255,0.08)' : undefined,
        backdropFilter: 'blur(12px)',
        transition: 'background 0.3s, border-color 0.3s, box-shadow 0.3s',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {isSpeaking && (
        <div style={{
          position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)',
          width: 100, height: 60,
          background: 'radial-gradient(ellipse, rgba(0,212,255,0.15) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
      )}

      <div style={{ position: 'relative', display: 'inline-block' }}>
        {isSpeaking && (
          <div style={{
            position: 'absolute', inset: -5, borderRadius: '50%',
            border: '2px solid rgba(0,212,255,0.55)',
            boxShadow: '0 0 14px rgba(0,212,255,0.40), 0 0 28px rgba(0,212,255,0.15)',
            animation: 'aura-pulse 2.5s ease-in-out infinite',
            pointerEvents: 'none',
          }} />
        )}
        <AvatarImage username={username} avatarUrl={avatarUrl} size="xl" />
        {isMuted && (
          <div style={{
            position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderRadius: '50%',
            background: 'rgba(239,68,68,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid var(--bg-primary)',
          }}>
            <MicOff className="h-2.5 w-2.5 text-white" />
          </div>
        )}
      </div>

      <div>
        <span className="text-sm font-bold" style={{ color: isSpeaking ? 'white' : 'rgba(255,255,255,0.80)' }}>
          {username}
        </span>
        {isMe && (
          <span className="ml-1.5 text-[9px] font-semibold rounded px-1.5 py-0.5"
            style={{ background: 'rgba(0,212,255,0.10)', color: 'rgba(0,212,255,0.70)' }}>You</span>
        )}
      </div>

      <span className="text-[10px] font-medium" style={{ color: statusColor }}>{statusLabel}</span>

      <AudioBars level={isMuted ? 0 : audioLevel} active={isSpeaking} barCount={AUDIO_BAR_COUNT} height={20} />
    </div>
  );
});

function AudioBars({ level, active, barCount, height }: { level: number; active: boolean; barCount: number; height: number }) {
  return (
    <div style={{ display: 'flex', gap: 2, justifyContent: 'center', height, alignItems: 'flex-end' }}>
      {Array.from({ length: barCount }).map((_, i) => {
        const variance = 0.6 + 0.4 * Math.sin(i * 2.1 + level * 20);
        const barHeight = active ? Math.max(3, height * level * variance) : 3;
        return (
          <div
            key={i}
            style={{
              width: 3,
              height: barHeight,
              borderRadius: 2,
              background: active
                ? `rgba(0,212,255,${0.35 + level * 0.3})`
                : 'rgba(255,255,255,0.08)',
              transition: 'height 0.1s ease-out',
            }}
          />
        );
      })}
    </div>
  );
}
