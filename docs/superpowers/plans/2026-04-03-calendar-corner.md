# Calendar & Tasks Corner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Calendar & Tasks corner to the corner rail — a two-panel slide-in panel with a weekly event calendar (shared via per-event friend invites) and a personal daily sticky-note task list, backed by Supabase.

**Architecture:** Six tasks covering the Supabase schema, Zustand store, corner plumbing (cornerStore → CornerRail → ChatLayout), left panel (mini month + tasks), week grid (events), and event creation modal. Data flows from Supabase into `calendarStore`, which all sub-components read via selectors. The corner slides in using the same CSS-transform pattern as `WritersCorner`.

**Tech Stack:** React 19, TypeScript, Zustand, Supabase (postgres + realtime), Tailwind + inline styles (Frutiger Aero), lucide-react, pnpm/Vite.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `supabase/migrations/014_calendar.sql` | Schema + RLS for events, invites, tasks |
| Create | `src/store/calendarStore.ts` | All calendar/task state + Supabase calls |
| Modify | `src/store/cornerStore.ts` | Add `calendarViewActive` + open/close actions |
| Modify | `src/components/corners/CornerRail.tsx` | Add calendar icon button |
| Modify | `src/components/chat/ChatLayout.tsx` | Add CALENDAR LAYER + update `anyViewActive` |
| Create | `src/components/corners/CalendarCorner.tsx` | Root shell (lazy-loaded), init, glass panel |
| Create | `src/components/corners/calendar/CalendarLeftPanel.tsx` | Mini month + calendar legend + task list |
| Create | `src/components/corners/calendar/CalendarWeekGrid.tsx` | 7-column week view + event cards |
| Create | `src/components/corners/calendar/EventModal.tsx` | Create/edit event modal with invite picker |

---

## Task 1 — Supabase Migration

**Files:**
- Create: `supabase/migrations/014_calendar.sql`

- [ ] **Step 1: Write migration file**

```sql
-- 014_calendar.sql
-- ── Calendar events ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calendar_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title        TEXT        NOT NULL,
  description  TEXT,
  start_at     TIMESTAMPTZ NOT NULL,
  end_at       TIMESTAMPTZ NOT NULL,
  color        TEXT        NOT NULL DEFAULT '#00d4ff',
  visibility   TEXT        NOT NULL DEFAULT 'private'
                           CHECK (visibility IN ('private','invited')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events_owner_select" ON calendar_events FOR SELECT
  USING (creator_id = auth.uid());

CREATE POLICY "events_invitee_select" ON calendar_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM calendar_event_invites
      WHERE event_id = id AND invitee_id = auth.uid()
    )
  );

CREATE POLICY "events_owner_insert" ON calendar_events FOR INSERT
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY "events_owner_update" ON calendar_events FOR UPDATE
  USING (creator_id = auth.uid());

CREATE POLICY "events_owner_delete" ON calendar_events FOR DELETE
  USING (creator_id = auth.uid());

-- ── Calendar event invites ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calendar_event_invites (
  event_id    UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  invitee_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','accepted','declined')),
  PRIMARY KEY (event_id, invitee_id)
);

ALTER TABLE calendar_event_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invites_select" ON calendar_event_invites FOR SELECT
  USING (
    invitee_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM calendar_events
      WHERE id = event_id AND creator_id = auth.uid()
    )
  );

CREATE POLICY "invites_creator_insert" ON calendar_event_invites FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM calendar_events
      WHERE id = event_id AND creator_id = auth.uid()
    )
  );

CREATE POLICY "invites_creator_delete" ON calendar_event_invites FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM calendar_events
      WHERE id = event_id AND creator_id = auth.uid()
    )
  );

CREATE POLICY "invites_invitee_update" ON calendar_event_invites FOR UPDATE
  USING (invitee_id = auth.uid());

-- ── Tasks ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title      TEXT    NOT NULL,
  done       BOOLEAN NOT NULL DEFAULT false,
  date       DATE    NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_owner_all" ON tasks
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

- [ ] **Step 2: Run migration in Supabase SQL editor**

Open Supabase dashboard → SQL Editor → paste the file contents above → Run. Verify the three tables appear in Table Editor with RLS enabled.

- [ ] **Step 3: Commit migration**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app"
git add supabase/migrations/014_calendar.sql
git commit -m "feat: add calendar_events, calendar_event_invites, and tasks tables"
```

---

## Task 2 — Zustand Store (`calendarStore.ts`)

**Files:**
- Create: `src/store/calendarStore.ts`

- [ ] **Step 1: Create the store file**

