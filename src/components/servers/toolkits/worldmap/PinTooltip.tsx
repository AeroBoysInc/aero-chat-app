import { memo } from 'react';
import type { DndMapPin } from '../../../../lib/serverTypes';
import { PIN_TYPE_MAP } from '../../../../lib/pinTypePresets';

export const PinTooltip = memo(function PinTooltip({
  pin,
  visible,
}: {
  pin: DndMapPin;
  visible: boolean;
}) {
  const preset = PIN_TYPE_MAP[pin.pin_type];
  const typeLabel = preset ? preset.label : pin.pin_type;

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        bottom: '100%',
        marginBottom: 12,
        width: 200,
        borderRadius: 14,
        overflow: 'hidden',
        background: 'rgba(18,18,32,0.97)',
        border: `1px solid ${pin.color}30`,
        boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
        opacity: visible ? 1 : 0,
        pointerEvents: 'none',
        transform: `translateX(-50%) scale(${visible ? 1 : 0.95})`,
        transition: 'opacity 0.2s ease, transform 0.2s ease',
        zIndex: 20,
      }}
    >
      {/* Header image or gradient */}
      <div
        style={{
          height: 70,
          background: pin.header_image_url
            ? `url(${pin.header_image_url}) center/cover`
            : `linear-gradient(135deg, ${pin.color}40, ${pin.color}15)`,
          position: 'relative',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 40%, rgba(18,18,32,0.8) 100%)' }} />
      </div>
      <div style={{ padding: '8px 12px 10px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: pin.color }}>{pin.name}</div>
        <div style={{ fontSize: 9, color: '#888', marginTop: 2 }}>{pin.emoji} {typeLabel}</div>
      </div>
    </div>
  );
});
