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
  // gainKey is an incrementing counter that forces React to remount the floater span
  const [gainKey, setGainKey] = useState<number>(0);
  const [gainAmount, setGainAmount] = useState<number>(0);
  const [glowKey, setGlowKey] = useState<number>(0);
  const prevSeq = useRef(0);
  const glowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const floatTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!lastGain || lastGain.bar !== bar || lastGain.ts === prevSeq.current) return;
    prevSeq.current = lastGain.ts;

    // Cancel any pending cleanup timers — new gain takes priority
    if (glowTimer.current) clearTimeout(glowTimer.current);
    if (floatTimer.current) clearTimeout(floatTimer.current);

    // Bump counters to force React to re-create elements (restarts CSS animations)
    setGlowKey(k => k + 1);
    setGainAmount(lastGain.amount);
    setGainKey(k => k + 1);

    glowTimer.current = setTimeout(() => setGlowKey(0), 250);
    floatTimer.current = setTimeout(() => setGainKey(0), 450);
  }, [lastGain, bar]);

  const isGlowing = glowKey > 0;

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
        boxShadow: isGlowing ? `0 0 10px ${meta.color}60, 0 0 20px ${meta.color}30` : 'none',
        transition: 'box-shadow 0.05s ease',
      }}>
        {/* Fill */}
        <div style={{
          height: '100%', borderRadius: 3,
          background: `linear-gradient(90deg, ${meta.color}aa, ${meta.color})`,
          width: `${progress}%`,
          transition: 'width 0.05s linear',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Shimmer sweep on gain — keyed to force animation restart */}
          {isGlowing && (
            <div key={glowKey} style={{
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%)',
              animation: 'xp-shimmer 0.25s ease-out',
            }} />
          )}
        </div>
      </div>

      {/* Level number */}
      <span style={{
        fontSize: 10, fontWeight: 800, color: meta.color,
        minWidth: 16, textAlign: 'right',
        transform: isGlowing ? 'scale(1.2)' : 'scale(1)',
        transition: 'transform 0.05s ease-out',
      }}>
        {level}
      </span>

      {/* Floating "+N XP" — keyed to force remount and restart animation */}
      {gainKey > 0 && (
        <span
          key={gainKey}
          style={{
            position: 'absolute',
            right: 0, top: -2,
            fontSize: 11, fontWeight: 800,
            color: meta.color,
            textShadow: `0 0 8px ${meta.color}80`,
            pointerEvents: 'none',
            animation: 'xp-float-up 0.45s ease-out forwards',
            whiteSpace: 'nowrap',
          }}
        >
          +{gainAmount} XP
        </span>
      )}
    </div>
  );
}
