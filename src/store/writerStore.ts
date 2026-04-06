import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useXpStore } from './xpStore';
import { useAuthStore } from './authStore';
import {
  type Story,
  type StoryCategory,
  type StoryVisibility,
  type WriterRole,
  popularityScore,
  DEV_USERNAME,
} from '../lib/writerUtils';

type WriterView = 'hub' | 'reader' | 'editor' | 'application' | 'admin';

interface WriterStore {
  // ── Role ───────────────────────────────────
  role: WriterRole | null;
  applicationPending: boolean;
  onboardingSeen: boolean;

  // ── Navigation ─────────────────────────────
  view: WriterView;
  activeStoryId: string | null;

  // ── Feed ───────────────────────────────────
  stories: Story[];
  myStories: Story[];
  categoryFilter: StoryCategory | 'all';
  loading: boolean;

  // ── Liked stories (current user) ───────────
  likedStoryIds: Set<string>;

  // ── Admin ──────────────────────────────────
  pendingApplications: { user_id: string; username: string; applied_at: string }[];

  // ── Actions ────────────────────────────────
  initRole: (userId: string, username: string) => Promise<void>;
  markOnboardingSeen: (userId: string) => void;
  setView: (view: WriterView) => void;
  setActiveStory: (id: string | null) => void;
  setCategoryFilter: (cat: StoryCategory | 'all') => void;

  fetchPublicStories: () => Promise<void>;
  fetchMyStories: (userId: string) => Promise<void>;
  fetchLikedIds: (userId: string) => Promise<void>;
  createStory: (data: {
    author_id: string;
    title: string;
    content: string;
    category: StoryCategory;
    visibility: StoryVisibility;
    cover_image_url?: string | null;
  }) => Promise<string | null>;
  updateStory: (id: string, data: Partial<Pick<Story, 'title' | 'content' | 'category' | 'visibility' | 'cover_image_url'>>) => Promise<boolean>;
  deleteStory: (id: string) => Promise<boolean>;
  toggleLike: (storyId: string, userId: string) => Promise<void>;
  incrementViews: (storyId: string) => Promise<void>;

  applyForWriter: (userId: string) => Promise<void>;

  fetchPendingApplications: () => Promise<void>;
  approveWriter: (userId: string) => Promise<void>;
  rejectWriter: (userId: string) => Promise<void>;
}

