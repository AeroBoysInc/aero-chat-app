// src/components/ui/EmojiGifPicker.tsx
import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';
import {
  EMOJI_CATEGORIES, getByCategory, searchEmojis,
  loadRecentEmojis, saveRecentEmoji,
  type CategoryId,
} from '../../lib/emojiData';
import { fetchTrending, searchGifs, type TenorGif } from '../../lib/tenor';

export interface EmojiGifPickerProps {
  onEmojiSelect: (emoji: string) => void;
  onGifSelect: (gif: { url: string; width: number; height: number; previewUrl: string }) => void;
  userId: string;
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

export const EmojiGifPicker = memo(function EmojiGifPicker({
  onEmojiSelect, onGifSelect, userId, open, onClose, anchorRef,
}: EmojiGifPickerProps) {
  const [tab, setTab] = useState<'emoji' | 'gif'>('emoji');
  const [emojiSearch, setEmojiSearch] = useState('');
  const [gifSearch, setGifSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<CategoryId>('smileys');
  const [pos, setPos] = useState({ x: 0, y: 0 });

  // GIF state
  const [gifs, setGifs] = useState<TenorGif[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [gifError, setGifError] = useState(false);
  const [trendingCache, setTrendingCache] = useState<TenorGif[] | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const gifSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Recents
  const recents = useMemo(() => loadRecentEmojis(userId), [userId, open]);

  // Position calculation
  useEffect(() => {
    if (!open || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    // Position above the input, right-aligned
    setPos({ x: rect.right - 340, y: rect.top - 8 });
  }, [open, anchorRef]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    // Delay to avoid the opening click triggering close
    const t = setTimeout(() => document.addEventListener('mousedown', handleClick), 50);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handleClick); };
  }, [open, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // Load trending GIFs when GIF tab is opened
  useEffect(() => {
    if (!open || tab !== 'gif') return;
    if (gifSearch.trim()) return; // search is active, don't reload trending
    if (trendingCache) { setGifs(trendingCache); return; }
    setGifLoading(true);
    setGifError(false);
    fetchTrending()
      .then(results => { setGifs(results); setTrendingCache(results); })
      .catch(() => setGifError(true))
      .finally(() => setGifLoading(false));
  }, [open, tab, gifSearch, trendingCache]);

  // Debounced GIF search
  const handleGifSearchChange = useCallback((value: string) => {
    setGifSearch(value);
    if (gifSearchTimer.current) clearTimeout(gifSearchTimer.current);
    if (!value.trim()) {
      // Revert to trending
      if (trendingCache) setGifs(trendingCache);
      return;
    }
    gifSearchTimer.current = setTimeout(async () => {
      setGifLoading(true);
      setGifError(false);
      try {
        const results = await searchGifs(value);
        setGifs(results);
      } catch {
        setGifError(true);
      } finally {
        setGifLoading(false);
      }
    }, 300);
  }, [trendingCache]);

  const handleEmojiClick = useCallback((emoji: string) => {
    saveRecentEmoji(userId, emoji);
    onEmojiSelect(emoji);
  }, [userId, onEmojiSelect]);

  const handleGifClick = useCallback((gif: TenorGif) => {
    onGifSelect({ url: gif.url, width: gif.width, height: gif.height, previewUrl: gif.previewUrl });
    onClose();
  }, [onGifSelect, onClose]);

  // Emoji list to render
  const emojiList = useMemo(() => {
    if (emojiSearch.trim()) return searchEmojis(emojiSearch);
    return getByCategory(activeCategory);
  }, [emojiSearch, activeCategory]);

  if (!open) return null;

  return createPortal(
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        left: Math.max(8, pos.x),
        top: 'auto',
        bottom: window.innerHeight - pos.y,
        zIndex: 99980,
      }}
    >
      <div style={{
        width: 340, maxHeight: 420,
        borderRadius: 16, overflow: 'hidden',
        background: 'rgba(12,20,45,0.95)',
        border: '1px solid rgba(80,145,255,0.12)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 0 1px rgba(255,255,255,0.1)',
        backdropFilter: 'blur(20px)',
        display: 'flex', flexDirection: 'column',
        animation: 'profile-tooltip-fade 0.15s ease-out',
      }}>
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(80,145,255,0.10)', flexShrink: 0 }}>
          <button
            onClick={() => setTab('emoji')}
            style={{
              flex: 1, padding: '10px 0', fontSize: 12, fontWeight: tab === 'emoji' ? 600 : 500,
              color: tab === 'emoji' ? '#00d4ff' : 'rgba(255,255,255,0.35)',
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: tab === 'emoji' ? '2px solid #00d4ff' : '2px solid transparent',
            }}
          >
            😊 Emoji
          </button>
          <button
            onClick={() => setTab('gif')}
            style={{
              flex: 1, padding: '10px 0', fontSize: 12, fontWeight: tab === 'gif' ? 600 : 500,
              color: tab === 'gif' ? '#00d4ff' : 'rgba(255,255,255,0.35)',
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: tab === 'gif' ? '2px solid #00d4ff' : '2px solid transparent',
            }}
          >
            GIF
          </button>
        </div>

        {tab === 'emoji' ? (
          <>
            {/* Search */}
            <div style={{ padding: '8px 10px', flexShrink: 0 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                height: 32, borderRadius: 8, padding: '0 10px',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(80,145,255,0.10)',
              }}>
                <Search style={{ width: 13, height: 13, color: 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
                <input
                  value={emojiSearch}
                  onChange={e => setEmojiSearch(e.target.value)}
                  placeholder="Search emoji..."
                  style={{
                    flex: 1, background: 'none', border: 'none', outline: 'none',
                    color: 'rgba(255,255,255,0.85)', fontSize: 11,
                  }}
                />
                {emojiSearch && (
                  <button onClick={() => setEmojiSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', display: 'flex' }}>
                    <X style={{ width: 12, height: 12 }} />
                  </button>
                )}
              </div>
            </div>

            {/* Category bar — hidden when searching */}
            {!emojiSearch.trim() && (
              <div style={{ display: 'flex', gap: 2, padding: '0 10px 6px', overflowX: 'auto', flexShrink: 0 }}>
                {EMOJI_CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    title={cat.label}
                    style={{
                      padding: '4px 8px', borderRadius: 6, fontSize: 13, flexShrink: 0,
                      background: activeCategory === cat.id ? 'rgba(0,212,255,0.12)' : 'transparent',
                      border: 'none', cursor: 'pointer',
                      opacity: activeCategory === cat.id ? 1 : 0.5,
                      transition: 'opacity 0.15s, background 0.15s',
                    }}
                  >
                    {cat.icon}
                  </button>
                ))}
              </div>
            )}

            {/* Category label */}
            {!emojiSearch.trim() && (
              <div style={{ padding: '2px 12px 4px', fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
                {emojiSearch.trim() ? 'Search Results' : EMOJI_CATEGORIES.find(c => c.id === activeCategory)?.label}
              </div>
            )}

            {/* Recents row */}
            {!emojiSearch.trim() && recents.length > 0 && activeCategory === 'smileys' && (
              <>
                <div style={{ padding: '2px 12px 2px', fontSize: 10, color: 'rgba(255,255,255,0.25)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
                  Recently Used
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', padding: '0 8px 4px', flexShrink: 0 }}>
                  {recents.slice(0, 8).map((emoji, i) => (
                    <button
                      key={`recent-${i}`}
                      onClick={() => handleEmojiClick(emoji)}
                      style={{
                        width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 20, borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer',
                        transition: 'background 0.1s, transform 0.1s',
                      }}
                      onMouseEnter={e => { (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; (e.target as HTMLElement).style.transform = 'scale(1.15)'; }}
                      onMouseLeave={e => { (e.target as HTMLElement).style.background = 'none'; (e.target as HTMLElement).style.transform = 'scale(1)'; }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <div style={{ padding: '2px 12px 4px', fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
                  {EMOJI_CATEGORIES.find(c => c.id === activeCategory)?.label}
                </div>
              </>
            )}

            {/* Emoji grid */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)' }}>
                {(emojiSearch.trim() ? emojiList : emojiList).map((entry, i) => (
                  <button
                    key={`${entry.emoji}-${i}`}
                    onClick={() => handleEmojiClick(entry.emoji)}
                    title={entry.name}
                    style={{
                      width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 20, borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer',
                      transition: 'background 0.1s, transform 0.1s',
                    }}
                    onMouseEnter={e => { (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; (e.target as HTMLElement).style.transform = 'scale(1.15)'; }}
                    onMouseLeave={e => { (e.target as HTMLElement).style.background = 'none'; (e.target as HTMLElement).style.transform = 'scale(1)'; }}
                  >
                    {entry.emoji}
                  </button>
                ))}
              </div>
              {emojiSearch.trim() && emojiList.length === 0 && (
                <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                  No emojis found
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* GIF Search */}
            <div style={{ padding: '8px 10px', flexShrink: 0 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                height: 32, borderRadius: 8, padding: '0 10px',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(80,145,255,0.10)',
              }}>
                <Search style={{ width: 13, height: 13, color: 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
                <input
                  value={gifSearch}
                  onChange={e => handleGifSearchChange(e.target.value)}
                  placeholder="Search Tenor..."
                  style={{
                    flex: 1, background: 'none', border: 'none', outline: 'none',
                    color: 'rgba(255,255,255,0.85)', fontSize: 11,
                  }}
                />
                {gifSearch && (
                  <button onClick={() => handleGifSearchChange('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', display: 'flex' }}>
                    <X style={{ width: 12, height: 12 }} />
                  </button>
                )}
              </div>
            </div>

            {/* Label */}
            <div style={{ padding: '2px 12px 6px', fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
              {gifSearch.trim() ? 'Results' : 'Trending'}
            </div>

            {/* GIF grid */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 4px' }}>
              {gifLoading && gifs.length === 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} style={{
                      height: 70 + (i % 3) * 20, borderRadius: 8,
                      background: 'rgba(255,255,255,0.04)',
                      animation: 'profile-tooltip-fade 0.6s ease-in-out infinite alternate',
                    }} />
                  ))}
                </div>
              ) : gifError ? (
                <div style={{ textAlign: 'center', padding: '30px 0' }}>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>Couldn't load GIFs</p>
                  <button
                    onClick={() => {
                      setGifError(false);
                      setTrendingCache(null);
                      setGifSearch('');
                    }}
                    style={{
                      fontSize: 11, color: '#00d4ff', background: 'rgba(0,212,255,0.12)',
                      border: '1px solid rgba(0,212,255,0.25)', borderRadius: 8, padding: '4px 12px', cursor: 'pointer',
                    }}
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {gifs.map(gif => (
                    <button
                      key={gif.id}
                      onClick={() => handleGifClick(gif)}
                      style={{
                        border: 'none', padding: 0, cursor: 'pointer', background: 'none',
                        borderRadius: 8, overflow: 'hidden',
                        transition: 'transform 0.15s, box-shadow 0.15s',
                      }}
                      onMouseEnter={e => { (e.target as HTMLElement).style.transform = 'scale(1.03)'; (e.target as HTMLElement).style.boxShadow = '0 0 12px rgba(0,212,255,0.2)'; }}
                      onMouseLeave={e => { (e.target as HTMLElement).style.transform = 'scale(1)'; (e.target as HTMLElement).style.boxShadow = 'none'; }}
                    >
                      <img
                        src={gif.previewUrl}
                        alt=""
                        loading="lazy"
                        style={{
                          width: '100%', display: 'block',
                          borderRadius: 8,
                          aspectRatio: `${gif.width} / ${gif.height}`,
                          objectFit: 'cover',
                          background: 'rgba(255,255,255,0.04)',
                        }}
                      />
                    </button>
                  ))}
                </div>
              )}
              {!gifLoading && !gifError && gifs.length === 0 && gifSearch.trim() && (
                <div style={{ textAlign: 'center', padding: '30px 0', fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                  No GIFs found
                </div>
              )}
            </div>

            {/* Tenor attribution */}
            <div style={{ padding: '4px 12px 8px', fontSize: 9, color: 'rgba(255,255,255,0.2)', textAlign: 'right', flexShrink: 0 }}>
              Powered by Tenor
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
});
