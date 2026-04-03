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
    // Update currentWeekStart immediately so navigation is responsive even if fetch is slow/fails
    set({ loading: true, currentWeekStart: weekStart });
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

    set({ events: mapped, loading: false });
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
    // Pre-generate ID client-side to avoid INSERT+RETURNING with RLS subquery (causes 500)
    const newId = crypto.randomUUID();
    const { error } = await supabase
      .from('calendar_events')
      .insert({
        id: newId,
        creator_id: userId,
        title: payload.title,
        description: payload.description,
        start_at: payload.start_at,
        end_at: payload.end_at,
        color: payload.color,
        visibility,
      });

    if (error) return;

    if (payload.invitee_ids.length > 0) {
      await supabase.from('calendar_event_invites').insert(
        payload.invitee_ids.map(inviteeId => ({ event_id: newId, invitee_id: inviteeId }))
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
    const { error } = await supabase
      .from('tasks')
      .insert({ user_id: userId, title, date: today });
    if (!error) await get().fetchTodayTasks(userId);
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
