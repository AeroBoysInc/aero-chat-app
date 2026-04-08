// src/components/ui/IdentityEditor.tsx
import { useState, useRef, useCallback } from 'react';
import { useAuthStore } from '../../store/authStore';
import {
  ACCENT_PRESETS, BANNER_PRESETS, CARD_EFFECTS,
  BIO_MAX_FREE, BIO_MAX_PREMIUM, STATUS_TEXT_MAX,
} from '../../lib/identityConstants';

export function IdentityEditor({ onClose }: { onClose: () => void }) {
  const user = useAuthStore(s => s.user);
  const updateIdentity = useAuthStore(s => s.updateIdentity);
  const isPremium = user?.is_premium === true;
  const bioMax = isPremium ? BIO_MAX_PREMIUM : BIO_MAX_FREE;

  const [bio, setBio] = useState(user?.bio ?? '');
  const [statusEmoji, setStatusEmoji] = useState(user?.custom_status_emoji ?? '');
  const [statusText, setStatusText] = useState(user?.custom_status_text ?? '');
  const [accentColor, setAccentColor] = useState(user?.accent_color ?? '#00d4ff');
  const [bannerGradient, setBannerGradient] = useState(user?.banner_gradient ?? 'ocean');
  const [cardEffect, setCardEffect] = useState(user?.card_effect ?? null);

  const bioTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const saveBanner = useCallback((id: string) => {
    setBannerGradient(id);
    updateIdentity({ banner_gradient: id });
  }, [updateIdentity]);

  const saveEffect = useCallback((id: string | null) => {
    setCardEffect(id);
    updateIdentity({ card_effect: id });
  }, [updateIdentity]);

  return (
    <div
      className="animate-fade-in"
      style={{
        position: 'absolute', top: '100%', left: 0, right: 0,
        marginTop: 4, zIndex: 30, borderRadius: 16, overflow: 'hidden',
        background: 'var(--popup-bg)', border: '1px solid var(--popup-border)',
        boxShadow: 'var(--popup-shadow)', backdropFilter: 'blur(28px)',
        padding: 14, maxHeight: 420, overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Edit Identity</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}>×</button>
      </div>

      {/* Custom Status */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Custom Status</label>
        <div style={{ display: 'flex', gap: 6 }}>
          <input value={statusEmoji} onChange={e => saveStatusEmoji(e.target.value.slice(0, 2))} placeholder="😊"
            style={{ width: 40, textAlign: 'center', padding: '6px 4px', borderRadius: 8, background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', fontSize: 14 }} />
          <input value={statusText} onChange={e => saveStatusText(e.target.value.slice(0, STATUS_TEXT_MAX))} placeholder="What's up?" maxLength={STATUS_TEXT_MAX}
            style={{ flex: 1, padding: '6px 10px', borderRadius: 8, background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', fontSize: 12 }} />
        </div>
      </div>

      {/* Bio */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>About Me <span style={{ opacity: 0.5 }}>({bio.length}/{bioMax})</span></label>
        <textarea value={bio} onChange={e => saveBio(e.target.value.slice(0, bioMax))} placeholder="Tell people about yourself..." rows={3}
          style={{ width: '100%', padding: '8px 10px', borderRadius: 10, resize: 'vertical', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', fontSize: 12, lineHeight: 1.5, boxSizing: 'border-box' }} />
      </div>

      {/* Accent Color */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Accent Color</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {ACCENT_PRESETS.map(p => (
            <button key={p.id} onClick={() => saveAccent(p.hex)} title={p.label}
              style={{ width: 28, height: 28, borderRadius: 8, background: p.hex, cursor: 'pointer', border: accentColor === p.hex ? '2px solid white' : '2px solid transparent', boxShadow: accentColor === p.hex ? `0 0 8px ${p.hex}60` : 'none', transition: 'border 0.15s, box-shadow 0.15s' }} />
          ))}
          {isPremium && (
            <input type="color" value={accentColor} onChange={e => saveAccent(e.target.value)} title="Custom color"
              style={{ width: 28, height: 28, borderRadius: 8, cursor: 'pointer', border: '2px solid var(--input-border)', padding: 0 }} />
          )}
        </div>
        {!isPremium && (
          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4, opacity: 0.6 }}>🔒 Aero Chat+ unlocks full color picker + gradient names</div>
        )}
      </div>

      {/* Banner Gradient */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Banner</label>
        <div style={{ display: 'flex', gap: 6 }}>
          {BANNER_PRESETS.map(b => (
            <button key={b.id} onClick={() => saveBanner(b.id)} title={b.id}
              style={{ width: 36, height: 24, borderRadius: 6, background: b.css, cursor: 'pointer', border: bannerGradient === b.id ? '2px solid white' : '2px solid transparent', transition: 'border 0.15s' }} />
          ))}
        </div>
      </div>

      {/* Card Effect */}
      <div>
        <label style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Card Effect {!isPremium && <span style={{ opacity: 0.5 }}>🔒 Premium</span>}</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <button onClick={() => isPremium && saveEffect(null)}
            style={{ padding: '4px 10px', borderRadius: 8, fontSize: 10, cursor: isPremium ? 'pointer' : 'default', background: !cardEffect ? 'var(--input-focus-border)' : 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', opacity: isPremium ? 1 : 0.4 }}>None</button>
          {CARD_EFFECTS.map(ef => (
            <button key={ef.id} onClick={() => isPremium && saveEffect(ef.id)} title={ef.description}
              style={{ padding: '4px 10px', borderRadius: 8, fontSize: 10, cursor: isPremium ? 'pointer' : 'default', background: cardEffect === ef.id ? 'var(--input-focus-border)' : 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', opacity: isPremium ? 1 : 0.4 }}>{ef.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
