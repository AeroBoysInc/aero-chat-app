import { useState } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { useCornerStore } from '../../store/cornerStore';

// ── Types ──────────────────────────────────────────────────────────────────────
type Priority = 'high' | 'medium' | 'low';
type Status   = 'todo' | 'inprogress' | 'done';
type Label    = 'ui' | 'backend' | 'crypto' | 'game' | 'bug' | 'feature' | 'infra' | 'perf' | 'release';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: Status;
  priority: Priority;
  sprint: number;
  labels: Label[];
}

interface SprintDef {
  id: number;
  name: string;
  goal: string;
}

// ── Hardcoded data ─────────────────────────────────────────────────────────────
const SPRINTS: SprintDef[] = [
  { id: 1, name: 'Sprint 1 — Core Infrastructure', goal: 'Ship auth, messaging, E2E encryption, and presence' },
  { id: 2, name: 'Sprint 2 — Games & Polish',       goal: 'Games Corner, bug fixes, UX improvements' },
  { id: 3, name: 'Sprint 3 — Release Prep',         goal: 'Notifications, file sharing, and installer packaging' },
];

const INITIAL_TASKS: Task[] = [
  // ── Sprint 1 (all done) ──────────────────────────────────────────────────────
  { id:'AC-1',  title:'Tauri + React + Vite scaffold',                sprint:1, status:'done', priority:'high',   labels:['infra'] },
  { id:'AC-2',  title:'Supabase auth & user profiles',                sprint:1, status:'done', priority:'high',   labels:['backend'] },
  { id:'AC-3',  title:'E2E encryption with TweetNaCl',                sprint:1, status:'done', priority:'high',   labels:['crypto','backend'] },
  { id:'AC-4',  title:'Real-time messaging channels',                 sprint:1, status:'done', priority:'high',   labels:['backend'] },
  { id:'AC-5',  title:'Friend request system',                        sprint:1, status:'done', priority:'medium', labels:['backend','ui'] },
  { id:'AC-6',  title:'Presence system (online/offline/away)',        sprint:1, status:'done', priority:'medium', labels:['backend'] },
  { id:'AC-7',  title:'Unread message counts',                        sprint:1, status:'done', priority:'medium', labels:['ui','backend'] },
  { id:'AC-8',  title:'Message read receipts',                        sprint:1, status:'done', priority:'low',    labels:['backend'] },

  // ── Sprint 2 ────────────────────────────────────────────────────────────────
  { id:'AC-9',  title:'Bubble Pop game',                              sprint:2, status:'done',       priority:'medium', labels:['game','ui'] },
  { id:'AC-10', title:'Tropico platformer — 10 levels',               sprint:2, status:'done',       priority:'medium', labels:['game','ui'] },
  { id:'AC-11', title:'Fix Tropico canvas scaling (ResizeObserver)',   sprint:2, status:'done',       priority:'high',   labels:['bug','game'] },
  { id:'AC-12', title:'Redesign levels 1-6 difficulty curve',         sprint:2, status:'done',       priority:'medium', labels:['game'] },
  { id:'AC-13', title:'Platform + floor glassy navy visuals',         sprint:2, status:'done',       priority:'low',    labels:['ui','game'] },
  { id:'AC-14', title:'Dev task board',                               sprint:2, status:'done',       priority:'medium', labels:['ui','infra'] },
  { id:'AC-15', title:'Push notifications for new messages',          sprint:2, status:'done',       priority:'high',   labels:['feature','backend'] },
  { id:'AC-16', title:'File / image sharing in chat',                 sprint:2, status:'todo',       priority:'high',   labels:['feature','backend','ui'] },
  { id:'AC-17', title:'Voice message recording & playback',           sprint:2, status:'todo',       priority:'medium', labels:['feature','ui'] },
  { id:'AC-18', title:'User avatar upload',                           sprint:2, status:'done',       priority:'medium', labels:['feature','ui','backend'] },
  { id:'AC-19', title:'Message reactions (emoji)',                    sprint:2, status:'done',       priority:'low',    labels:['feature','ui'] },

  // ── Sprint 3 ────────────────────────────────────────────────────────────────
  { id:'AC-20', title:'Group chat support',                           sprint:3, status:'todo', priority:'high',   labels:['feature','backend','ui'] },
  { id:'AC-21', title:'Desktop installer build & sign',               sprint:3, status:'done', priority:'high',   labels:['release','infra'] },
  { id:'AC-22', title:'Auto-updater via Tauri',                       sprint:3, status:'todo', priority:'high',   labels:['release','infra'] },
  { id:'AC-23', title:'Onboarding / first-run flow',                  sprint:3, status:'todo', priority:'medium', labels:['ui','feature'] },
  { id:'AC-24', title:'Performance profiling & bundle splitting',     sprint:3, status:'todo', priority:'medium', labels:['perf','infra'] },
  { id:'AC-25', title:'Landing page download section (live)',         sprint:3, status:'todo', priority:'low',    labels:['release','ui'] },
];

