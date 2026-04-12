// src/components/servers/toolkits/quests/QuestLog.tsx
import { memo, useEffect, useMemo, useState } from 'react';
import { Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { useAuthStore } from '../../../../store/authStore';
import { useServerStore } from '../../../../store/serverStore';
import { useServerRoleStore } from '../../../../store/serverRoleStore';
import { useDndQuestStore } from '../../../../store/dndQuestStore';
import type { DndQuest } from '../../../../lib/serverTypes';
import { QuestCard } from './QuestCard';
import { QuestForm } from './QuestForm';

export const QuestLog = memo(function QuestLog() {
  const user = useAuthStore(s => s.user);
  const { selectedServerId, members } = useServerStore();
  const { hasPermission } = useServerRoleStore();
  const { quests, loading, loadQuests, createQuest, updateQuest, deleteQuest, toggleCompleted, subscribeRealtime, reset } = useDndQuestStore();

  const [formState, setFormState] = useState<{ editing?: DndQuest } | null>(null);
  const [completedOpen, setCompletedOpen] = useState(false);

  const isDm = user && selectedServerId
    ? hasPermission(selectedServerId, user.id, members, 'dungeon_master')
    : false;

  useEffect(() => {
    if (!selectedServerId) return;
    loadQuests(selectedServerId);
    const unsub = subscribeRealtime(selectedServerId);
    return () => { unsub(); reset(); };
  }, [selectedServerId]);

  const { active, completed } = useMemo(() => {
    const active: DndQuest[] = [];
    const completed: DndQuest[] = [];
    for (const q of quests) (q.is_completed ? completed : active).push(q);
    return { active, completed };
  }, [quests]);

  const handleSave = async (
    data: { title: string; description: string; is_secret: boolean; secret_player_ids: string[] },
    editing?: DndQuest,
  ) => {
    if (!selectedServerId || !user) return;
    if (editing) {
      await updateQuest(editing.id, data);
    } else {
      await createQuest({ server_id: selectedServerId, created_by: user.id, ...data });
    }
  };

  const canToggle = (q: DndQuest) => {
    if (isDm) return true;
    if (q.is_secret && user && q.secret_player_ids.includes(user.id)) return true;
    return false;
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--tk-border, var(--panel-divider))' }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--tk-text, var(--text-primary))', margin: 0, fontFamily: 'Georgia, serif' }}>
            Quest Log
          </h3>
          <p style={{ fontSize: 10, color: 'var(--tk-text-muted, var(--text-muted))', margin: '2px 0 0' }}>
            {active.length} active · {completed.length} completed
          </p>
        </div>
        {isDm && (
          <button
            onClick={() => setFormState({})}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.97]"
            style={{
              background: 'linear-gradient(135deg, #8B4513, #D2691E)',
              border: 'none', color: '#fff', cursor: 'pointer',
            }}
          >
            <Plus className="h-3.5 w-3.5" /> New Quest
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading && quests.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p style={{ fontSize: 12, color: 'var(--tk-text-muted, var(--text-muted))' }}>Loading quests…</p>
          </div>
        ) : quests.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div style={{ fontSize: 48, marginBottom: 8, opacity: 0.3 }}>📜</div>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--tk-text, var(--text-primary))', marginBottom: 4 }}>
              No quests yet
            </p>
            <p style={{ fontSize: 11, color: 'var(--tk-text-muted, var(--text-muted))', maxWidth: 260 }}>
              {isDm ? 'Create the first quest for your party.' : 'The DM has not posted any quests yet.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {/* Active quests */}
            {active.map(q => (
              <QuestCard
                key={q.id}
                quest={q}
                isDm={isDm}
                canToggle={canToggle(q)}
                onToggleComplete={() => toggleCompleted(q.id, !q.is_completed)}
                onEdit={() => setFormState({ editing: q })}
                onDelete={() => { if (confirm(`Delete quest "${q.title}"?`)) deleteQuest(q.id); }}
              />
            ))}

            {/* Completed section */}
            {completed.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <button
                  onClick={() => setCompletedOpen(o => !o)}
                  className="flex items-center gap-1.5 w-full px-1 py-1.5 rounded-md transition-colors"
                  style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                    color: 'var(--tk-text-muted, var(--text-muted))',
                    background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  {completedOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  Completed ({completed.length})
                </button>
                {completedOpen && (
                  <div className="space-y-2.5" style={{ marginTop: 8 }}>
                    {completed.map(q => (
                      <QuestCard
                        key={q.id}
                        quest={q}
                        isDm={isDm}
                        canToggle={canToggle(q)}
                        onToggleComplete={() => toggleCompleted(q.id, !q.is_completed)}
                        onEdit={() => setFormState({ editing: q })}
                        onDelete={() => { if (confirm(`Delete quest "${q.title}"?`)) deleteQuest(q.id); }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {formState && (
        <QuestForm
          existing={formState.editing}
          members={members}
          onSave={(data) => handleSave(data, formState.editing)}
          onClose={() => setFormState(null)}
        />
      )}
    </div>
  );
});
