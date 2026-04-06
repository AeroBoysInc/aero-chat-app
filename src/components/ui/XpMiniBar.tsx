// src/components/ui/XpMiniBar.tsx
// Compact XP progress bar with dopamine animation on gain.
// Premium-only — parent must gate rendering.

import { useState, useEffect, useRef } from 'react';
import { useXpStore } from '../../store/xpStore';
import { type XpBar, BAR_META, deriveLevel, getRank } from '../../lib/xpConfig';

interface Props {
  bar: XpBar;
}

export function XpMiniBar({ bar }: Props) {
  const totalXp = useXpStore(s => s[`${bar}_xp`]);
  const lastGain = useXpStore(s => s.lastGain);
  const { level, currentXp, nextXp } = deriveLevel(totalXp);
  const rank = getRank(bar, level);
  const meta = BAR_META[bar];
  const progress = level >= 100 ? 100 : nextXp > 0 ? Math.round((currentXp / nextXp) * 100) : 0;

  // ── Floating "+N XP" animation state ──
  const [floater, setFloater] = useState<{ amount: number; key: number } | null>(null);
  const [glowing, setGlowing] = useState(false);
  const prevTs = useRef(0);

  useEffect(() => {
    if (!lastGain || lastGain.bar !== bar || lastGain.ts === prevTs.current) return;
    prevTs.current = lastGain.ts;

    // Trigger glow + floater
    setGlowing(true);
    setFloater({ amount: lastGain.amount, key: lastGain.ts });

    const t1 = setTimeout(() => setGlowing(false), 800);
    const t2 = setTimeout(() => setFloater(null), 1200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [lastGain, bar]);

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
      {/* Rank + Level label */}
      <span style={{
        fontSize: 9, fontWeight: 700, color: meta.color,
        whiteSpace: 'nowrap', letterSpacing: '0.02em', opacity: 0.9,
        minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {rank}
      </span>

      {/* Progress bar track */}
      <div style={{
        flex: 1, height: 5, borderRadius: 3, minWidth: 40,
        background: 'rgba(255,255,255,0.08)',
        overflow: 'hidden',
        position: 'relative',
        boxShadow: glowing ? `0 0 10px ${meta.color}60, 0 0 20px ${meta.color}30` : 'none',
        transition: 'box-shadow 0.3s ease',
      }}>
        {/* Fill */}
        <div style={{
          height: '100%', borderRadius: 3,
          background: `linear-gradient(90deg, ${meta.color}aa, ${meta.color})`,
          width: `${progress}%`,
          transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Shimmer sweep on gain */}
          {glowing && (
            <div style={{
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%)',
              animation: 'xp-shimmer 0.6s ease-out',
            }} />
          )}
        </div>
      </div>

      {/* Level number */}
      <span style={{
        fontSize: 10, fontWeight: 800, color: meta.color,
        minWidth: 16, textAlign: 'right',
        transform: glowing ? 'scale(1.2)' : 'scale(1)',
        transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}>
        {level}
      </span>

      {/* Floating "+N XP" */}
      {floater && (
        <span
          key={floater.key}
          style={{
            position: 'absolute',
            right: 0, top: -2,
            fontSize: 11, fontWeight: 800,
            color: meta.color,
            textShadow: `0 0 8px ${meta.color}80`,
            pointerEvents: 'none',
            animation: 'xp-float-up 1.2s ease-out forwards',
            whiteSpace: 'nowrap',
          }}
        >
          +{floater.amount} XP
        </span>
      )}
    </div>
  );
}