const STORAGE_KEY = 'aero_dev_tasks_v2';

function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Task[]) : INITIAL_TASKS;
  } catch { return INITIAL_TASKS; }
}

function saveTasks(tasks: Task[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

// ── Config maps ────────────────────────────────────────────────────────────────
const COL_CFG = {
  todo:       { label: 'To Do',       color: '#4d9fff', bg: 'rgba(40,100,255,0.10)' },
  inprogress: { label: 'In Progress', color: '#ff9d3d', bg: 'rgba(255,140,0,0.10)'  },
  done:       { label: 'Done',        color: '#3dcc7e', bg: 'rgba(0,200,100,0.10)'  },
} as const;

const PRI_CFG = {
  high:   { label: 'High', color: '#ff5555' },
  medium: { label: 'Med',  color: '#ffaa33' },
  low:    { label: 'Low',  color: '#55aaff' },
} as const;

const LABEL_CFG: Record<Label, { color: string; bg: string }> = {
  ui:      { color: '#00d4ff', bg: 'rgba(0,212,255,0.13)'   },
  backend: { color: '#a78bfa', bg: 'rgba(167,139,250,0.13)' },
  crypto:  { color: '#ffd700', bg: 'rgba(255,215,0,0.13)'   },
  game:    { color: '#ff80c0', bg: 'rgba(255,128,192,0.13)' },
  bug:     { color: '#ff5555', bg: 'rgba(255,85,85,0.13)'   },
  feature: { color: '#3dcc7e', bg: 'rgba(61,204,126,0.13)'  },
  infra:   { color: '#a0a8c0', bg: 'rgba(160,168,192,0.13)' },
  perf:    { color: '#ff9d3d', bg: 'rgba(255,157,61,0.13)'  },
  release: { color: '#40e0d0', bg: 'rgba(64,224,208,0.13)'  },
};

// ── Task card ──────────────────────────────────────────────────────────────────
function TaskCard({ task, onMove }: { task: Task; onMove: (id: string, s: Status) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const col = COL_CFG[task.status];
  const pri = PRI_CFG[task.priority];

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderLeft: `3px solid ${col.color}`,
        borderRadius: 10,
        padding: '10px 12px',
        position: 'relative',
      }}
    >
      {/* Top row: ID + priority */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:5 }}>
        <span style={{ fontSize:10, fontFamily:'monospace', color:'rgba(255,255,255,0.30)', letterSpacing:'0.04em' }}>
          {task.id}
        </span>
        <span style={{ fontSize:10, fontWeight:700, color: pri.color, background:`${pri.color}22`, padding:'1px 7px', borderRadius:20 }}>
          {pri.label}
        </span>
      </div>

      {/* Title */}
      <p style={{ fontSize:13, fontWeight:600, color:'rgba(255,255,255,0.88)', lineHeight:1.35, marginBottom: task.description ? 4 : 8 }}>
        {task.title}
      </p>

      {/* Optional description */}
      {task.description && (
        <p style={{
          fontSize:11, color:'rgba(255,255,255,0.42)', lineHeight:1.5, marginBottom:8,
          display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden',
        } as React.CSSProperties}>
          {task.description}
        </p>
      )}

      {/* Bottom row: labels + move */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:6 }}>
        <div style={{ display:'flex', flexWrap:'wrap', gap:3, flex:1, minWidth:0 }}>
          {task.labels.map(l => {
            const lc = LABEL_CFG[l];
            return (
              <span key={l} style={{
                fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em',
                color: lc.color, background: lc.bg, padding:'2px 6px', borderRadius:20,
              }}>
                {l}
              </span>
            );
          })}
        </div>

        {/* Move dropdown */}
        <div style={{ position:'relative', flexShrink:0 }}>
          <button
            onClick={() => setMenuOpen(o => !o)}
            style={{
              fontSize:10, color:'rgba(255,255,255,0.38)', background:'rgba(255,255,255,0.06)',
              border:'1px solid rgba(255,255,255,0.10)', borderRadius:6, padding:'3px 8px',
              cursor:'pointer', display:'flex', alignItems:'center', gap:3,
            }}
          >
            Move <ChevronDown style={{ width:9, height:9 }} />
          </button>

          {menuOpen && (
            <div style={{
              position:'absolute', right:0, top:'calc(100% + 4px)', zIndex:200,
              background:'rgba(6,14,42,0.97)', border:'1px solid rgba(255,255,255,0.12)',
              borderRadius:10, overflow:'hidden', boxShadow:'0 8px 28px rgba(0,0,0,0.55)',
              backdropFilter:'blur(14px)', minWidth:130,
            }}>
              {(['todo','inprogress','done'] as Status[])
                .filter(s => s !== task.status)
                .map(s => {
                  const c = COL_CFG[s];
                  return (
                    <button
                      key={s}
                      onClick={() => { onMove(task.id, s); setMenuOpen(false); }}
                      style={{
                        display:'flex', alignItems:'center', gap:9, width:'100%',
                        padding:'9px 13px', background:'transparent', border:'none',
                        cursor:'pointer', color:'rgba(255,255,255,0.78)', fontSize:12,
                        fontWeight:500, textAlign:'left',
                      }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                    >
                      <div style={{ width:8, height:8, borderRadius:'50%', background: c.color, flexShrink:0 }} />
                      {c.label}
                    </button>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Kanban column ──────────────────────────────────────────────────────────────
function KanbanColumn({ status, tasks, onMove }: { status: Status; tasks: Task[]; onMove: (id: string, s: Status) => void }) {
  const cfg = COL_CFG[status];
  return (
    <div style={{
      flex: 1, minWidth: 0, display:'flex', flexDirection:'column',
      borderRadius: 14, border:'1px solid rgba(255,255,255,0.07)',
      background:'rgba(255,255,255,0.02)', overflow:'hidden',
    }}>
      {/* Column header */}
      <div style={{
        padding:'12px 14px', borderBottom:'1px solid rgba(255,255,255,0.07)',
        background: cfg.bg, flexShrink:0,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:10, height:10, borderRadius:'50%', background: cfg.color, boxShadow:`0 0 8px ${cfg.color}80` }} />
          <span style={{ fontSize:11, fontWeight:800, color: cfg.color, textTransform:'uppercase', letterSpacing:'0.07em' }}>
            {cfg.label}
          </span>
          <span style={{
            marginLeft:'auto', fontSize:11, fontWeight:700, color: cfg.color,
            background:`${cfg.color}22`, padding:'1px 9px', borderRadius:20,
          }}>
            {tasks.length}
          </span>
        </div>
      </div>

      {/* Cards */}
      <div style={{ flex:1, overflowY:'auto', padding:'10px', display:'flex', flexDirection:'column', gap:8 }}>
        {tasks.length === 0 ? (
          <div style={{ textAlign:'center', padding:'28px 0', color:'rgba(255,255,255,0.18)', fontSize:12 }}>
            No tasks
          </div>
        ) : (
          tasks.map(t => <TaskCard key={t.id} task={t} onMove={onMove} />)
        )}
      </div>
    </div>
  );
}

// ── Progress bar ───────────────────────────────────────────────────────────────
function SprintProgress({ tasks }: { tasks: Task[] }) {
  const total = tasks.length;
  if (total === 0) return null;
  const done  = tasks.filter(t => t.status === 'done').length;
  const inprog= tasks.filter(t => t.status === 'inprogress').length;
  const pctDone  = (done   / total) * 100;
  const pctInProg= (inprog / total) * 100;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, flex:1 }}>
      <div style={{ flex:1, height:5, borderRadius:10, background:'rgba(255,255,255,0.08)', overflow:'hidden', position:'relative' }}>
        <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${pctDone + pctInProg}%`, background: COL_CFG.inprogress.color, borderRadius:10, opacity:0.5 }} />
        <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${pctDone}%`, background: COL_CFG.done.color, borderRadius:10 }} />
      </div>
      <span style={{ fontSize:10, color:'rgba(255,255,255,0.32)', flexShrink:0 }}>
        {done}/{total} done
      </span>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function DevCorner() {
  const { closeDevView } = useCornerStore();
  const [tasks, setTasks]               = useState<Task[]>(loadTasks);
  const [selectedSprint, setSelectedSprint] = useState(2);

  const sprint      = SPRINTS.find(s => s.id === selectedSprint)!;
  const sprintTasks = tasks.filter(t => t.sprint === selectedSprint);
  const byStatus    = (s: Status) => sprintTasks.filter(t => t.status === s);

  function moveTask(id: string, newStatus: Status) {
    setTasks(prev => {
      const next = prev.map(t => t.id === id ? { ...t, status: newStatus } : t);
      saveTasks(next);
      return next;
    });
  }

  return (
    <div style={{
      height: '100%', display:'flex', flexDirection:'column',
      background: 'linear-gradient(160deg, #020d24, #031530, #040e25)',
      color: '#fff', overflow: 'hidden', borderRadius: 16,
    }}>

      {/* ── Header ── */}
      <div style={{
        display:'flex', alignItems:'center', gap:12, padding:'13px 18px',
        borderBottom:'1px solid rgba(255,255,255,0.08)',
        background:'rgba(255,255,255,0.025)', flexShrink:0,
      }}>
        <span style={{ fontSize:18 }}>🛠️</span>
        <div>
          <p style={{ fontWeight:800, fontSize:15, color:'#fff', lineHeight:1 }}>Dev Board</p>
          <p style={{ fontSize:9, color:'rgba(255,255,255,0.30)', marginTop:2, fontFamily:'monospace', letterSpacing:'0.04em' }}>
            AeroChat · dev only · {import.meta.env.MODE}
          </p>
        </div>

        {/* Sprint selector */}
        <div style={{ marginLeft:'auto', position:'relative' }}>
          <select
            value={selectedSprint}
            onChange={e => setSelectedSprint(Number(e.target.value))}
            style={{
              background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.14)',
              borderRadius:10, padding:'6px 32px 6px 12px', color:'rgba(255,255,255,0.82)',
              fontSize:12, fontWeight:600, cursor:'pointer', outline:'none', appearance:'none',
            }}
          >
            {SPRINTS.map(s => (
              <option key={s.id} value={s.id} style={{ background:'#0a1a3a' }}>{s.name}</option>
            ))}
          </select>
          <ChevronDown style={{
            position:'absolute', right:9, top:'50%', transform:'translateY(-50%)',
            width:12, height:12, color:'rgba(255,255,255,0.45)', pointerEvents:'none',
          }} />
        </div>

        {/* Close */}
        <button
          onClick={closeDevView}
          style={{
            width:28, height:28, borderRadius:8, background:'rgba(255,255,255,0.06)',
            border:'1px solid rgba(255,255,255,0.10)', color:'rgba(255,255,255,0.45)',
            display:'flex', alignItems:'center', justifyContent:'center',
            cursor:'pointer', flexShrink:0,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,80,80,0.15)'; (e.currentTarget as HTMLElement).style.color = '#ff6060'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)'; }}
        >
          <X style={{ width:13, height:13 }} />
        </button>
      </div>

      {/* ── Sprint goal banner ── */}
      <div style={{
        display:'flex', alignItems:'center', gap:12, padding:'8px 18px',
        background:'rgba(255,157,61,0.05)', borderBottom:'1px solid rgba(255,157,61,0.10)',
        flexShrink:0,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
          <div style={{ width:6, height:6, borderRadius:'50%', background:'#ff9d3d', boxShadow:'0 0 6px #ff9d3d80' }} />
          <span style={{ fontSize:9, fontWeight:800, color:'#ff9d3d', textTransform:'uppercase', letterSpacing:'0.08em' }}>
            Sprint Goal
          </span>
        </div>
        <span style={{ fontSize:11, color:'rgba(255,255,255,0.52)', flex:1, minWidth:0 }}>{sprint.goal}</span>
        <SprintProgress tasks={sprintTasks} />
      </div>

      {/* ── Board ── */}
      <div style={{
        flex:1, display:'flex', gap:12, padding:'12px 14px',
        overflow:'hidden', minHeight:0,
      }}>
        <KanbanColumn status="todo"       tasks={byStatus('todo')}       onMove={moveTask} />
        <KanbanColumn status="inprogress" tasks={byStatus('inprogress')} onMove={moveTask} />
        <KanbanColumn status="done"       tasks={byStatus('done')}       onMove={moveTask} />
      </div>
    </div>
  );
}
