import { X } from 'lucide-react';
import { useChessStore } from '../../store/chessStore';

export function ChessQueue() {
  const { leaveQueue } = useChessStore();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6">
      <style>{`
        @keyframes chess-pulse-ring {
          0%   { transform: scale(0.92); box-shadow: 0 0 0 0   rgba(0,212,255,0.65); }
          70%  { transform: scale(1);    box-shadow: 0 0 0 22px rgba(0,212,255,0);   }
          100% { transform: scale(0.92); box-shadow: 0 0 0 0   rgba(0,212,255,0);   }
        }
        @keyframes chess-dot-bounce {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.75); }
          40%           { opacity: 1;   transform: scale(1.15); }
        }
      `}</style>

      {/* Pulsing orb */}
      <div style={{
        width: 88, height: 88, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,212,255,0.38) 0%, rgba(0,150,220,0.12) 100%)',
        animation: 'chess-pulse-ring 2s ease-in-out infinite',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 38,
      }}>
        ♟️
      </div>

      <div className="text-center">
        <p className="flex items-center justify-center gap-1.5 text-base font-bold" style={{ color: 'var(--text-primary)' }}>
          Finding opponent
          {[0,1,2].map(i => (
            <span key={i} style={{
              width: 5, height: 5, borderRadius: '50%',
              background: '#00d4ff', display: 'inline-block',
              animation: `chess-dot-bounce 1.4s ease-in-out ${i * 0.22}s infinite`,
            }} />
          ))}
        </p>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          Waiting in matchmaking queue
        </p>
      </div>

      <button
        onClick={leaveQueue}
        className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-muted)' }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.12)'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'}
      >
        <X className="h-4 w-4" />
        Cancel
      </button>
    </div>
  );
}