```typescript
// src/store/calendarStore.ts
import { create } from 'zustand';
import { supabase } from '../lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CalendarEventInvite {
  invitee_id: string;
  invitee_username: string;
  status: 'pending' | 'accepted' | 'declined';
}

export interface CalendarEvent {
  id: string;
  creator_id: string;
  title: string;
  description?: string;
  start_at: string;
  end_at: string;
  color: string;
  visibility: 'private' | 'invited';
  created_at: string;
  invites?: CalendarEventInvite[];
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  done: boolean;
  date: string; // YYYY-MM-DD
}

export interface CreateEventPayload {
  title: string;
  description?: string;
  start_at: string;
  end_at: string;
  color: string;
  invitee_ids: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns the Monday of the week containing `date`. */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Returns YYYY-MM-DD for a Date. */
export function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface CalendarState {
  events: CalendarEvent[];
  tasks: Task[];
  currentWeekStart: Date;
  loading: boolean;
  activeModal: 'create' | 'edit' | null;
  editingEvent: CalendarEvent | null;
  modalPrefillDate: Date | null;

  // Actions
  init: (userId: string) => Promise<void>;
  fetchWeek: (weekStart: Date) => Promise<void>;
  fetchTodayTasks: (userId: string) => Promise<void>;
  createEvent: (userId: string, payload: CreateEventPayload) => Promise<void>;
  updateEvent: (id: string, payload: CreateEventPayload) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  addTask: (userId: string, title: string) => Promise<void>;
  toggleTask: (id: string, done: boolean) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  goToPrevWeek: () => void;
  goToNextWeek: () => void;
  goToCurrentWeek: () => void;
  goToWeekContaining: (date: Date) => void;
  openCreateModal: (prefillDate?: Date) => void;
  openEditModal: (event: CalendarEvent) => void;
  closeModal: () => void;
  subscribeRealtime: (userId: string) => () => void;
}

export const useCalendarStore = create<CalendarState>()((set, get) => ({
  events: [],
  tasks: [],
  currentWeekStart: getWeekStart(new Date()),
  loading: false,
  activeModal: null,
  editingEvent: null,
  modalPrefillDate: null,

  init: async (userId) => {
    const weekStart = getWeekStart(new Date());
    set({ currentWeekStart: weekStart });
    await Promise.all([
      get().fetchWeek(weekStart),
      get().fetchTodayTasks(userId),
    ]);
  },

  fetchWeek: async (weekStart) => {
    set({ loading: true });
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const { data, error } = await supabase
      .from('calendar_events')
      .select(`
        *,
        calendar_event_invites (
          invitee_id,
          status,
          profiles:invitee_id ( username )
        )
      `)
      .gte('start_at', weekStart.toISOString())
      .lt('start_at', weekEnd.toISOString())
      .order('start_at', { ascending: true });

    if (error) { set({ loading: false }); return; }

    const mapped: CalendarEvent[] = (data ?? []).map((row: any) => ({
      ...row,
      invites: (row.calendar_event_invites ?? []).map((inv: any) => ({
        invitee_id: inv.invitee_id,
        invitee_username: inv.profiles?.username ?? 'Unknown',
        status: inv.status,
      })),
      calendar_event_invites: undefined,
    }));

    set({ events: mapped, loading: false, currentWeekStart: weekStart });
  },

  fetchTodayTasks: async (userId) => {
    const today = toDateString(new Date());
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .order('created_at', { ascending: true });
    set({ tasks: data ?? [] });
  },

  createEvent: async (userId, payload) => {
    const visibility = payload.invitee_ids.length > 0 ? 'invited' : 'private';
    const { data, error } = await supabase
      .from('calendar_events')
      .insert({
        creator_id: userId,
        title: payload.title,
        description: payload.description,
        start_at: payload.start_at,
        end_at: payload.end_at,
        color: payload.color,
        visibility,
      })
      .select('id')
      .single();

    if (error || !data) return;

    if (payload.invitee_ids.length > 0) {
      await supabase.from('calendar_event_invites').insert(
        payload.invitee_ids.map(id => ({ event_id: data.id, invitee_id: id }))
      );
    }

    set({ activeModal: null });
    await get().fetchWeek(get().currentWeekStart);
  },

  updateEvent: async (id, payload) => {
    const visibility = payload.invitee_ids.length > 0 ? 'invited' : 'private';
    await supabase
      .from('calendar_events')
      .update({
        title: payload.title,
        description: payload.description,
        start_at: payload.start_at,
        end_at: payload.end_at,
        color: payload.color,
        visibility,
      })
      .eq('id', id);

    // Replace invites: delete all, re-insert
    await supabase.from('calendar_event_invites').delete().eq('event_id', id);
    if (payload.invitee_ids.length > 0) {
      await supabase.from('calendar_event_invites').insert(
        payload.invitee_ids.map(invitee_id => ({ event_id: id, invitee_id }))
      );
    }

    set({ activeModal: null, editingEvent: null });
    await get().fetchWeek(get().currentWeekStart);
  },

  deleteEvent: async (id) => {
    await supabase.from('calendar_events').delete().eq('id', id);
    set(s => ({ events: s.events.filter(e => e.id !== id), activeModal: null, editingEvent: null }));
  },

  addTask: async (userId, title) => {
    const today = toDateString(new Date());
    const { data } = await supabase
      .from('tasks')
      .insert({ user_id: userId, title, date: today })
      .select('*')
      .single();
    if (data) set(s => ({ tasks: [...s.tasks, data] }));
  },

  toggleTask: async (id, done) => {
    await supabase.from('tasks').update({ done }).eq('id', id);
    set(s => ({ tasks: s.tasks.map(t => t.id === id ? { ...t, done } : t) }));
  },

  deleteTask: async (id) => {
    await supabase.from('tasks').delete().eq('id', id);
    set(s => ({ tasks: s.tasks.filter(t => t.id !== id) }));
  },

  goToPrevWeek: () => {
    const prev = new Date(get().currentWeekStart);
    prev.setDate(prev.getDate() - 7);
    get().fetchWeek(prev);
  },

  goToNextWeek: () => {
    const next = new Date(get().currentWeekStart);
    next.setDate(next.getDate() + 7);
    get().fetchWeek(next);
  },

  goToCurrentWeek: () => {
    get().fetchWeek(getWeekStart(new Date()));
  },

  goToWeekContaining: (date) => {
    get().fetchWeek(getWeekStart(date));
  },

  openCreateModal: (prefillDate) => set({ activeModal: 'create', editingEvent: null, modalPrefillDate: prefillDate ?? null }),
  openEditModal: (event) => set({ activeModal: 'edit', editingEvent: event, modalPrefillDate: null }),
  closeModal: () => set({ activeModal: null, editingEvent: null, modalPrefillDate: null }),

  subscribeRealtime: (userId) => {
    const channel = supabase
      .channel(`calendar:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calendar_events' },
        () => get().fetchWeek(get().currentWeekStart),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calendar_event_invites' },
        () => get().fetchWeek(get().currentWeekStart),
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  },
}));
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app" && pnpm build 2>&1 | tail -20
```

Expected: no errors referencing `calendarStore.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/store/calendarStore.ts
git commit -m "feat: add calendarStore with events and tasks Zustand state"
```

---

## Task 3 — Corner Plumbing (cornerStore + CornerRail + ChatLayout)

**Files:**
- Modify: `src/store/cornerStore.ts`
- Modify: `src/components/corners/CornerRail.tsx`
- Modify: `src/components/chat/ChatLayout.tsx`

- [ ] **Step 1: Update cornerStore.ts**

Open `src/store/cornerStore.ts`. The current file is 41 lines. Replace the entire file with:

```typescript
// src/store/cornerStore.ts
import { create } from 'zustand';

