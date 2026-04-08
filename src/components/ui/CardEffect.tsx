// src/components/ui/CardEffect.tsx
import React from 'react';

interface CardEffectProps {
  effect: string | null | undefined;
  playing: boolean;
}

const playState = (playing: boolean) => (playing ? 'running' : 'paused');

function ShimmerEffect({ playing }: { playing: boolean }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: '-100%',
        width: '60%',
        height: '100%',
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent)',
        transform: 'skewX(-20deg)',
        animation: `effect-shimmer 3s ease-in-out infinite`,
        animationPlayState: playState(playing),
      }}
    />
  );
}

const BUBBLE_ITEMS = [
  { size: 16, left: '15%', delay: '0s', dur: '3.5s' },
  { size: 12, left: '40%', delay: '0.8s', dur: '4s' },
  { size: 10, left: '65%', delay: '1.5s', dur: '3s' },
  { size: 14, left: '82%', delay: '0.4s', dur: '4.5s' },
  { size: 8,  left: '30%', delay: '2s', dur: '3.2s' },
];

function BubblesEffect({ playing }: { playing: boolean }) {
  return (
    <>
      {BUBBLE_ITEMS.map((b, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            bottom: 0,
            left: b.left,
            width: b.size,
            height: b.size,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)',
            animation: `effect-bubble-up ${b.dur} ease-in-out infinite`,
            animationDelay: b.delay,
            animationPlayState: playState(playing),
          }}
        />
      ))}
    </>
  );
}

const SPARKLE_ITEMS = [
  { top: '15%', left: '20%', delay: '0s', dur: '1.5s' },
  { top: '40%', left: '60%', delay: '0.4s', dur: '2s' },
  { top: '25%', left: '80%', delay: '0.9s', dur: '1.8s' },
  { top: '55%', left: '35%', delay: '1.3s', dur: '2.2s' },
  { top: '20%', left: '50%', delay: '1.8s', dur: '1.6s' },
  { top: '50%', left: '75%', delay: '0.6s', dur: '2.5s' },
];

function SparklesEffect({ playing }: { playing: boolean }) {
  return (
    <>
      {SPARKLE_ITEMS.map((s, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: s.top,
            left: s.left,
            width: 3,
            height: 3,
            borderRadius: '50%',
            background: 'white',
            animation: `effect-sparkle ${s.dur} ease-in-out infinite`,
            animationDelay: s.delay,
            animationPlayState: playState(playing),
          }}
        />
      ))}
    </>
  );
}

function AuroraEffect({ playing }: { playing: boolean }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(45deg, rgba(0,200,150,0.15), rgba(0,100,255,0.10), rgba(150,0,255,0.12))',
        backgroundSize: '200% 200%',
        animation: `effect-aurora 4s ease-in-out infinite alternate`,
        animationPlayState: playState(playing),
      }}
    />
  );
}

const RAIN_ITEMS = [
  { left: '12%', height: 12, delay: '0s', dur: '0.9s' },
  { left: '30%', height: 10, delay: '0.2s', dur: '1.1s' },
  { left: '50%', height: 14, delay: '0.5s', dur: '0.8s' },
  { left: '68%', height: 8, delay: '0.3s', dur: '1.2s' },
  { left: '85%', height: 11, delay: '0.7s', dur: '1s' },
];

function RainEffect({ playing }: { playing: boolean }) {
  return (
    <>
      {RAIN_ITEMS.map((r, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: -r.height,
            left: r.left,
            width: 1,
            height: r.height,
            background: 'rgba(150,200,255,0.25)',
            animation: `effect-rain ${r.dur} linear infinite`,
            animationDelay: r.delay,
            animationPlayState: playState(playing),
          }}
        />
      ))}
    </>
  );
}

const FIREFLY_ITEMS = [
  { top: '20%', left: '25%', delay: '0s', dur: '3s', color: '#ffd740' },
  { top: '45%', left: '60%', delay: '1s', dur: '4s', color: '#ffe070' },
  { top: '15%', left: '75%', delay: '2s', dur: '3.5s', color: '#ffd740' },
  { top: '55%', left: '40%', delay: '0.5s', dur: '4.5s', color: '#ffcc30' },
];

function FirefliesEffect({ playing }: { playing: boolean }) {
  return (
    <>
      {FIREFLY_ITEMS.map((f, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: f.top,
            left: f.left,
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: f.color,
            boxShadow: `0 0 6px ${f.color}`,
            animation: `effect-firefly ${f.dur} ease-in-out infinite`,
            animationDelay: f.delay,
            animationPlayState: playState(playing),
          }}
        />
      ))}
    </>
  );
}

const EFFECT_MAP: Record<string, React.FC<{ playing: boolean }>> = {
  shimmer: ShimmerEffect,
  bubbles: BubblesEffect,
  sparkles: SparklesEffect,
  aurora: AuroraEffect,
  rain: RainEffect,
  fireflies: FirefliesEffect,
};

/** Card effect overlay. Renders animated particles/effects on top of a card.
 *  Parent must have `position: relative; overflow: hidden`. */
const CardEffect = React.memo(function CardEffect({ effect, playing }: CardEffectProps) {
  if (!effect) return null;
  const EffectComponent = EFFECT_MAP[effect];
  if (!EffectComponent) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 2,
        borderRadius: 'inherit',
      }}
    >
      <EffectComponent playing={playing} />
    </div>
  );
});

export { CardEffect };
