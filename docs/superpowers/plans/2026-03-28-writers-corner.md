# Writers Corner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Writers Corner panel (parallel to Games Corner) where users can read, write, and discover short stories with role-based access, category filtering, and popularity-ranked feeds.

**Architecture:** New Supabase tables (`writer_roles`, `stories`, `story_likes`) with RLS policies enforce role-based access. A `writerStore` manages UI state, story CRUD, and role checks. The Writers Corner slides in as a new layer in ChatLayout (same pattern as Games Corner). Stories are displayed as horizontal glassmorphism cards with category tags, sorted by a simple popularity score (`likes + views*0.1 + recency_boost`).

**Tech Stack:** React 19, Zustand, Supabase (PostgreSQL + Storage + Realtime), Tailwind CSS, Lucide icons

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `supabase/migrations/013_writers_corner.sql` | Tables, RLS, storage bucket, realtime |
| Create | `src/store/writerStore.ts` | Writer role, stories, filters, CRUD actions |
| Modify | `src/store/cornerStore.ts` | Add `writerViewActive`, open/close actions |
| Modify | `src/components/corners/CornerRail.tsx` | Add Writers Corner rail button |
| Modify | `src/components/chat/ChatLayout.tsx` | Add WRITER LAYER (parallel to GAME LAYER) |
| Create | `src/components/corners/WritersCorner.tsx` | Root container — hub, reader, editor routing |
| Create | `src/components/corners/writers/WriterOnboarding.tsx` | First-time tutorial popup |
| Create | `src/components/corners/writers/StoryCard.tsx` | Horizontal glassmorphism card with category tag |
| Create | `src/components/corners/writers/WriterHub.tsx` | Main feed — story list, filters, tabs |
| Create | `src/components/corners/writers/StoryReader.tsx` | Full story reading view |
| Create | `src/components/corners/writers/StoryEditor.tsx` | Writing interface + new story dialog |
| Create | `src/components/corners/writers/WriterApplication.tsx` | Apply-for-writer form |
| Create | `src/components/corners/writers/AdminPanel.tsx` | Dev-only: approve/reject writer applications |
| Create | `src/lib/writerUtils.ts` | Popularity score calc, category constants, helpers |

---

## Database Design

### Tables

```
writer_roles
├── user_id        UUID PK → profiles(id)
├── role           TEXT CHECK (dev, writer, reader)
├── applied_at     TIMESTAMPTZ (null unless applied for writer)
├── approved_at    TIMESTAMPTZ (null unless approved)
├── created_at     TIMESTAMPTZ DEFAULT now()

stories
├── id             UUID PK DEFAULT gen_random_uuid()
├── author_id      UUID → profiles(id)
├── title          TEXT NOT NULL
├── content        TEXT NOT NULL
├── category       TEXT CHECK (fantasy, horror, scifi, romance, mystery, comedy, drama, adventure, other)
├── visibility     TEXT CHECK (private, friends, public) DEFAULT 'private'
├── cover_image_url TEXT
├── views          INT DEFAULT 0
├── likes_count    INT DEFAULT 0
├── created_at     TIMESTAMPTZ DEFAULT now()
├── updated_at     TIMESTAMPTZ DEFAULT now()

story_likes
├── story_id       UUID → stories(id) ON DELETE CASCADE
├── user_id        UUID → profiles(id) ON DELETE CASCADE
├── created_at     TIMESTAMPTZ DEFAULT now()
├── PK (story_id, user_id)
```

### RLS Summary

- **writer_roles**: Users can read their own role; DejanAdmin can read/update all
- **stories**: Authors can CRUD their own; readers see public stories + friends-only from friends; visibility filter in SELECT policy
- **story_likes**: Authenticated users can like public/friends stories; one like per user per story (PK constraint)

---

## Task Breakdown

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/013_writers_corner.sql`

This migration creates all tables, RLS policies, the storage bucket for cover images, and adds tables to realtime publication.

- [ ] **Step 1: Write the migration SQL**

```sql
-- ============================================================
-- 013_writers_corner.sql — Writers Corner schema
-- ============================================================

-- ── Writer roles ──────────────────────────────────────────────
CREATE TABLE public.writer_roles (
  user_id    UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'reader'
               CHECK (role IN ('dev', 'writer', 'reader')),
  applied_at  TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.writer_roles ENABLE ROW LEVEL SECURITY;

-- Everyone can read their own role
CREATE POLICY "wr_select_own" ON public.writer_roles FOR SELECT
  USING (auth.uid() = user_id);

-- DejanAdmin can read all roles (for admin panel)
-- We identify DejanAdmin by joining to profiles.username
CREATE POLICY "wr_select_admin" ON public.writer_roles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND username = 'DejanAdmin'
    )
  );

-- Users can insert their own role (self-registration as reader)
CREATE POLICY "wr_insert_own" ON public.writer_roles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own row (to set applied_at when applying)
CREATE POLICY "wr_update_own" ON public.writer_roles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND role = 'reader'  -- users can only keep themselves as reader
  );

-- DejanAdmin can update any role (approve/reject writers)
CREATE POLICY "wr_update_admin" ON public.writer_roles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND username = 'DejanAdmin'
    )
  );

-- ── Stories ──────────────────────────────────────────────────
CREATE TABLE public.stories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  content         TEXT NOT NULL DEFAULT '',
  category        TEXT NOT NULL DEFAULT 'other'
                    CHECK (category IN (
                      'fantasy', 'horror', 'scifi', 'romance',
                      'mystery', 'comedy', 'drama', 'adventure', 'other'
                    )),
  visibility      TEXT NOT NULL DEFAULT 'private'
                    CHECK (visibility IN ('private', 'friends', 'public')),
  cover_image_url TEXT,
  views           INT NOT NULL DEFAULT 0,
  likes_count     INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

-- Authors can see all their own stories
CREATE POLICY "stories_select_own" ON public.stories FOR SELECT
  USING (auth.uid() = author_id);

-- Anyone can see public stories
CREATE POLICY "stories_select_public" ON public.stories FOR SELECT
  USING (visibility = 'public');

-- Friends can see friends-only stories
CREATE POLICY "stories_select_friends" ON public.stories FOR SELECT
  USING (
    visibility = 'friends'
    AND EXISTS (
      SELECT 1 FROM public.friend_requests fr
      WHERE fr.status = 'accepted'
        AND (
          (fr.sender_id = auth.uid() AND fr.receiver_id = author_id)
          OR (fr.receiver_id = auth.uid() AND fr.sender_id = author_id)
        )
    )
  );

-- Only writers and devs can insert stories
CREATE POLICY "stories_insert" ON public.stories FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM public.writer_roles
      WHERE user_id = auth.uid() AND role IN ('writer', 'dev')
    )
  );

-- Authors can update their own stories
CREATE POLICY "stories_update" ON public.stories FOR UPDATE
  USING (auth.uid() = author_id);

-- Authors can delete their own stories
CREATE POLICY "stories_delete" ON public.stories FOR DELETE
  USING (auth.uid() = author_id);

-- ── Story likes ──────────────────────────────────────────────
CREATE TABLE public.story_likes (
  story_id   UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, user_id)
);

ALTER TABLE public.story_likes ENABLE ROW LEVEL SECURITY;

-- Users can see their own likes
CREATE POLICY "likes_select_own" ON public.story_likes FOR SELECT
  USING (auth.uid() = user_id);

