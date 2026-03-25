import { useRef, useState, useCallback } from 'react';

export interface CropParams { zoom: number; x: number; y: number; }

interface Props {
  imageUrl: string;
  initialParams?: CropParams;
  onConfirm: (params: CropParams) => void;
  onCancel: () => void;
}

const PREVIEW_W = 284;
const PREVIEW_H = 96;

export function CardImageCropModal({ imageUrl, initialParams, onConfirm, onCancel }: Props) {
  const [zoom, setZoom] = useState(initialParams?.zoom ?? 1.5);
  const [x, setX]       = useState(initialParams?.x   ?? 50);
  const [y, setY]       = useState(initialParams?.y   ?? 50);

  const dragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';

    const sensitivity = 100 / (PREVIEW_W * zoom);

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const dx = ev.clientX - lastMouse.current.x;
      const dy = ev.clientY - lastMouse.current.y;
      lastMouse.current = { x: ev.clientX, y: ev.clientY };
      setX(prev => Math.max(0, Math.min(100, prev + dx * sensitivity)));
      setY(prev => Math.max(0, Math.min(100, prev + dy * sensitivity)));
    };
    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [zoom]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10001,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: 'var(--popup-bg)',
          border: '1px solid var(--popup-border)',
          borderRadius: 20,
          padding: '22px 24px',
          width: PREVIEW_W + 48,
          boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <p style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: 'var(--popup-text)', fontFamily: 'Inter, system-ui, sans-serif' }}>
          Adjust Card Background
        </p>

        {/* Preview */}
        <div
          onMouseDown={onMouseDown}
          style={{
            width: PREVIEW_W,
            height: PREVIEW_H,
            borderRadius: 12,
            overflow: 'hidden',
            cursor: 'grab',
            backgroundImage: `url(${imageUrl})`,
            backgroundSize: `${zoom * 100}%`,
            backgroundPosition: `${x}% ${y}%`,
            backgroundRepeat: 'no-repeat',
            border: '1px solid var(--panel-divider)',
            userSelect: 'none',
          }}
        />

        <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, system-ui, sans-serif' }}>
          Drag to reposition
        </p>

        {/* Zoom slider */}
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'Inter, system-ui, sans-serif' }}>Zoom</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'Inter, system-ui, sans-serif' }}>{Math.round(zoom * 100)}%</span>
          </div>
          <input
            type="range" min="1" max="3" step="0.02"
            value={zoom}
            onChange={e => setZoom(Number(e.target.value))}
            style={{ width: '100%', cursor: 'pointer', accentColor: '#1a6fd4' }}
          />
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '7px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
              background: 'var(--hover-bg)', color: 'var(--text-primary)',
              border: '1px solid var(--panel-divider)', cursor: 'pointer',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm({ zoom, x, y })}
            style={{
              padding: '7px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
              background: 'linear-gradient(135deg, #1a6fd4, #38ccf8)',
              color: 'white', border: 'none', cursor: 'pointer',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
