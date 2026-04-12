import { memo, useState, useCallback } from 'react';
import type { DndMapPin } from '../../../../lib/serverTypes';
import { PinTooltip } from './PinTooltip';

export const MapPin = memo(function MapPin({
  pin,
  scale,
  onPinClick,
}: {
  pin: DndMapPin;
  scale: number;
  onPinClick: (pin: DndMapPin) => void;
}) {
  const [hovered, setHovered] = useState(false);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onPinClick(pin);
  }, [pin, onPinClick]);

  // Inverse scale so pins stay the same visual size regardless of zoom
  const inverseScale = 1 / scale;

  return (
    <div
      data-pin
      style={{
        position: 'absolute',
        left: `${pin.x}%`,
        top: `${pin.y}%`,
        transform: `translate(-50%, -50%) scale(${inverseScale})`,
        cursor: 'pointer',
        textAlign: 'center',
        zIndex: hovered ? 10 : 5,
        transition: 'z-index 0s',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
    >
      {/* Pulse ring */}
      <div
        style={{
          position: 'absolute',
          inset: -6,
          borderRadius: '50%',
          border: `2px solid ${pin.color}`,
          opacity: 0,
          animation: 'pin-pulse 2.5s ease-out infinite',
          pointerEvents: 'none',
        }}
      />

      {/* Icon circle */}
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          background: `${pin.color}20`,
          border: `2px solid ${pin.color}90`,
          boxShadow: hovered
            ? `0 0 20px ${pin.color}60, 0 0 40px ${pin.color}20`
            : `0 0 12px ${pin.color}40`,
          transition: 'box-shadow 0.3s ease',
        }}
      >
        {pin.emoji}
      </div>

      {/* Label */}
      <div
        style={{
          marginTop: 5,
          fontSize: 9,
          fontWeight: 700,
          color: `${pin.color}`,
          textShadow: '0 1px 6px rgba(0,0,0,0.9), 0 0 12px rgba(0,0,0,0.5)',
          letterSpacing: '0.02em',
          whiteSpace: 'nowrap',
        }}
      >
        {pin.name}
      </div>

      {/* Tooltip */}
      <PinTooltip pin={pin} visible={hovered} />
    </div>
  );
});
