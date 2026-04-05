// src/components/corners/calendar/CalendarWeekGrid.tsx
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCalendarStore, type CalendarEvent } from '../../../store/calendarStore';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface Props {
  userId: string;
}

export function CalendarWeekGrid({ userId: _userId }: Props) {
  const {
    events, currentWeekStart, loading,
    goToPrevWeek, goToNextWeek, goToCurrentWeek,
    openCreateModal, openEditModal,
  } = useCalendarStore();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Build the 7 day columns for the current week
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  // Format week header label
  const startLabel = currentWeekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const endDay = new Date(currentWeekStart);
  endDay.setDate(endDay.getDate() + 6);
  const endLabel = endDay.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
      {/* Week header bar */}
      <div
        className="flex items-center gap-3 px-5 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--panel-divider)' }}
      >
        <div className="flex items-center gap-1">
          <button
            onClick={goToPrevWeek}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: 'var(--text-muted)' }}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={goToNextWeek}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: 'var(--text-muted)' }}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <span className="text-sm font-semibold flex-1" style={{ color: 'var(--text-secondary)' }}>
          {loading ? 'Loading…' : `${startLabel} – ${endLabel}`}
        </span>

        <button
          onClick={() => goToCurrentWeek()}
          className="rounded-lg px-3 py-1 text-[10px] font-semibold transition-all"
          style={{ background: 'rgba(0,180,255,0.08)', border: '1px solid rgba(0,180,255,0.20)', color: '#00d4ff' }}
        >
          Today
        </button>

        <button
          onClick={() => openCreateModal()}
          className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all"
          style={{ background: 'rgba(61,216,122,0.15)', border: '1px solid rgba(61,216,122,0.35)', color: '#3dd87a' }}
        >
          <Plus className="h-3.5 w-3.5" />
          New Event
        </button>
      </div>

      {/* Day column headers */}
      <div
        className="grid flex-shrink-0"
        style={{ gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--panel-divider)' }}
      >
        {days.map((day, i) => {
          const isToday = day.getTime() === today.getTime();
          return (
            <div
              key={i}
              className="flex flex-col items-center py-2 gap-1 cursor-pointer"
              style={{ borderRight: i < 6 ? '1px solid var(--panel-divider)' : 'none' }}
              onClick={() => openCreateModal(day)}
            >
              <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                {DAY_LABELS[i]}
              </span>
              <div
                className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold"
                style={isToday
                  ? { background: '#00d4ff', color: '#08112d' }
                  : { color: 'var(--text-secondary)' }
                }
              >
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Event cells */}
      <div
        className="grid flex-1 overflow-y-auto"
        style={{ gridTemplateColumns: 'repeat(7, 1fr)', alignContent: 'start' }}
      >
        {days.map((day, i) => {
          // Use local date string — toISOString() shifts to UTC which mismatches in non-UTC timezones
          const dayStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
          const dayEvents = events.filter(e => {
            const ed = new Date(e.start_at);
            const edStr = `${ed.getFullYear()}-${String(ed.getMonth() + 1).padStart(2, '0')}-${String(ed.getDate()).padStart(2, '0')}`;
            return edStr === dayStr;
          });
          return (
            <div
              key={i}
              className="flex flex-col gap-1.5 p-2"
              style={{
                borderRight: i < 6 ? '1px solid var(--panel-divider)' : 'none',
                minHeight: 80,
              }}
            >
              {dayEvents.map(event => (
                <EventChip key={event.id} event={event} onClick={() => openEditModal(event)} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

function EventChip({ event, onClick }: { event: CalendarEvent; onClick: () => void }) {
  const startTime = new Date(event.start_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-lg px-2 py-1.5 transition-all"
      style={{
        background: `rgba(${hexToRgb(event.color)}, 0.15)`,
        border: `1px solid rgba(${hexToRgb(event.color)}, 0.35)`,
        borderLeft: `3px solid ${event.color}`,
      }}
    >
      <p className="text-[10px] font-semibold leading-tight truncate" style={{ color: event.color }}>
        {event.title}
      </p>
      <p className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
        {startTime}
      </p>
    </button>
  );
}
