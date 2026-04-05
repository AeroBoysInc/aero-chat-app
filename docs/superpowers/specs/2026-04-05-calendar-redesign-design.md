# Calendar Redesign: Hybrid Dashboard with Spine Timeline

## Overview

Redesign the Calendar & Tasks Corner from a sparse two-panel week grid into a hybrid dashboard that fills space effectively and matches the Frutiger Aero glass-morphism aesthetic.

## Layout Structure

The calendar corner becomes a single full-bleed view with three zones stacked/split:

```
┌──────────────────────────────────────────────────────┐
│  ← Calendar          [Today] [+ New Event]           │  Header bar
├──────────────────────────────────────────────────────┤
│  ◂  Mon  Tue  Wed  Thu  Fri [SAT]  Sun  ▸           │  Week strip
├──────────────────────────────────────────────────────┤
│  (collapsible mini-month grid — hidden by default)   │
├────────────────────────────────────┬─────────────────┤
│  April 5 · Schedule               │  Tasks        ↺  │
│                                    │                  │
│  9:00  ●━━ Team Standup ━━━━━━━   │  ○ Review PR     │
│        ┃   9:00 – 9:30            │  ✓ Ship v2.1     │
│        ┃                          │  ○ Write log     │
│ 11:00  ●━━ Design Review ━━━━━   │                  │
│        ┃   11:00 – 12:00          │                  │
│        ┃                          │                  │
│ 14:00  ●━━ 1:1 with Alex ━━━━━   │  [+ New task…]   │
│        ┃   14:00 – 14:30          │                  │
│        ╏                          │                  │
└────────────────────────────────────┴─────────────────┘
                                     ↕ resize handle
```

### 1. Header Bar

- Back arrow (closes calendar corner)
- Green calendar icon + "Calendar" title
- "Today" pill button (cyan accent) — jumps week strip + agenda to current day
- "+ New Event" button (green accent) — opens EventModal

### 2. Week Strip

- Horizontal row of 7 day cells: day name (MON/TUE/...) + date number
- Prev/next chevron arrows on each side
- Selected day has cyan accent background pill with bold white text
- Clicking a day selects it and loads that day's events in the agenda
- The month+year label (e.g. "April 2026") sits centered above or inline — clicking it toggles the collapsible mini-month

### 3. Collapsible Mini-Month

- Hidden by default (collapsed)
- Toggle by clicking month name in the week strip
- When expanded: standard 7-column month grid (same as current CalendarLeftPanel mini-month)
- Clicking a day in the mini-month selects that day (updates week strip + agenda)
- Smooth height animation on expand/collapse

### 4. Agenda Area (Spine Timeline) — ~65-70% width

**With events:**
- Vertical timeline spine on the left edge (2px wide, gradient-colored between events)
- Glowing colored dots (10px) at each event's start time, with box-shadow glow matching event color
- Time labels (e.g. "9:00") to the left of each dot
- Glass event cards branch to the right of the spine:
  - `background: rgba({eventColor}, 0.08)` with `backdrop-filter: blur(12px)`
  - `border: 1px solid rgba({eventColor}, 0.18)`
  - `border-radius: 14px`, `padding: 14px 16px`
  - Event title (white, 13px, font-weight 600)
  - Time range + optional description/invitees (muted, 10px)
  - Clicking a card opens EventModal in edit mode
- Gradient connector lines between dots fade from one event's color to the next

**Empty state (ghost timeline):**
- Same spine structure but with hollow dots (`border: 1.5px solid rgba(255,255,255,0.08)`, no fill)
- Faded connector lines (`rgba(255,255,255,0.04)`)
- Ghost time labels at 9:00, 12:00, 15:00
- Centered "Nothing scheduled" text + dashed "Add event" button
- Clicking "Add event" opens EventModal with the selected day pre-filled

### 5. Tasks Panel — ~30-35% width

- Resizable via drag handle on left edge (same pattern as current, MIN 200px, MAX 400px, default ~280px)
- Section header: "Tasks" label (purple accent) + refresh button
- Task list with checkboxes, inline edit (pencil icon), delete (trash icon) — all existing functionality
- "New task…" input at bottom
- Separated from agenda by a 1px panel divider

## Component Changes

### Files to modify:
- `CalendarCorner.tsx` — new layout shell (week strip + collapsible month + agenda/tasks split)
- `CalendarWeekGrid.tsx` — **replace entirely** with new `WeekStrip` component
- `CalendarLeftPanel.tsx` — **replace entirely**: mini-month moves into collapsible section, tasks become the right panel

### New components to create:
- `WeekStrip.tsx` — horizontal 7-day strip with selection, navigation, collapsible mini-month
- `AgendaTimeline.tsx` — spine timeline with glass event cards + empty ghost state
- `TasksPanel.tsx` — tasks list with resize handle (extracted from CalendarLeftPanel)

### Files unchanged:
- `calendarStore.ts` — all store logic stays (fetchWeek, fetchTodayTasks, CRUD, realtime)
- `EventModal.tsx` — create/edit modal is unchanged
- `cornerStore.ts` — calendarViewActive toggle is unchanged
- `ChatLayout.tsx` — calendar layer mounting is unchanged

## Store Changes

Add to `calendarStore`:
- `selectedDate: Date` — the currently selected day in the week strip (defaults to today)
- `miniMonthOpen: boolean` — controls collapsible mini-month visibility
- `selectDate(date: Date)` — sets selectedDate, also calls goToWeekContaining if the date is outside the current week
- `toggleMiniMonth()` — toggles miniMonthOpen

The existing `fetchWeek` already loads events for the visible week range. The agenda filters `events` client-side by `selectedDate` to show only that day's events.

## Visual Specs

### Week Strip Day Cell
- Default: `color: var(--text-muted)`, transparent background
- Selected: `background: rgba(0,212,255,0.15)`, `border: 1px solid rgba(0,212,255,0.3)`, `color: #00d4ff`, font-weight 700
- Today indicator: small cyan dot below the date number (even if not selected)

### Spine Timeline Dot
- Size: 10px diameter
- Active: `background: {eventColor}`, `box-shadow: 0 0 10px rgba({eventColor}, 0.4)`
- Ghost: `border: 1.5px solid rgba(255,255,255,0.08)`, no fill, no shadow

### Glass Event Card
- `background: rgba({r},{g},{b}, 0.08)`
- `backdrop-filter: blur(12px)`
- `border: 1px solid rgba({r},{g},{b}, 0.18)`
- `border-radius: 14px`
- `padding: 14px 16px`

### Connector Line
- Width: 2px
- `background: linear-gradient(rgba({color1}, 0.25), rgba({color2}, 0.25))`
- Ghost: `background: rgba(255,255,255, 0.04)`

## What Gets Removed

- 7-column week grid layout (CalendarWeekGrid's current grid)
- Permanent mini-month in the left panel (now collapsible)
- Calendar legend section ("My Events" / "Friend Events" dots — colors are self-evident from cards)
- The old two-panel left/right split structure
