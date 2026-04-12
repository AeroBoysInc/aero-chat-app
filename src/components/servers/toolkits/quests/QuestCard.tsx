// src/components/servers/toolkits/quests/QuestCard.tsx
import { memo } from 'react';
import { Check, EyeOff, Pencil, Trash2 } from 'lucide-react';
import type { DndQuest } from '../../../../lib/serverTypes';

export const QuestCard = memo(function QuestCard({
  quest,
  isDm,
  canToggle,
  onToggleComplete,
  onEdit,
  onDelete,
}: {
  quest: DndQuest;
  isDm: boolean;
  canToggle: boolean;
  onToggleComplete: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const completed = quest.is_completed;

  return (
    <div
      style={{
        position: 'relative',
        padding: 14,
        borderRadius: 14,
        background: completed
          ? 'linear-gradient(145deg, rgba(76,175,80,0.06), rgba(139,69,19,0.03))'
          : 'linear-gradient(145deg, rgba(139,69,19,0.08), rgba(255,215,0,0.04))',
        border: `1px solid ${completed ? 'rgba(76,175,80,0.22)' : 'rgba(139,69,19,0.22)'}`,
        transition: 'background 0.2s, border-color 0.2s',
      }}
    >
      <div className="flex items-start gap-3">
        {/* Completion toggle */}
        <button
          onClick={onToggleComplete}
          disabled={!canToggle}
          title={canToggle ? (completed ? 'Mark incomplete' : 'Mark complete') : 'Only DMs or assigned players can toggle'}
          style={{
            flexShrink: 0,
            width: 22,
            height: 22,
            borderRadius: '50%',
            border: `2px solid ${completed ? '#4CAF50' : 'rgba(139,69,19,0.40)'}`,
            background: completed ? '#4CAF50' : 'transparent',
            cursor: canToggle ? 'pointer' : 'not-allowed',
            opacity: canToggle ? 1 : 0.5,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s',
            marginTop: 2,
          }}
        >
          {completed && <Check className="h-3 w-3" style={{ color: '#fff', strokeWidth: 3 }} />}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex items-center gap-2">
            {quest.is_secret && (
              <EyeOff className="h-3 w-3" style={{ color: 'var(--tk-gold, #FFD700)', flexShrink: 0 }} />
            )}
            <h4
              style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--tk-text, var(--text-primary))',
                textDecoration: completed ? 'line-through' : 'none',
                opacity: completed ? 0.65 : 1,
                fontFamily: 'Georgia, serif',
              }}
            >
              {quest.title}
            </h4>
          </div>

          {quest.description && (
            <p
              style={{
                margin: '4px 0 0',
                fontSize: 11,
                lineHeight: 1.5,
                color: 'var(--tk-text-muted, var(--text-muted))',
                whiteSpace: 'pre-wrap',
                opacity: completed ? 0.6 : 1,
              }}
            >
              {quest.description}
            </p>
          )}

          {completed && quest.completed_at && (
            <p style={{ margin: '6px 0 0', fontSize: 9, color: '#4CAF50', fontWeight: 600 }}>
              Completed {new Date(quest.completed_at).toLocaleDateString()}
            </p>
          )}
        </div>

        {/* DM actions */}
        {isDm && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={onEdit}
              title="Edit quest"
              className="rounded-md p-1.5 transition-colors hover:bg-white/10"
              style={{ color: 'var(--tk-text-muted, var(--text-muted))', cursor: 'pointer', border: 'none', background: 'transparent' }}
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              onClick={onDelete}
              title="Delete quest"
              className="rounded-md p-1.5 transition-colors hover:bg-red-500/10"
              style={{ color: 'var(--tk-text-muted, var(--text-muted))', cursor: 'pointer', border: 'none', background: 'transparent' }}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
