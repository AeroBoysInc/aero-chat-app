// src/components/corners/calendar/EventModal.tsx
import { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import { useCalendarStore } from '../../../store/calendarStore';
import { useFriendStore } from '../../../store/friendStore';

const COLOR_SWATCHES = [
  '#00d4ff', // cyan
  '#3dd87a', // green
  '#a855f7', // purple
  '#f59e0b', // amber
  '#ef4444', // red
];

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

function toLocalInputValue(iso: string): string {
  // Convert ISO string to "YYYY-MM-DDTHH:MM" for datetime-local input
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultStartFor(prefill?: Date | null): string {
  const d = prefill ? new Date(prefill) : new Date();
  d.setMinutes(0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
}

function defaultEndFor(startVal: string): string {
  const d = new Date(startVal);
  d.setMinutes(d.getMinutes() + 30);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Props {
  userId: string;
}

export function EventModal({ userId }: Props) {
  const {
    activeModal, editingEvent, modalPrefillDate,
    closeModal, createEvent, updateEvent, deleteEvent,
  } = useCalendarStore();
  const friends = useFriendStore(s => s.friends);

  const isEdit = activeModal === 'edit' && !!editingEvent;

  const initStart = isEdit
    ? toLocalInputValue(editingEvent!.start_at)
    : defaultStartFor(modalPrefillDate);
  const initEnd = isEdit
    ? toLocalInputValue(editingEvent!.end_at)
    : defaultEndFor(initStart);

  const [title, setTitle] = useState(isEdit ? editingEvent!.title : '');
  const [description, setDescription] = useState(isEdit ? (editingEvent!.description ?? '') : '');
  const [startVal, setStartVal] = useState(initStart);
  const [endVal, setEndVal] = useState(initEnd);
  const [color, setColor] = useState(isEdit ? editingEvent!.color : COLOR_SWATCHES[0]);
  const [inviteeIds, setInviteeIds] = useState<string[]>(
    isEdit ? (editingEvent!.invites ?? []).map(i => i.invitee_id) : []
  );
  const [saving, setSaving] = useState(false);

  // Re-init when modal opens
  useEffect(() => {
    if (!activeModal) return;
    const start = isEdit ? toLocalInputValue(editingEvent!.start_at) : defaultStartFor(modalPrefillDate);
    const end = isEdit ? toLocalInputValue(editingEvent!.end_at) : defaultEndFor(start);
    setTitle(isEdit ? editingEvent!.title : '');
    setDescription(isEdit ? (editingEvent!.description ?? '') : '');
    setStartVal(start);
    setEndVal(end);
    setColor(isEdit ? editingEvent!.color : COLOR_SWATCHES[0]);
    setInviteeIds(isEdit ? (editingEvent!.invites ?? []).map(i => i.invitee_id) : []);
  }, [activeModal, editingEvent?.id]);

  function toggleInvitee(id: string) {
    setInviteeIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  async function handleSubmit() {
    if (!title.trim()) return;
    setSaving(true);
    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      start_at: new Date(startVal).toISOString(),
      end_at: new Date(endVal).toISOString(),
      color,
      invitee_ids: inviteeIds,
    };
    if (isEdit) {
      await updateEvent(editingEvent!.id, payload);
    } else {
      await createEvent(userId, payload);
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!editingEvent) return;
    setSaving(true);
    await deleteEvent(editingEvent.id);
    setSaving(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl flex flex-col overflow-hidden"
        style={{
          background: 'var(--sidebar-bg)',
          border: '1px solid var(--panel-divider)',
          backdropFilter: 'blur(24px)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
          maxHeight: '85vh',
        }}
      >
        {/* Modal header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--panel-divider)' }}
        >
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            {isEdit ? 'Edit Event' : 'New Event'}
          </p>
          <button
            onClick={closeModal}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-all"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text-muted)' }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex flex-col gap-4 px-5 py-4 overflow-y-auto">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Title *
            </label>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Event title"
              className="rounded-xl px-3 py-2 text-sm outline-none transition-all"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.10)',
                color: 'var(--text-primary)',
              }}
              onFocus={e => (e.currentTarget.style.border = '1px solid rgba(0,180,255,0.40)')}
              onBlur={e => (e.currentTarget.style.border = '1px solid rgba(255,255,255,0.10)')}
            />
          </div>

          {/* Date/time row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Start
              </label>
              <input
                type="datetime-local"
                value={startVal}
                onChange={e => setStartVal(e.target.value)}
                className="rounded-xl px-3 py-2 text-xs outline-none"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  color: 'var(--text-primary)',
                  colorScheme: 'dark',
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                End
              </label>
              <input
                type="datetime-local"
                value={endVal}
                onChange={e => setEndVal(e.target.value)}
                className="rounded-xl px-3 py-2 text-xs outline-none"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  color: 'var(--text-primary)',
                  colorScheme: 'dark',
                }}
              />
            </div>
          </div>

          {/* Color swatches */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Colour
            </label>
            <div className="flex gap-2">
              {COLOR_SWATCHES.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="transition-all"
                  style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: c,
                    border: color === c ? `3px solid rgba(255,255,255,0.8)` : '3px solid transparent',
                    boxShadow: color === c ? `0 0 8px ${c}` : 'none',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional notes…"
              rows={2}
              className="rounded-xl px-3 py-2 text-xs outline-none resize-none"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.10)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Invite friends */}
          {friends.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Invite Friends
              </label>
              <div className="flex flex-col gap-1">
                {friends.map(friend => {
                  const selected = inviteeIds.includes(friend.id);
                  return (
                    <button
                      key={friend.id}
                      onClick={() => toggleInvitee(friend.id)}
                      className="flex items-center gap-2 rounded-xl px-3 py-2 transition-all text-left"
                      style={{
                        background: selected ? `rgba(${hexToRgb(color)}, 0.15)` : 'rgba(255,255,255,0.04)',
                        border: selected ? `1px solid rgba(${hexToRgb(color)}, 0.40)` : '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      <div
                        className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold flex-shrink-0"
                        style={{ background: `rgba(${hexToRgb(color)}, 0.25)`, color }}
                      >
                        {friend.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs" style={{ color: selected ? color : 'var(--text-secondary)' }}>
                        {friend.username}
                      </span>
                      {selected && (
                        <span className="ml-auto text-[9px] font-semibold" style={{ color }}>✓ Invited</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div
          className="flex items-center gap-2 px-5 py-4 flex-shrink-0"
          style={{ borderTop: '1px solid var(--panel-divider)' }}
        >
          {isEdit && (
            <button
              onClick={handleDelete}
              disabled={saving}
              className="flex h-8 w-8 items-center justify-center rounded-xl transition-all"
              style={{
                background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.30)',
                color: '#ef4444',
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={closeModal}
            className="rounded-xl px-4 py-2 text-xs font-semibold transition-all"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text-muted)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !title.trim()}
            className="rounded-xl px-4 py-2 text-xs font-bold transition-all"
            style={{
              background: title.trim() ? `rgba(${hexToRgb(color)}, 0.20)` : 'rgba(255,255,255,0.04)',
              border: title.trim() ? `1px solid rgba(${hexToRgb(color)}, 0.45)` : '1px solid rgba(255,255,255,0.08)',
              color: title.trim() ? color : 'var(--text-muted)',
              cursor: title.trim() ? 'pointer' : 'default',
            }}
          >
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Event'}
          </button>
        </div>
      </div>
    </div>
  );
}