export type SelectedGame = 'bubblepop' | 'tropico' | 'twentyfortyeight' | 'typingtest' | 'wordle' | 'chess' | null;

export type GameChatOverlay = null | { mode: 'picker' } | { mode: 'conversation'; senderId: string };

interface CornerStore {
  gameViewActive: boolean;
  devViewActive: boolean;
  writerViewActive: boolean;
  calendarViewActive: boolean;
  selectedGame: SelectedGame;
  gameChatOverlay: GameChatOverlay;
  openGameHub: () => void;
  closeGameView: () => void;
  selectGame: (game: SelectedGame) => void;
  openDevView: () => void;
  closeDevView: () => void;
  openWriterHub: () => void;
  closeWriterView: () => void;
  openCalendarView: () => void;
  closeCalendarView: () => void;
  openGameChat: () => void;
  openGameChatFor: (senderId: string) => void;
  closeGameChat: () => void;
}

export const useCornerStore = create<CornerStore>()((set) => ({
  gameViewActive:     false,
  devViewActive:      false,
  writerViewActive:   false,
  calendarViewActive: false,
  selectedGame:       null,
  gameChatOverlay:    null,
  openGameHub:        () => set({ gameViewActive: true,  writerViewActive: false, devViewActive: false, calendarViewActive: false }),
  closeGameView:      () => set({ gameViewActive: false, selectedGame: null, gameChatOverlay: null }),
  selectGame:         (selectedGame) => set({ selectedGame }),
  openDevView:        () => set({ devViewActive: true,   gameViewActive: false, writerViewActive: false, calendarViewActive: false, selectedGame: null, gameChatOverlay: null }),
  closeDevView:       () => set({ devViewActive: false }),
  openWriterHub:      () => set({ writerViewActive: true, gameViewActive: false, devViewActive: false, calendarViewActive: false, selectedGame: null, gameChatOverlay: null }),
  closeWriterView:    () => set({ writerViewActive: false }),
  openCalendarView:   () => set({ calendarViewActive: true, gameViewActive: false, devViewActive: false, writerViewActive: false, selectedGame: null, gameChatOverlay: null }),
  closeCalendarView:  () => set({ calendarViewActive: false }),
  openGameChat:       () => set({ gameChatOverlay: { mode: 'picker' } }),
  openGameChatFor:    (senderId) => set({ gameChatOverlay: { mode: 'conversation', senderId } }),
  closeGameChat:      () => set({ gameChatOverlay: null }),
}));
```

- [ ] **Step 2: Update CornerRail.tsx**

Open `src/components/corners/CornerRail.tsx`. Replace the entire file with:

```tsx
// src/components/corners/CornerRail.tsx
import { useState } from 'react';
import { Gamepad2, Terminal, PenTool, CalendarDays } from 'lucide-react';
import { useCornerStore } from '../../store/cornerStore';

