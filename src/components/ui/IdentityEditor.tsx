// src/components/ui/IdentityEditor.tsx
import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Loader2, Upload, Trash2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import {
  ACCENT_PRESETS, CARD_EFFECTS,
  BIO_MAX_FREE, BIO_MAX_PREMIUM, STATUS_TEXT_MAX,
  NAME_EFFECTS_FREE, NAME_EFFECTS_PREMIUM,
} from '../../lib/identityConstants';
import { CARD_GRADIENTS } from '../../lib/cardGradients';
import { AccentName } from './AccentName';

export function IdentityEditor({ onClose }: { onClose: () => void }) {
  const user = useAuthStore(s => s.user);
  const updateIdentity = useAuthStore(s => s.updateIdentity);
  const isPremium = user?.is_premium === true;
  const bioMax = isPremium ? BIO_MAX_PREMIUM : BIO_MAX_FREE;

  const [bio, setBio] = useState(user?.bio ?? '');
  const [statusEmoji, setStatusEmoji] = useState(user?.custom_status_emoji ?? '');
  const [statusText, setStatusText] = useState(user?.custom_status_text ?? '');
  const [accentColor, setAccentColor] = useState(user?.accent_color ?? '#00d4ff');
  const [cardEffect, setCardEffect] = useState(user?.card_effect ?? null);
  const [nameEffect, setNameEffect] = useState(user?.name_effect ?? null);
  const [cardGradient, setCardGradient] = useState(user?.card_gradient ?? 'ocean');
  const [cardImageUploading, setCardImageUploading] = useState(false);
  const [cardImageError, setCardImageError] = useState('');
  const cardImageInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const bioTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Escape key to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const saveBio = useCallback((val: string) => {
    setBio(val);
    if (bioTimerRef.current) clearTimeout(bioTimerRef.current);
    bioTimerRef.current = setTimeout(() => {
      updateIdentity({ bio: val || null });
    }, 600);
  }, [updateIdentity]);

  const saveStatusText = useCallback((val: string) => {
    setStatusText(val);
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => {
      updateIdentity({ custom_status_text: val || null });
    }, 600);
  }, [updateIdentity]);

  const saveStatusEmoji = useCallback((val: string) => {
    setStatusEmoji(val);
    updateIdentity({ custom_status_emoji: val || null });
  }, [updateIdentity]);

  const saveAccent = useCallback((hex: string) => {
    setAccentColor(hex);
    updateIdentity({ accent_color: hex });
  }, [updateIdentity]);

  const saveCardGradient = useCallback((id: string) => {
    setCardGradient(id);
    updateIdentity({ card_gradient: id, card_image_url: null, card_image_params: null });
  }, [updateIdentity]);

  const handleCardImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    e.target.value = '';
    setCardImageError('');
    if (file.size > 10 * 1024 * 1024) { setCardImageError('Image must be under 10MB'); return; }
    setCardImageUploading(true);
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      const maxW = 500;
      const scale = bitmap.width > maxW ? maxW / bitmap.width : 1;
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
      await updateIdentity({ card_image_url: dataUrl, card_image_params: { zoom: 1.5, x: 50, y: 50 } });
    } catch (err: any) {
      setCardImageError(err.message ?? 'Upload failed');
    } finally {
      setCardImageUploading(false);
    }
  }, [user, updateIdentity]);

  const clearCardImage = useCallback(() => {
    updateIdentity({ card_image_url: null, card_image_params: null });
  }, [updateIdentity]);

  const saveEffect = useCallback((id: string | null) => {
    setCardEffect(id);
    updateIdentity({ card_effect: id });
  }, [updateIdentity]);

  const saveNameEffect = useCallback((id: string | null) => {
    setNameEffect(id);
    updateIdentity({ name_effect: id });
  }, [updateIdentity]);

  const sectionLabel: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: '0.06em', color: 'var(--popup-text-muted)',
    display: 'block', marginBottom: 8,
  };

  const sectionWrap: React.CSSProperties = {
    padding: '14px 0',
    borderBottom: '1px solid var(--popup-divider)',
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="animate-fade-in"
        onClick={e => e.stopPropagation()}
        style={{
          width: 420, maxWidth: '92vw', maxHeight: '85vh',
          borderRadius: 20, overflow: 'hidden',
          background: 'var(--popup-bg)',
          border: '1px solid var(--popup-border)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.25), 0 0 1px rgba(255,255,255,0.15), inset 0 1px 0 rgba(255,255,255,0.25)',
          backdropFilter: 'blur(32px)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--popup-divider)',
          flexShrink: 0,
        }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--popup-text)', margin: 0, fontFamily: 'Inter, system-ui, sans-serif' }}>
              Edit Identity
            </h2>
            <p style={{ fontSize: 11, color: 'var(--popup-text-muted)', margin: '2px 0 0' }}>
              Customize how others see you
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--popup-hover)', border: 'none',
              color: 'var(--popup-text-muted)', cursor: 'pointer',
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,60,60,0.12)'; e.currentTarget.style.color = '#ff4060'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--popup-hover)'; e.currentTarget.style.color = 'var(--popup-text-muted)'; }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>

          {/* ── Custom Status ── */}
          <div style={sectionWrap}>
            <label style={sectionLabel}>Custom Status</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={statusEmoji}
                onChange={e => saveStatusEmoji(e.target.value.slice(0, 2))}
                placeholder="😊"
                style={{
                  width: 44, textAlign: 'center', padding: '8px 4px',
                  borderRadius: 10, background: 'var(--popup-item-bg)',
                  border: '1px solid var(--popup-divider)',
                  color: 'var(--popup-text)', fontSize: 16,
                }}
              />
              <input
                value={statusText}
                onChange={e => saveStatusText(e.target.value.slice(0, STATUS_TEXT_MAX))}
                placeholder="What's happening?"
                maxLength={STATUS_TEXT_MAX}
                style={{
                  flex: 1, padding: '8px 12px',
                  borderRadius: 10, background: 'var(--popup-item-bg)',
                  border: '1px solid var(--popup-divider)',
                  color: 'var(--popup-text)', fontSize: 13,
                }}
              />
            </div>
          </div>

          {/* ── Bio ── */}
          <div style={sectionWrap}>
            <label style={sectionLabel}>
              About Me
              <span style={{ fontWeight: 400, opacity: 0.5, marginLeft: 6, textTransform: 'none', letterSpacing: 0 }}>
                {bio.length}/{bioMax}
              </span>
            </label>
            <textarea
              value={bio}
              onChange={e => saveBio(e.target.value.slice(0, bioMax))}
              placeholder="Tell people about yourself..."
              rows={3}
              style={{
                width: '100%', padding: '10px 12px',
                borderRadius: 12, resize: 'vertical',
                background: 'var(--popup-item-bg)',
                border: '1px solid var(--popup-divider)',
                color: 'var(--popup-text)', fontSize: 13,
                lineHeight: 1.5, boxSizing: 'border-box',
              }}
            />
          </div>

          {/* ── Accent Color ── */}
          <div style={sectionWrap}>
            <label style={sectionLabel}>Accent Color</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {ACCENT_PRESETS.map(p => (
                <button
                  key={p.id} onClick={() => saveAccent(p.hex)} title={p.label}
                  style={{
                    width: 32, height: 32, borderRadius: 10,
                    background: p.hex, cursor: 'pointer',
                    border: accentColor === p.hex ? '2.5px solid white' : '2.5px solid transparent',
                    boxShadow: accentColor === p.hex ? `0 0 12px ${p.hex}70` : 'none',
                    transition: 'border 0.15s, box-shadow 0.15s, transform 0.1s',
                    transform: accentColor === p.hex ? 'scale(1.1)' : 'scale(1)',
                  }}
                />
              ))}
              {isPremium && (
                <input
                  type="color" value={accentColor}
                  onChange={e => saveAccent(e.target.value)}
                  title="Custom color"
                  style={{
                    width: 32, height: 32, borderRadius: 10, cursor: 'pointer',
                    border: '2.5px solid var(--popup-divider)', padding: 0,
                  }}
                />
              )}
            </div>
            {!isPremium && (
              <p style={{ fontSize: 10, color: 'var(--popup-text-muted)', marginTop: 6, opacity: 0.6 }}>
                🔒 Aero Chat+ unlocks full color picker + gradient names
              </p>
            )}
          </div>

          {/* ── Name Effect ── */}
          <div style={sectionWrap}>
            <label style={sectionLabel}>Name Effect</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <button
                onClick={() => saveNameEffect(null)}
                style={{
                  padding: '6px 14px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                  cursor: 'pointer',
                  background: !nameEffect ? 'var(--input-focus-border)' : 'var(--popup-item-bg)',
                  border: '1px solid var(--popup-divider)',
                  color: !nameEffect ? 'white' : 'var(--popup-text)',
                  transition: 'all 0.15s',
                }}
              >
                None
              </button>
              {NAME_EFFECTS_FREE.map(ef => (
                <button
                  key={ef.id} onClick={() => saveNameEffect(ef.id)}
                  style={{
                    padding: '6px 14px', borderRadius: 10, fontSize: 11,
                    cursor: 'pointer',
                    background: nameEffect === ef.id ? 'var(--input-focus-border)' : 'var(--popup-item-bg)',
                    border: '1px solid var(--popup-divider)', overflow: 'hidden',
                    transition: 'all 0.15s',
                  }}
                >
                  <AccentName name={ef.label} accentColor={accentColor} nameEffect={ef.id} playing animateOnHover={false} style={{ fontSize: 11 }} />
                </button>
              ))}
              {NAME_EFFECTS_PREMIUM.map(ef => (
                <button
                  key={ef.id} onClick={() => isPremium && saveNameEffect(ef.id)}
                  style={{
                    padding: '6px 14px', borderRadius: 10, fontSize: 11,
                    cursor: isPremium ? 'pointer' : 'default',
                    background: nameEffect === ef.id ? 'var(--input-focus-border)' : 'var(--popup-item-bg)',
                    border: '1px solid var(--popup-divider)',
                    opacity: isPremium ? 1 : 0.4, overflow: 'hidden',
                    transition: 'all 0.15s',
                  }}
                >
                  <AccentName name={ef.label} accentColor={accentColor} nameEffect={ef.id} playing animateOnHover={false} style={{ fontSize: 11 }} />
                  {!isPremium && <span style={{ fontSize: 9, marginLeft: 3 }}>🔒</span>}
                </button>
              ))}
            </div>
          </div>

          {/* ── Card Background ── */}
          <div style={sectionWrap}>
            <label style={sectionLabel}>Card Background</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              {CARD_GRADIENTS.map(g => (
                <button
                  key={g.id} onClick={() => saveCardGradient(g.id)}
                  title={g.id.charAt(0).toUpperCase() + g.id.slice(1)}
                  style={{
                    width: 32, height: 32, borderRadius: 10,
                    background: g.preview, cursor: 'pointer',
                    border: !user?.card_image_url && cardGradient === g.id ? '2.5px solid white' : '2.5px solid transparent',
                    boxShadow: !user?.card_image_url && cardGradient === g.id ? `0 0 12px ${g.preview}60` : 'none',
                    transition: 'border 0.15s, box-shadow 0.15s, transform 0.1s',
                    transform: !user?.card_image_url && cardGradient === g.id ? 'scale(1.1)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              {user?.card_image_url ? (
                <>
                  <div style={{ width: 100, height: 36, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--popup-divider)' }}>
                    <img src={user.card_image_url} alt="card bg" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <button
                    onClick={clearCardImage}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '6px 12px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                      color: '#ff4060', background: 'rgba(255,64,96,0.08)',
                      border: '1px solid rgba(255,64,96,0.18)', cursor: 'pointer',
                    }}
                  >
                    <Trash2 className="h-3 w-3" /> Remove
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => cardImageInputRef.current?.click()}
                    disabled={cardImageUploading}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 14px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                      cursor: 'pointer',
                      background: 'var(--popup-item-bg)',
                      border: '1px solid var(--popup-divider)',
                      color: 'var(--popup-text)',
                      transition: 'background 0.15s',
                    }}
                  >
                    {cardImageUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    Upload Image
                  </button>
                  <input ref={cardImageInputRef} type="file" accept="image/*" className="hidden" onChange={handleCardImageUpload} />
                </>
              )}
            </div>
            {cardImageError && <p style={{ fontSize: 10, color: '#ff4060', marginTop: 6 }}>{cardImageError}</p>}
          </div>

          {/* ── Card Effect ── */}
          <div style={{ ...sectionWrap, borderBottom: 'none', paddingBottom: 20 }}>
            <label style={sectionLabel}>
              Card Effect
              {!isPremium && <span style={{ fontWeight: 400, opacity: 0.5, marginLeft: 4 }}>🔒 Premium</span>}
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <button
                onClick={() => isPremium && saveEffect(null)}
                style={{
                  padding: '6px 14px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                  cursor: isPremium ? 'pointer' : 'default',
                  background: !cardEffect ? 'var(--input-focus-border)' : 'var(--popup-item-bg)',
                  border: '1px solid var(--popup-divider)',
                  color: !cardEffect ? 'white' : 'var(--popup-text)',
                  opacity: isPremium ? 1 : 0.4,
                  transition: 'all 0.15s',
                }}
              >
                None
              </button>
              {CARD_EFFECTS.map(ef => (
                <button
                  key={ef.id} onClick={() => isPremium && saveEffect(ef.id)}
                  title={ef.description}
                  style={{
                    padding: '6px 14px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                    cursor: isPremium ? 'pointer' : 'default',
                    background: cardEffect === ef.id ? 'var(--input-focus-border)' : 'var(--popup-item-bg)',
                    border: '1px solid var(--popup-divider)',
                    color: cardEffect === ef.id ? 'white' : 'var(--popup-text)',
                    opacity: isPremium ? 1 : 0.4,
                    transition: 'all 0.15s',
                  }}
                >
                  {ef.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
