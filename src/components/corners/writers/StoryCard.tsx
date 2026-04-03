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
      className="relative rounded-2xl cursor-pointer transition-all"
      style={{
        height: 140,
        overflow: 'visible',
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
      {/* Clipped background layers */}
      <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: 16 }}>
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
      </div>

      {/* ── Category tag — protrudes above card for 3D effect ── */}
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
