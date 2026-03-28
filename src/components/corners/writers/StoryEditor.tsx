import { useState, useRef } from 'react';
import { ArrowLeft, Trash2, Save, Globe, Lock, Users, Image } from 'lucide-react';
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

  async function handleDelete() {
    if (!existingStory || !confirm('Delete this story permanently?')) return;
    await deleteStory(existingStory.id);
    setActiveStory(null);
    setView('hub');
  }

  // ── META STEP ──────────────────────────────────────────────
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

  // ── WRITE STEP ─────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col">
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

        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
          {content.split(/\s+/).filter(Boolean).length} words
        </span>

        {!isNew && (
          <button
            onClick={handleDelete}
            className="flex h-8 w-8 items-center justify-center rounded-xl transition-all"
            style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}

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

      <div className="flex-1 overflow-y-auto scrollbar-aero">
        <div className="max-w-2xl mx-auto px-8 py-6">
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
