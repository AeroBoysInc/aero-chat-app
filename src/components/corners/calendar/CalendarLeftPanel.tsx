// src/components/corners/calendar/CalendarLeftPanel.tsx
import { useState, useRef, useCallback } from 'react';
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Trash2, Pencil, Check, X } from 'lucide-react';
import { useCalendarStore } from '../../../store/calendarStore';

const ACCENT_CAL = '#00d4ff';

const DOW_SHORT = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

interface Props {
  userId: string;
  onClose: () => void;
}

const MIN_WIDTH = 240;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 310;

export function CalendarLeftPanel({ userId, onClose }: Props) {
  const { tasks, addTask, toggleTask, renameTask, deleteTask, fetchTodayTasks, goToWeekContaining } = useCalendarStore();
  const [miniMonth, setMiniMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
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
      const delta = ev.clientX - resizeStart.current.mouse;
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

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Build mini month grid days
  const firstOfMonth = new Date(miniMonth.year, miniMonth.month, 1);
  const startDow = firstOfMonth.getDay(); // 0=Sun
  const gridOffset = startDow === 0 ? 6 : startDow - 1; // shift to Mon=0
  const daysInMonth = new Date(miniMonth.year, miniMonth.month + 1, 0).getDate();
  const gridCells: (number | null)[] = [
    ...Array(gridOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function prevMonth() {
    setMiniMonth(m => {
      if (m.month === 0) return { year: m.year - 1, month: 11 };
      return { year: m.year, month: m.month - 1 };
    });
  }

  function nextMonth() {
    setMiniMonth(m => {
      if (m.month === 11) return { year: m.year + 1, month: 0 };
      return { year: m.year, month: m.month + 1 };
    });
  }

  function handleDayClick(day: number) {
    const clicked = new Date(miniMonth.year, miniMonth.month, day);
    goToWeekContaining(clicked);
  }

  const submitTask = useCallback(async () => {
    const title = newTaskTitle.trim();
    if (!title) return;
    setNewTaskTitle('');
    await addTask(userId, title);
  }, [newTaskTitle, userId, addTask]);

  const pendingTasks = tasks.filter(t => !t.done);
  const doneTasks = tasks.filter(t => t.done);

  return (
    <div
      className="flex flex-shrink-0 relative"
      style={{ width: panelWidth }}
    >
    <div
      className="flex flex-col flex-1 min-w-0 overflow-y-auto"
      style={{
        borderRight: '1px solid var(--panel-divider)',
        padding: '14px 12px',
        background: 'rgba(0,180,255,0.03)',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4 flex-shrink-0">
        <button
          onClick={onClose}
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
      </div>

      {/* ── Mini month calendar ── */}
      <div className="mb-4 flex-shrink-0">
        {/* Month nav */}
        <div className="flex items-center justify-between mb-2">
          <button onClick={prevMonth} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 3 }}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {MONTH_NAMES[miniMonth.month]} {miniMonth.year}
          </span>
          <button onClick={nextMonth} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 3 }}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Day-of-week header */}
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
            const cellStr = `${miniMonth.year}-${String(miniMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = cellStr === todayStr;
            return (
              <button
                key={i}
                onClick={() => handleDayClick(day)}
                className="flex items-center justify-center transition-all"
                style={{
                  height: 26,
                  borderRadius: isToday ? '50%' : 5,
                  background: isToday ? ACCENT_CAL : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: isToday ? 700 : 400,
                  color: isToday ? '#08112d' : 'var(--text-muted)',
                }}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Calendar legend ── */}
      <div className="mb-4 flex-shrink-0">
        <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'rgba(0,212,255,0.6)' }}>
          Calendars
        </p>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2.5">
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: ACCENT_CAL, flexShrink: 0 }} />
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>My Events</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#a855f7', flexShrink: 0 }} />
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Friend Events</span>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', marginBottom: 12, flexShrink: 0 }} />

      {/* ── Today's Tasks ── */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-2.5 flex-shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgba(168,85,247,0.7)' }}>
            Today's Tasks
          </p>
          <button
            onClick={() => fetchTodayTasks(userId)}
            className="text-[10px]"
            style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            ↺
          </button>
        </div>

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
          className="flex items-center gap-2 mt-2.5 flex-shrink-0"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10,
            padding: '6px 10px',
          }}
        >
          <input
            ref={inputRef}
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

    {/* Resize drag handle */}
    <div
      onMouseDown={onResizeMouseDown}
      style={{
        position: 'absolute',
        top: 0, right: 0, bottom: 0, width: 6,
        cursor: 'col-resize',
        zIndex: 10,
      }}
    >
      {/* Visible drag indicator */}
      <div style={{
        position: 'absolute',
        right: 1, top: '50%', transform: 'translateY(-50%)',
        width: 3, height: 40, borderRadius: 2,
        background: 'rgba(0,200,255,0.25)',
        transition: 'background 0.15s',
      }} />
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
      {/* Edit / Delete — visible on hover */}
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
