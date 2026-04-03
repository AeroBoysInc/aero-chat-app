# Calendar & Tasks Corner — Design Spec

**Date:** 2026-04-03  
**Status:** Approved for implementation

---

## Overview

A new "Calendar Corner" slide-in panel accessible from the corner rail (calendar icon). It provides a personal + social weekly calendar with per-event friend invites, and a daily sticky-note-style task list. Storage is in Supabase. No external calendar sync for v1.

---

## Layout

**Two-panel split (Option A):**

```
┌─────────────────────────────────────────────────────────┐
│  ← [CalendarCorner]                          [+ New Event]│
├──────────────────┬──────────────────────────────────────┤
│  LEFT PANEL      │  RIGHT PANEL — Week Grid             │
│                  │                                       │
│  Mini Month      │  Mon  Tue  Wed  Thu  Fri  Sat  Sun   │
│  Calendar        │  7    8    9    10   11   12   13    │
│                  │  ┌──┐      ┌──┐      ┌──┐            │
│  ─────────────   │  │9am│     │1:1│     │Rev│            │
│  Calendars       │  └──┘      └──┘      └──┘            │
│  ● My Events     │                                       │
│  ● Friend Events │                                       │
│                  │                                       │
│  ─────────────   │                                       │
│  Today's Tasks   │                                       │
│  ○ Buy groceries │                                       │
│  ○ Call dentist  │                                       │
│  ✓ Reply emails  │                                       │
│  + New task…     │                                       │
│                  │  ─────────────────────────────────── │
│                  │  Add event or task…            [+ Add]│
└──────────────────┴──────────────────────────────────────┘
```

- Left panel is ~220px wide, fixed; right panel is flex-1
- Today's column gets a cyan circle highlight on the date number
- Event cards have category-coloured left border + tinted background

---

## Data Model

### Supabase Tables

**`calendar_events`**
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
creator_id    uuid REFERENCES profiles(id) ON DELETE CASCADE
title         text NOT NULL
description   text
start_at      timestamptz NOT NULL
end_at        timestamptz NOT NULL
color         text NOT NULL DEFAULT '#00d4ff'  -- hex, one of 5 presets
visibility    text NOT NULL DEFAULT 'private'  -- 'private' | 'invited'
created_at    timestamptz DEFAULT now()
```

**`calendar_event_invites`**
```sql
event_id    uuid REFERENCES calendar_events(id) ON DELETE CASCADE
invitee_id  uuid REFERENCES profiles(id) ON DELETE CASCADE
status      text NOT NULL DEFAULT 'pending'  -- 'pending' | 'accepted' | 'declined'
PRIMARY KEY (event_id, invitee_id)
```

**`tasks`**
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id     uuid REFERENCES profiles(id) ON DELETE CASCADE
title       text NOT NULL
done        boolean NOT NULL DEFAULT false
date        date NOT NULL  -- the day this task belongs to (local date of creator)
created_at  timestamptz DEFAULT now()
```

### RLS Policies

- `calendar_events`: users can SELECT own events + events where they have an invite row; INSERT/UPDATE/DELETE own only
- `calendar_event_invites`: creator can INSERT/DELETE; invitee can UPDATE status; both can SELECT their own rows
- `tasks`: users can SELECT/INSERT/UPDATE/DELETE own rows only

---

## Component Structure

```
src/components/corners/calendar/
  CalendarCorner.tsx       — root component (header + two-panel layout)
  CalendarLeftPanel.tsx    — mini month, calendar filters, task list
  CalendarWeekGrid.tsx     — week column view with event cards
  EventCard.tsx            — single event chip in the grid
  EventModal.tsx           — create/edit event sheet (title, date/time, color, invite picker)
  TaskItem.tsx             — single task row with checkbox and strike-through
src/store/calendarStore.ts — Zustand store
```

---

## Store (`calendarStore.ts`)

