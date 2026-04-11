// src/components/call/ParticipantCard.tsx
import { memo } from 'react';
import { MicOff } from 'lucide-react';
import { AvatarImage } from '../ui/AvatarImage';
import type { DndCharacter } from '../../lib/serverTypes';
import { getClassColor } from '../../lib/classColors';
import { HpBar } from '../servers/toolkits/HpBar';

interface ParticipantCardProps {
  username: string;
  avatarUrl: string | null;
  isMuted: boolean;
  isSpeaking: boolean;
  audioLevel: number;
  isMe: boolean;
  compact?: boolean;
  character?: DndCharacter | null;
  isDm?: boolean;
}

const AUDIO_BAR_COUNT = 7;

export const ParticipantCard = memo(function ParticipantCard({
  username, avatarUrl, isMuted, isSpeaking, audioLevel, isMe, compact, character, isDm,
}: ParticipantCardProps) {
  if (compact) {
    const classColor = character ? getClassColor(character.class) : undefined;
    const lowHp = character && character.hp_max > 0 && character.hp_current / character.hp_max < 0.25;

    return (
      <div
        className="flex items-center gap-2.5 rounded-2xl px-3 py-2"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: classColor ? `1px solid ${classColor}30` : '1px solid rgba(255,255,255,0.08)',
          minWidth: 110,
        }}
      >
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {character?.portrait_url ? (
            <div style={{
              width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
              border: `2px solid ${classColor}`,
              backgroundImage: `url(${character.portrait_url})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }} />
          ) : (
            <AvatarImage username={username} avatarUrl={avatarUrl} size="sm" />
          )}
          {isMuted && (
            <div style={{
              position: 'absolute', bottom: -1, right: -1, width: 14, height: 14, borderRadius: '50%',
              background: 'rgba(239,68,68,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1.5px solid var(--bg-primary)',
            }}>
              <MicOff className="h-2 w-2 text-white" />
            </div>
          )}
          {lowHp && !isMuted && (
            <div style={{
              position: 'absolute', bottom: -1, left: -1, width: 14, height: 14, borderRadius: '50%',
              background: 'rgba(239,68,68,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1.5px solid var(--bg-primary)',
              fontSize: 9, fontWeight: 700, color: '#fff', lineHeight: 1,
            }}>!</div>
          )}
        </div>
        <div className="min-w-0">
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <p className="truncate text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.70)' }}>
              {character ? character.name : username}
            </p>
            {isDm && (
              <span style={{
                fontSize: 7, fontWeight: 700, color: '#FFD700',
                background: 'rgba(255,215,0,0.15)', borderRadius: 3,
                padding: '0 3px', flexShrink: 0, lineHeight: '12px',
              }}>DM</span>
            )}
          </div>
          {character ? (
            <>
              <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.40)', marginBottom: 2 }}>
                {character.class} · Lv {character.level}
              </p>
              <HpBar current={character.hp_current} max={character.hp_max} height={3} />
            </>
          ) : (
            <AudioBars level={isMuted ? 0 : audioLevel} active={isSpeaking} barCount={5} height={8} />
          )}
        </div>
      </div>
    );
  }

  const classColor = character ? getClassColor(character.class) : undefined;
  const lowHp = character && character.hp_max > 0 && character.hp_current / character.hp_max < 0.25;

  return (
    <div
      className="flex flex-col items-center gap-2 rounded-2xl p-5 text-center"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.10)',
        backdropFilter: 'blur(12px)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'relative', display: 'inline-block' }}>
        {character?.portrait_url ? (
          <div style={{
            width: 64, height: 64, borderRadius: '50%', overflow: 'hidden',
            border: `3px solid ${classColor}`,
            boxShadow: `0 0 12px ${classColor}50`,
            backgroundImage: `url(${character.portrait_url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }} />
        ) : (
          <AvatarImage username={username} avatarUrl={avatarUrl} size="xl" />
        )}
        {isMuted && (
          <div style={{
            position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderRadius: '50%',
            background: 'rgba(239,68,68,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid var(--bg-primary)',
          }}>
            <MicOff className="h-2.5 w-2.5 text-white" />
          </div>
        )}
        {lowHp && !isMuted && (
          <div style={{
            position: 'absolute', bottom: -2, left: -2, width: 20, height: 20, borderRadius: '50%',
            background: 'rgba(239,68,68,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid var(--bg-primary)',
            fontSize: 12, fontWeight: 700, color: '#fff', lineHeight: 1,
          }}>!</div>
        )}
      </div>

      <div>
        <span className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.80)' }}>
          {character ? character.name : username}
        </span>
        {isMe && (
          <span className="ml-1.5 text-[9px] font-semibold rounded px-1.5 py-0.5"
            style={{ background: 'rgba(0,212,255,0.10)', color: 'rgba(0,212,255,0.70)' }}>You</span>
        )}
        {isDm && (
          <span className="ml-1.5 text-[9px] font-semibold rounded px-1.5 py-0.5"
            style={{ background: 'rgba(255,215,0,0.15)', color: '#FFD700' }}>DM</span>
        )}
      </div>

      {character && (
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: -4 }}>
          {character.class} · Lv {character.level}
        </p>
      )}

      {character ? (
        <div style={{ width: '80%' }}>
          <HpBar current={character.hp_current} max={character.hp_max} height={5} />
        </div>
      ) : (
        <AudioBars level={isMuted ? 0 : audioLevel} active={isSpeaking} barCount={AUDIO_BAR_COUNT} height={20} />
      )}
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
