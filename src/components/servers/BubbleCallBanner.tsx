// src/components/servers/BubbleCallBanner.tsx
import { memo } from 'react';
import { Phone } from 'lucide-react';

export const BubbleCallBanner = memo(function BubbleCallBanner({
  participantCount,
  onJoin,
}: {
  participantCount: number;
  onJoin: () => void;
}) {
  return (
    <div
      className="mx-3 mt-2 flex items-center gap-3 rounded-aero-lg px-3.5 py-2"
      style={{
        background: 'linear-gradient(135deg, rgba(79,201,122,0.1), rgba(0,212,255,0.08))',
        border: '1px solid rgba(79,201,122,0.2)',
      }}
    >
      <div
        style={{
          width: 8, height: 8, borderRadius: '50%',
          background: '#4fc97a',
          boxShadow: '0 0 6px rgba(79,201,122,0.5)',
          animation: 'aura-pulse 2s ease-in-out infinite',
        }}
      />
      <span style={{ fontSize: 12, fontWeight: 500, color: '#4fc97a' }}>Call active</span>
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{participantCount} in call</span>
      <button
        onClick={onJoin}
        className="ml-auto flex items-center gap-1 rounded-aero px-3 py-1 text-xs font-medium transition-opacity hover:opacity-80"
        style={{
          background: 'rgba(79,201,122,0.15)',
          border: '1px solid rgba(79,201,122,0.3)',
          color: '#4fc97a',
        }}
      >
        <Phone className="h-3 w-3" /> Join
      </button>
    </div>
  );
});
