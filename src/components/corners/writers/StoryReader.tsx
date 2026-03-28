import { useMemo } from 'react';
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

  const wordCount = story.content.split(/\s+/).length;
  const readMin = Math.max(1, Math.round(wordCount / 200));

  return (
    <div className="flex h-full flex-col">
      {/* Header bar */}
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

      {/* Cover image hero */}
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

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto scrollbar-aero">
        <div className="max-w-2xl mx-auto px-8 py-6">
          <h1
            className="text-2xl font-bold leading-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            {story.title}
          </h1>

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

          <div
            className="text-sm leading-relaxed whitespace-pre-wrap"
            style={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}
          >
            {story.content}
          </div>
        </div>
      </div>
    </div>
  );
}
