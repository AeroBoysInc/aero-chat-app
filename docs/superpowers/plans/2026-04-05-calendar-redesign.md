# Calendar Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the sparse two-panel calendar with a hybrid dashboard: week strip + collapsible mini-month + spine timeline agenda + resizable tasks panel.

**Architecture:** Three new leaf components (WeekStrip, AgendaTimeline, TasksPanel) composed inside a redesigned CalendarCorner shell. Store gets two new fields (selectedDate, miniMonthOpen) and two new actions. All existing CRUD/realtime logic is untouched.

**Tech Stack:** React 19, Zustand, Tailwind CSS, lucide-react icons, existing Supabase backend.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/store/calendarStore.ts` | Modify | Add `selectedDate`, `miniMonthOpen`, `selectDate()`, `toggleMiniMonth()`. Fix `toDateString` UTC bug. |
| `src/components/corners/CalendarCorner.tsx` | Rewrite | New layout shell: header bar → week strip → collapsible month → agenda/tasks split |
| `src/components/corners/calendar/WeekStrip.tsx` | Create | Horizontal 7-day strip with selection, prev/next nav, collapsible mini-month |
| `src/components/corners/calendar/AgendaTimeline.tsx` | Create | Spine timeline with glass event cards + ghost empty state |
| `src/components/corners/calendar/TasksPanel.tsx` | Create | Tasks list with resize handle (extracted from CalendarLeftPanel) |
| `src/components/corners/calendar/CalendarWeekGrid.tsx` | Delete | Replaced by WeekStrip + AgendaTimeline |
| `src/components/corners/calendar/CalendarLeftPanel.tsx` | Delete | Split into WeekStrip (mini-month) + TasksPanel (tasks) |

---

### Task 1: Add store fields for selected date and mini-month toggle

**Files:**
- Modify: `src/store/calendarStore.ts`

- [ ] **Step 1: Fix `toDateString` helper to use local dates instead of UTC**

The current helper uses `toISOString().slice(0, 10)` which shifts dates in non-UTC timezones. Replace it:

```typescript
/** Returns YYYY-MM-DD for a Date in local time. */
export function toDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
```

- [ ] **Step 2: Add `selectedDate` and `miniMonthOpen` to the CalendarState interface**

Add these to the interface block (after `modalPrefillDate`):

```typescript
selectedDate: Date;
miniMonthOpen: boolean;
```

And these actions (after `closeModal`):

```typescript
selectDate: (date: Date) => void;
toggleMiniMonth: () => void;
```

- [ ] **Step 3: Add initial values and action implementations**

Add initial values to the store creation (after `modalPrefillDate: null`):

```typescript
selectedDate: new Date(),
miniMonthOpen: false,
```

Add action implementations (after `closeModal`):

```typescript
selectDate: (date) => {
  const ws = getWeekStart(date);
  const current = get().currentWeekStart;
  // If the date falls outside the currently loaded week, fetch that week
  if (ws.getTime() !== current.getTime()) {
    get().fetchWeek(ws);
  }
  set({ selectedDate: date });
},

toggleMiniMonth: () => set(s => ({ miniMonthOpen: !s.miniMonthOpen })),
```

- [ ] **Step 4: Update `init` to also set `selectedDate` to today**

In the `init` action, add `selectedDate: new Date()` to the initial `set()` call:

```typescript
init: async (userId) => {
  const weekStart = getWeekStart(new Date());
  set({ currentWeekStart: weekStart, selectedDate: new Date() });
  await Promise.all([
    get().fetchWeek(weekStart),
    get().fetchTodayTasks(userId),
  ]);
},
```

- [ ] **Step 5: Verify build passes**

Run: `cd aero-chat-app && npx tsc --noEmit`
Expected: no errors (the new fields are added but not consumed yet)

- [ ] **Step 6: Commit**

```bash
git add src/store/calendarStore.ts
git commit -m "feat(calendar): add selectedDate and miniMonthOpen to calendarStore"
```

---

### Task 2: Create TasksPanel component

**Files:**
- Create: `src/components/corners/calendar/TasksPanel.tsx`

This extracts the tasks list and resize handle from CalendarLeftPanel into a standalone right-side panel.

- [ ] **Step 1: Create `TasksPanel.tsx`**

```tsx
// src/components/corners/calendar/TasksPanel.tsx
import { useState, useRef, useCallback } from 'react';
import { Trash2, Pencil, Check, X } from 'lucide-react';
import { useCalendarStore } from '../../../store/calendarStore';

