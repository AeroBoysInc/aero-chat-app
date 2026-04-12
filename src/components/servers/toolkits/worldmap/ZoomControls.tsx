import { memo } from 'react';

export const ZoomControls = memo(function ZoomControls({
  scale,
  onZoomIn,
  onZoomOut,
}: {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
}) {
  const btnStyle: React.CSSProperties = {
    width: 34, height: 34, borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(16px)',
    color: '#ccc', fontSize: 18, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };

  return (
    <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 15, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <button style={btnStyle} onClick={onZoomIn}>+</button>
      <button style={btnStyle} onClick={onZoomOut}>−</button>
      <div style={{ textAlign: 'center', fontSize: 9, color: '#666', fontWeight: 600, marginTop: 2 }}>
        {Math.round(scale * 100)}%
      </div>
    </div>
  );
});
