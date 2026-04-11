// src/components/servers/toolkits/XpBar.tsx
import { memo } from 'react';

export const XpBar = memo(function XpBar({
  current,
  max,
  height = 4,
  showLabel = false,
}: {
  current: number;
  max: number;
  height?: number;
  showLabel?: boolean;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;

  return (
    <div>
      {showLabel && (
        <div className="flex justify-between mb-0.5" style={{ fontSize: 9, color: 'var(--tk-text-muted, var(--text-muted))' }}>
          <span>XP</span>
          <span>{current}/{max}</span>
        </div>
      )}
      <div style={{
        width: '100%', height, borderRadius: height / 2,
        background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: height / 2,
          background: 'var(--tk-gold, #FFD700)',
          boxShadow: '0 0 6px rgba(255,215,0,0.3)',
          transition: 'width 0.4s ease',
        }} />
      </div>
    </div>
  );
});