export const useWriterStore = create<WriterStore>()((set, get) => ({
  role: null,
  applicationPending: false,
  onboardingSeen: false,
  view: 'hub',
  activeStoryId: null,
  stories: [],
  myStories: [],
  categoryFilter: 'all',
  loading: false,
  likedStoryIds: new Set(),
  pendingApplications: [],

  initRole: async (userId, username) => {
    const seen = localStorage.getItem(`aero-writer-onboarding-${userId}`) === '1';
    set({ onboardingSeen: seen });

    const { data } = await supabase
      .from('writer_roles')
      .select('role, applied_at, approved_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (data) {
      set({
        role: data.role as WriterRole,
        applicationPending: data.applied_at !== null && data.approved_at === null && data.role === 'reader',
      });
      return;
    }

    const assignedRole: WriterRole = username === DEV_USERNAME ? 'dev' : 'reader';
    await supabase.from('writer_roles').insert({ user_id: userId, role: assignedRole });
    set({ role: assignedRole, applicationPending: false });
  },

  markOnboardingSeen: (userId) => {
    localStorage.setItem(`aero-writer-onboarding-${userId}`, '1');
    set({ onboardingSeen: true });
  },

  setView: (view) => set({ view }),
  setActiveStory: (id) => set({ activeStoryId: id }),
  setCategoryFilter: (cat) => set({ categoryFilter: cat }),

  fetchPublicStories: async () => {
    set({ loading: true });
    const { data, error } = await supabase
      .from('stories')
      .select('*, profiles:author_id(username, avatar_url)')
      .in('visibility', ['public', 'friends'])
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) { set({ loading: false }); return; }

    const mapped: Story[] = (data ?? []).map((row: any) => ({
      ...row,
      author_username: row.profiles?.username,
      author_avatar_url: row.profiles?.avatar_url,
      profiles: undefined,
    }));

    mapped.sort((a, b) => popularityScore(b) - popularityScore(a));
    set({ stories: mapped, loading: false });
  },

  fetchMyStories: async (userId) => {
    const { data } = await supabase
      .from('stories')
      .select('*')
      .eq('author_id', userId)
      .order('updated_at', { ascending: false });
    set({ myStories: data ?? [] });
  },

  fetchLikedIds: async (userId) => {
    const { data } = await supabase
      .from('story_likes')
      .select('story_id')
      .eq('user_id', userId);
    set({ likedStoryIds: new Set((data ?? []).map(r => r.story_id)) });
  },

  createStory: async (storyData) => {
    const { data, error } = await supabase
      .from('stories')
      .insert(storyData)
      .select('id')
      .single();
    if (error || !data) return null;
    get().fetchMyStories(storyData.author_id);

    // Award writer XP: +30 base, +10 per 500 words (min 50 words)
    const wordCount = (storyData.content ?? '').split(/\s+/).filter(Boolean).length;
    if (wordCount >= 50) {
      const user = useAuthStore.getState().user;
      const bonus = Math.floor(wordCount / 500) * 10;
      useXpStore.getState().awardXp('writer', 30 + bonus, storyData.author_id, user?.is_premium === true);
    }

    return data.id;
  },

  updateStory: async (id, updates) => {
    const { error } = await supabase.from('stories').update(updates).eq('id', id);
    if (error) return false;
    const authorId = get().myStories.find(s => s.id === id)?.author_id;
    if (authorId) get().fetchMyStories(authorId);
    return true;
  },

  deleteStory: async (id) => {
    const { error } = await supabase.from('stories').delete().eq('id', id);
    if (error) return false;
    set(s => ({
      myStories: s.myStories.filter(st => st.id !== id),
      stories: s.stories.filter(st => st.id !== id),
    }));
    return true;
  },

  toggleLike: async (storyId, userId) => {
    const liked = get().likedStoryIds;
    if (liked.has(storyId)) {
      await supabase.from('story_likes').delete().eq('story_id', storyId).eq('user_id', userId);
      const next = new Set(liked);
      next.delete(storyId);
      set({ likedStoryIds: next });
      set(s => ({
        stories: s.stories.map(st => st.id === storyId ? { ...st, likes_count: Math.max(0, st.likes_count - 1) } : st),
      }));
    } else {
      await supabase.from('story_likes').insert({ story_id: storyId, user_id: userId });
      const next = new Set(liked);
      next.add(storyId);
      set({ likedStoryIds: next });
      set(s => ({
        stories: s.stories.map(st => st.id === storyId ? { ...st, likes_count: st.likes_count + 1 } : st),
      }));
    }
  },

  incrementViews: async (storyId) => {
    await supabase.rpc('increment_story_views', { story_uuid: storyId });
    set(s => ({
      stories: s.stories.map(st => st.id === storyId ? { ...st, views: st.views + 1 } : st),
    }));
  },

  applyForWriter: async (userId) => {
    await supabase
      .from('writer_roles')
      .update({ applied_at: new Date().toISOString() })
      .eq('user_id', userId);
    set({ applicationPending: true });
  },

  fetchPendingApplications: async () => {
    const { data } = await supabase
      .from('writer_roles')
      .select('user_id, applied_at, profiles:user_id(username)')
      .not('applied_at', 'is', null)
      .is('approved_at', null)
      .eq('role', 'reader');
    set({
      pendingApplications: (data ?? []).map((r: any) => ({
        user_id: r.user_id,
        username: r.profiles?.username ?? 'Unknown',
        applied_at: r.applied_at,
      })),
    });
  },

  approveWriter: async (userId) => {
    await supabase
      .from('writer_roles')
      .update({ role: 'writer', approved_at: new Date().toISOString() })
      .eq('user_id', userId);
    get().fetchPendingApplications();
  },

  rejectWriter: async (userId) => {
    await supabase
      .from('writer_roles')
      .update({ applied_at: null })
      .eq('user_id', userId);
    get().fetchPendingApplications();
  },
}));
