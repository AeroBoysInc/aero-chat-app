// src/components/servers/toolkits/HpBar.tsx
import { memo } from 'react';

function hpColor(pct: number): string {
  if (pct >= 60) return '#4CAF50';
  if (pct >= 30) return '#FFA000';
  return '#e53935';
}

export const HpBar = memo(function HpBar({
  current,
  max,
  height = 6,
  showLabel = false,
}: {
  current: number;
  max: number;
  height?: number;
  showLabel?: boolean;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  const color = hpColor(pct);

  return (
    <div>
      {showLabel && (
        <div className="flex justify-between mb-0.5" style={{ fontSize: 9, color: 'var(--tk-text-muted, var(--text-muted))' }}>
          <span>HP</span>
          <span>{current}/{max}</span>
        </div>
      )}
      <div style={{
        width: '100%', height, borderRadius: height / 2,
        background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: height / 2,
          background: color,
          boxShadow: `0 0 6px ${color}40`,
          transition: 'width 0.4s ease, background 0.4s ease',
        }} />
      </div>
    </div>
  );
});
