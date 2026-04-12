// src/components/servers/toolkits/worldmap/PinPopup.tsx
import { memo, useEffect, useCallback } from 'react';
import { X, Pencil, Trash2 } from 'lucide-react';
import type { DndMapPin } from '../../../../lib/serverTypes';
import { PIN_TYPE_MAP } from '../../../../lib/pinTypePresets';
import { generateHTML } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';

const extensions = [
  StarterKit,
  Underline,
  Link,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
];

export const PinPopup = memo(function PinPopup({
  pin,
  isDm,
  onClose,
  onEdit,
  onDelete,
}: {
  pin: DndMapPin | null;
  isDm: boolean;
  onClose: () => void;
  onEdit: (pin: DndMapPin) => void;
  onDelete: (pin: DndMapPin) => void;
}) {
  useEffect(() => {
    if (!pin) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [pin, onClose]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  if (!pin) return null;

  const preset = PIN_TYPE_MAP[pin.pin_type];
  const typeLabel = preset ? `${pin.emoji} ${preset.label}` : `${pin.emoji} ${pin.pin_type}`;

  // Render rich text from Tiptap JSON
  let descriptionHtml = '';
  if (pin.description && typeof pin.description === 'object' && 'type' in pin.description) {
    try {
      descriptionHtml = generateHTML(pin.description as Parameters<typeof generateHTML>[0], extensions);
    } catch {
      descriptionHtml = '';
    }
  }

  return (
    <div
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: 380,
          maxHeight: '85vh',
          borderRadius: 20,
          overflow: 'hidden',
          overflowY: 'auto',
          background: 'rgba(22,22,38,0.98)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
        }}
      >
        {/* Header image */}
        <div
          style={{
            height: 160,
            background: pin.header_image_url
              ? `url(${pin.header_image_url}) center/cover`
              : `linear-gradient(135deg, ${pin.color}60, ${pin.color}20)`,
            position: 'relative',
          }}
        >
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, background: 'linear-gradient(transparent, rgba(22,22,38,0.95))' }} />
          {/* Type badge */}
          <div style={{
            position: 'absolute', top: 12, right: 12,
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
            borderRadius: 8, padding: '4px 10px', fontSize: 10, fontWeight: 600, color: pin.color,
          }}>
            {typeLabel}
          </div>
          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: 12, left: 12, width: 28, height: 28, borderRadius: '50%',
              background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', border: 'none',
              color: '#aaa', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={14} />
          </button>
          {/* DM actions */}
          {isDm && (
            <div style={{ position: 'absolute', top: 12, left: 48, display: 'flex', gap: 6 }}>
              <button
                onClick={() => onEdit(pin)}
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', border: 'none',
                  color: '#aaa', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Pencil size={12} />
              </button>
              <button
                onClick={() => { if (confirm('Delete this pin?')) onDelete(pin); }}
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', border: 'none',
                  color: '#e05050', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ padding: '20px 24px 24px' }}>
          <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 22, fontWeight: 800, color: pin.color, marginBottom: 4 }}>
            {pin.name}
          </div>
          {pin.subtitle && (
            <div style={{ fontSize: 11, color: '#777', marginBottom: 16, fontStyle: 'italic' }}>{pin.subtitle}</div>
          )}
          <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${pin.color}25, transparent)`, margin: '14px 0' }} />
          {descriptionHtml ? (
            <div
              className="pin-popup-text"
              style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: 13, lineHeight: 1.8, color: '#bbb', textAlign: 'center',
              }}
              dangerouslySetInnerHTML={{ __html: descriptionHtml }}
            />
          ) : (
            <p style={{ fontSize: 12, color: '#555', textAlign: 'center', fontStyle: 'italic' }}>No description yet.</p>
          )}
        </div>
      </div>
    </div>
  );
});
