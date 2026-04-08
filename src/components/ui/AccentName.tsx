// src/components/ui/AccentName.tsx
import React from 'react';
import { DEFAULT_ACCENT } from '../../lib/identityConstants';

interface AccentNameProps {
  name: string;
  accentColor?: string | null;
  accentColorSecondary?: string | null;
  className?: string;
  style?: React.CSSProperties;
}

/** Renders a username with their accent color (solid or gradient). */
const AccentName = React.memo(function AccentName({
  name,
  accentColor,
  accentColorSecondary,
  className,
  style,
}: AccentNameProps) {
  const primary = accentColor || DEFAULT_ACCENT;

  const nameStyle: React.CSSProperties = accentColorSecondary
    ? {
        background: `linear-gradient(90deg, ${primary}, ${accentColorSecondary})`,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        ...style,
      }
    : {
        color: primary,
        ...style,
      };

  return (
    <span className={className} style={nameStyle}>
      {name}
    </span>
  );
});

export { AccentName };
