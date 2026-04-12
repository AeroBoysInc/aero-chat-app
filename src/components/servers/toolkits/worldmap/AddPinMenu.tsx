// src/components/servers/toolkits/worldmap/AddPinMenu.tsx
import { memo, useEffect, useRef } from 'react';
import { PIN_TYPE_PRESETS, type PinTypePreset } from '../../../../lib/pinTypePresets';

export const AddPinMenu = memo(function AddPinMenu({
  x,
  y,
  onSelect,
  onClose,
}: {
  x: number;
  y: number;
  onSelect: (preset: PinTypePreset) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [onClose]);

  // Clamp to viewport
  const style: React.CSSProperties = {
    position: 'fixed',
    left: x,
    top: y,
    zIndex: 50,
    width: 220,
    borderRadius: 14,
    overflow: 'hidden',
    background: 'rgba(18,18,32,0.97)',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
    backdropFilter: 'blur(16px)',
  };

  return (
    <div ref={ref} style={style}>
      <div style={{
        padding: '10px 14px 6px', fontSize: 10, fontWeight: 700,
        color: 'var(--tk-gold, #FFD700)', letterSpacing: '0.04em', textTransform: 'uppercase',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        Add Pin
      </div>
      {PIN_TYPE_PRESETS.map(preset => (
        <button
          key={preset.key}
          onClick={() => onSelect(preset)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            width: '100%', padding: '9px 14px', fontSize: 12, color: '#ccc',
            background: 'transparent', border: 'none', cursor: 'pointer',
            textAlign: 'left', transition: 'background 0.12s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <span style={{ fontSize: 15, width: 22, textAlign: 'center' }}>{preset.emoji}</span>
          <span>{preset.label}</span>
        </button>
      ))}
    </div>
  );
});
