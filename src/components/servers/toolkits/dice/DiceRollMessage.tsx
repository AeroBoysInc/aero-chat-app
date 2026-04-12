// src/components/servers/toolkits/dice/DiceRollMessage.tsx
import { memo } from 'react';
import { dieColor, type DiceRollPayload } from '../../../../lib/diceNotation';

export const DiceRollMessage = memo(function DiceRollMessage({
  payload,
  isMine,
}: {
  payload: DiceRollPayload;
  isMine: boolean;
}) {
  const { expression, dice, sides, modifier, total } = payload;

  // Total color gradient over its possible range
  const minTotal = dice.length + modifier;
  const maxTotal = dice.length * sides + modifier;
  const totalColor = minTotal === maxTotal
    ? 'hsl(60, 75%, 55%)'
    : (() => {
        const t = (total - minTotal) / (maxTotal - minTotal);
        const hue = Math.max(0, Math.min(1, t)) * 120;
        return `hsl(${hue}, 75%, 55%)`;
      })();

  // Natural labels
  const showNat1 = dice.length === 1 && dice[0] === 1;
  const showNatMax = dice.length === 1 && dice[0] === sides && sides > 1;

  return (
    <div
      style={{
        padding: '10px 14px',
        borderRadius: 14,
        background: isMine
          ? 'linear-gradient(145deg, rgba(139,69,19,0.30), rgba(255,140,40,0.20))'
          : 'linear-gradient(145deg, rgba(139,69,19,0.20), rgba(255,215,0,0.10))',
        border: `1px solid ${isMine ? 'rgba(255,165,50,0.45)' : 'rgba(255,215,0,0.30)'}`,
        boxShadow: '0 4px 14px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)',
        minWidth: 180,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-1.5" style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 16 }}>🎲</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#FFD700', fontFamily: 'Georgia, serif', letterSpacing: '0.02em' }}>
          rolled
        </span>
        <span style={{
          fontSize: 11, fontWeight: 800,
          padding: '1px 7px', borderRadius: 6,
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,215,0,0.30)',
          color: '#FFD700', fontFamily: 'ui-monospace, monospace',
        }}>
          {expression}
        </span>
      </div>

      {/* Dice pills */}
      <div className="flex flex-wrap items-center gap-1.5" style={{ marginBottom: 6 }}>
        {dice.map((d, i) => {
          const c = dieColor(d, sides);
          const isNat1 = d === 1;
          const isNatMax = d === sides && sides > 1;
          return (
            <span
              key={i}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                minWidth: 26, height: 26, padding: '0 6px',
                borderRadius: 8,
                fontSize: 13, fontWeight: 800, fontFamily: 'ui-monospace, monospace',
                color: '#fff',
                background: `linear-gradient(145deg, ${c}, ${c})`,
                border: `1.5px solid ${c}`,
                boxShadow: isNat1
                  ? `0 0 10px rgba(229,57,53,0.7), inset 0 1px 0 rgba(255,255,255,0.25)`
                  : isNatMax
                  ? `0 0 10px rgba(76,175,80,0.7), inset 0 1px 0 rgba(255,255,255,0.25)`
                  : `0 2px 4px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.2)`,
                textShadow: '0 1px 2px rgba(0,0,0,0.5)',
              }}
            >
              {d}
            </span>
          );
        })}
        {modifier !== 0 && (
          <span style={{ fontSize: 12, fontWeight: 700, color: '#c9b78a', margin: '0 2px', fontFamily: 'ui-monospace, monospace' }}>
            {modifier > 0 ? `+ ${modifier}` : `− ${Math.abs(modifier)}`}
          </span>
        )}
        <span style={{ fontSize: 13, fontWeight: 700, color: '#c9b78a', margin: '0 2px' }}>=</span>
        <span
          style={{
            padding: '2px 10px', borderRadius: 10,
            fontSize: 16, fontWeight: 900, fontFamily: 'ui-monospace, monospace',
            color: '#fff',
            background: `linear-gradient(145deg, ${totalColor}, ${totalColor})`,
            border: `2px solid ${totalColor}`,
            boxShadow: `0 0 14px ${totalColor}70, inset 0 1px 0 rgba(255,255,255,0.25)`,
            textShadow: '0 1px 2px rgba(0,0,0,0.55)',
          }}
        >
          {total}
        </span>
      </div>

      {/* Nat labels */}
      {(showNat1 || showNatMax) && (
        <div style={{ marginTop: 4 }}>
          <span style={{
            display: 'inline-block',
            padding: '2px 8px', borderRadius: 6,
            fontSize: 10, fontWeight: 900, letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#fff',
            background: showNat1 ? 'rgba(229,57,53,0.85)' : 'rgba(76,175,80,0.85)',
            boxShadow: `0 0 10px ${showNat1 ? 'rgba(229,57,53,0.6)' : 'rgba(76,175,80,0.6)'}`,
          }}>
            {showNat1 ? `NAT 1!` : `NAT ${sides}!`}
          </span>
        </div>
      )}
    </div>
  );
});
