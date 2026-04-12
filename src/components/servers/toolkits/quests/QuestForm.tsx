// src/components/servers/toolkits/quests/QuestForm.tsx
import { memo, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, EyeOff, Eye, Check } from 'lucide-react';
import type { DndQuest, ServerMember } from '../../../../lib/serverTypes';

export const QuestForm = memo(function QuestForm({
  existing,
  members,
  onSave,
  onClose,
}: {
  existing?: DndQuest;
  members: ServerMember[];
  onSave: (data: {
    title: string;
    description: string;
    is_secret: boolean;
    secret_player_ids: string[];
  }) => Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [isSecret, setIsSecret] = useState(existing?.is_secret ?? false);
  const [secretIds, setSecretIds] = useState<string[]>(existing?.secret_player_ids ?? []);
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => { titleRef.current?.focus(); }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const togglePlayer = (id: string) => {
    setSecretIds(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  };

  const handleSave = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        is_secret: isSecret,
        secret_player_ids: isSecret ? secretIds : [],
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(480px, calc(100vw - 32px))',
          maxHeight: 'calc(100vh - 64px)',
          overflow: 'auto',
          borderRadius: 18,
          background: 'rgba(20,14,8,0.97)',
          border: '1px solid rgba(139,69,19,0.35)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,215,0,0.08)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(139,69,19,0.22)' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, fontFamily: 'Georgia, serif', color: 'var(--tk-gold, #FFD700)' }}>
            {existing ? 'Edit Quest' : 'New Quest'}
          </h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-white/10" style={{ color: '#ccc', background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Title */}
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', color: '#aaa', marginBottom: 6, textTransform: 'uppercase' }}>
              Title
            </label>
            <input
              ref={titleRef}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="The Lost Crown of Bael Turath"
              style={{
                width: '100%', padding: '9px 12px', borderRadius: 10,
                background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(139,69,19,0.30)',
                color: '#fff', fontSize: 13, fontFamily: 'Georgia, serif', outline: 'none',
              }}
            />
          </div>

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', color: '#aaa', marginBottom: 6, textTransform: 'uppercase' }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              placeholder="Describe the objective, rewards, warnings…"
              style={{
                width: '100%', padding: '9px 12px', borderRadius: 10,
                background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(139,69,19,0.30)',
                color: '#fff', fontSize: 12, lineHeight: 1.5, outline: 'none', resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Visibility */}
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', color: '#aaa', marginBottom: 6, textTransform: 'uppercase' }}>
              Visibility
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsSecret(false)}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all"
                style={{
                  background: !isSecret ? 'linear-gradient(135deg, rgba(0,180,255,0.20), rgba(0,180,255,0.10))' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${!isSecret ? 'rgba(0,180,255,0.40)' : 'rgba(255,255,255,0.08)'}`,
                  color: !isSecret ? '#5cd0ff' : '#999', cursor: 'pointer',
                }}
              >
                <Eye className="h-3 w-3" /> Public
              </button>
              <button
                type="button"
                onClick={() => setIsSecret(true)}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all"
                style={{
                  background: isSecret ? 'linear-gradient(135deg, rgba(255,215,0,0.20), rgba(255,215,0,0.10))' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${isSecret ? 'rgba(255,215,0,0.40)' : 'rgba(255,255,255,0.08)'}`,
                  color: isSecret ? '#FFD700' : '#999', cursor: 'pointer',
                }}
              >
                <EyeOff className="h-3 w-3" /> Secret
              </button>
            </div>
          </div>

          {/* Player picker (only when secret) */}
          {isSecret && (
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', color: '#aaa', marginBottom: 6, textTransform: 'uppercase' }}>
                Assigned Players ({secretIds.length})
              </label>
              <div
                style={{
                  maxHeight: 160, overflowY: 'auto',
                  borderRadius: 10, border: '1px solid rgba(139,69,19,0.25)',
                  background: 'rgba(0,0,0,0.22)', padding: 4,
                }}
              >
                {members.length === 0 ? (
                  <p style={{ padding: 10, fontSize: 11, color: '#777' }}>No members.</p>
                ) : members.map(m => {
                  const selected = secretIds.includes(m.user_id);
                  return (
                    <button
                      key={m.user_id}
                      type="button"
                      onClick={() => togglePlayer(m.user_id)}
                      className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md transition-colors"
                      style={{
                        background: selected ? 'rgba(255,215,0,0.12)' : 'transparent',
                        border: 'none', cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <div style={{
                        width: 14, height: 14, borderRadius: 4,
                        border: `1.5px solid ${selected ? '#FFD700' : 'rgba(255,255,255,0.20)'}`,
                        background: selected ? '#FFD700' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {selected && <Check className="h-2.5 w-2.5" style={{ color: '#000', strokeWidth: 3 }} />}
                      </div>
                      <span style={{ fontSize: 12, color: selected ? '#FFD700' : '#ccc', fontWeight: selected ? 600 : 400 }}>
                        {m.username ?? m.user_id.slice(0, 8)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3" style={{ borderTop: '1px solid rgba(139,69,19,0.22)' }}>
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-xs font-semibold transition-all active:scale-[0.97]"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#ccc', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || saving}
            className="rounded-lg px-4 py-2 text-xs font-bold transition-all active:scale-[0.97] disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, #8B4513, #D2691E)',
              border: 'none', color: '#fff', cursor: saving ? 'wait' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : existing ? 'Save Changes' : 'Create Quest'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
});

