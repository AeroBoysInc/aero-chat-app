// src/components/servers/toolkits/CharacterCard.tsx
import { memo } from 'react';
import type { DndCharacter, ServerMember } from '../../../lib/serverTypes';
import { getClassColor } from '../../../lib/classColors';
import { HpBar } from './HpBar';
import { XpBar } from './XpBar';

export const CharacterCard = memo(function CharacterCard({
  character,
  member,
  isDm,
  onClick,
}: {
  character: DndCharacter;
  member: ServerMember | undefined;
  isDm: boolean;
  onClick: () => void;
}) {
  const classColor = getClassColor(character.class);
  const lowHp = character.hp_max > 0 && character.hp_current / character.hp_max < 0.25;

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99]"
      style={{
        padding: 12, border: '1px solid var(--tk-border, var(--panel-divider))',
        background: 'var(--tk-panel, rgba(0,180,255,0.04))',
        cursor: 'pointer', position: 'relative', overflow: 'hidden',
      }}
    >
      {/* Background image if set */}
      {character.background_url && (
        <div style={{
          position: 'absolute', inset: 0,
          background: `url(${character.background_url}) center/cover`,
          opacity: 0.08, pointerEvents: 'none',
        }} />
      )}

      <div className="relative flex items-center gap-3">
        {/* Portrait */}
        <div style={{
          width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
          border: `2px solid ${classColor}`,
          background: character.portrait_url
            ? `url(${character.portrait_url}) center/cover`
            : `linear-gradient(135deg, ${classColor}40, ${classColor}15)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, color: classColor,
          position: 'relative',
        }}>
          {!character.portrait_url && '🛡️'}
          {lowHp && (
            <div style={{
              position: 'absolute', top: -2, right: -2,
              width: 14, height: 14, borderRadius: '50%',
              background: '#e53935', color: '#fff',
              fontSize: 9, fontWeight: 800, lineHeight: '14px', textAlign: 'center',
            }}>!</div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-xs font-bold" style={{ color: 'var(--tk-text, var(--text-primary))' }}>
              {character.name}
            </span>
            {isDm && (
              <span style={{
                fontSize: 8, padding: '1px 5px', borderRadius: 4, flexShrink: 0,
                background: 'rgba(255,215,0,0.12)', border: '1px solid rgba(255,215,0,0.25)',
                color: 'var(--tk-gold, #FFD700)', fontWeight: 700,
              }}>DM</span>
            )}
          </div>
          <p className="truncate" style={{ fontSize: 10, color: 'var(--tk-text-muted, var(--text-muted))', marginTop: 1 }}>
            {character.species} {character.class} · Lv {character.level}
          </p>
          {member && (
            <p className="truncate" style={{ fontSize: 9, color: 'var(--tk-text-muted, var(--text-muted))', opacity: 0.7, marginTop: 1 }}>
              @{member.username}
            </p>
          )}
        </div>
      </div>

      {/* Bars */}
      <div className="relative mt-2.5 flex flex-col gap-1">
        <HpBar current={character.hp_current} max={character.hp_max} height={5} />
        <XpBar current={character.xp_current} max={character.xp_max} height={3} />
      </div>
    </button>
  );
});
