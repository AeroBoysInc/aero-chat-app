// src/components/corners/AeroAgent.tsx
// Paper doll character renderer — stacks base + equipped item layers.

import { LAYER_ORDER } from '../../lib/avatarConfig';

interface AeroAgentProps {
  base: string;       // image src for the base character
  helmet?: string;
  armor?: string;
  weapon?: string;
  wings?: string;
}

/** Maps a layer name to its image src from props. */
function getLayerSrc(layer: string, props: AeroAgentProps): string | undefined {
  if (layer === 'base') return props.base;
  return props[layer as keyof Omit<AeroAgentProps, 'base'>];
}

export function AeroAgent({ base, helmet, armor, weapon, wings }: AeroAgentProps) {
  const props: AeroAgentProps = { base, helmet, armor, weapon, wings };

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      aspectRatio: '2816 / 1536',
    }}>
      {LAYER_ORDER.map((layer, i) => {
        const src = getLayerSrc(layer, props);
        if (!src) return null;
        return (
          <img
            key={layer}
            src={src}
            alt={layer}
            draggable={false}
            style={{
              position: i === 0 ? 'relative' : 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              zIndex: i + 1,
              pointerEvents: 'none',
            }}
          />
        );
      })}
    </div>
  );
}
