// src/components/corners/calendar/WeekStrip.tsx
import { useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { useCalendarStore, toDateString } from '../../../store/calendarStore';

const DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DOW_SHORT = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export function WeekStrip() {
  const {
    currentWeekStart, selectedDate, miniMonthOpen,
    goToPrevWeek, goToNextWeek, selectDate, toggleMiniMonth,
  } = useCalendarStore();

  const todayStr = toDateString(new Date());
  const selectedStr = toDateString(selectedDate);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const monthLabel = `${MONTH_NAMES[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;

  return (
    <div className="flex-shrink-0">
      {/* Week strip row */}
      <div
        className="flex items-center gap-2 px-4 py-2"
        style={{ borderBottom: '1px solid var(--panel-divider)' }}
      >
        <button
          onClick={goToPrevWeek}
          className="flex h-7 w-7 items-center justify-center rounded-lg transition-all flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: 'var(--text-muted)' }}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>

        <div className="flex flex-1 gap-1">
          {days.map((day, i) => {
            const dayStr = toDateString(day);
            const isSelected = dayStr === selectedStr;
            const isToday = dayStr === todayStr;
            return (
              <button
                key={i}
                onClick={() => selectDate(day)}
                className="flex-1 flex flex-col items-center py-1.5 gap-0.5 rounded-xl transition-all"
                style={{
                  background: isSelected ? 'rgba(0,212,255,0.15)' : 'transparent',
                  border: isSelected ? '1px solid rgba(0,212,255,0.3)' : '1px solid transparent',
                  cursor: 'pointer',
                }}
              >
                <span style={{
                  fontSize: 9, fontWeight: 600, letterSpacing: '0.04em',
                  color: isSelected ? '#00d4ff' : 'var(--text-muted)',
                }}>
                  {DAY_LABELS[i]}
                </span>
                <span style={{
                  fontSize: 14, fontWeight: isSelected ? 700 : 500,
                  color: isSelected ? '#00d4ff' : 'var(--text-secondary)',
                }}>
                  {day.getDate()}
                </span>
                {isToday && (
                  <div style={{
                    width: 4, height: 4, borderRadius: '50%',
                    background: isSelected ? '#00d4ff' : 'rgba(0,212,255,0.5)',
                  }} />
                )}
              </button>
            );
          })}
        </div>

        <button
          onClick={goToNextWeek}
          className="flex h-7 w-7 items-center justify-center rounded-lg transition-all flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: 'var(--text-muted)' }}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Month label + toggle */}
      <div
        className="flex items-center justify-center gap-1.5 py-1.5 cursor-pointer"
        onClick={toggleMiniMonth}
        style={{ borderBottom: '1px solid var(--panel-divider)' }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
          {monthLabel}
        </span>
        {miniMonthOpen
          ? <ChevronUp className="h-3 w-3" style={{ color: 'var(--text-muted)' }} />
          : <ChevronDown className="h-3 w-3" style={{ color: 'var(--text-muted)' }} />
        }
      </div>

      {/* Collapsible mini-month */}
      <div style={{
        overflow: 'hidden',
        maxHeight: miniMonthOpen ? 220 : 0,
        transition: 'max-height 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        borderBottom: miniMonthOpen ? '1px solid var(--panel-divider)' : 'none',
      }}>
        <MiniMonth />
      </div>
    </div>
  );
}

function MiniMonth() {
  const { selectedDate, selectDate } = useCalendarStore();
  const [viewMonth, setViewMonth] = useState(() => ({
    year: selectedDate.getFullYear(),
    month: selectedDate.getMonth(),
  }));

  const todayStr = toDateString(new Date());
  const selectedStr = toDateString(selectedDate);

  const firstOfMonth = new Date(viewMonth.year, viewMonth.month, 1);
  const startDow = firstOfMonth.getDay();
  const gridOffset = startDow === 0 ? 6 : startDow - 1;
  const daysInMonth = new Date(viewMonth.year, viewMonth.month + 1, 0).getDate();
  const gridCells: (number | null)[] = [
    ...Array(gridOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function prevMonth() {
    setViewMonth(m => m.month === 0 ? { year: m.year - 1, month: 11 } : { year: m.year, month: m.month - 1 });
  }
  function nextMonth() {
    setViewMonth(m => m.month === 11 ? { year: m.year + 1, month: 0 } : { year: m.year, month: m.month + 1 });
  }

  function handleDayClick(day: number) {
    selectDate(new Date(viewMonth.year, viewMonth.month, day));
  }

  return (
    <div style={{ padding: '10px 20px 14px' }}>
      <div className="flex items-center justify-between mb-2">
        <button onClick={prevMonth} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 3 }}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
          {MONTH_NAMES[viewMonth.month]} {viewMonth.year}
        </span>
        <button onClick={nextMonth} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 3 }}>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {DOW_SHORT.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.25)' }}>
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {gridCells.map((day, i) => {
          if (!day) return <div key={i} />;
          const cellStr = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isToday = cellStr === todayStr;
          const isSelected = cellStr === selectedStr;
          return (
            <button
              key={i}
              onClick={() => handleDayClick(day)}
              className="flex items-center justify-center transition-all"
              style={{
                height: 26, borderRadius: isSelected || isToday ? '50%' : 5,
                background: isSelected ? '#00d4ff' : isToday ? 'rgba(0,212,255,0.15)' : 'transparent',
                border: 'none', cursor: 'pointer', fontSize: 11,
                fontWeight: isSelected || isToday ? 700 : 400,
                color: isSelected ? '#08112d' : isToday ? '#00d4ff' : 'var(--text-muted)',
              }}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