-- Users can see like counts (needed for public stories)
CREATE POLICY "likes_select_public" ON public.story_likes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.stories s
      WHERE s.id = story_id AND s.visibility = 'public'
    )
  );

-- Authenticated users can like stories they can see
CREATE POLICY "likes_insert" ON public.story_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can unlike (delete their own like)
CREATE POLICY "likes_delete" ON public.story_likes FOR DELETE
  USING (auth.uid() = user_id);

-- ── Updated-at trigger (reuse existing function from 011) ────
CREATE TRIGGER stories_updated_at
  BEFORE UPDATE ON public.stories
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ── Increment views via RPC ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_story_views(story_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.stories SET views = views + 1 WHERE id = story_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Realtime ─────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.stories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.writer_roles;

-- ── Storage bucket for cover images ──────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'story-covers',
  'story-covers',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
);

CREATE POLICY "story_covers_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'story-covers'
    AND auth.role() = 'authenticated'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "story_covers_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'story-covers');

CREATE POLICY "story_covers_update" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'story-covers'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "story_covers_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'story-covers'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/013_writers_corner.sql
git commit -m "feat(db): add writers corner schema — roles, stories, likes, covers bucket"
```

> **Note:** Run this migration in the Supabase SQL editor before testing the feature.

---

### Task 2: Writer Utilities & Constants

**Files:**
- Create: `src/lib/writerUtils.ts`

- [ ] **Step 1: Create the utility file**

```typescript
export type WriterRole = 'dev' | 'writer' | 'reader';

export type StoryCategory =
  | 'fantasy' | 'horror' | 'scifi' | 'romance'
  | 'mystery' | 'comedy' | 'drama' | 'adventure' | 'other';

export type StoryVisibility = 'private' | 'friends' | 'public';

export interface Story {
  id: string;
  author_id: string;
  title: string;
  content: string;
  category: StoryCategory;
  visibility: StoryVisibility;
  cover_image_url: string | null;
  views: number;
  likes_count: number;
  created_at: string;
  updated_at: string;
  // Joined from profiles
  author_username?: string;
  author_avatar_url?: string | null;
}

export const CATEGORIES: { id: StoryCategory; label: string; emoji: string; color: string }[] = [
  { id: 'fantasy',   label: 'Fantasy',   emoji: '\u{1F9D9}', color: '#a855f7' },
  { id: 'horror',    label: 'Horror',    emoji: '\u{1F47B}', color: '#ef4444' },
  { id: 'scifi',     label: 'Sci-Fi',    emoji: '\u{1F680}', color: '#06b6d4' },
  { id: 'romance',   label: 'Romance',   emoji: '\u{1F496}', color: '#ec4899' },
  { id: 'mystery',   label: 'Mystery',   emoji: '\u{1F50D}', color: '#f59e0b' },
  { id: 'comedy',    label: 'Comedy',    emoji: '\u{1F602}', color: '#22c55e' },
  { id: 'drama',     label: 'Drama',     emoji: '\u{1F3AD}', color: '#8b5cf6' },
  { id: 'adventure', label: 'Adventure', emoji: '\u{1F5FA}', color: '#f97316' },
  { id: 'other',     label: 'Other',     emoji: '\u{1F4DD}', color: '#64748b' },
];

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c])) as Record<
  StoryCategory,
  (typeof CATEGORIES)[number]
>;

/**
 * Popularity score for feed ranking.
 * Score = likes + (views * 0.1) + recency_boost
 * recency_boost = max(0, 7 - days_old) * 5  (stories < 7 days old get a boost)
 */
export function popularityScore(story: Pick<Story, 'likes_count' | 'views' | 'created_at'>): number {
  const daysOld = (Date.now() - new Date(story.created_at).getTime()) / 86_400_000;
  const recencyBoost = Math.max(0, 7 - daysOld) * 5;
  return story.likes_count + story.views * 0.1 + recencyBoost;
}

export function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

/** Role display config */
export const ROLE_CONFIG: Record<WriterRole, { label: string; color: string }> = {
  dev:    { label: 'Dev',    color: '#fbbf24' },  // golden
  writer: { label: 'Writer', color: '#00d4ff' },  // cyan
  reader: { label: 'Reader', color: '#94a3b8' },  // slate
};

