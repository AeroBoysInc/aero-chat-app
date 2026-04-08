// src/components/ui/AccentName.tsx
import React from 'react';
import { DEFAULT_ACCENT } from '../../lib/identityConstants';

interface AccentNameProps {
  name: string;
  accentColor?: string | null;
  accentColorSecondary?: string | null;
  nameEffect?: string | null;
  playing?: boolean;           // controlled by parent hover state
  animateOnHover?: boolean;    // default true — paused at rest
  className?: string;
  style?: React.CSSProperties;
}

function darkenHex(hex: string, amount = 0.4): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const f = 1 - amount;
  return `#${Math.round(r * f).toString(16).padStart(2, '0')}${Math.round(g * f).toString(16).padStart(2, '0')}${Math.round(b * f).toString(16).padStart(2, '0')}`;
}

/** Renders a username with accent color and optional name effect. */
const AccentName = React.memo(function AccentName({
  name,
  accentColor,
  accentColorSecondary,
  nameEffect,
  playing = false,
  animateOnHover = true,
  className,
  style,
}: AccentNameProps) {
  const primary = accentColor || DEFAULT_ACCENT;
  const isAnimating = animateOnHover ? playing : true;
  const animState = isAnimating ? 'running' : 'paused';

  // Base accent color styling
  const baseStyle: React.CSSProperties = accentColorSecondary
    ? {
        background: `linear-gradient(90deg, ${primary}, ${accentColorSecondary})`,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }
    : { color: primary };

  // No effect — simple render
  if (!nameEffect) {
    return <span className={className} style={{ ...baseStyle, ...style }}>{name}</span>;
  }

  // ── Static effects ──────────────────────────────────────────────
  if (nameEffect === 'glow') {
    return (
      <span className={className} style={{
        ...baseStyle,
        textShadow: `0 0 8px ${primary}80, 0 0 16px ${primary}40`,
        ...style,
      }}>
        {name}
      </span>
    );
  }

  if (nameEffect === 'shadow') {
    return (
      <span className={className} style={{
        ...baseStyle,
        textShadow: '2px 2px 4px rgba(0,0,0,0.6)',
        ...style,
      }}>
        {name}
      </span>
    );
  }

  if (nameEffect === 'metallic') {
    const darkened = darkenHex(primary);
    return (
      <span className={className} style={{
        background: `linear-gradient(180deg, #ffffff 0%, ${primary} 50%, ${darkened} 100%)`,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        ...style,
      }}>
        {name}
      </span>
    );
  }

  if (nameEffect === 'spaced') {
    return (
      <span className={className} style={{
        ...baseStyle,
        letterSpacing: '3px',
        ...style,
      }}>
        {name}
      </span>
    );
  }

  if (nameEffect === 'italic') {
    return (
      <span className={className} style={{
        ...baseStyle,
        fontStyle: 'italic',
        ...style,
      }}>
        {name}
      </span>
    );
  }

  // ── Animated effects ────────────────────────────────────────────
  if (nameEffect === 'rainbow') {
    return (
      <span className={className} style={{
        background: 'linear-gradient(90deg, #ff0000, #ff8800, #ffff00, #00ff00, #0088ff, #8800ff, #ff0000)',
        backgroundSize: '200% 100%',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        animation: 'name-rainbow 3s linear infinite',
        animationPlayState: animState,
        ...style,
      }}>
        {name}
      </span>
    );
  }

  if (nameEffect === 'wave') {
    return (
      <span className={className} style={{ ...baseStyle, ...style, display: 'inline-flex' }}>
        {name.split('').map((char, i) => (
          <span
            key={i}
            style={{
              display: 'inline-block',
              animation: 'name-wave 1.2s ease-in-out infinite',
              animationDelay: `${i * 0.08}s`,
              animationPlayState: animState,
              whiteSpace: char === ' ' ? 'pre' : undefined,
            }}
          >
            {char}
          </span>
        ))}
      </span>
    );
  }

  if (nameEffect === 'pulse') {
    return (
      <span className={className} style={{
        ...baseStyle,
        animation: 'name-pulse 1.5s ease-in-out infinite',
        animationPlayState: animState,
        ...style,
      }}>
        {name}
      </span>
    );
  }

  if (nameEffect === 'glitch') {
    return (
      <span className={className} style={{
        ...baseStyle,
        display: 'inline-block',
        animation: 'name-glitch 4s steps(1) infinite',
        animationPlayState: animState,
        ...style,
      }}>
        {name}
      </span>
    );
  }

  if (nameEffect === 'sparkle') {
    return (
      <span
        className={`name-effect-sparkle ${className ?? ''}`}
        style={{ ...baseStyle, ...style }}
      >
        {name}
      </span>
    );
  }

  // Unknown effect — fallback to plain accent
  return <span className={className} style={{ ...baseStyle, ...style }}>{name}</span>;
});

export { AccentName };
