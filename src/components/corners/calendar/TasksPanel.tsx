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
