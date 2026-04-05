// src/store/calendarStore.ts
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { encryptMessage, loadPrivateKey } from '../lib/crypto';

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
  server_id?: string | null;
  server_name?: string;
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
  server_id?: string;
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

/** Returns YYYY-MM-DD for a Date in local time. */
export function toDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// ── Invite message helper ────────────────────────────────────────────────────

/**
 * Send an encrypted calendar-invite message to a friend.
 * Content is JSON with `_calendarInvite: true` so ChatWindow can render it as a card.
 */
async function insertInviteMessage(
  senderId: string,
  recipientId: string,
  event: { id: string; title: string; start_at: string; end_at: string; color: string; description?: string },
) {
  try {
    const privateKey = loadPrivateKey(senderId);
    if (!privateKey) { console.warn('[CalendarInvite] No private key for sender', senderId); return; }

    const { data: profile } = await supabase
      .from('profiles').select('public_key').eq('id', recipientId).single();
    if (!profile?.public_key) { console.warn('[CalendarInvite] No public key for recipient', recipientId); return; }

    const content = JSON.stringify({
      _calendarInvite: true,
      eventId: event.id,
      title: event.title,
      startAt: event.start_at,
      endAt: event.end_at,
      color: event.color,
      description: event.description ?? '',
    });

    const ciphertext = encryptMessage(content, profile.public_key, privateKey);
    const { error } = await supabase.from('messages').insert({
      sender_id: senderId,
      recipient_id: recipientId,
      content: ciphertext,
    });
    if (error) console.error('[CalendarInvite] Failed to insert message:', error);
  } catch (err) {
    console.error('[CalendarInvite] Error sending invite message:', err);
  }
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
  selectedDate: Date;
  miniMonthOpen: boolean;

  // Actions
  init: (userId: string) => Promise<void>;
  fetchWeek: (weekStart: Date) => Promise<void>;
  fetchTodayTasks: (userId: string) => Promise<void>;
  createEvent: (userId: string, payload: CreateEventPayload) => Promise<void>;
  updateEvent: (id: string, payload: CreateEventPayload) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  addTask: (userId: string, title: string) => Promise<void>;
  toggleTask: (id: string, done: boolean) => Promise<void>;
  renameTask: (id: string, title: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  goToPrevWeek: () => void;
  goToNextWeek: () => void;
  goToCurrentWeek: () => void;
  goToWeekContaining: (date: Date) => void;
  openCreateModal: (prefillDate?: Date) => void;
  openEditModal: (event: CalendarEvent) => Promise<void>;
  closeModal: () => void;
  selectDate: (date: Date) => void;
  toggleMiniMonth: () => void;
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
  selectedDate: new Date(),
  miniMonthOpen: false,

  init: async (userId) => {
    const weekStart = getWeekStart(new Date());
    set({ currentWeekStart: weekStart, selectedDate: new Date() });
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

    // Plain select — no nested join to avoid PostgREST 500 with RLS subquery policies
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .gte('start_at', weekStart.toISOString())
      .lt('start_at', weekEnd.toISOString())
      .order('start_at', { ascending: true });

    if (error) { set({ loading: false }); return; }

    // Attach server names for server events
    const events: CalendarEvent[] = data ?? [];
    const serverIds = [...new Set(events.filter(e => e.server_id).map(e => e.server_id!))];
    if (serverIds.length > 0) {
      const { data: servers } = await supabase
        .from('servers')
        .select('id, name')
        .in('id', serverIds);
      const nameMap = new Map((servers ?? []).map(s => [s.id, s.name]));
      for (const e of events) {
        if (e.server_id) e.server_name = nameMap.get(e.server_id);
      }
    }

    set({ events, loading: false });
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
    const visibility = payload.server_id ? 'private' : payload.invitee_ids.length > 0 ? 'invited' : 'private';
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
        ...(payload.server_id ? { server_id: payload.server_id } : {}),
      });

    if (error) return;

    if (payload.invitee_ids.length > 0) {
      await supabase.from('calendar_event_invites').insert(
        payload.invitee_ids.map(inviteeId => ({ event_id: newId, invitee_id: inviteeId }))
      );

      // Send an invite chat message to each invitee
      const eventInfo = { id: newId, title: payload.title, start_at: payload.start_at, end_at: payload.end_at, color: payload.color, description: payload.description };
      await Promise.all(
        payload.invitee_ids.map(inviteeId => insertInviteMessage(userId, inviteeId, eventInfo))
      );
    }

    set({ activeModal: null });
    await get().fetchWeek(get().currentWeekStart);
  },

  updateEvent: async (id, payload) => {
    const visibility = payload.invitee_ids.length > 0 ? 'invited' : 'private';

    // Snapshot existing invitees so we only message NEW ones
    const { data: existingInvites } = await supabase
      .from('calendar_event_invites')
      .select('invitee_id')
      .eq('event_id', id);
    const existingIds = new Set((existingInvites ?? []).map(i => i.invitee_id));

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

      // Send invite messages only to newly added invitees
      const newInviteeIds = payload.invitee_ids.filter(uid => !existingIds.has(uid));
      if (newInviteeIds.length > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const eventInfo = { id, title: payload.title, start_at: payload.start_at, end_at: payload.end_at, color: payload.color, description: payload.description };
          await Promise.all(
            newInviteeIds.map(inviteeId => insertInviteMessage(user.id, inviteeId, eventInfo))
          );
        }
      }
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

  renameTask: async (id, title) => {
    await supabase.from('tasks').update({ title }).eq('id', id);
    set(s => ({ tasks: s.tasks.map(t => t.id === id ? { ...t, title } : t) }));
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
  openEditModal: async (event) => {
    // Open modal immediately, then load invites in the background
    set({ activeModal: 'edit', editingEvent: event, modalPrefillDate: null });
    const { data } = await supabase
      .from('calendar_event_invites')
      .select('invitee_id, status')
      .eq('event_id', event.id);
    if (data) {
      const invites: CalendarEventInvite[] = data.map((inv: any) => ({
        invitee_id: inv.invitee_id,
        invitee_username: '',
        status: inv.status as CalendarEventInvite['status'],
      }));
      set(s => ({ editingEvent: s.editingEvent ? { ...s.editingEvent, invites } : s.editingEvent }));
    }
  },
  closeModal: () => set({ activeModal: null, editingEvent: null, modalPrefillDate: null }),

  selectDate: (date) => {
    const ws = getWeekStart(date);
    const current = get().currentWeekStart;
    if (ws.getTime() !== current.getTime()) {
      get().fetchWeek(ws);
    }
    set({ selectedDate: date });
  },

  toggleMiniMonth: () => set(s => ({ miniMonthOpen: !s.miniMonthOpen })),

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
