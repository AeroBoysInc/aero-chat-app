import { memo, useCallback, useRef, useState } from 'react';
import type { DndMapPin } from '../../../../lib/serverTypes';

export const Minimap = memo(function Minimap({
  imageUrl,
  pins,
  panX,
  panY,
  scale,
  containerWidth,
  containerHeight,
  onNavigate,
}: {
  imageUrl: string;
  pins: DndMapPin[];
  panX: number;
  panY: number;
  scale: number;
  containerWidth: number;
  containerHeight: number;
  onNavigate: (worldXPercent: number, worldYPercent: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  // Viewport rect in percentages
  const vx = containerWidth > 0 ? ((-panX / scale) / containerWidth) * 100 : 0;
  const vy = containerHeight > 0 ? ((-panY / scale) / containerHeight) * 100 : 0;
  const vw = containerWidth > 0 ? ((containerWidth / scale) / containerWidth) * 100 : 100;
  const vh = containerHeight > 0 ? ((containerHeight / scale) / containerHeight) * 100 : 100;

  const handleNav = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width;
    const my = (e.clientY - rect.top) / rect.height;
    onNavigate(mx * 100, my * 100);
  }, [onNavigate]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setDragging(true);
    handleNav(e);
    e.preventDefault();
    e.stopPropagation();
  }, [handleNav]);

  // Global move/up handlers for drag
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (dragging) handleNav(e);
  }, [dragging, handleNav]);

  const handleMouseUp = useCallback(() => setDragging(false), []);

  // Attach/detach global listeners
  const prevDragging = useRef(false);
  if (dragging !== prevDragging.current) {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    prevDragging.current = dragging;
  }

  return (
    <div
      ref={ref}
      onMouseDown={handleMouseDown}
      style={{
        position: 'absolute', bottom: 14, left: 14, zIndex: 15,
        width: 140, height: 95, borderRadius: 10, overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(8px)', cursor: 'pointer',
      }}
    >
      {/* Scaled map image */}
      <img
        src={imageUrl}
        alt=""
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.5 }}
        draggable={false}
      />
      {/* Viewport rectangle */}
      <div
        style={{
          position: 'absolute',
          left: `${vx}%`, top: `${vy}%`,
          width: `${vw}%`, height: `${vh}%`,
          border: '1.5px solid rgba(0,180,255,0.6)',
          borderRadius: 2,
          background: 'rgba(0,180,255,0.08)',
          pointerEvents: 'none',
          transition: 'all 0.15s ease',
        }}
      />
      {/* Pin dots */}
      {pins.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}%`, top: `${p.y}%`,
            width: 4, height: 4, borderRadius: '50%',
            background: p.color, pointerEvents: 'none',
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}
    </div>
  );
});