interface RailBtnProps {
  icon: React.ComponentType<{ style?: React.CSSProperties; className?: string }>;
  isActive: boolean;
  color: string;
  tooltip: string;
  onClick: () => void;
}

function RailBtn({ icon: Icon, isActive, color, tooltip, onClick }: RailBtnProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {isActive && (
        <div
          className="absolute top-1/2 -translate-y-1/2 rounded-r-full"
          style={{ left: -13, width: 4, height: 32, background: color, boxShadow: `0 0 8px ${color}` }}
        />
      )}

      <button
        onClick={onClick}
        style={{
          width: 36, height: 36,
          borderRadius: isActive || hovered ? '30%' : '50%',
          background: isActive
            ? `linear-gradient(135deg, ${color}35, ${color}18)`
            : hovered ? 'var(--rail-bg-hover)' : 'var(--rail-bg-idle)',
          border: `1px solid ${isActive ? `${color}55` : 'var(--rail-border)'}`,
          color: isActive ? color : hovered ? 'var(--rail-icon-hover)' : 'var(--rail-icon)',
          boxShadow: isActive ? `0 0 14px ${color}40` : 'none',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', outline: 'none',
        }}
      >
        <Icon style={{ width: 16, height: 16 }} />
      </button>

      {hovered && (
        <div
          className="absolute left-11 top-1/2 -translate-y-1/2 z-50 animate-fade-in"
          style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}
        >
          <div
            className="rounded-aero px-3 py-1.5 text-xs font-medium"
            style={{
              background: 'rgba(8,18,45,0.95)',
              border: '1px solid rgba(255,255,255,0.14)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
              backdropFilter: 'blur(10px)',
              color: 'rgba(255,255,255,0.88)',
            }}
          >
            {tooltip}
          </div>
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-full"
            style={{
              left: 0,
              borderTop: '5px solid transparent',
              borderBottom: '5px solid transparent',
              borderRight: '5px solid rgba(8,18,45,0.95)',
            }}
          />
        </div>
      )}
    </div>
  );
}

