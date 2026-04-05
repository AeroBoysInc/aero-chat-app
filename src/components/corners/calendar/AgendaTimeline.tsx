// src/components/corners/calendar/AgendaTimeline.tsx
import { useCalendarStore, toDateString, type CalendarEvent } from '../../../store/calendarStore';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

export function AgendaTimeline() {
  const { events, selectedDate, openCreateModal, openEditModal } = useCalendarStore();

  const selectedStr = toDateString(selectedDate);
  const dayEvents = events
    .filter(e => {
      const ed = new Date(e.start_at);
      return toDateString(ed) === selectedStr;
    })
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

  const dateLabel = `${DAY_NAMES[selectedDate.getDay()]}, ${MONTH_NAMES[selectedDate.getMonth()]} ${selectedDate.getDate()}`;

  return (
    <div className="flex flex-col flex-1 min-w-0 overflow-y-auto" style={{ padding: '16px 20px' }}>
      {/* Date label */}
      <div className="flex-shrink-0 mb-4">
        <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: 0 }}>{dateLabel}</h2>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 }}>
          {dayEvents.length > 0
            ? `${dayEvents.length} event${dayEvents.length > 1 ? 's' : ''} scheduled`
            : 'No events scheduled'}
        </p>
      </div>

      {dayEvents.length === 0 ? (
        <GhostTimeline onAdd={() => openCreateModal(selectedDate)} />
      ) : (
        <EventTimeline events={dayEvents} onEventClick={openEditModal} />
      )}
    </div>
  );
}

function EventTimeline({ events, onEventClick }: { events: CalendarEvent[]; onEventClick: (e: CalendarEvent) => void }) {
  return (
    <div className="flex gap-0 flex-1">
      {/* Spine */}
      <div style={{ width: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        {events.map((event, i) => {
          const time = new Date(event.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
          const nextColor = events[i + 1]?.color ?? event.color;
          const rgb = hexToRgb(event.color);
          const nextRgb = hexToRgb(nextColor);
          const isLast = i === events.length - 1;
          return (
            <div key={event.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {/* Time label */}
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: 500, marginBottom: 4 }}>
                {time}
              </span>
              {/* Glowing dot */}
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: event.color,
                boxShadow: `0 0 10px rgba(${rgb}, 0.4)`,
                flexShrink: 0,
              }} />
              {/* Connector line */}
              {!isLast && (
                <div style={{
                  width: 2, height: 40,
                  background: `linear-gradient(rgba(${rgb}, 0.25), rgba(${nextRgb}, 0.25))`,
                  margin: '4px 0',
                }} />
              )}
              {isLast && (
                <div style={{
                  width: 2, flex: 1, minHeight: 20,
                  background: `linear-gradient(rgba(${rgb}, 0.15), transparent)`,
                  margin: '4px 0',
                }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Cards */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: 8 }}>
        {events.map(event => {
          const rgb = hexToRgb(event.color);
          const startTime = new Date(event.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const endTime = new Date(event.end_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return (
            <button
              key={event.id}
              onClick={() => onEventClick(event)}
              className="w-full text-left transition-all"
              style={{
                background: `rgba(${rgb}, 0.08)`,
                backdropFilter: 'blur(12px)',
                border: `1px solid rgba(${rgb}, 0.18)`,
                borderRadius: 14,
                padding: '14px 16px',
                cursor: 'pointer',
              }}
            >
              <div style={{ color: '#fff', fontSize: 13, fontWeight: 600, marginBottom: 3 }}>
                {event.title}
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>
                  {startTime} – {endTime}
                </span>
                {event.description && (
                  <span style={{ color: `rgba(${rgb}, 0.5)`, fontSize: 10 }}>
                    {event.description.length > 60 ? event.description.slice(0, 60) + '…' : event.description}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function GhostTimeline({ onAdd }: { onAdd: () => void }) {
  const ghostTimes = ['9:00', '12:00', '15:00'];
  return (
    <div className="flex gap-0 flex-1">
      {/* Ghost spine */}
      <div style={{ width: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        {ghostTimes.map((time, i) => (
          <div key={time} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ color: 'rgba(255,255,255,0.12)', fontSize: 10, fontWeight: 500, marginBottom: 4 }}>
              {time}
            </span>
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              border: '1.5px solid rgba(255,255,255,0.08)',
              flexShrink: 0,
            }} />
            {i < ghostTimes.length - 1 && (
              <div style={{ width: 1, height: 36, background: 'rgba(255,255,255,0.04)', margin: '4px 0' }} />
            )}
            {i === ghostTimes.length - 1 && (
              <div style={{ width: 1, flex: 1, minHeight: 20, background: 'rgba(255,255,255,0.02)', margin: '4px 0' }} />
            )}
          </div>
        ))}
      </div>

      {/* Empty prompt */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', paddingLeft: 8,
      }}>
        <p style={{ color: 'rgba(255,255,255,0.18)', fontSize: 12, fontWeight: 500, marginBottom: 12 }}>
          Nothing scheduled
        </p>
        <button
          onClick={onAdd}
          style={{
            border: '1px dashed rgba(0,212,255,0.25)', borderRadius: 12,
            padding: '8px 20px', background: 'transparent',
            color: 'rgba(0,212,255,0.5)', fontSize: 11, fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,212,255,0.06)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          + Add event
        </button>
      </div>
    </div>
  );
}