const MIN_WIDTH = 200;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 280;

interface Props {
  userId: string;
}

export function TasksPanel({ userId }: Props) {
  const { tasks, addTask, toggleTask, renameTask, deleteTask, fetchTodayTasks } = useCalendarStore();
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH);
  const resizing = useRef(false);
  const resizeStart = useRef({ mouse: 0, size: 0 });

  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizing.current = true;
    resizeStart.current = { mouse: e.clientX, size: panelWidth };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return;
      // Dragging left increases width (resize handle is on the left edge)
      const delta = resizeStart.current.mouse - ev.clientX;
      setPanelWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(resizeStart.current.size + delta))));
    };
    const onUp = () => {
      resizing.current = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [panelWidth]);

  const submitTask = useCallback(async () => {
    const title = newTaskTitle.trim();
    if (!title) return;
    setNewTaskTitle('');
    await addTask(userId, title);
  }, [newTaskTitle, userId, addTask]);

  const pendingTasks = tasks.filter(t => !t.done);
  const doneTasks = tasks.filter(t => t.done);

  return (
    <div className="flex flex-shrink-0 relative" style={{ width: panelWidth }}>
      {/* Resize drag handle (left edge) */}
      <div
        onMouseDown={onResizeMouseDown}
        style={{
          position: 'absolute', top: 0, left: 0, bottom: 0, width: 6,
          cursor: 'col-resize', zIndex: 10,
        }}
      >
        <div style={{
          position: 'absolute', left: 1, top: '50%', transform: 'translateY(-50%)',
          width: 3, height: 40, borderRadius: 2,
          background: 'rgba(0,200,255,0.25)', transition: 'background 0.15s',
        }} />
      </div>

      <div
        className="flex flex-col flex-1 min-w-0 overflow-y-auto"
        style={{
          borderLeft: '1px solid var(--panel-divider)',
          padding: '14px 14px 14px 18px',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'rgba(168,85,247,0.7)' }}>
            Tasks
          </p>
          <button
            onClick={() => fetchTodayTasks(userId)}
            className="text-[11px]"
            style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            ↺
          </button>
        </div>

        {/* Task list */}
        <div className="flex flex-col gap-2 flex-1 overflow-y-auto">
          {pendingTasks.map(task => (
            <TaskRow key={task.id} title={task.title} done={false}
              onToggle={() => toggleTask(task.id, true)}
              onRename={(t) => renameTask(task.id, t)}
              onDelete={() => deleteTask(task.id)} />
          ))}
          {doneTasks.map(task => (
            <TaskRow key={task.id} title={task.title} done
              onToggle={() => toggleTask(task.id, false)}
              onRename={(t) => renameTask(task.id, t)}
              onDelete={() => deleteTask(task.id)} />
          ))}
        </div>

        {/* New task input */}
        <div
          className="flex items-center gap-2 mt-3 flex-shrink-0"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10, padding: '7px 10px',
          }}
        >
          <input
            value={newTaskTitle}
            onChange={e => setNewTaskTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submitTask(); }}
            placeholder="New task…"
            className="flex-1 bg-transparent outline-none text-xs"
            style={{ color: 'var(--text-primary)' }}
          />
        </div>
      </div>
    </div>
  );
}

