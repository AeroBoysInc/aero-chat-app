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
      {/* Header */}
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

      {/* Tabs + Category filters */}
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

        <div className="flex-1" />

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

      {/* Story feed */}
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
