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
