// src/components/servers/ServerEvents.tsx
import { memo, useState, useEffect, useCallback } from 'react';
import { Plus, CalendarDays, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useServerStore } from '../../store/serverStore';
import type { CalendarEvent } from '../../store/calendarStore';

const EVENT_COLORS = ['#00d4ff', '#3dd87a', '#a855f7', '#ff9d3d', '#ff5032', '#f472b6'];

export const ServerEvents = memo(function ServerEvents() {
  const user = useAuthStore(s => s.user);
  const { selectedServerId } = useServerStore();

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('12:00');
  const [endTime, setEndTime] = useState('13:00');
  const [color, setColor] = useState('#00d4ff');
  const [creating, setCreating] = useState(false);

  const loadEvents = useCallback(async () => {
    if (!selectedServerId) return;
    const { data } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('server_id', selectedServerId)
      .order('start_at', { ascending: true });
    if (data) setEvents(data);
  }, [selectedServerId]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const handleCreate = async () => {
    if (!user || !selectedServerId || !title.trim() || !date || creating) return;
    setCreating(true);
    const start_at = new Date(`${date}T${startTime}`).toISOString();
    const end_at = new Date(`${date}T${endTime}`).toISOString();

    const { error } = await supabase.from('calendar_events').insert({
      id: crypto.randomUUID(),
      creator_id: user.id,
      title: title.trim(),
      description: description.trim() || null,
      start_at,
      end_at,
      color,
      visibility: 'private',
      server_id: selectedServerId,
    });

    if (!error) {
      setTitle('');
      setDescription('');
      setDate('');
      setStartTime('12:00');
      setEndTime('13:00');
      setColor('#00d4ff');
      setShowCreate(false);
      await loadEvents();
    }
    setCreating(false);
  };

  const handleDelete = async (eventId: string) => {
    await supabase.from('calendar_events').delete().eq('id', eventId);
    setEvents(prev => prev.filter(e => e.id !== eventId));
  };

  // Split events into upcoming and past
  const now = new Date();
  const upcoming = events.filter(e => new Date(e.end_at) >= now);
  const past = events.filter(e => new Date(e.end_at) < now);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Server events appear in every member's calendar.
        </p>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1 rounded-aero px-2.5 py-1.5 text-[10px] font-medium transition-opacity hover:opacity-80"
          style={{ background: 'rgba(0,212,255,0.12)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.25)' }}
        >
          <Plus className="h-3 w-3" /> New Event
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div
          className="rounded-[12px] flex flex-col gap-3"
          style={{ padding: 16, background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.15)' }}
        >
          <input
            value={title}
            onChange={e => setTitle(e.target.value.slice(0, 60))}
            placeholder="Event title..."
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 10, fontSize: 12,
              background: 'var(--input-bg)', border: '1px solid var(--input-border)',
              color: 'var(--text-primary)', outline: 'none',
            }}
          />
          <input
            value={description}
            onChange={e => setDescription(e.target.value.slice(0, 200))}
            placeholder="Description (optional)..."
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 10, fontSize: 12,
              background: 'var(--input-bg)', border: '1px solid var(--input-border)',
              color: 'var(--text-primary)', outline: 'none',
            }}
          />
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 10, fontSize: 12,
                background: 'var(--input-bg)', border: '1px solid var(--input-border)',
                color: 'var(--text-primary)', outline: 'none',
              }}
            />
            <input
              type="time"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
              style={{
                width: 100, padding: '8px 10px', borderRadius: 10, fontSize: 12,
                background: 'var(--input-bg)', border: '1px solid var(--input-border)',
                color: 'var(--text-primary)', outline: 'none',
              }}
            />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>to</span>
            <input
              type="time"
              value={endTime}
              onChange={e => setEndTime(e.target.value)}
              style={{
                width: 100, padding: '8px 10px', borderRadius: 10, fontSize: 12,
                background: 'var(--input-bg)', border: '1px solid var(--input-border)',
                color: 'var(--text-primary)', outline: 'none',
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Color</span>
            <div className="flex gap-1.5">
              {EVENT_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  style={{
                    width: 22, height: 22, borderRadius: '50%', background: c,
                    border: color === c ? '2px solid white' : '2px solid transparent',
                    boxShadow: color === c ? `0 0 8px ${c}60` : 'none',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowCreate(false)}
              className="rounded-aero px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
              style={{ color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--panel-divider)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!title.trim() || !date || creating}
              className="rounded-aero px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ background: 'rgba(0,212,255,0.15)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.3)' }}
            >
              {creating ? 'Creating...' : 'Create Event'}
            </button>
          </div>
        </div>
      )}

      {/* Upcoming events */}
      {upcoming.length > 0 && (
        <div className="flex flex-col gap-2">
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Upcoming
          </span>
          {upcoming.map(event => (
            <EventCard key={event.id} event={event} isOwner={event.creator_id === user?.id} onDelete={() => handleDelete(event.id)} />
          ))}
        </div>
      )}

      {/* Past events */}
      {past.length > 0 && (
        <div className="flex flex-col gap-2">
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Past
          </span>
          {past.map(event => (
            <EventCard key={event.id} event={event} isOwner={event.creator_id === user?.id} onDelete={() => handleDelete(event.id)} isPast />
          ))}
        </div>
      )}

      {events.length === 0 && !showCreate && (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>
          No events yet. Create one and it will show up on every member's calendar.
        </p>
      )}
    </div>
  );
});

function EventCard({ event, isOwner, onDelete, isPast }: {
  event: CalendarEvent;
  isOwner: boolean;
  onDelete: () => void;
  isPast?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const start = new Date(event.start_at);
  const end = new Date(event.end_at);
  const dateStr = start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const timeStr = `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

  return (
    <div
      className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 transition-colors"
      style={{
        border: `1px solid ${event.color}30`,
        background: isPast ? 'rgba(255,255,255,0.02)' : `${event.color}08`,
        opacity: isPast ? 0.6 : 1,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ width: 4, height: 32, borderRadius: 2, background: event.color, flexShrink: 0 }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <CalendarDays className="h-3 w-3 flex-shrink-0" style={{ color: event.color }} />
          <span className="truncate" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
            {event.title}
          </span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
          {dateStr} · {timeStr}
        </div>
        {event.description && (
          <p className="truncate" style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
            {event.description}
          </p>
        )}
      </div>
      {isOwner && hovered && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="transition-opacity hover:opacity-70"
          style={{ color: '#ff5032', flexShrink: 0 }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