```ts
interface CalendarState {
  events: CalendarEvent[]        // all visible events (own + invited+accepted)
  tasks: Task[]                  // today's tasks (loaded on mount, refreshed on date change)
  currentWeekStart: Date         // Monday of the displayed week
  loading: boolean
  activeModal: 'create' | 'edit' | null
  editingEvent: CalendarEvent | null

  // actions
  fetchWeek(weekStart: Date): Promise<void>
  fetchTodayTasks(): Promise<void>
  createEvent(payload: CreateEventPayload): Promise<void>
  updateEvent(id: string, patch: Partial<CreateEventPayload>): Promise<void>
  deleteEvent(id: string): Promise<void>
  addTask(title: string): Promise<void>
  toggleTask(id: string, done: boolean): Promise<void>
  deleteTask(id: string): Promise<void>
  goToPrevWeek(): void
  goToNextWeek(): void
  goToCurrentWeek(): void
  openCreateModal(prefillDate?: Date): void
  openEditModal(event: CalendarEvent): void
  closeModal(): void
}
```

Types:
```ts
interface CalendarEvent {
  id: string
  creator_id: string
  title: string
  description?: string
  start_at: string  // ISO
  end_at: string    // ISO
  color: string
  visibility: 'private' | 'invited'
  invites?: { invitee_id: string; invitee_username: string; status: string }[]
}

interface Task {
  id: string
  title: string
  done: boolean
  date: string  // YYYY-MM-DD
}
```

---

## Corner Rail Integration

- Add `CalendarIcon` (from lucide-react) button to `CornerRail.tsx` between existing icons
- Add `'calendar'` to the `CornerView` union type in `cornerStore.ts`
- `cornerStore.openCalendarView()` / `closeCalendarView()` actions
- `CalendarCorner` slides in via the same CSS transform pattern used by other corners

---

## Event Creation Modal

Triggered by "New Event" button in the week grid header, or clicking an empty day cell.

Fields:
- **Title** — text input (required)
- **Date** — date picker, pre-filled from click context
- **Start time / End time** — time inputs (HH:MM), 30-min default duration
- **Color** — 5 swatches: cyan `#00d4ff`, green `#3dd87a`, purple `#a855f7`, amber `#f59e0b`, red `#ef4444`
- **Invite friends** — multi-select from accepted friends list; shown as dismissible avatar+username chips
- **Visibility** — auto-set to `'invited'` if any invitees added, `'private'` if none

No emoji picker, no recurrence in v1.

---

## Task List

- Shows tasks for **today** (the device's local date) only
- Rendered as sticky-note-style rows: circle checkbox → strike-through title on completion
- "New task…" inline input at bottom; Enter key submits
- Completed tasks shown at bottom with 35% opacity, strikethrough
- Tasks are personal only (no sharing, no priority levels)

---

## Mini Month Calendar (Left Panel)

- Shows current month grid (7-column Mon–Sun)
- Today highlighted with cyan dot
- Click a day → `goToWeek(day)` — jumps right panel to the week containing that day
- Previous/next month arrows
- Read-only; no event indicators in v1 (scope reduction)

---

## Week Grid (Right Panel)

- 7 columns Mon–Sun, fixed-height rows
- Header row: abbreviated day name + date number; today gets a cyan rounded chip
- Events rendered as coloured pills inside the correct day column
  - Pills show: event title (truncated) + start time
  - Left border accent in event's `color`
  - Click → opens `EventModal` in edit mode
- Multiple events in the same day stack vertically
- No time-of-day row layout in v1 — events stack in order of `start_at`

---

## Realtime (Supabase Realtime)

Subscribe to `postgres_changes` on `calendar_events` and `calendar_event_invites` for `INSERT/UPDATE/DELETE` where `creator_id = user.id` OR `invitee_id = user.id`. On change, re-run `fetchWeek()` for the current window. This keeps shared events live without polling.

---

## Aero Styling

- Left panel: `rgba(0,180,255,0.07)` tinted glass with `border: 1px solid rgba(0,180,255,0.15)`
- Week grid: `rgba(255,255,255,0.03)` surface with `border: 1px solid rgba(255,255,255,0.08)`
- Section headers: 8px uppercase, `rgba(0,212,255,0.7)` for calendar sections, `rgba(168,85,247,0.7)` for tasks
- Event pills: `rgba(color, 0.15)` background, `1px solid rgba(color, 0.30)` border
- Today column header: `rgba(0,212,255,0.20)` badge with cyan text
- EventModal: same glass panel style as other modals in the app

---

## Out of Scope (v1)

- Month / day / agenda views — week only
- Recurring events
- Event notifications / reminders
- Task due dates or priorities
- Friend task visibility
- Drag-and-drop rescheduling
- Mini month event dot indicators
