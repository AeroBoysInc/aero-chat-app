import { useState } from 'react';

export interface BubbleInstance {
  id: string;
  emoji: string;
  /** px from left edge of the chat message-list container */
  x: number;
  /** px from top edge of the chat message-list container */
  y: number;
}

interface Props {
  bubbles: BubbleInstance[];
  onRemove: (id: string) => void;
}

/** Angles for 8 pop-particles (consumed by the particle-fly keyframe via --a CSS var) */
const PARTICLE_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

/** Size of each bubble emoji container in pixels */
const BUBBLE_SIZE = 42;

// End-state offsets of @keyframes reaction-bubble-rise (100% frame).
// The outer positioner div jumps to this position when popping so that
// particles and the shockwave ring appear where the bubble actually is.
const RISE_END_DX = -3;   // translateX(-3px)
const RISE_END_DY = -268; // translateY(-268px)

function Bubble({ inst, onRemove }: { inst: BubbleInstance; onRemove: (id: string) => void }) {
  const [phase, setPhase] = useState<'rising' | 'popping'>('rising');

  // Rise animation ends → switch to pop phase
  const handleRiseEnd = (e: React.AnimationEvent<HTMLDivElement>) => {
    if (e.animationName === 'reaction-bubble-rise') setPhase('popping');
  };

  // Pop animation ends → remove bubble from parent state.
  // We use onAnimationEnd on the pop phase too (see sphere div below) for robustness
  // rather than a fixed timeout, so tab-backgrounding doesn't leave ghost elements.
  const handlePopEnd = (e: React.AnimationEvent<HTMLDivElement>) => {
    if (e.animationName === 'bubble-pop') onRemove(inst.id);
  };

  // When popping, shift the outer div to where the bubble visually ended up
  const left = inst.x - BUBBLE_SIZE / 2 + (phase === 'popping' ? RISE_END_DX : 0);
  const top  = inst.y - BUBBLE_SIZE / 2 + (phase === 'popping' ? RISE_END_DY : 0);

  return (
    // Outer positioner — position: absolute places this relative to data-bubble-container
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width: BUBBLE_SIZE,
        height: BUBBLE_SIZE,
        pointerEvents: 'none',
        zIndex: 50,
      }}
    >
      {/* Soap bubble sphere.
          .soap-bubble has position:absolute built in; we let it fill the outer 42×42 div. */}
      <div
        className="soap-bubble"
        onAnimationEnd={phase === 'rising' ? handleRiseEnd : handlePopEnd}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          animation: phase === 'rising'
            ? 'reaction-bubble-rise 2.2s cubic-bezier(0.3, 0, 0.7, 1) forwards'
            : 'bubble-pop 0.42s ease-out forwards',
        }}
      >
        {inst.emoji}
      </div>

      {/* Pop particles — only during pop phase */}
      {phase === 'popping' && PARTICLE_ANGLES.map(angle => (
        <div
          key={angle}
          style={{
            position: 'absolute',
            top: '50%', left: '50%',
            width: 6, height: 6,
            borderRadius: '50%',
            background: 'rgba(0,200,255,0.85)',
            animation: 'particle-fly 0.42s ease-out forwards',
            ['--a' as string]: `${angle}deg`,
            ['--d' as string]: '28px',
          }}
        />
      ))}

      {/* Shockwave ring — only during pop phase */}
      {phase === 'popping' && (
        <div
          style={{
            position: 'absolute',
            top: '50%', left: '50%',
            width: BUBBLE_SIZE,
            height: BUBBLE_SIZE,
            borderRadius: '50%',
            border: '1.5px solid rgba(0,200,255,0.6)',
            animation: 'pop-ring 0.42s ease-out forwards',
          }}
        />
      )}
    </div>
  );
}

/**
 * Renders ephemeral soap bubble animations for emoji reactions.
 * The parent container MUST have `position: relative` so bubbles are
 * positioned relative to it.
 */
export function BubbleLayer({ bubbles, onRemove }: Props) {
  if (bubbles.length === 0) return null;
  return (
    <>
      {bubbles.map(inst => (
        <Bubble key={inst.id} inst={inst} onRemove={onRemove} />
      ))}
    </>
  );
}
