// src/components/corners/CalendarCorner.tsx
import { useEffect } from 'react';
import { ArrowLeft, CalendarDays, Plus } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useCornerStore } from '../../store/cornerStore';
import { useCalendarStore } from '../../store/calendarStore';
import { WeekStrip } from './calendar/WeekStrip';
import { AgendaTimeline } from './calendar/AgendaTimeline';
import { TasksPanel } from './calendar/TasksPanel';
import { EventModal } from './calendar/EventModal';

export function CalendarCorner() {
  const user = useAuthStore(s => s.user);
  const { closeCalendarView } = useCornerStore();
  const { init, subscribeRealtime, activeModal, openCreateModal, goToCurrentWeek } = useCalendarStore();

  useEffect(() => {
    if (!user) return;
    init(user.id);
    const unsub = subscribeRealtime(user.id);
    return unsub;
  }, [user?.id]);

  if (!user) return null;

  return (
    <div
      className="flex h-full flex-col"
      style={{
        background: 'var(--sidebar-bg)',
        overflow: 'hidden',
      }}
    >
      {/* Header bar */}
      <div
        className="flex items-center gap-2.5 px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--panel-divider)' }}
      >
        <button
          onClick={closeCalendarView}
          className="flex h-8 w-8 items-center justify-center rounded-xl transition-all flex-shrink-0"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.10)',
            color: 'var(--text-muted)',
          }}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div
          className="flex h-8 w-8 items-center justify-center rounded-xl flex-shrink-0"
          style={{ background: 'rgba(61,216,122,0.15)', border: '1px solid rgba(61,216,122,0.30)' }}
        >
          <CalendarDays className="h-[18px] w-[18px]" style={{ color: '#3dd87a' }} />
        </div>
        <p className="text-[15px] font-bold flex-1 min-w-0 truncate" style={{ color: 'var(--text-primary)' }}>
          Calendar
        </p>

        <button
          onClick={() => { goToCurrentWeek(); useCalendarStore.getState().selectDate(new Date()); }}
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

      {/* Week strip + collapsible mini-month */}
      <WeekStrip />

      {/* Agenda + Tasks split */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <AgendaTimeline />
        <TasksPanel userId={user.id} />
      </div>

      {/* Event modal */}
      {activeModal && <EventModal userId={user.id} />}
    </div>
  );
}
