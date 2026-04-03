// src/components/corners/CalendarCorner.tsx
import { useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useCornerStore } from '../../store/cornerStore';
import { useCalendarStore } from '../../store/calendarStore';
import { CalendarLeftPanel } from './calendar/CalendarLeftPanel';
import { CalendarWeekGrid } from './calendar/CalendarWeekGrid';
import { EventModal } from './calendar/EventModal';

export function CalendarCorner() {
  const user = useAuthStore(s => s.user);
  const { closeCalendarView } = useCornerStore();
  const { init, subscribeRealtime, activeModal } = useCalendarStore();

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
        borderRadius: 16,
        border: '1px solid var(--sidebar-border)',
        boxShadow: 'var(--sidebar-shadow)',
        overflow: 'hidden',
      }}
    >
      {/* Two-panel body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <CalendarLeftPanel userId={user.id} onClose={closeCalendarView} />
        <CalendarWeekGrid userId={user.id} />
      </div>

      {/* Event creation/edit modal */}
      {activeModal && <EventModal userId={user.id} />}
    </div>
  );
}
