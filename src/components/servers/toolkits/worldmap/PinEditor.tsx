// src/components/servers/toolkits/worldmap/PinEditor.tsx
import { memo, useState, useCallback, useRef } from 'react';
import { X, Upload } from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import { PIN_TYPE_PRESETS, type PinTypePreset } from '../../../../lib/pinTypePresets';
import type { DndMapPin } from '../../../../lib/serverTypes';
import { supabase } from '../../../../lib/supabase';
import { useAuthStore } from '../../../../store/authStore';
import { useDndMapStore } from '../../../../store/dndMapStore';

interface PinEditorProps {
  mapId: string;
  serverId: string;
  /** Pre-filled coordinates for new pin (from right-click) */
  coords?: { x: number; y: number };
  /** Pre-filled preset (from AddPinMenu selection) */
  preset?: PinTypePreset;
  /** Existing pin to edit (null = create mode) */
  existingPin?: DndMapPin | null;
  onClose: () => void;
}

export const PinEditor = memo(function PinEditor({
  mapId,
  serverId,
  coords,
  preset: initialPreset,
  existingPin,
  onClose,
}: PinEditorProps) {
  const user = useAuthStore(s => s.user);
  const { createPin, updatePin } = useDndMapStore();

  const isEdit = !!existingPin;

  const [name, setName] = useState(existingPin?.name ?? '');
  const [subtitle, setSubtitle] = useState(existingPin?.subtitle ?? '');
  const [pinType, setPinType] = useState(existingPin?.pin_type ?? initialPreset?.key ?? 'custom');
  const [emoji, setEmoji] = useState(existingPin?.emoji ?? initialPreset?.emoji ?? '📍');
  const [color, setColor] = useState(existingPin?.color ?? initialPreset?.color ?? '#00B4FF');
  const [headerImageUrl, setHeaderImageUrl] = useState(existingPin?.header_image_url ?? '');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: (existingPin?.description && typeof existingPin.description === 'object' && 'type' in existingPin.description)
      ? existingPin.description
      : undefined,
  });

  const handlePresetChange = useCallback((key: string) => {
    setPinType(key);
    const p = PIN_TYPE_PRESETS.find(pr => pr.key === key);
    if (p) {
      setEmoji(p.emoji);
      setColor(p.color);
    }
  }, []);

  const handleImageUpload = useCallback(async (file: File) => {
    if (!user) return;
    const ext = file.name.split('.').pop() ?? 'png';
    const path = `pins/${serverId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('dnd-assets').upload(path, file);
    if (error) { console.error('Upload error:', error); return; }
    const { data } = supabase.storage.from('dnd-assets').getPublicUrl(path);
    setHeaderImageUrl(data.publicUrl);
  }, [user, serverId]);

  const handleSave = useCallback(async () => {
    if (!name.trim() || !user) return;
    setSaving(true);
    const desc = editor?.getJSON() ?? {};

    if (isEdit && existingPin) {
      await updatePin(existingPin.id, {
        name: name.trim(),
        subtitle: subtitle.trim(),
        pin_type: pinType,
        emoji,
        color,
        header_image_url: headerImageUrl || null,
        description: desc,
      });
    } else {
      await createPin({
        map_id: mapId,
        x: coords?.x ?? 50,
        y: coords?.y ?? 50,
        pin_type: pinType,
        emoji,
        name: name.trim(),
        subtitle: subtitle.trim(),
        description: desc,
        header_image_url: headerImageUrl || null,
        color,
        created_by: user.id,
      });
    }

    setSaving(false);
    onClose();
  }, [name, subtitle, pinType, emoji, color, headerImageUrl, editor, isEdit, existingPin, mapId, coords, user, onClose, createPin, updatePin]);

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: 10, fontSize: 12,
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    color: '#e0e0e0', outline: 'none',
  };

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 110, background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{
        width: 420, maxHeight: '90vh', borderRadius: 20, overflow: 'hidden', overflowY: 'auto',
        background: 'rgba(22,22,38,0.98)', border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#e0e0e0' }}>
            {isEdit ? 'Edit Pin' : 'New Pin'}
          </span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#888', cursor: 'pointer',
          }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Name */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: '#888', marginBottom: 4, display: 'block' }}>Name *</label>
            <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="Pin name" />
          </div>

          {/* Subtitle */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: '#888', marginBottom: 4, display: 'block' }}>Subtitle</label>
            <input style={inputStyle} value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="Short description" />
          </div>

          {/* Pin type + emoji + color row */}
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: '#888', marginBottom: 4, display: 'block' }}>Type</label>
              <select
                style={{ ...inputStyle, cursor: 'pointer' }}
                value={pinType}
                onChange={e => handlePresetChange(e.target.value)}
              >
                {PIN_TYPE_PRESETS.map(p => (
                  <option key={p.key} value={p.key}>{p.emoji} {p.label}</option>
                ))}
              </select>
            </div>
            <div style={{ width: 60 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: '#888', marginBottom: 4, display: 'block' }}>Emoji</label>
              <input style={{ ...inputStyle, textAlign: 'center' }} value={emoji} onChange={e => setEmoji(e.target.value)} />
            </div>
            <div style={{ width: 60 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: '#888', marginBottom: 4, display: 'block' }}>Color</label>
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                style={{ width: '100%', height: 34, borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', cursor: 'pointer' }}
              />
            </div>
          </div>

          {/* Header image */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: '#888', marginBottom: 4, display: 'block' }}>Header Image</label>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }}
              onChange={e => { if (e.target.files?.[0]) handleImageUpload(e.target.files[0]); }} />
            {headerImageUrl ? (
              <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', height: 80 }}>
                <img src={headerImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button onClick={() => setHeaderImageUrl('')} style={{
                  position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', fontSize: 10, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>✕</button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  ...inputStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  cursor: 'pointer', color: '#666',
                }}
              >
                <Upload size={12} /> Upload image
              </button>
            )}
          </div>

          {/* Tiptap editor */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: '#888', marginBottom: 4, display: 'block' }}>Description</label>
            {/* Toolbar */}
            {editor && (
              <div style={{
                display: 'flex', gap: 2, padding: '4px 6px', marginBottom: 4,
                background: 'rgba(255,255,255,0.03)', borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap',
              }}>
                {[
                  { label: 'B', cmd: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold'), style: { fontWeight: 700 } as React.CSSProperties },
                  { label: 'I', cmd: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic'), style: { fontStyle: 'italic' } as React.CSSProperties },
                  { label: 'U', cmd: () => editor.chain().focus().toggleUnderline().run(), active: editor.isActive('underline'), style: { textDecoration: 'underline' } as React.CSSProperties },
                  { label: 'H2', cmd: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive('heading', { level: 2 }) },
                  { label: 'H3', cmd: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), active: editor.isActive('heading', { level: 3 }) },
                  { label: '•', cmd: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive('bulletList') },
                  { label: '1.', cmd: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive('orderedList') },
                  { label: '❝', cmd: () => editor.chain().focus().toggleBlockquote().run(), active: editor.isActive('blockquote') },
                ].map((btn, i) => (
                  <button
                    key={i}
                    onClick={btn.cmd}
                    style={{
                      padding: '3px 8px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
                      background: btn.active ? 'rgba(255,255,255,0.1)' : 'transparent',
                      color: btn.active ? '#fff' : '#888', border: 'none',
                      ...(btn.style ?? {}),
                    }}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            )}
            <div style={{
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
              padding: '8px 12px', minHeight: 120, maxHeight: 200, overflowY: 'auto',
              fontSize: 13, color: '#ccc', lineHeight: 1.7,
            }}>
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          padding: '12px 20px 16px', borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          <button onClick={onClose} style={{
            padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600,
            background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#888', cursor: 'pointer',
          }}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            style={{
              padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600,
              background: !name.trim() || saving ? 'rgba(139,69,19,0.3)' : 'linear-gradient(135deg, #8B4513, #D2691E)',
              border: 'none', color: '#fff', cursor: name.trim() && !saving ? 'pointer' : 'default',
              opacity: !name.trim() || saving ? 0.5 : 1,
            }}
          >
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Pin'}
          </button>
        </div>
      </div>
    </div>
  );
});
