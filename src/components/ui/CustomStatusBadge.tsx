// src/components/ui/CustomStatusBadge.tsx
import React from 'react';

interface CustomStatusBadgeProps {
  emoji?: string | null;
  text?: string | null;
  size?: 'sm' | 'md';
}

const SIZES = {
  sm: { fontSize: '9.5px', gap: 3 },
  md: { fontSize: '11px', gap: 4 },
} as const;

/** Renders a custom status line: emoji + text. Returns null if both are empty. */
const CustomStatusBadge = React.memo(function CustomStatusBadge({
  emoji,
  text,
  size = 'sm',
}: CustomStatusBadgeProps) {
  if (!emoji && !text) return null;

  const s = SIZES[size];
  return (
    <div
      style={{
        fontSize: s.fontSize,
        color: 'var(--text-muted)',
        display: 'flex',
        alignItems: 'center',
        gap: s.gap,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {emoji && <span>{emoji}</span>}
      {text && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{text}</span>}
    </div>
  );
});

export { CustomStatusBadge };