function TaskRow({ title, done, onToggle, onRename, onDelete }: {
  title: string; done: boolean; onToggle: () => void; onRename: (t: string) => void; onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(title);

  function commitEdit() {
    const trimmed = editVal.trim();
    if (trimmed && trimmed !== title) onRename(trimmed);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          value={editVal}
          onChange={e => setEditVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false); }}
          className="flex-1 min-w-0 bg-transparent outline-none text-xs rounded px-1.5 py-1"
          style={{ color: 'var(--text-primary)', border: '1px solid rgba(0,180,255,0.40)' }}
        />
        <button onClick={commitEdit} style={{ color: '#3dd87a', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
          <Check className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => setEditing(false)} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 group">
      <button
        onClick={onToggle}
        className="flex-shrink-0 transition-all"
        style={{
          width: 17, height: 17, borderRadius: '50%',
          border: done ? 'none' : '1.5px solid rgba(255,255,255,0.25)',
          background: done ? 'rgba(0,212,255,0.7)' : 'transparent',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {done && <span style={{ fontSize: 10, color: '#08112d', fontWeight: 700 }}>✓</span>}
      </button>
      <span
        className="text-xs flex-1 min-w-0 truncate"
        style={{
          color: done ? 'rgba(255,255,255,0.3)' : 'var(--text-secondary)',
          textDecoration: done ? 'line-through' : 'none',
        }}
      >
        {title}
      </span>
      <div className="hidden group-hover:flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => { setEditVal(title); setEditing(true); }}
          style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
        >
          <Pencil className="h-3 w-3" />
        </button>
        <button
          onClick={onDelete}
          style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run: `cd aero-chat-app && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/corners/calendar/TasksPanel.tsx
git commit -m "feat(calendar): create TasksPanel component with resize handle"
```

---

### Task 3: Create WeekStrip component with collapsible mini-month

**Files:**
- Create: `src/components/corners/calendar/WeekStrip.tsx`

- [ ] **Step 1: Create `WeekStrip.tsx`**

```tsx
// src/components/corners/calendar/WeekStrip.tsx
import { useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { useCalendarStore, getWeekStart, toDateString } from '../../../store/calendarStore';

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

  // Build the 7 days for the current week
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  // Month label derived from the selected date
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
                {/* Today dot indicator */}
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
      {/* Month nav */}
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

      {/* DOW header */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DOW_SHORT.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.25)' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
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
```

- [ ] **Step 2: Verify build passes**

Run: `cd aero-chat-app && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/corners/calendar/WeekStrip.tsx
git commit -m "feat(calendar): create WeekStrip with collapsible mini-month"
```

---

### Task 4: Create AgendaTimeline component

**Files:**
- Create: `src/components/corners/calendar/AgendaTimeline.tsx`

- [ ] **Step 1: Create `AgendaTimeline.tsx`**

```tsx
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
```

- [ ] **Step 2: Verify build passes**

Run: `cd aero-chat-app && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/corners/calendar/AgendaTimeline.tsx
git commit -m "feat(calendar): create AgendaTimeline with spine + ghost empty state"
```

---

### Task 5: Rewrite CalendarCorner shell and wire everything together

**Files:**
- Rewrite: `src/components/corners/CalendarCorner.tsx`
- Delete: `src/components/corners/calendar/CalendarWeekGrid.tsx`
- Delete: `src/components/corners/calendar/CalendarLeftPanel.tsx`

- [ ] **Step 1: Rewrite `CalendarCorner.tsx`**

```tsx
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
        borderRadius: 16,
        border: '1px solid var(--sidebar-border)',
        boxShadow: 'var(--sidebar-shadow)',
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
```

- [ ] **Step 2: Delete old components**

```bash
rm src/components/corners/calendar/CalendarWeekGrid.tsx
rm src/components/corners/calendar/CalendarLeftPanel.tsx
```

- [ ] **Step 3: Verify build passes**

Run: `cd aero-chat-app && npx tsc --noEmit`
Expected: no errors. If the lazy import in ChatLayout.tsx references `CalendarCorner` by name, it should still work since the export name hasn't changed.

- [ ] **Step 4: Run full Vite build**

Run: `cd aero-chat-app && pnpm build`
Expected: builds successfully

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(calendar): wire up redesigned dashboard layout

Replace two-panel week grid + left panel with:
- Week strip with day selection and collapsible mini-month
- Spine timeline agenda with glass event cards and ghost empty state
- Resizable tasks panel on the right

Removes CalendarWeekGrid.tsx and CalendarLeftPanel.tsx."
```

---

### Task 6: Push and deploy

**Files:** none (deploy step)

- [ ] **Step 1: Push to GitHub**

```bash
cd aero-chat-app && git push origin main
```

- [ ] **Step 2: Deploy to Vercel production**

```bash
cd aero-chat-app && vercel --prod --yes
```

- [ ] **Step 3: Verify deployment succeeds**

Expected: build passes, aliased to `aero-chat-app.vercel.app`