export function CornerRail() {
  const {
    gameViewActive, openGameHub, closeGameView,
    devViewActive, openDevView, closeDevView,
    writerViewActive, openWriterHub, closeWriterView,
    calendarViewActive, openCalendarView, closeCalendarView,
  } = useCornerStore();

  return (
    <div
      className="flex flex-col items-center py-4"
      style={{
        width: 52, flexShrink: 0,
        background: 'var(--sidebar-bg)',
        borderRadius: 16,
        border: '1px solid var(--sidebar-border)',
        boxShadow: 'var(--sidebar-shadow)',
        zIndex: 10,
      }}
    >
      <div className="flex flex-col items-center gap-3">
        <RailBtn
          icon={Gamepad2}
          isActive={gameViewActive}
          color="#00d4ff"
          tooltip={gameViewActive ? 'Back to Chat' : 'Games Corner'}
          onClick={() => gameViewActive ? closeGameView() : openGameHub()}
        />
        <RailBtn
          icon={PenTool}
          isActive={writerViewActive}
          color="#a855f7"
          tooltip={writerViewActive ? 'Back to Chat' : 'Writers Corner'}
          onClick={() => writerViewActive ? closeWriterView() : openWriterHub()}
        />
        <RailBtn
          icon={CalendarDays}
          isActive={calendarViewActive}
          color="#3dd87a"
          tooltip={calendarViewActive ? 'Back to Chat' : 'Calendar & Tasks'}
          onClick={() => calendarViewActive ? closeCalendarView() : openCalendarView()}
        />
      </div>

      {import.meta.env.DEV && (
        <div className="mt-auto">
          <RailBtn
            icon={Terminal}
            isActive={devViewActive}
            color="#ff9d3d"
            tooltip={devViewActive ? 'Back to Chat' : 'Dev Board'}
            onClick={() => devViewActive ? closeDevView() : openDevView()}
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Update ChatLayout.tsx — add calendarViewActive to anyViewActive and add CALENDAR LAYER**

In `src/components/chat/ChatLayout.tsx`, make three targeted edits:

**Edit A** — update the `useCornerStore` destructure (line 37 area) from:
```tsx
const { gameViewActive, devViewActive, writerViewActive } = useCornerStore();
const anyViewActive = gameViewActive || devViewActive || writerViewActive;
```
to:
```tsx
const { gameViewActive, devViewActive, writerViewActive, calendarViewActive } = useCornerStore();
const anyViewActive = gameViewActive || devViewActive || writerViewActive || calendarViewActive;
```

**Edit B** — add the lazy import for CalendarCorner after the WritersCorner lazy import (line 11 area):
```tsx
const CalendarCorner = lazy(() => import('../corners/CalendarCorner').then(m => ({ default: m.CalendarCorner })));
```

**Edit C** — add the CALENDAR LAYER div immediately after the closing `</div>` of the WRITER LAYER (before the `{/* DEV LAYER */}` comment):
```tsx
{/* ── CALENDAR LAYER ──────────────────────────────────── */}
<div
  style={{
    position: 'absolute', inset: 0,
    transform: calendarViewActive ? 'translateX(0)' : 'translateX(102%)',
    opacity: calendarViewActive ? 1 : 0,
    transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.18s ease',
    pointerEvents: calendarViewActive ? 'auto' : 'none',
  }}
>
  <Suspense fallback={
    <div className="flex h-full items-center justify-center" style={{ color: 'rgba(61,216,122,0.7)', fontSize: 13 }}>
      Loading Calendar...
    </div>
  }>
    <CalendarCorner />
  </Suspense>
</div>
```

- [ ] **Step 4: Verify build**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app" && pnpm build 2>&1 | tail -20
```

Expected: no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/store/cornerStore.ts src/components/corners/CornerRail.tsx src/components/chat/ChatLayout.tsx
git commit -m "feat: wire calendar corner into cornerStore, CornerRail, and ChatLayout"
```

---

## Task 4 — CalendarCorner root shell + left panel + week grid

**Files:**
- Create: `src/components/corners/CalendarCorner.tsx`
- Create: `src/components/corners/calendar/CalendarLeftPanel.tsx`
- Create: `src/components/corners/calendar/CalendarWeekGrid.tsx`

- [ ] **Step 1: Create CalendarCorner.tsx**

```tsx
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
```

- [ ] **Step 2: Create CalendarLeftPanel.tsx**

```tsx
// src/components/corners/calendar/CalendarLeftPanel.tsx
import { useState, useRef, useCallback } from 'react';
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCalendarStore, getWeekStart } from '../../../store/calendarStore';

const ACCENT_CAL = '#00d4ff';
const ACCENT_TASK = '#a855f7';

const DOW_SHORT = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

interface Props {
  userId: string;
  onClose: () => void;
}

export function CalendarLeftPanel({ userId, onClose }: Props) {
  const { tasks, addTask, toggleTask, fetchTodayTasks, goToWeekContaining } = useCalendarStore();
  const [miniMonth, setMiniMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

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

  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const pendingTasks = tasks.filter(t => !t.done);
  const doneTasks = tasks.filter(t => t.done);

  return (
    <div
      className="flex flex-col flex-shrink-0 overflow-y-auto scrollbar-aero"
      style={{
        width: 200,
        borderRight: '1px solid var(--panel-divider)',
        padding: '12px 10px',
        gap: 0,
        background: 'rgba(0,180,255,0.03)',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 flex-shrink-0">
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-xl transition-all flex-shrink-0"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.10)',
            color: 'var(--text-muted)',
          }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
        <div
          className="flex h-7 w-7 items-center justify-center rounded-xl flex-shrink-0"
          style={{ background: 'rgba(61,216,122,0.15)', border: '1px solid rgba(61,216,122,0.30)' }}
        >
          <CalendarDays className="h-4 w-4" style={{ color: '#3dd87a' }} />
        </div>
        <p className="text-sm font-bold flex-1 min-w-0 truncate" style={{ color: 'var(--text-primary)' }}>
          Calendar
        </p>
      </div>

      {/* ── Mini month calendar ── */}
      <div className="mb-3 flex-shrink-0">
        {/* Month nav */}
        <div className="flex items-center justify-between mb-1.5">
          <button onClick={prevMonth} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="text-[10px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {MONTH_NAMES[miniMonth.month]} {miniMonth.year}
          </span>
          <button onClick={nextMonth} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Day-of-week header */}
        <div className="grid grid-cols-7 gap-0.5 mb-0.5">
          {DOW_SHORT.map(d => (
            <div key={d} className="text-center text-[8px] font-semibold" style={{ color: 'rgba(255,255,255,0.25)' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-0.5">
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
                  height: 20,
                  borderRadius: isToday ? '50%' : 4,
                  background: isToday ? ACCENT_CAL : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 9,
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
      <div className="mb-3 flex-shrink-0">
        <p className="text-[8px] font-bold uppercase tracking-wider mb-1.5" style={{ color: `rgba(0,212,255,0.6)` }}>
          Calendars
        </p>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: ACCENT_CAL, flexShrink: 0 }} />
            <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>My Events</span>
          </div>
          <div className="flex items-center gap-2">
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#a855f7', flexShrink: 0 }} />
            <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>Friend Events</span>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', marginBottom: 10, flexShrink: 0 }} />

      {/* ── Today's Tasks ── */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-2 flex-shrink-0">
          <p className="text-[8px] font-bold uppercase tracking-wider" style={{ color: `rgba(168,85,247,0.7)` }}>
            Today's Tasks
          </p>
          <button
            onClick={() => fetchTodayTasks(userId)}
            className="text-[8px]"
            style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            ↺
          </button>
        </div>

        <div className="flex flex-col gap-1.5 flex-1 overflow-y-auto scrollbar-aero">
          {pendingTasks.map(task => (
            <TaskRow key={task.id} title={task.title} done={false} onToggle={() => toggleTask(task.id, true)} />
          ))}
          {doneTasks.map(task => (
            <TaskRow key={task.id} title={task.title} done onToggle={() => toggleTask(task.id, false)} />
          ))}
        </div>

        {/* New task input */}
        <div
          className="flex items-center gap-1.5 mt-2 flex-shrink-0"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            padding: '4px 8px',
          }}
        >
          <input
            ref={inputRef}
            value={newTaskTitle}
            onChange={e => setNewTaskTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submitTask(); }}
            placeholder="New task…"
            className="flex-1 bg-transparent outline-none text-[10px]"
            style={{ color: 'var(--text-primary)' }}
          />
        </div>
      </div>
    </div>
  );
}

function TaskRow({ title, done, onToggle }: { title: string; done: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center gap-2 group">
      <button
        onClick={onToggle}
        className="flex-shrink-0 transition-all"
        style={{
          width: 14, height: 14, borderRadius: '50%',
          border: done ? 'none' : '1.5px solid rgba(255,255,255,0.25)',
          background: done ? 'rgba(0,212,255,0.7)' : 'transparent',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {done && <span style={{ fontSize: 8, color: '#08112d', fontWeight: 700 }}>✓</span>}
      </button>
      <span
        className="text-[10px] flex-1 min-w-0 truncate"
        style={{
          color: done ? 'rgba(255,255,255,0.3)' : 'var(--text-secondary)',
          textDecoration: done ? 'line-through' : 'none',
        }}
      >
        {title}
      </span>
    </div>
  );
}
```

- [ ] **Step 3: Create CalendarWeekGrid.tsx**

```tsx
// src/components/corners/calendar/CalendarWeekGrid.tsx
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCalendarStore } from '../../../store/calendarStore';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface Props {
  userId: string;
}

export function CalendarWeekGrid({ userId }: Props) {
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
        className="grid flex-1 overflow-y-auto scrollbar-aero"
        style={{ gridTemplateColumns: 'repeat(7, 1fr)', alignContent: 'start' }}
      >
        {days.map((day, i) => {
          const dayStr = day.toISOString().slice(0, 10);
          const dayEvents = events.filter(e => e.start_at.slice(0, 10) === dayStr);
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

function EventChip({ event, onClick }: { event: import('../../../store/calendarStore').CalendarEvent; onClick: () => void }) {
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

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
```

- [ ] **Step 4: Build check**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app" && pnpm build 2>&1 | tail -20
```

Expected: no TypeScript errors.

- [ ] **Step 5: Smoke test in browser**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app" && pnpm dev
```

Open `http://localhost:1420`. Click the green calendar icon in the rail. Expect the left panel + week grid to appear. Back-to-chat arrow should close it.

- [ ] **Step 6: Commit**

```bash
git add src/components/corners/CalendarCorner.tsx src/components/corners/calendar/
git commit -m "feat: add CalendarCorner shell, left panel (mini month + tasks), and week grid"
```

---

## Task 5 — EventModal (create / edit)

**Files:**
- Create: `src/components/corners/calendar/EventModal.tsx`

- [ ] **Step 1: Create EventModal.tsx**

```tsx
// src/components/corners/calendar/EventModal.tsx
import { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import { useCalendarStore } from '../../../store/calendarStore';
import { useFriendStore } from '../../../store/friendStore';

const COLOR_SWATCHES = [
  '#00d4ff', // cyan
  '#3dd87a', // green
  '#a855f7', // purple
  '#f59e0b', // amber
  '#ef4444', // red
];

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

function toLocalInputValue(iso: string): string {
  // Convert ISO string to "YYYY-MM-DDTHH:MM" for datetime-local input
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultStartFor(prefill?: Date | null): string {
  const d = prefill ? new Date(prefill) : new Date();
  d.setMinutes(0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
}

function defaultEndFor(startVal: string): string {
  const d = new Date(startVal);
  d.setMinutes(d.getMinutes() + 30);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Props {
  userId: string;
}

export function EventModal({ userId }: Props) {
  const {
    activeModal, editingEvent, modalPrefillDate,
    closeModal, createEvent, updateEvent, deleteEvent,
  } = useCalendarStore();
  const friends = useFriendStore(s => s.friends);

  const isEdit = activeModal === 'edit' && !!editingEvent;

  const initStart = isEdit
    ? toLocalInputValue(editingEvent!.start_at)
    : defaultStartFor(modalPrefillDate);
  const initEnd = isEdit
    ? toLocalInputValue(editingEvent!.end_at)
    : defaultEndFor(initStart);

  const [title, setTitle] = useState(isEdit ? editingEvent!.title : '');
  const [description, setDescription] = useState(isEdit ? (editingEvent!.description ?? '') : '');
  const [startVal, setStartVal] = useState(initStart);
  const [endVal, setEndVal] = useState(initEnd);
  const [color, setColor] = useState(isEdit ? editingEvent!.color : COLOR_SWATCHES[0]);
  const [inviteeIds, setInviteeIds] = useState<string[]>(
    isEdit ? (editingEvent!.invites ?? []).map(i => i.invitee_id) : []
  );
  const [saving, setSaving] = useState(false);

  // Re-init when modal opens
  useEffect(() => {
    if (!activeModal) return;
    const start = isEdit ? toLocalInputValue(editingEvent!.start_at) : defaultStartFor(modalPrefillDate);
    const end = isEdit ? toLocalInputValue(editingEvent!.end_at) : defaultEndFor(start);
    setTitle(isEdit ? editingEvent!.title : '');
    setDescription(isEdit ? (editingEvent!.description ?? '') : '');
    setStartVal(start);
    setEndVal(end);
    setColor(isEdit ? editingEvent!.color : COLOR_SWATCHES[0]);
    setInviteeIds(isEdit ? (editingEvent!.invites ?? []).map(i => i.invitee_id) : []);
  }, [activeModal, editingEvent?.id]);

  function toggleInvitee(id: string) {
    setInviteeIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  async function handleSubmit() {
    if (!title.trim()) return;
    setSaving(true);
    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      start_at: new Date(startVal).toISOString(),
      end_at: new Date(endVal).toISOString(),
      color,
      invitee_ids: inviteeIds,
    };
    if (isEdit) {
      await updateEvent(editingEvent!.id, payload);
    } else {
      await createEvent(userId, payload);
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!editingEvent) return;
    setSaving(true);
    await deleteEvent(editingEvent.id);
    setSaving(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl flex flex-col overflow-hidden"
        style={{
          background: 'var(--sidebar-bg)',
          border: '1px solid var(--panel-divider)',
          backdropFilter: 'blur(24px)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
          maxHeight: '85vh',
        }}
      >
        {/* Modal header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--panel-divider)' }}
        >
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            {isEdit ? 'Edit Event' : 'New Event'}
          </p>
          <button
            onClick={closeModal}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-all"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text-muted)' }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex flex-col gap-4 px-5 py-4 overflow-y-auto scrollbar-aero">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Title *
            </label>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Event title"
              className="rounded-xl px-3 py-2 text-sm outline-none transition-all"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.10)',
                color: 'var(--text-primary)',
              }}
              onFocus={e => (e.currentTarget.style.border = '1px solid rgba(0,180,255,0.40)')}
              onBlur={e => (e.currentTarget.style.border = '1px solid rgba(255,255,255,0.10)')}
            />
          </div>

          {/* Date/time row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Start
              </label>
              <input
                type="datetime-local"
                value={startVal}
                onChange={e => setStartVal(e.target.value)}
                className="rounded-xl px-3 py-2 text-xs outline-none"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  color: 'var(--text-primary)',
                  colorScheme: 'dark',
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                End
              </label>
              <input
                type="datetime-local"
                value={endVal}
                onChange={e => setEndVal(e.target.value)}
                className="rounded-xl px-3 py-2 text-xs outline-none"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  color: 'var(--text-primary)',
                  colorScheme: 'dark',
                }}
              />
            </div>
          </div>

          {/* Color swatches */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Colour
            </label>
            <div className="flex gap-2">
              {COLOR_SWATCHES.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="transition-all"
                  style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: c,
                    border: color === c ? `3px solid rgba(255,255,255,0.8)` : '3px solid transparent',
                    boxShadow: color === c ? `0 0 8px ${c}` : 'none',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional notes…"
              rows={2}
              className="rounded-xl px-3 py-2 text-xs outline-none resize-none"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.10)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Invite friends */}
          {friends.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Invite Friends
              </label>
              <div className="flex flex-col gap-1">
                {friends.map(friend => {
                  const selected = inviteeIds.includes(friend.id);
                  return (
                    <button
                      key={friend.id}
                      onClick={() => toggleInvitee(friend.id)}
                      className="flex items-center gap-2 rounded-xl px-3 py-2 transition-all text-left"
                      style={{
                        background: selected ? `rgba(${hexToRgb(color)}, 0.15)` : 'rgba(255,255,255,0.04)',
                        border: selected ? `1px solid rgba(${hexToRgb(color)}, 0.40)` : '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      <div
                        className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold flex-shrink-0"
                        style={{ background: `rgba(${hexToRgb(color)}, 0.25)`, color }}
                      >
                        {friend.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs" style={{ color: selected ? color : 'var(--text-secondary)' }}>
                        {friend.username}
                      </span>
                      {selected && (
                        <span className="ml-auto text-[9px] font-semibold" style={{ color }}>✓ Invited</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div
          className="flex items-center gap-2 px-5 py-4 flex-shrink-0"
          style={{ borderTop: '1px solid var(--panel-divider)' }}
        >
          {isEdit && (
            <button
              onClick={handleDelete}
              disabled={saving}
              className="flex h-8 w-8 items-center justify-center rounded-xl transition-all"
              style={{
                background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.30)',
                color: '#ef4444',
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={closeModal}
            className="rounded-xl px-4 py-2 text-xs font-semibold transition-all"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text-muted)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !title.trim()}
            className="rounded-xl px-4 py-2 text-xs font-bold transition-all"
            style={{
              background: title.trim() ? `rgba(${hexToRgb(color)}, 0.20)` : 'rgba(255,255,255,0.04)',
              border: title.trim() ? `1px solid rgba(${hexToRgb(color)}, 0.45)` : '1px solid rgba(255,255,255,0.08)',
              color: title.trim() ? color : 'var(--text-muted)',
              cursor: title.trim() ? 'pointer' : 'default',
            }}
          >
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Event'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build check**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app" && pnpm build 2>&1 | tail -20
```

Expected: clean build.

- [ ] **Step 3: End-to-end smoke test**

```bash
pnpm dev
```

1. Click the green calendar icon — corner opens
2. Click "New Event" — modal appears with title input, datetime pickers, 5 colour swatches, friends list
3. Fill in title, pick amber, select a friend — click "Create Event"
4. Modal closes, event card appears in the correct day column with amber left border
5. Click the event card — edit modal opens with pre-filled values
6. Click the red trash button — event is deleted
7. Type a task in "New task…" and press Enter — task appears in the left panel
8. Click the circle to complete it — strikethrough appears

- [ ] **Step 4: Commit**

```bash
git add src/components/corners/calendar/EventModal.tsx
git commit -m "feat: add EventModal with colour picker, datetime pickers, and friend invite list"
```

---

## Task 6 — Final build check + deploy

**Files:** no new files

- [ ] **Step 1: TypeScript + production build**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app" && pnpm build 2>&1
```

Expected: `✓ built in` with no errors.

- [ ] **Step 2: Git push**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app" && git push
```

- [ ] **Step 3: Deploy to Vercel production**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app" && vercel --prod --yes
```

Expected: deployment URL printed. Verify calendar icon appears in the rail on the live site.
