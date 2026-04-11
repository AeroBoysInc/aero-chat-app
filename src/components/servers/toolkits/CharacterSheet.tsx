// src/components/servers/toolkits/CharacterSheet.tsx
import { memo, useState } from 'react';
import { X, Trash2, Pencil, Check } from 'lucide-react';
import type { DndCharacter, ServerMember } from '../../../lib/serverTypes';
import { getClassColor } from '../../../lib/classColors';
import { useDndCharacterStore } from '../../../store/dndCharacterStore';
import { HpBar } from './HpBar';
import { XpBar } from './XpBar';

const STAT_LABELS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const;
const STAT_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;

export const CharacterSheet = memo(function CharacterSheet({
  character,
  member,
  isDm,
  isOwn,
  onClose,
}: {
  character: DndCharacter;
  member: ServerMember | undefined;
  isDm: boolean;
  isOwn: boolean;
  onClose: () => void;
}) {
  const { updateCharacter, deleteCharacter } = useDndCharacterStore();
  const classColor = getClassColor(character.class);
  const canEdit = isOwn || isDm;

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: character.name,
    species: character.species,
    class: character.class,
    level: String(character.level),
    hp_current: String(character.hp_current),
    hp_max: String(character.hp_max),
    xp_current: String(character.xp_current),
    xp_max: String(character.xp_max),
    gold: String(character.gold),
    armor_class: String(character.armor_class),
    str: String(character.stats.str),
    dex: String(character.stats.dex),
    con: String(character.stats.con),
    int: String(character.stats.int),
    wis: String(character.stats.wis),
    cha: String(character.stats.cha),
  });

  const setField = (key: keyof typeof form, value: string) => setForm(f => ({ ...f, [key]: value }));

  const handleSave = async () => {
    await updateCharacter(character.id, {
      name: form.name.trim() || character.name,
      species: form.species,
      class: form.class,
      level: parseInt(form.level, 10) || character.level,
      hp_current: Math.max(0, Math.min(parseInt(form.hp_current, 10) || 0, parseInt(form.hp_max, 10) || character.hp_max)),
      hp_max: parseInt(form.hp_max, 10) || character.hp_max,
      xp_current: parseInt(form.xp_current, 10) || 0,
      xp_max: parseInt(form.xp_max, 10) || character.xp_max,
      gold: parseInt(form.gold, 10) || 0,
      armor_class: parseInt(form.armor_class, 10) || 10,
      stats: {
        str: parseInt(form.str, 10) || 10,
        dex: parseInt(form.dex, 10) || 10,
        con: parseInt(form.con, 10) || 10,
        int: parseInt(form.int, 10) || 10,
        wis: parseInt(form.wis, 10) || 10,
        cha: parseInt(form.cha, 10) || 10,
      },
    });
    setEditing(false);
  };

  const handleDelete = async () => {
    await deleteCharacter(character.id);
    onClose();
  };

  const editInput = (key: keyof typeof form, width: number, type: 'text' | 'number' = 'number') => (
    <input
      type={type}
      value={form[key]}
      onChange={e => setField(key, e.target.value)}
      style={{
        width, padding: '2px 4px', borderRadius: 4, fontSize: 12, textAlign: 'center',
        background: 'rgba(255,255,255,0.06)', border: '1px solid var(--tk-border, var(--panel-divider))',
        color: 'var(--tk-text, var(--text-primary))', outline: 'none',
      }}
    />
  );

  return (
    <div
      className="animate-fade-in"
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        backdropFilter: 'blur(20px)', background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 420, maxHeight: '85vh', borderRadius: 20, overflow: 'hidden',
          background: 'var(--sidebar-bg)', border: `1px solid ${classColor}30`,
          boxShadow: `0 24px 80px rgba(0,0,0,0.5), 0 0 40px ${classColor}15`,
          display: 'flex', flexDirection: 'column', position: 'relative',
        }}
      >
        {/* Background image */}
        {character.background_url && (
          <div style={{
            position: 'absolute', inset: 0,
            background: `url(${character.background_url}) center/cover`,
            opacity: 0.12, pointerEvents: 'none',
          }} />
        )}

        {/* Header */}
        <div className="relative flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--tk-border, var(--panel-divider))' }}>
          <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--tk-text, var(--text-primary))' }}>
            Character Sheet
          </span>
          <div className="flex items-center gap-2">
            {canEdit && !editing && (
              <button onClick={() => setEditing(true)} style={{ color: 'var(--tk-accent-light, #00d4ff)', background: 'none', border: 'none', cursor: 'pointer' }} title="Edit character">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {editing && (
              <button onClick={handleSave} style={{ color: '#4CAF50', background: 'none', border: 'none', cursor: 'pointer' }} title="Save changes">
                <Check className="h-3.5 w-3.5" />
              </button>
            )}
            {isOwn && (
              <button onClick={handleDelete} style={{ color: '#cc4444', background: 'none', border: 'none', cursor: 'pointer' }} title="Delete character">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            <button onClick={onClose} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="relative flex-1 overflow-y-auto px-5 py-4">
          {/* Portrait + name */}
          <div className="flex items-center gap-4 mb-4">
            <div style={{
              width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
              border: `3px solid ${classColor}`,
              boxShadow: `0 0 16px ${classColor}30`,
              background: character.portrait_url
                ? `url(${character.portrait_url}) center/cover`
                : `linear-gradient(135deg, ${classColor}40, ${classColor}15)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, color: classColor,
            }}>
              {!character.portrait_url && '🛡️'}
            </div>
            <div>
              {editing ? (
                <>
                  {editInput('name', 160, 'text')}
                  <div className="flex gap-1.5 mt-1">
                    {editInput('species', 75, 'text')}
                    {editInput('class', 75, 'text')}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <span style={{ fontSize: 10, color: 'var(--tk-text-muted, var(--text-muted))' }}>Level</span>
                    {editInput('level', 40)}
                  </div>
                </>
              ) : (
                <>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--tk-text, var(--text-primary))', margin: 0 }}>
                    {character.name}
                  </h3>
                  <p style={{ fontSize: 12, color: 'var(--tk-text-muted, var(--text-muted))', margin: '2px 0 0' }}>
                    {character.species} {character.class} · Level {character.level}
                  </p>
                </>
              )}
              {member && (
                <p style={{ fontSize: 11, color: 'var(--tk-text-muted, var(--text-muted))', opacity: 0.7, margin: '2px 0 0' }}>
                  Played by @{member.username}
                </p>
              )}
            </div>
          </div>

          {/* Stat grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 16 }}>
            {STAT_LABELS.map((label, i) => {
              const key = STAT_KEYS[i];
              const val = character.stats[key];
              const mod = ((val - 10) / 2) | 0;
              const isHigh = val >= 14;
              const isLow = val <= 8;
              return (
                <div key={label} style={{
                  padding: '8px 6px', borderRadius: 10, textAlign: 'center',
                  background: 'var(--tk-panel, rgba(0,180,255,0.04))',
                  border: `1px solid ${isHigh ? classColor + '40' : 'var(--tk-border, var(--panel-divider))'}`,
                  opacity: isLow ? 0.5 : 1,
                }}>
                  <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--tk-text-muted, var(--text-muted))', letterSpacing: '0.05em' }}>{label}</div>
                  {editing ? (
                    editInput(key as keyof typeof form, 40)
                  ) : (
                    <>
                      <div style={{ fontSize: 20, fontWeight: 800, color: isHigh ? classColor : 'var(--tk-text, var(--text-primary))' }}>{val}</div>
                      <div style={{ fontSize: 10, color: 'var(--tk-text-muted, var(--text-muted))' }}>{mod >= 0 ? '+' : ''}{mod}</div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* HP bar */}
          <div style={{ marginBottom: 12 }}>
            <div className="flex items-center justify-between mb-1">
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--tk-text-muted, var(--text-muted))' }}>HP</span>
              {editing ? (
                <div className="flex items-center gap-1">
                  {editInput('hp_current', 45)}
                  <span style={{ fontSize: 10, color: 'var(--tk-text-muted, var(--text-muted))' }}>/</span>
                  {editInput('hp_max', 45)}
                </div>
              ) : (
                <span style={{ fontSize: 11, color: 'var(--tk-text, var(--text-primary))' }}>{character.hp_current}/{character.hp_max}</span>
              )}
            </div>
            <HpBar current={character.hp_current} max={character.hp_max} height={8} />
          </div>

          {/* XP bar */}
          <div style={{ marginBottom: 16 }}>
            <div className="flex items-center justify-between mb-1">
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--tk-text-muted, var(--text-muted))' }}>XP</span>
              {editing ? (
                <div className="flex items-center gap-1">
                  {editInput('xp_current', 55)}
                  <span style={{ fontSize: 10, color: 'var(--tk-text-muted, var(--text-muted))' }}>/</span>
                  {editInput('xp_max', 55)}
                </div>
              ) : (
                <span style={{ fontSize: 11, color: 'var(--tk-text, var(--text-primary))' }}>{character.xp_current}/{character.xp_max}</span>
              )}
            </div>
            <XpBar current={character.xp_current} max={character.xp_max} height={6} />
          </div>

          {/* AC + Gold badges */}
          <div className="flex flex-wrap gap-1.5" style={{ marginBottom: 12 }}>
            <span style={badgeStyle}>
              {editing ? <>{editInput('armor_class', 35)}</> : <>🛡️ AC {character.armor_class}</>}
            </span>
            <span style={badgeStyle}>
              {editing ? <>{editInput('gold', 50)}</> : <>💰 {character.gold.toLocaleString()} gp</>}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="relative flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderTop: '1px solid var(--tk-border, var(--panel-divider))' }}>
          <span style={{ fontSize: 10, color: 'var(--tk-text-muted, var(--text-muted))' }}>
            All fields are editable
          </span>
          {editing && (
            <button onClick={() => setEditing(false)} style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

const badgeStyle: React.CSSProperties = {
  padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 500,
  background: 'var(--tk-panel, rgba(0,180,255,0.06))',
  border: '1px solid var(--tk-border, var(--panel-divider))',
  color: 'var(--tk-text-muted, var(--text-muted))',
  whiteSpace: 'nowrap',
  display: 'inline-flex', alignItems: 'center', gap: 4,
};