/** DejanAdmin username — the only user who gets the Dev role */
export const DEV_USERNAME = 'DejanAdmin';
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/writerUtils.ts
git commit -m "feat: add writer utilities — types, categories, popularity score"
```

---

### Task 3: Writer Store (Zustand)

**Files:**
- Create: `src/store/writerStore.ts`

- [ ] **Step 1: Create the store**

```typescript
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
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
  role: WriterRole | null;          // null = not yet loaded / not registered
  applicationPending: boolean;      // true if applied but not yet approved
  onboardingSeen: boolean;          // persisted in localStorage

  // ── Navigation ─────────────────────────────
  view: WriterView;
  activeStoryId: string | null;     // story being read or edited

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

  // Story CRUD
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

  // Writer application
  applyForWriter: (userId: string) => Promise<void>;

  // Admin
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

  // ── Init role ──────────────────────────────────────────────
  initRole: async (userId, username) => {
    // Check localStorage for onboarding
    const seen = localStorage.getItem(`aero-writer-onboarding-${userId}`) === '1';
    set({ onboardingSeen: seen });

    // Check if role row exists
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

    // First visit — create role row
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

  // ── Fetch public stories (with author join) ────────────────
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

    // Sort by popularity score
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

  // ── Create story ───────────────────────────────────────────
  createStory: async (storyData) => {
    const { data, error } = await supabase
      .from('stories')
      .insert(storyData)
      .select('id')
      .single();
    if (error || !data) return null;
    // Refresh my stories
    get().fetchMyStories(storyData.author_id);
    return data.id;
  },

  updateStory: async (id, updates) => {
    const { error } = await supabase.from('stories').update(updates).eq('id', id);
    if (error) return false;
    // Refresh lists
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

  // ── Like / unlike ──────────────────────────────────────────
  toggleLike: async (storyId, userId) => {
    const liked = get().likedStoryIds;
    if (liked.has(storyId)) {
      // Unlike
      await supabase.from('story_likes').delete().eq('story_id', storyId).eq('user_id', userId);
      const next = new Set(liked);
      next.delete(storyId);
      set({ likedStoryIds: next });
      // Decrement local count
      set(s => ({
        stories: s.stories.map(st => st.id === storyId ? { ...st, likes_count: Math.max(0, st.likes_count - 1) } : st),
      }));
    } else {
      // Like
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

  // ── Writer application ─────────────────────────────────────
  applyForWriter: async (userId) => {
    await supabase
      .from('writer_roles')
      .update({ applied_at: new Date().toISOString() })
      .eq('user_id', userId);
    set({ applicationPending: true });
  },

  // ── Admin actions ──────────────────────────────────────────
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
```

- [ ] **Step 2: Commit**

```bash
git add src/store/writerStore.ts
git commit -m "feat: add writerStore — role management, story CRUD, likes, admin"
```

---

### Task 4: Corner Store + CornerRail + ChatLayout Integration

**Files:**
- Modify: `src/store/cornerStore.ts`
- Modify: `src/components/corners/CornerRail.tsx`
- Modify: `src/components/chat/ChatLayout.tsx`

- [ ] **Step 1: Update cornerStore — add writer view state**

In `src/store/cornerStore.ts`, add `writerViewActive`, `openWriterHub`, and `closeWriterView`:

```typescript
// Add to interface:
  writerViewActive: boolean;
  openWriterHub: () => void;
  closeWriterView: () => void;

// Add to initial state:
  writerViewActive: false,

// Add actions:
  openWriterHub:     () => set({ writerViewActive: true, gameViewActive: false, devViewActive: false, selectedGame: null, gameChatOverlay: null }),
  closeWriterView:   () => set({ writerViewActive: false }),

// Update openGameHub to also close writer view:
  openGameHub:       () => set({ gameViewActive: true, writerViewActive: false, devViewActive: false }),

// Update openDevView to also close writer view:
  openDevView:       () => set({ devViewActive: true, gameViewActive: false, writerViewActive: false, selectedGame: null, gameChatOverlay: null }),
```

- [ ] **Step 2: Update CornerRail — add Writers Corner button**

In `src/components/corners/CornerRail.tsx`:

Add import: `import { Gamepad2, Terminal, PenTool } from 'lucide-react';`

Add to store destructure: `writerViewActive, openWriterHub, closeWriterView`

Add the Writers Corner button **after** the Games Corner button, inside the top section `<div>`:

```tsx
<RailBtn
  icon={PenTool}
  isActive={writerViewActive}
  color="#a855f7"
  tooltip={writerViewActive ? 'Back to Chat' : 'Writers Corner'}
  onClick={() => writerViewActive ? closeWriterView() : openWriterHub()}
/>
```

- [ ] **Step 3: Update ChatLayout — add WRITER LAYER**

In `src/components/chat/ChatLayout.tsx`:

Add import: `const WritersCorner = lazy(() => import('../corners/WritersCorner').then(m => ({ default: m.WritersCorner })));` at the top, plus `import { lazy, Suspense } from 'react';`

Add to store destructure: `writerViewActive`

Update `anyViewActive`: `const anyViewActive = gameViewActive || devViewActive || writerViewActive;`

Add a new WRITER LAYER div **after** the GAME LAYER div, same pattern:

```tsx
{/* ── WRITER LAYER ──────────────────────────────────── */}
<div
  style={{
    position: 'absolute', inset: 0,
    transform: writerViewActive ? 'translateX(0)' : 'translateX(102%)',
    opacity: writerViewActive ? 1 : 0,
    transition: 'transform 0.38s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.32s ease',
    pointerEvents: writerViewActive ? 'auto' : 'none',
    willChange: 'transform, opacity',
  }}
>
  <Suspense fallback={
    <div className="flex h-full items-center justify-center" style={{ color: 'rgba(168,85,247,0.7)', fontSize: 13 }}>
      Loading Writers Corner...
    </div>
  }>
    <WritersCorner />
  </Suspense>
</div>
```

- [ ] **Step 4: Build and verify**

Run: `pnpm build`
Expected: Build succeeds (WritersCorner component will be created in the next task — create a placeholder first if needed)

- [ ] **Step 5: Commit**

```bash
git add src/store/cornerStore.ts src/components/corners/CornerRail.tsx src/components/chat/ChatLayout.tsx
git commit -m "feat: wire Writers Corner into corner store, rail, and layout layer"
```

---

### Task 5: WritersCorner Root + Writer Onboarding

**Files:**
- Create: `src/components/corners/WritersCorner.tsx`
- Create: `src/components/corners/writers/WriterOnboarding.tsx`

- [ ] **Step 1: Create WriterOnboarding popup**

```typescript
// src/components/corners/writers/WriterOnboarding.tsx
import { X, BookOpen, PenTool, Search } from 'lucide-react';
import { hexToRgb } from '../../../lib/writerUtils';

const ACCENT = '#a855f7';

interface Props {
  onClose: () => void;
}

export function WriterOnboarding({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md mx-4 rounded-2xl p-6"
        style={{
          background: 'var(--sidebar-bg)',
          border: `1px solid rgba(${hexToRgb(ACCENT)}, 0.30)`,
          boxShadow: `0 8px 40px rgba(${hexToRgb(ACCENT)}, 0.20), inset 0 1px 0 rgba(255,255,255,0.10)`,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-lg p-1.5 transition-all"
          style={{ color: 'var(--text-muted)' }}
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div
            className="inline-flex h-14 w-14 items-center justify-center rounded-2xl mb-3"
            style={{
              background: `rgba(${hexToRgb(ACCENT)}, 0.15)`,
              border: `1px solid rgba(${hexToRgb(ACCENT)}, 0.30)`,
            }}
          >
            <PenTool className="h-7 w-7" style={{ color: ACCENT }} />
          </div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            Welcome to Writers Corner
          </h2>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            A place to read and share short stories with the AeroChat community
          </p>
        </div>

        {/* Steps */}
        <div className="flex flex-col gap-4 mb-6">
          <OnboardingStep
            icon={Search}
            title="Browse Stories"
            desc="Discover stories by category — fantasy, horror, sci-fi, and more. Filter by what you love."
          />
          <OnboardingStep
            icon={BookOpen}
            title="Start Reading"
            desc="Tap any story card to dive in. Like stories to help them trend."
          />
          <OnboardingStep
            icon={PenTool}
            title="Want to Write?"
            desc="Apply for a Writer role to publish your own stories. Pick a category, add a cover, and share with the world."
          />
        </div>

        {/* CTA */}
        <button
          onClick={onClose}
          className="w-full rounded-xl py-3 text-sm font-bold transition-all"
          style={{
            background: `linear-gradient(135deg, ${ACCENT}, #7c3aed)`,
            color: '#fff',
            border: 'none',
            boxShadow: `0 4px 16px rgba(${hexToRgb(ACCENT)}, 0.35)`,
          }}
        >
          Got it, let's go!
        </button>
      </div>
    </div>
  );
}

function OnboardingStep({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex gap-3 items-start">
      <div
        className="flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0"
        style={{
          background: `rgba(${hexToRgb(ACCENT)}, 0.10)`,
          border: `1px solid rgba(${hexToRgb(ACCENT)}, 0.20)`,
        }}
      >
        <Icon className="h-4 w-4" style={{ color: ACCENT }} />
      </div>
      <div>
        <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{title}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create WritersCorner root container**

```typescript
// src/components/corners/WritersCorner.tsx
import { useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useWriterStore } from '../../store/writerStore';
import { WriterOnboarding } from './writers/WriterOnboarding';
import { WriterHub } from './writers/WriterHub';
import { StoryReader } from './writers/StoryReader';
import { StoryEditor } from './writers/StoryEditor';
import { WriterApplication } from './writers/WriterApplication';
import { AdminPanel } from './writers/AdminPanel';

export function WritersCorner() {
  const user = useAuthStore(s => s.user);
  const { role, onboardingSeen, view, initRole, markOnboardingSeen, fetchPublicStories, fetchLikedIds } =
    useWriterStore();

  // Init role + fetch stories on mount
  useEffect(() => {
    if (!user) return;
    initRole(user.id, user.user_metadata?.username ?? user.email ?? '');
    fetchPublicStories();
    fetchLikedIds(user.id);
  }, [user?.id]);

  if (!user || role === null) {
    return (
      <div
        className="flex h-full items-center justify-center"
        style={{ color: 'rgba(168,85,247,0.7)', fontSize: 13 }}
      >
        Loading...
      </div>
    );
  }

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
      {/* Onboarding popup — shown once */}
      {!onboardingSeen && (
        <WriterOnboarding onClose={() => markOnboardingSeen(user.id)} />
      )}

      {/* View router */}
      {view === 'hub' && <WriterHub />}
      {view === 'reader' && <StoryReader />}
      {view === 'editor' && <StoryEditor />}
      {view === 'application' && <WriterApplication />}
      {view === 'admin' && <AdminPanel />}
    </div>
  );
}
```

- [ ] **Step 3: Create placeholder components** (to be filled in subsequent tasks)

Create minimal placeholder exports for `WriterHub`, `StoryReader`, `StoryEditor`, `WriterApplication`, `AdminPanel` so the build passes:

```typescript
// src/components/corners/writers/WriterHub.tsx
export function WriterHub() {
  return <div className="flex-1 p-5" style={{ color: 'var(--text-muted)' }}>WriterHub — coming next</div>;
}

// src/components/corners/writers/StoryReader.tsx
export function StoryReader() {
  return <div className="flex-1 p-5" style={{ color: 'var(--text-muted)' }}>StoryReader — coming next</div>;
}

// src/components/corners/writers/StoryEditor.tsx
export function StoryEditor() {
  return <div className="flex-1 p-5" style={{ color: 'var(--text-muted)' }}>StoryEditor — coming next</div>;
}

// src/components/corners/writers/WriterApplication.tsx
export function WriterApplication() {
  return <div className="flex-1 p-5" style={{ color: 'var(--text-muted)' }}>WriterApplication — coming next</div>;
}

// src/components/corners/writers/AdminPanel.tsx
export function AdminPanel() {
  return <div className="flex-1 p-5" style={{ color: 'var(--text-muted)' }}>AdminPanel — coming next</div>;
}
```

- [ ] **Step 4: Build and verify**

Run: `pnpm build`
Expected: Build succeeds. Writers Corner rail button visible, clicking opens the panel with onboarding popup.

- [ ] **Step 5: Commit**

```bash
git add src/components/corners/WritersCorner.tsx src/components/corners/writers/
git commit -m "feat: add WritersCorner root container + onboarding popup + placeholder views"
```

---

### Task 6: StoryCard Component

**Files:**
- Create: `src/components/corners/writers/StoryCard.tsx`

This is the horizontal glassmorphism card with a blurred cover image, category tag floating half-in/half-out, and readable title.

- [ ] **Step 1: Build the StoryCard**

```typescript
// src/components/corners/writers/StoryCard.tsx
import { memo, useState } from 'react';
import { Heart, Eye, Lock, Users, Globe } from 'lucide-react';
import { type Story, CATEGORY_MAP, hexToRgb } from '../../../lib/writerUtils';

interface Props {
  story: Story;
  liked: boolean;
  onOpen: () => void;
  onLike: () => void;
}

const VISIBILITY_ICON: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  private: Lock,
  friends: Users,
  public: Globe,
};

export const StoryCard = memo(function StoryCard({ story, liked, onOpen, onLike }: Props) {
  const [hovered, setHovered] = useState(false);
  const cat = CATEGORY_MAP[story.category];
  const VisIcon = VISIBILITY_ICON[story.visibility] ?? Globe;

  return (
    <div
      className="relative rounded-2xl overflow-hidden cursor-pointer transition-all"
      style={{
        height: 140,
        border: `1px solid rgba(${hexToRgb(cat.color)}, ${hovered ? 0.40 : 0.18})`,
        boxShadow: hovered
          ? `0 8px 32px rgba(${hexToRgb(cat.color)}, 0.20)`
          : `0 2px 12px rgba(0,0,0,0.08)`,
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onOpen}
    >
      {/* Background — blurred cover image or gradient fallback */}
      <div
        className="absolute inset-0"
        style={{
          background: story.cover_image_url
            ? `url(${story.cover_image_url}) center/cover`
            : `linear-gradient(135deg, rgba(${hexToRgb(cat.color)}, 0.15), rgba(${hexToRgb(cat.color)}, 0.05))`,
        }}
      />
      {/* Blur + darken overlay */}
      <div
        className="absolute inset-0"
        style={{
          backdropFilter: story.cover_image_url ? 'blur(8px) brightness(0.5)' : 'none',
          background: story.cover_image_url
            ? 'rgba(0,0,0,0.3)'
            : 'var(--sidebar-bg)',
        }}
      />

      {/* Glass surface */}
      <div
        className="absolute inset-0"
        style={{
          background: `rgba(${hexToRgb(cat.color)}, 0.04)`,
          backdropFilter: 'blur(20px)',
        }}
      />

      {/* ── Category tag — floats half-in, half-out at the top ── */}
      <div
        className="absolute left-4 flex items-center gap-1.5 rounded-full px-3 py-1"
        style={{
          top: -12,
          background: `rgba(${hexToRgb(cat.color)}, 0.20)`,
          border: `1px solid rgba(${hexToRgb(cat.color)}, 0.40)`,
          backdropFilter: 'blur(12px)',
          boxShadow: `0 2px 8px rgba(${hexToRgb(cat.color)}, 0.25)`,
          zIndex: 2,
        }}
      >
        <span style={{ fontSize: 11 }}>{cat.emoji}</span>
        <span className="text-[10px] font-bold" style={{ color: cat.color }}>
          {cat.label}
        </span>
      </div>

      {/* ── Content ── */}
      <div className="relative z-[1] flex h-full flex-col justify-between p-4 pt-5">
        {/* Title + author */}
        <div>
          <h3
            className="text-base font-bold leading-tight line-clamp-2"
            style={{
              color: story.cover_image_url ? '#fff' : 'var(--text-primary)',
              textShadow: story.cover_image_url ? '0 1px 4px rgba(0,0,0,0.5)' : 'none',
            }}
          >
            {story.title}
          </h3>
          <p
            className="text-xs mt-1"
            style={{
              color: story.cover_image_url ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)',
            }}
          >
            by {story.author_username ?? 'Unknown'}
          </p>
        </div>

        {/* Bottom row — stats + visibility */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Like button */}
            <button
              onClick={e => { e.stopPropagation(); onLike(); }}
              className="flex items-center gap-1 text-xs transition-all"
              style={{ color: liked ? '#ef4444' : (story.cover_image_url ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)') }}
            >
              <Heart className="h-3.5 w-3.5" style={{ fill: liked ? '#ef4444' : 'none' }} />
              {story.likes_count}
            </button>
            {/* Views */}
            <span
              className="flex items-center gap-1 text-xs"
              style={{ color: story.cover_image_url ? 'rgba(255,255,255,0.5)' : 'var(--text-muted)', opacity: 0.7 }}
            >
              <Eye className="h-3 w-3" />
              {story.views}
            </span>
          </div>
          {/* Visibility badge */}
          <span
            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold"
            style={{
              background: story.cover_image_url ? 'rgba(255,255,255,0.12)' : `rgba(${hexToRgb(cat.color)}, 0.08)`,
              color: story.cover_image_url ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)',
            }}
          >
            <VisIcon className="h-2.5 w-2.5" />
            {story.visibility}
          </span>
        </div>
      </div>
    </div>
  );
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/corners/writers/StoryCard.tsx
git commit -m "feat: add StoryCard — glassmorphism card with floating category tag"
```

---

### Task 7: WriterHub (Main Feed + Filters + Tabs)

**Files:**
- Modify: `src/components/corners/writers/WriterHub.tsx` (replace placeholder)

- [ ] **Step 1: Implement WriterHub**

```typescript
// src/components/corners/writers/WriterHub.tsx
import { useState, useEffect } from 'react';
import { ArrowLeft, PenTool, Plus, Shield, RefreshCw } from 'lucide-react';
import { useCornerStore } from '../../../store/cornerStore';
import { useAuthStore } from '../../../store/authStore';
import { useWriterStore } from '../../../store/writerStore';
import { StoryCard } from './StoryCard';
import { CATEGORIES, type StoryCategory, hexToRgb, ROLE_CONFIG } from '../../../lib/writerUtils';

export function WriterHub() {
  const user = useAuthStore(s => s.user);
  const { closeWriterView } = useCornerStore();
  const {
    role, applicationPending, stories, myStories, categoryFilter, loading,
    likedStoryIds, setCategoryFilter, setView, setActiveStory,
    toggleLike, fetchPublicStories, fetchMyStories, incrementViews,
  } = useWriterStore();

  const [activeTab, setActiveTab] = useState<'browse' | 'my-stories'>('browse');

  useEffect(() => {
    if (user && activeTab === 'my-stories') fetchMyStories(user.id);
  }, [activeTab, user?.id]);

  const canWrite = role === 'writer' || role === 'dev';
  const isAdmin = role === 'dev';
  const roleConfig = role ? ROLE_CONFIG[role] : null;

  // Apply category filter
  const filteredStories = categoryFilter === 'all'
    ? stories
    : stories.filter(s => s.category === categoryFilter);

  const filteredMyStories = categoryFilter === 'all'
    ? myStories
    : myStories.filter(s => s.category === categoryFilter);

  function handleOpenStory(storyId: string) {
    setActiveStory(storyId);
    incrementViews(storyId);
    setView('reader');
  }

  function handleNewStory() {
    setActiveStory(null);
    setView('editor');
  }

  const ACCENT = '#a855f7';

  return (
    <div className="flex h-full flex-col">
      {/* ── Header ── */}
      <div
        className="flex items-center gap-3 px-6 py-5 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--panel-divider)' }}
      >
        <button
          onClick={closeWriterView}
          className="flex h-8 w-8 items-center justify-center rounded-xl transition-all flex-shrink-0"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.10)',
            color: 'var(--text-muted)',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0"
          style={{ background: `rgba(${hexToRgb(ACCENT)}, 0.15)`, border: `1px solid rgba(${hexToRgb(ACCENT)}, 0.30)` }}
        >
          <PenTool className="h-5 w-5" style={{ color: ACCENT }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Writers Corner</p>
            {roleConfig && (
              <span
                className="rounded-full px-2 py-0.5 text-[9px] font-bold"
                style={{
                  background: `rgba(${hexToRgb(roleConfig.color)}, 0.15)`,
                  border: `1px solid rgba(${hexToRgb(roleConfig.color)}, 0.35)`,
                  color: roleConfig.color,
                }}
              >
                {roleConfig.label}
              </span>
            )}
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Short stories by the community</p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Refresh */}
          <button
            onClick={() => fetchPublicStories()}
            className="flex h-8 w-8 items-center justify-center rounded-xl transition-all"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.10)',
              color: 'var(--text-muted)',
            }}
            title="Refresh stories"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>

          {/* Admin panel */}
          {isAdmin && (
            <button
              onClick={() => setView('admin')}
              className="flex h-8 w-8 items-center justify-center rounded-xl transition-all"
              style={{
                background: 'rgba(251,191,36,0.12)',
                border: '1px solid rgba(251,191,36,0.30)',
                color: '#fbbf24',
              }}
              title="Admin Panel"
            >
              <Shield className="h-3.5 w-3.5" />
            </button>
          )}

          {/* New story / Apply */}
          {canWrite ? (
            <button
              onClick={handleNewStory}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all"
              style={{
                background: `rgba(${hexToRgb(ACCENT)}, 0.18)`,
                border: `1px solid rgba(${hexToRgb(ACCENT)}, 0.40)`,
                color: ACCENT,
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              New Story
            </button>
          ) : (
            <button
              onClick={() => setView('application')}
              disabled={applicationPending}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all"
              style={{
                background: applicationPending ? 'rgba(255,255,255,0.04)' : `rgba(${hexToRgb(ACCENT)}, 0.12)`,
                border: applicationPending
                  ? '1px solid rgba(255,255,255,0.10)'
                  : `1px solid rgba(${hexToRgb(ACCENT)}, 0.30)`,
                color: applicationPending ? 'var(--text-muted)' : ACCENT,
                cursor: applicationPending ? 'default' : 'pointer',
              }}
            >
              <PenTool className="h-3.5 w-3.5" />
              {applicationPending ? 'Application Pending' : 'Apply to Write'}
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div
        className="flex items-center gap-4 px-6 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--panel-divider)' }}
      >
        <div className="flex gap-1.5">
          {(['browse', ...(canWrite ? ['my-stories'] : [])] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as 'browse' | 'my-stories')}
              className="rounded-full px-4 py-1.5 text-xs font-bold transition-all"
              style={{
                background: activeTab === tab ? `rgba(${hexToRgb(ACCENT)}, 0.15)` : 'rgba(255,255,255,0.04)',
                border: activeTab === tab ? `1px solid rgba(${hexToRgb(ACCENT)}, 0.40)` : '1px solid rgba(255,255,255,0.09)',
                color: activeTab === tab ? ACCENT : 'var(--text-muted)',
              }}
            >
              {tab === 'browse' ? `Browse (${filteredStories.length})` : `My Stories (${filteredMyStories.length})`}
            </button>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Category filter pills — scrollable */}
        <div className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <FilterPill
            label="All"
            active={categoryFilter === 'all'}
            color={ACCENT}
            onClick={() => setCategoryFilter('all')}
          />
          {CATEGORIES.map(cat => (
            <FilterPill
              key={cat.id}
              label={cat.emoji + ' ' + cat.label}
              active={categoryFilter === cat.id}
              color={cat.color}
              onClick={() => setCategoryFilter(cat.id)}
            />
          ))}
        </div>
      </div>

      {/* ── Story feed ── */}
      <div className="flex-1 overflow-y-auto scrollbar-aero p-5">
        <div className="flex flex-col gap-5">
          {activeTab === 'browse' ? (
            filteredStories.length === 0 ? (
              <EmptyFeed loading={loading} />
            ) : (
              filteredStories.map(story => (
                <StoryCard
                  key={story.id}
                  story={story}
                  liked={likedStoryIds.has(story.id)}
                  onOpen={() => handleOpenStory(story.id)}
                  onLike={() => user && toggleLike(story.id, user.id)}
                />
              ))
            )
          ) : (
            filteredMyStories.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-center">
                <div>
                  <p className="text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>No stories yet</p>
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    Click "New Story" to start writing!
                  </p>
                </div>
              </div>
            ) : (
              filteredMyStories.map(story => (
                <StoryCard
                  key={story.id}
                  story={story}
                  liked={likedStoryIds.has(story.id)}
                  onOpen={() => { setActiveStory(story.id); setView('editor'); }}
                  onLike={() => user && toggleLike(story.id, user.id)}
                />
              ))
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ── Filter pill ──────────────────────────────────────────────

function FilterPill({ label, active, color, onClick }: { label: string; active: boolean; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full px-2.5 py-1 text-[10px] font-semibold whitespace-nowrap transition-all flex-shrink-0"
      style={{
        background: active ? `rgba(${hexToRgb(color)}, 0.18)` : 'rgba(255,255,255,0.04)',
        border: active ? `1px solid rgba(${hexToRgb(color)}, 0.40)` : '1px solid rgba(255,255,255,0.08)',
        color: active ? color : 'var(--text-muted)',
      }}
    >
      {label}
    </button>
  );
}

// ── Empty state ──────────────────────────────────────────────

function EmptyFeed({ loading }: { loading: boolean }) {
  return (
    <div className="flex h-40 items-center justify-center text-center">
      <div>
        <p className="text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>
          {loading ? 'Loading stories...' : 'No stories yet'}
        </p>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          {loading ? 'Fetching the latest from the community' : 'Be the first to publish a story!'}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build and test visually**

Run: `pnpm dev`
Open localhost:1420. Click the Writers Corner rail button (pen icon). Verify:
- Header with role badge, back button, action buttons
- Category filter pills scrollable
- Browse tab shows empty state (no stories in DB yet)

- [ ] **Step 3: Commit**

```bash
git add src/components/corners/writers/WriterHub.tsx
git commit -m "feat: add WriterHub — story feed with category filters and role-aware actions"
```

---

### Task 8: StoryReader (Reading View)

**Files:**
- Modify: `src/components/corners/writers/StoryReader.tsx` (replace placeholder)

- [ ] **Step 1: Implement StoryReader**

```typescript
// src/components/corners/writers/StoryReader.tsx
import { useEffect, useMemo } from 'react';
import { ArrowLeft, Heart, Eye, Clock, User } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { useWriterStore } from '../../../store/writerStore';
import { CATEGORY_MAP, hexToRgb } from '../../../lib/writerUtils';

export function StoryReader() {
  const user = useAuthStore(s => s.user);
  const { stories, activeStoryId, likedStoryIds, setView, setActiveStory, toggleLike } = useWriterStore();

  const story = useMemo(
    () => stories.find(s => s.id === activeStoryId) ?? null,
    [stories, activeStoryId],
  );

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo?.(0, 0);
  }, [activeStoryId]);

  if (!story) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>Story not found</p>
          <button
            onClick={() => { setActiveStory(null); setView('hub'); }}
            className="mt-3 text-xs underline"
            style={{ color: 'var(--text-muted)' }}
          >
            Back to hub
          </button>
        </div>
      </div>
    );
  }

  const cat = CATEGORY_MAP[story.category];
  const liked = likedStoryIds.has(story.id);
  const date = new Date(story.created_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  // Rough reading time: ~200 words per minute
  const wordCount = story.content.split(/\s+/).length;
  const readMin = Math.max(1, Math.round(wordCount / 200));

  return (
    <div className="flex h-full flex-col">
      {/* ── Header bar ── */}
      <div
        className="flex items-center gap-3 px-6 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--panel-divider)' }}
      >
        <button
          onClick={() => { setActiveStory(null); setView('hub'); }}
          className="flex h-8 w-8 items-center justify-center rounded-xl transition-all flex-shrink-0"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.10)',
            color: 'var(--text-muted)',
          }}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        {/* Category tag */}
        <span
          className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold"
          style={{
            background: `rgba(${hexToRgb(cat.color)}, 0.15)`,
            border: `1px solid rgba(${hexToRgb(cat.color)}, 0.35)`,
            color: cat.color,
          }}
        >
          {cat.emoji} {cat.label}
        </span>

        <div className="flex-1" />

        {/* Stats */}
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            <Clock className="h-3 w-3" /> {readMin} min read
          </span>
          <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            <Eye className="h-3 w-3" /> {story.views}
          </span>
          <button
            onClick={() => user && toggleLike(story.id, user.id)}
            className="flex items-center gap-1 text-xs transition-all"
            style={{ color: liked ? '#ef4444' : 'var(--text-muted)' }}
          >
            <Heart className="h-3.5 w-3.5" style={{ fill: liked ? '#ef4444' : 'none' }} />
            {story.likes_count}
          </button>
        </div>
      </div>

      {/* ── Cover image hero (if present) ── */}
      {story.cover_image_url && (
        <div
          className="relative flex-shrink-0"
          style={{ height: 180, overflow: 'hidden' }}
        >
          <img
            src={story.cover_image_url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(transparent 40%, var(--sidebar-bg) 100%)' }}
          />
        </div>
      )}

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto scrollbar-aero">
        <div className="max-w-2xl mx-auto px-8 py-6">
          {/* Title */}
          <h1
            className="text-2xl font-bold leading-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            {story.title}
          </h1>

          {/* Author + date */}
          <div className="flex items-center gap-3 mt-3 mb-8">
            <div
              className="flex items-center gap-2 rounded-full px-3 py-1.5"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {story.author_avatar_url ? (
                <img src={story.author_avatar_url} className="h-5 w-5 rounded-full object-cover" alt="" />
              ) : (
                <User className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
              )}
              <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {story.author_username ?? 'Unknown'}
              </span>
            </div>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{date}</span>
          </div>

          {/* Story body */}
          <div
            className="prose-writer text-sm leading-relaxed whitespace-pre-wrap"
            style={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}
          >
            {story.content}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/corners/writers/StoryReader.tsx
git commit -m "feat: add StoryReader — reading view with cover hero, stats, author info"
```

---

### Task 9: StoryEditor + New Story Dialog

**Files:**
- Modify: `src/components/corners/writers/StoryEditor.tsx` (replace placeholder)

- [ ] **Step 1: Implement StoryEditor with inline category/cover selection**

```typescript
// src/components/corners/writers/StoryEditor.tsx
import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Upload, Trash2, Save, Globe, Lock, Users, Image } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { useWriterStore } from '../../../store/writerStore';
import { supabase } from '../../../lib/supabase';
import {
  CATEGORIES, CATEGORY_MAP,
  type StoryCategory, type StoryVisibility,
  hexToRgb,
} from '../../../lib/writerUtils';

const VISIBILITY_OPTIONS: { id: StoryVisibility; label: string; icon: typeof Globe }[] = [
  { id: 'private', label: 'Private', icon: Lock },
  { id: 'friends', label: 'Friends Only', icon: Users },
  { id: 'public', label: 'Public', icon: Globe },
];

export function StoryEditor() {
  const user = useAuthStore(s => s.user);
  const { activeStoryId, myStories, setView, setActiveStory, createStory, updateStory, deleteStory } =
    useWriterStore();

  const existingStory = activeStoryId ? myStories.find(s => s.id === activeStoryId) : null;
  const isNew = !existingStory;

  // ── Form state ─────────────────────────────────────────────
  const [step, setStep] = useState<'meta' | 'write'>(isNew ? 'meta' : 'write');
  const [title, setTitle] = useState(existingStory?.title ?? '');
  const [content, setContent] = useState(existingStory?.content ?? '');
  const [category, setCategory] = useState<StoryCategory>(existingStory?.category ?? 'fantasy');
  const [visibility, setVisibility] = useState<StoryVisibility>(existingStory?.visibility ?? 'private');
  const [coverUrl, setCoverUrl] = useState<string | null>(existingStory?.cover_image_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const cat = CATEGORY_MAP[category];
  const ACCENT = cat.color;

  // ── Cover upload ───────────────────────────────────────────
  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) { alert('Max 5 MB'); return; }

    setUploading(true);
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('story-covers').upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (!error) {
      const { data: urlData } = supabase.storage.from('story-covers').getPublicUrl(path);
      setCoverUrl(urlData.publicUrl);
    }
    setUploading(false);
  }

  // ── Save ───────────────────────────────────────────────────
  async function handleSave() {
    if (!user || !title.trim()) return;
    setSaving(true);

    if (isNew) {
      const id = await createStory({
        author_id: user.id,
        title: title.trim(),
        content,
        category,
        visibility,
        cover_image_url: coverUrl,
      });
      if (id) {
        setActiveStory(null);
        setView('hub');
      }
    } else {
      await updateStory(existingStory.id, {
        title: title.trim(),
        content,
        category,
        visibility,
        cover_image_url: coverUrl,
      });
      setActiveStory(null);
      setView('hub');
    }
    setSaving(false);
  }

  // ── Delete ─────────────────────────────────────────────────
  async function handleDelete() {
    if (!existingStory || !confirm('Delete this story permanently?')) return;
    await deleteStory(existingStory.id);
    setActiveStory(null);
    setView('hub');
  }

  // ── META STEP (category + cover + visibility selection) ────
  if (step === 'meta') {
    return (
      <div className="flex h-full flex-col">
        <div
          className="flex items-center gap-3 px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--panel-divider)' }}
        >
          <button
            onClick={() => { setActiveStory(null); setView('hub'); }}
            className="flex h-8 w-8 items-center justify-center rounded-xl flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text-muted)' }}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
            New Story
          </p>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-aero p-6">
          <div className="max-w-md mx-auto flex flex-col gap-6">
            {/* Category selection */}
            <div>
              <label className="text-xs font-bold mb-2 block" style={{ color: 'var(--text-secondary)' }}>
                Category
              </label>
              <div className="grid grid-cols-3 gap-2">
                {CATEGORIES.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setCategory(c.id)}
                    className="flex flex-col items-center gap-1 rounded-xl p-3 transition-all"
                    style={{
                      background: category === c.id ? `rgba(${hexToRgb(c.color)}, 0.18)` : 'rgba(255,255,255,0.04)',
                      border: category === c.id
                        ? `2px solid rgba(${hexToRgb(c.color)}, 0.50)`
                        : '1px solid rgba(255,255,255,0.08)',
                      color: category === c.id ? c.color : 'var(--text-muted)',
                    }}
                  >
                    <span style={{ fontSize: 20 }}>{c.emoji}</span>
                    <span className="text-[10px] font-bold">{c.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Cover image upload */}
            <div>
              <label className="text-xs font-bold mb-2 block" style={{ color: 'var(--text-secondary)' }}>
                Cover Image (optional)
              </label>
              {coverUrl ? (
                <div className="relative rounded-xl overflow-hidden" style={{ height: 120 }}>
                  <img src={coverUrl} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => setCoverUrl(null)}
                    className="absolute top-2 right-2 rounded-lg p-1.5"
                    style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="w-full rounded-xl p-6 flex flex-col items-center gap-2 transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '2px dashed rgba(255,255,255,0.12)',
                    color: 'var(--text-muted)',
                  }}
                >
                  {uploading ? (
                    <span className="text-xs">Uploading...</span>
                  ) : (
                    <>
                      <Image className="h-6 w-6" style={{ opacity: 0.4 }} />
                      <span className="text-xs">Click to upload (max 5 MB)</span>
                    </>
                  )}
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
            </div>

            {/* Visibility */}
            <div>
              <label className="text-xs font-bold mb-2 block" style={{ color: 'var(--text-secondary)' }}>
                Visibility
              </label>
              <div className="flex gap-2">
                {VISIBILITY_OPTIONS.map(v => {
                  const VIcon = v.icon;
                  return (
                    <button
                      key={v.id}
                      onClick={() => setVisibility(v.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition-all"
                      style={{
                        background: visibility === v.id ? `rgba(${hexToRgb(ACCENT)}, 0.15)` : 'rgba(255,255,255,0.04)',
                        border: visibility === v.id
                          ? `2px solid rgba(${hexToRgb(ACCENT)}, 0.40)`
                          : '1px solid rgba(255,255,255,0.08)',
                        color: visibility === v.id ? ACCENT : 'var(--text-muted)',
                      }}
                    >
                      <VIcon className="h-3.5 w-3.5" />
                      {v.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Continue button */}
            <button
              onClick={() => setStep('write')}
              className="w-full rounded-xl py-3 text-sm font-bold transition-all"
              style={{
                background: `linear-gradient(135deg, ${ACCENT}, ${cat.color}cc)`,
                color: '#fff',
                boxShadow: `0 4px 16px rgba(${hexToRgb(ACCENT)}, 0.35)`,
              }}
            >
              Continue to Writing
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── WRITE STEP (title + content editor) ────────────────────
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-6 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--panel-divider)' }}
      >
        <button
          onClick={() => isNew ? setStep('meta') : (() => { setActiveStory(null); setView('hub'); })()}
          className="flex h-8 w-8 items-center justify-center rounded-xl flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text-muted)' }}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <span
          className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold"
          style={{
            background: `rgba(${hexToRgb(cat.color)}, 0.15)`,
            border: `1px solid rgba(${hexToRgb(cat.color)}, 0.30)`,
            color: cat.color,
          }}
        >
          {cat.emoji} {cat.label}
        </span>

        <div className="flex-1" />

        {/* Word count */}
        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
          {content.split(/\s+/).filter(Boolean).length} words
        </span>

        {/* Delete (existing stories only) */}
        {!isNew && (
          <button
            onClick={handleDelete}
            className="flex h-8 w-8 items-center justify-center rounded-xl transition-all"
            style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving || !title.trim()}
          className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all"
          style={{
            background: `rgba(${hexToRgb(ACCENT)}, 0.18)`,
            border: `1px solid rgba(${hexToRgb(ACCENT)}, 0.40)`,
            color: ACCENT,
            opacity: saving || !title.trim() ? 0.5 : 1,
          }}
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? 'Saving...' : isNew ? 'Publish' : 'Save'}
        </button>
      </div>

      {/* Editor area */}
      <div className="flex-1 overflow-y-auto scrollbar-aero">
        <div className="max-w-2xl mx-auto px-8 py-6">
          {/* Title input */}
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Story title..."
            className="w-full bg-transparent text-2xl font-bold outline-none mb-4"
            style={{
              color: 'var(--text-primary)',
              border: 'none',
            }}
          />

          {/* Content textarea */}
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Start writing your story..."
            className="w-full bg-transparent text-sm outline-none resize-none"
            style={{
              color: 'var(--text-secondary)',
              lineHeight: 1.8,
              minHeight: 400,
              border: 'none',
            }}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/corners/writers/StoryEditor.tsx
git commit -m "feat: add StoryEditor — two-step flow: meta (category/cover/vis) then writing"
```

---

### Task 10: WriterApplication

**Files:**
- Modify: `src/components/corners/writers/WriterApplication.tsx` (replace placeholder)

- [ ] **Step 1: Implement WriterApplication**

```typescript
// src/components/corners/writers/WriterApplication.tsx
import { useState } from 'react';
import { ArrowLeft, PenTool, Send } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { useWriterStore } from '../../../store/writerStore';
import { hexToRgb } from '../../../lib/writerUtils';

const ACCENT = '#a855f7';

export function WriterApplication() {
  const user = useAuthStore(s => s.user);
  const { applicationPending, setView, applyForWriter } = useWriterStore();
  const [submitted, setSubmitted] = useState(false);

  async function handleApply() {
    if (!user) return;
    await applyForWriter(user.id);
    setSubmitted(true);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-6 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--panel-divider)' }}
      >
        <button
          onClick={() => setView('hub')}
          className="flex h-8 w-8 items-center justify-center rounded-xl flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text-muted)' }}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Apply to Write</p>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <div
            className="inline-flex h-16 w-16 items-center justify-center rounded-2xl mb-4"
            style={{
              background: `rgba(${hexToRgb(ACCENT)}, 0.15)`,
              border: `1px solid rgba(${hexToRgb(ACCENT)}, 0.30)`,
            }}
          >
            <PenTool className="h-8 w-8" style={{ color: ACCENT }} />
          </div>

          {applicationPending || submitted ? (
            <>
              <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                Application Submitted!
              </h2>
              <p className="text-sm mb-6" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Your application is being reviewed. You'll be able to write stories once approved by an admin.
              </p>
              <button
                onClick={() => setView('hub')}
                className="rounded-xl px-6 py-2.5 text-sm font-bold transition-all"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'var(--text-secondary)',
                }}
              >
                Back to Hub
              </button>
            </>
          ) : (
            <>
              <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                Become a Writer
              </h2>
              <p className="text-sm mb-6" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Writers can publish stories for the AeroChat community to read.
                Your application will be reviewed by an admin. Once approved, you'll
                see a "New Story" button in the hub.
              </p>
              <button
                onClick={handleApply}
                className="flex items-center gap-2 mx-auto rounded-xl px-6 py-3 text-sm font-bold transition-all"
                style={{
                  background: `linear-gradient(135deg, ${ACCENT}, #7c3aed)`,
                  color: '#fff',
                  boxShadow: `0 4px 16px rgba(${hexToRgb(ACCENT)}, 0.35)`,
                }}
              >
                <Send className="h-4 w-4" />
                Submit Application
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/corners/writers/WriterApplication.tsx
git commit -m "feat: add WriterApplication — apply for writer role"
```

---

### Task 11: AdminPanel (Dev Only)

**Files:**
- Modify: `src/components/corners/writers/AdminPanel.tsx` (replace placeholder)

- [ ] **Step 1: Implement AdminPanel**

```typescript
// src/components/corners/writers/AdminPanel.tsx
import { useEffect } from 'react';
import { ArrowLeft, Shield, Check, X } from 'lucide-react';
import { useWriterStore } from '../../../store/writerStore';
import { hexToRgb } from '../../../lib/writerUtils';

const GOLD = '#fbbf24';

export function AdminPanel() {
  const { pendingApplications, setView, fetchPendingApplications, approveWriter, rejectWriter } =
    useWriterStore();

  useEffect(() => {
    fetchPendingApplications();
  }, []);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-6 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--panel-divider)' }}
      >
        <button
          onClick={() => setView('hub')}
          className="flex h-8 w-8 items-center justify-center rounded-xl flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text-muted)' }}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0"
          style={{ background: `rgba(${hexToRgb(GOLD)}, 0.15)`, border: `1px solid rgba(${hexToRgb(GOLD)}, 0.30)` }}
        >
          <Shield className="h-5 w-5" style={{ color: GOLD }} />
        </div>
        <div>
          <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Admin Panel</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Manage writer applications</p>
        </div>
      </div>

      {/* Applications list */}
      <div className="flex-1 overflow-y-auto scrollbar-aero p-5">
        {pendingApplications.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-center">
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>No pending applications</p>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>All caught up!</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {pendingApplications.map(app => (
              <div
                key={app.user_id}
                className="flex items-center gap-3 rounded-2xl p-4"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.10)',
                }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    {app.username}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Applied {new Date(app.applied_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => approveWriter(app.user_id)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl transition-all"
                    style={{
                      background: 'rgba(34,197,94,0.15)',
                      border: '1px solid rgba(34,197,94,0.35)',
                      color: '#22c55e',
                    }}
                    title="Approve"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => rejectWriter(app.user_id)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl transition-all"
                    style={{
                      background: 'rgba(239,68,68,0.15)',
                      border: '1px solid rgba(239,68,68,0.35)',
                      color: '#ef4444',
                    }}
                    title="Reject"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/corners/writers/AdminPanel.tsx
git commit -m "feat: add AdminPanel — approve/reject writer applications (Dev role only)"
```

---

### Task 12: Mobile Support + Sidebar Integration

**Files:**
- Modify: `src/components/chat/Sidebar.tsx` (add Writers Corner button to mobile header)

- [ ] **Step 1: Add Writers Corner button to mobile header**

In `src/components/chat/Sidebar.tsx`, find the mobile header section where `Gamepad2` is rendered. Add a `PenTool` button next to it:

```tsx
import { PenTool } from 'lucide-react';

// In mobile header, next to the Gamepad2 button:
<PenTool
  className="h-5 w-5 cursor-pointer"
  style={{ color: 'var(--text-muted)' }}
  onClick={openWriterHub}
/>
```

Add `openWriterHub` to the cornerStore destructure at the top of the component.

- [ ] **Step 2: Build and test**

Run: `pnpm build`
Expected: Clean build with all components properly connected.

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/Sidebar.tsx
git commit -m "feat: add Writers Corner button to mobile sidebar header"
```

---

### Task 13: Final Build + Verify + Push

- [ ] **Step 1: Run full build**

```bash
cd aero-chat-app && pnpm build
```

Expected: Clean build, no TypeScript errors.

- [ ] **Step 2: Run tests**

```bash
pnpm test --run
```

Expected: All tests pass (existing tests should not break).

- [ ] **Step 3: Test manually on localhost**

```bash
pnpm dev
```

Verify on localhost:1420:
1. Writers Corner rail button (purple pen icon) appears in CornerRail
2. Clicking opens Writers Corner panel with slide-in animation
3. Onboarding popup shows on first visit
4. Hub shows empty state with category filters
5. Role badge shows "Reader" for normal users, "Dev" for DejanAdmin
6. "Apply to Write" button navigates to application form
7. Admin panel accessible to DejanAdmin via shield button
8. Back button returns to chat

- [ ] **Step 4: Commit any final fixes and push**

```bash
git push origin main
```

---

## Execution Notes

- **Migration 013 must be run in the Supabase SQL editor** before testing any DB operations. Without it, all store actions that touch `writer_roles`, `stories`, or `story_likes` will fail.
- The `set_updated_at()` function is created in migration 011 — migration 013 reuses it. Ensure 011 has been applied.
- The `story-covers` storage bucket requires the migration to exist. Cover image uploads will fail without it.
- All writer components are lazy-loaded via the `WritersCorner` import in ChatLayout, so they don't affect initial bundle size.
