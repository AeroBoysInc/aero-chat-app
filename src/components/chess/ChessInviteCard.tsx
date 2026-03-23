import { useState } from 'react';
import { Swords } from 'lucide-react';
import { useChessStore } from '../../store/chessStore';
import { useAuthStore } from '../../store/authStore';
import { useCornerStore } from '../../store/cornerStore';
import { supabase } from '../../lib/supabase';

interface ChessInviteCardProps {
  gameId: string;
  inviterUsername: string;
}

export function ChessInviteCard({ gameId, inviterUsername }: ChessInviteCardProps) {
  const { startGame } = useChessStore();
  const { user } = useAuthStore();
  const { openGameHub, selectGame } = useCornerStore();
  const [accepting, setAccepting] = useState(false);
  const [declined, setDeclined]   = useState(false);

  async function handleAccept() {
    if (!user) return;
    setAccepting(true);

    // Fetch the game to know our color
    const { data: game } = await supabase
      .from('chess_games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (!game) { setAccepting(false); return; }

    // Activate the game and update status to active
    await supabase
      .from('chess_games')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', gameId);

    const myColor = game.blue_player_id === user.id ? 'blue' : 'green';
    openGameHub();        // open games corner
    selectGame('chess');  // show chess panel
    await startGame(gameId, myColor);
    setAccepting(false);
  }

  if (declined) {
    return (
      <div className="rounded-xl px-4 py-3 text-xs" style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        color: 'var(--text-muted)',
      }}>
        Chess invite declined
      </div>
    );
  }

  return (
    <div className="rounded-xl px-4 py-3" style={{
      background: 'rgba(0,212,255,0.07)',
      border: '1px solid rgba(0,212,255,0.22)',
      maxWidth: 280,
    }}>
      <div className="flex items-center gap-2 mb-2">
        <Swords className="h-4 w-4" style={{ color: '#00d4ff' }} />
        <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
          AeroChess Invite
        </span>
      </div>
      <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{inviterUsername}</span>{' '}
        challenged you to a game of chess!
      </p>
      <div className="flex gap-2">
        <button
          onClick={handleAccept}
          disabled={accepting}
          className="flex-1 rounded-lg py-1.5 text-xs font-bold"
          style={{
            background: 'rgba(0,212,255,0.18)',
            border: '1px solid rgba(0,212,255,0.40)',
            color: '#00d4ff',
            opacity: accepting ? 0.7 : 1,
          }}>
          {accepting ? 'Joining…' : 'Accept ♟'}
        </button>
        <button
          onClick={() => setDeclined(true)}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'var(--text-muted)',
          }}>
          Decline
        </button>
      </div>
    </div>
  );
}
