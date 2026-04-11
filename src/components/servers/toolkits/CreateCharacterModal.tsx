// src/components/servers/toolkits/CreateCharacterModal.tsx
import { memo, useState, useRef } from 'react';
import { X, Upload, FileText } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { useServerStore } from '../../../store/serverStore';
import { useDndCharacterStore } from '../../../store/dndCharacterStore';
import { supabase } from '../../../lib/supabase';
import { parseCharacterPdf } from '../../../lib/parseCharacterPdf';
import type { ParsedCharacter } from '../../../lib/parseCharacterPdf';

type Step = 'import' | 'review' | 'images';

export const CreateCharacterModal = memo(function CreateCharacterModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const user = useAuthStore(s => s.user);
  const selectedServerId = useServerStore(s => s.selectedServerId);
  const { upsertCharacter } = useDndCharacterStore();

  const [step, setStep] = useState<Step>('import');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState<ParsedCharacter>({
    name: '', species: '', class: '', level: 1,
    hp_current: 0, hp_max: 0, xp_current: 0, xp_max: 0,
    gold: 0, armor_class: 10,
    stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  });

  const [portraitFile, setPortraitFile] = useState<File | null>(null);
  const [portraitPreview, setPortraitPreview] = useState<string | null>(null);
  const [bgFile, setBgFile] = useState<File | null>(null);
  const [bgPreview, setBgPreview] = useState<string | null>(null);
  const portraitRef = useRef<HTMLInputElement>(null);
  const bgRef = useRef<HTMLInputElement>(null);

  const setField = (key: string, value: string | number) =>
    setForm(f => ({ ...f, [key]: value }));
  const setStat = (key: string, value: number) =>
    setForm(f => ({ ...f, stats: { ...f.stats, [key]: value } }));

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const parsed = await parseCharacterPdf(file);
      setForm(parsed);
      setStep('review');
    } catch (err) {
      setError('Could not parse this PDF. You can fill in the fields manually instead.');
      console.error('[CreateCharacterModal] PDF parse error:', err);
    }
    setLoading(false);
  };

  const handlePortraitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPortraitFile(file);
    setPortraitPreview(URL.createObjectURL(file));
  };
  const handleBgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBgFile(file);
    setBgPreview(URL.createObjectURL(file));
  };

  async function uploadImage(file: File, suffix: string): Promise<string | null> {
    if (!user) return null;
    const path = `${user.id}/${Date.now()}-${suffix}`;
    const { error: upErr } = await supabase.storage.from('dnd-assets').upload(path, file);
    if (upErr) { console.error('[CreateCharacterModal] Upload error:', upErr); return null; }
    const { data } = supabase.storage.from('dnd-assets').getPublicUrl(path);
    return data.publicUrl;
  }

  const handleSubmit = async () => {
    if (!user || !selectedServerId || !form.name.trim()) { setError('Character name is required.'); return; }
    setLoading(true);
    setError('');

    const portrait_url = portraitFile ? await uploadImage(portraitFile, 'portrait') : null;
    const background_url = bgFile ? await uploadImage(bgFile, 'background') : null;

    const res = await upsertCharacter({
      server_id: selectedServerId,
      user_id: user.id,
      name: form.name.trim(),
      species: form.species,
      class: form.class,
      level: form.level,
      portrait_url,
      background_url,
      hp_current: form.hp_current,
      hp_max: form.hp_max,
      xp_current: form.xp_current,
      xp_max: form.xp_max,
      gold: form.gold,
      stats: form.stats,
      armor_class: form.armor_class,
    });
    setLoading(false);
    if (res.error) { setError(res.error); return; }
    onClose();
  };

  const inp = (value: string | number, onChange: (v: string) => void, placeholder: string, type: 'text' | 'number' = 'text', flex?: number) => (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        padding: '9px 12px', borderRadius: 8, fontSize: 12, flex,
        background: 'rgba(255,255,255,0.04)', border: '1px solid var(--tk-border, var(--panel-divider))',
        color: 'var(--tk-text, var(--text-primary))', outline: 'none', width: flex ? undefined : '100%',
      }}
    />
  );

  return (
    <div
      className="animate-fade-in"
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        backdropFilter: 'blur(20px)', background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 480, maxHeight: '85vh', borderRadius: 20, overflow: 'hidden',
          background: 'var(--sidebar-bg)', border: '1px solid var(--tk-border, var(--panel-divider))',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--tk-border, var(--panel-divider))' }}>
          <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--tk-text, var(--text-primary))' }}>
            {step === 'import' ? 'Create Character' : step === 'review' ? 'Review Character Info' : 'Character Images'}
          </span>
          <button onClick={onClose} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {step === 'import' && (
            <div>
              <p style={{ fontSize: 12, color: 'var(--tk-text-muted, var(--text-muted))', marginBottom: 16, lineHeight: 1.5 }}>
                Upload your D&D Beyond character sheet PDF to auto-fill your card, or skip to enter details manually.
              </p>
              <label
                className="flex flex-col items-center justify-center gap-2 rounded-xl cursor-pointer transition-all hover:scale-[1.01]"
                style={{
                  padding: 28, border: '2px dashed var(--tk-border, var(--panel-divider))',
                  background: 'var(--tk-panel, rgba(0,180,255,0.04))',
                  marginBottom: 12,
                }}
              >
                <FileText className="h-8 w-8" style={{ color: 'var(--tk-accent-light, #D2691E)', opacity: 0.6 }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tk-text, var(--text-primary))' }}>
                  {loading ? 'Parsing PDF…' : 'Upload Character Sheet PDF'}
                </span>
                <span style={{ fontSize: 10, color: 'var(--tk-text-muted, var(--text-muted))' }}>
                  D&D Beyond exported PDFs work best
                </span>
                <input type="file" accept=".pdf" hidden onChange={handlePdfUpload} disabled={loading} />
              </label>
              <button
                onClick={() => setStep('review')}
                className="w-full text-center transition-opacity hover:opacity-80"
                style={{
                  padding: '10px 0', fontSize: 12, fontWeight: 500,
                  color: 'var(--tk-accent-light, #00d4ff)', background: 'none', border: 'none', cursor: 'pointer',
                }}
              >
                Skip — I'll enter details manually
              </button>
            </div>
          )}

          {step === 'review' && (
            <div className="flex flex-col gap-2.5">
              {inp(form.name, v => setField('name', v), 'Character name *')}
              <div className="flex gap-2">
                {inp(form.species, v => setField('species', v), 'Species', 'text', 1)}
                {inp(form.class, v => setField('class', v), 'Class', 'text', 1)}
              </div>
              <div className="flex gap-2">
                {inp(form.level, v => setField('level', parseInt(v, 10) || 1), 'Level', 'number', 1)}
                {inp(form.armor_class, v => setField('armor_class', parseInt(v, 10) || 10), 'AC', 'number', 1)}
                {inp(form.gold, v => setField('gold', parseInt(v, 10) || 0), 'Gold', 'number', 1)}
              </div>
              <div className="flex gap-2">
                {inp(form.hp_current, v => setField('hp_current', parseInt(v, 10) || 0), 'HP current', 'number', 1)}
                {inp(form.hp_max, v => setField('hp_max', parseInt(v, 10) || 0), 'HP max', 'number', 1)}
              </div>
              <div className="flex gap-2">
                {inp(form.xp_current, v => setField('xp_current', parseInt(v, 10) || 0), 'XP current', 'number', 1)}
                {inp(form.xp_max, v => setField('xp_max', parseInt(v, 10) || 0), 'XP max', 'number', 1)}
              </div>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--tk-text-muted, var(--text-muted))', marginTop: 4 }}>Ability Scores</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map(key => (
                  <div key={key} className="flex items-center gap-1.5">
                    <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--tk-text-muted, var(--text-muted))', width: 28, textTransform: 'uppercase' }}>{key}</span>
                    <input
                      type="number"
                      value={form.stats[key]}
                      onChange={e => setStat(key, parseInt(e.target.value, 10) || 10)}
                      style={{
                        width: '100%', padding: '6px 8px', borderRadius: 6, fontSize: 12, textAlign: 'center',
                        background: 'rgba(255,255,255,0.04)', border: '1px solid var(--tk-border, var(--panel-divider))',
                        color: 'var(--tk-text, var(--text-primary))', outline: 'none',
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 'images' && (
            <div>
              <p style={{ fontSize: 12, color: 'var(--tk-text-muted, var(--text-muted))', marginBottom: 16, lineHeight: 1.5 }}>
                Upload a portrait for your character and optionally a background image for the card.
              </p>
              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={() => portraitRef.current?.click()}
                  style={{
                    width: 64, height: 64, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
                    background: portraitPreview ? `url(${portraitPreview}) center/cover` : 'rgba(255,255,255,0.04)',
                    border: '2px dashed var(--tk-border, var(--panel-divider))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--tk-text-muted, var(--text-muted))',
                  }}
                >
                  {!portraitPreview && <Upload className="h-5 w-5" />}
                </button>
                <input ref={portraitRef} type="file" accept="image/*" hidden onChange={handlePortraitChange} />
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--tk-text, var(--text-primary))' }}>Portrait</p>
                  <p style={{ fontSize: 10, color: 'var(--tk-text-muted, var(--text-muted))' }}>
                    {portraitFile ? portraitFile.name : 'Click to upload (optional)'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => bgRef.current?.click()}
                  style={{
                    width: 64, height: 40, borderRadius: 8, flexShrink: 0, cursor: 'pointer',
                    background: bgPreview ? `url(${bgPreview}) center/cover` : 'rgba(255,255,255,0.04)',
                    border: '2px dashed var(--tk-border, var(--panel-divider))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--tk-text-muted, var(--text-muted))',
                  }}
                >
                  {!bgPreview && <Upload className="h-4 w-4" />}
                </button>
                <input ref={bgRef} type="file" accept="image/*" hidden onChange={handleBgChange} />
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--tk-text, var(--text-primary))' }}>Background</p>
                  <p style={{ fontSize: 10, color: 'var(--tk-text-muted, var(--text-muted))' }}>
                    {bgFile ? bgFile.name : 'Optional — decorates your card'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <p style={{ fontSize: 11, color: '#e53935', marginTop: 10, padding: '6px 10px', borderRadius: 8, background: 'rgba(229,57,53,0.08)' }}>
              {error}
            </p>
          )}
        </div>

        {/* Footer buttons */}
        <div className="flex gap-2.5 px-5 py-3 flex-shrink-0" style={{ borderTop: '1px solid var(--tk-border, var(--panel-divider))' }}>
          {step === 'review' && (
            <button
              onClick={() => setStep('import')}
              className="flex-1 transition-all active:scale-[0.98]"
              style={{
                padding: '10px 0', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: 'rgba(255,255,255,0.04)', border: '1px solid var(--tk-border, var(--panel-divider))',
                color: 'var(--tk-text-muted, var(--text-muted))',
              }}
            >
              Back
            </button>
          )}
          {step === 'images' && (
            <button
              onClick={() => setStep('review')}
              className="flex-1 transition-all active:scale-[0.98]"
              style={{
                padding: '10px 0', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: 'rgba(255,255,255,0.04)', border: '1px solid var(--tk-border, var(--panel-divider))',
                color: 'var(--tk-text-muted, var(--text-muted))',
              }}
            >
              Back
            </button>
          )}
          {step === 'review' && (
            <button
              onClick={() => { if (!form.name.trim()) { setError('Character name is required.'); return; } setError(''); setStep('images'); }}
              className="flex-1 transition-all active:scale-[0.98]"
              style={{
                padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                background: 'linear-gradient(135deg, #8B4513, #D2691E)',
                border: 'none', color: '#fff',
              }}
            >
              Next — Add Images
            </button>
          )}
          {step === 'images' && (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 transition-all active:scale-[0.98] disabled:opacity-50"
              style={{
                padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                background: 'linear-gradient(135deg, #8B4513, #D2691E)',
                border: 'none', color: '#fff',
              }}
            >
              {loading ? 'Creating…' : 'Create Character'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
