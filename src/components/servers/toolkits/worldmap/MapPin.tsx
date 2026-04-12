import { memo, useState, useCallback, useRef } from 'react';
import type { DndMapPin } from '../../../../lib/serverTypes';
import { PinTooltip } from './PinTooltip';

export const MapPin = memo(function MapPin({
  pin,
  scale,
  isDm,
  imageWidth,
  imageHeight,
  onPinClick,
  onPinMove,
}: {
  pin: DndMapPin;
  scale: number; // effectiveScale
  isDm: boolean;
  imageWidth: number;
  imageHeight: number;
  onPinClick: (pin: DndMapPin) => void;
  onPinMove: (pin: DndMapPin, newX: number, newY: number) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const dragStart = useRef({ x: 0, y: 0 });
  const moved = useRef(false);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    dragStart.current = { x: e.clientX, y: e.clientY };
    moved.current = false;
    if (isDm) {
      setDragOffset({ x: 0, y: 0 });
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    e.stopPropagation();
  }, [isDm]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDm || !dragOffset) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved.current = true;
    setDragOffset({ x: dx, y: dy });
  }, [isDm, dragOffset]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const wasMoved = moved.current;
    const offset = dragOffset;
    moved.current = false;
    if (isDm && offset) {
      try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
      setDragOffset(null);
    }
    if (wasMoved && isDm && offset && imageWidth > 0 && imageHeight > 0 && scale > 0) {
      const dxPct = (offset.x / scale) / imageWidth * 100;
      const dyPct = (offset.y / scale) / imageHeight * 100;
      const newX = Math.max(0, Math.min(100, pin.x + dxPct));
      const newY = Math.max(0, Math.min(100, pin.y + dyPct));
      onPinMove(pin, newX, newY);
    } else {
      onPinClick(pin);
    }
  }, [isDm, dragOffset, scale, imageWidth, imageHeight, pin, onPinClick, onPinMove]);

  // Inverse scale so pins stay the same visual size regardless of zoom
  const inverseScale = 1 / scale;

  // Display position with live drag offset applied
  let displayX = pin.x;
  let displayY = pin.y;
  if (dragOffset && moved.current && imageWidth > 0 && imageHeight > 0 && scale > 0) {
    displayX = pin.x + (dragOffset.x / scale) / imageWidth * 100;
    displayY = pin.y + (dragOffset.y / scale) / imageHeight * 100;
  }

  const isDragging = dragOffset !== null && moved.current;

  return (
    <div
      data-pin
      data-pin-id={pin.id}
      style={{
        position: 'absolute',
        left: `${displayX}%`,
        top: `${displayY}%`,
        width: 44,
        height: 44,
        transform: `translate(-50%, -50%) scale(${inverseScale})`,
        cursor: isDm ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
        zIndex: hovered || isDragging ? 10 : 5,
        touchAction: 'none',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Pulse ring — exactly aligned with icon */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          border: `2px solid ${pin.color}`,
          opacity: 0,
          animation: isDragging ? 'none' : 'pin-pulse 2.5s ease-out infinite',
          pointerEvents: 'none',
        }}
      />

      {/* Icon circle — bigger, brighter, white ring for contrast */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
          background: `radial-gradient(circle at 30% 28%, ${pin.color}ff, ${pin.color}b0 60%, ${pin.color}90)`,
          border: '3px solid #ffffff',
          boxShadow: hovered || isDragging
            ? `0 4px 14px rgba(0,0,0,0.7), 0 0 24px ${pin.color}a0, 0 0 48px ${pin.color}55`
            : `0 3px 10px rgba(0,0,0,0.65), 0 0 16px ${pin.color}80`,
          transition: 'box-shadow 0.2s ease',
        }}
      >
        <span style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}>{pin.emoji}</span>
      </div>

      {/* Label pill — below icon, dark backdrop for readability over any map */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '100%',
          transform: 'translateX(-50%)',
          marginTop: 5,
          padding: '2px 9px',
          background: 'rgba(10,12,20,0.78)',
          border: `1px solid ${pin.color}90`,
          borderRadius: 10,
          backdropFilter: 'blur(4px)',
          fontSize: 10,
          fontWeight: 700,
          color: '#ffffff',
          letterSpacing: '0.02em',
          whiteSpace: 'nowrap',
          textShadow: '0 1px 2px rgba(0,0,0,0.9)',
          pointerEvents: 'none',
        }}
      >
        {pin.name}
      </div>

      {/* Tooltip */}
      <PinTooltip pin={pin} visible={hovered && !isDragging} />
    </div>
  );
});
