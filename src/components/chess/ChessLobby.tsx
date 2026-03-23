import { useState } from 'react';
import { Swords, UserPlus, X } from 'lucide-react';
import { useChessStore } from '../../store/chessStore';
import { useAuthStore } from '../../store/authStore';
import { useFriendStore } from '../../store/friendStore';
import { useCornerStore } from '../../store/cornerStore';
import { AvatarImage } from '../ui/AvatarImage';
import { supabase } from '../../lib/supabase';
import { encryptMessage, loadPrivateKey } from '../../lib/crypto';

const CHESS_INVITE_PREFIX = '__CHESS_INVITE__';

export function ChessLobby() {
  const { closeChess, joinQueue, startGame } = useChessStore();
  const { selectGame } = useCornerStore();

  function handleClose() { closeChess(); selectGame(null); }
  const { user } = useAuthStore();
  const { friends } = useFriendStore();
  const [inviting, setInviting] = useState<string | null>(null);
  const [finding, setFinding]   = useState(false);

  async function handleFindMatch() {
    if (!user) return;
    setFinding(true);
    await joinQueue(user.id);
    // phase will transition to 'queue' or 'game' inside joinQueue
    setFinding(false);
  }

  async function handleInviteFriend(friendId: string) {
    if (!user) return;
    setInviting(friendId);

    const blueIsMe = Math.random() < 0.5;
    const blueId   = blueIsMe ? user.id : friendId;
    const greenId  = blueIsMe ? friendId : user.id;
    const myColor  = blueIsMe ? 'blue' as const : 'green' as const;

    const { data: game, error } = await supabase
      .from('chess_games')
      .insert({ blue_player_id: blueId, green_player_id: greenId, status: 'pending' })
      .select()
      .single();

    if (error || !game) { setInviting(null); return; }

    // Send invite as an encrypted chat message
    const { data: profile } = await supabase
      .from('profiles')
      .select('public_key')
      .eq('id', friendId)
      .single();

    if (profile?.public_key) {
      const privateKey = loadPrivateKey(user.id);
      if (privateKey) {
        const content   = `${CHESS_INVITE_PREFIX}:${game.id}:${user.username}`;
        const encrypted = encryptMessage(content, profile.public_key, privateKey);
        await supabase.from('messages').insert({
          sender_id:    user.id,
          recipient_id: friendId,
          content:      encrypted,
        });
      }
    }

    setInviting(null);
    await startGame(game.id, myColor);
  }

  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-8 p-8 overflow-y-auto">
      <style>{`
        @keyframes chess-knight-float {
          0%, 100% { transform: translateY(0) rotate(-5deg); }
          50%       { transform: translateY(-10px) rotate(5deg); }
        }
      `}</style>

      {/* Close */}
      <button
        onClick={handleClose}
        className="absolute top-5 right-5 flex h-9 w-9 items-center justify-center rounded-xl"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-muted)' }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.12)'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'}
      >
        <X className="h-4 w-4" />
      </button>

      {/* Hero */}
      <div style={{ animation: 'chess-knight-float 3.5s ease-in-out infinite', fontSize: 64 }}>♟️</div>

      <div className="text-center">
        <h1 className="text-3xl font-black" style={{ color: 'var(--text-primary)', letterSpacing: -1 }}>
          Aero<span style={{ color: '#00d4ff' }}>Chess</span>
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          Real-time 1v1 — 🔵 Blue vs 🟢 Green
        </p>
      </div>

      {/* Find match */}
      <button
        onClick={handleFindMatch}
        disabled={finding}
        className="flex items-center gap-3 rounded-2xl px-8 py-4 text-base font-bold transition-all"
        style={{
          background: 'rgba(0,212,255,0.15)',
          border: '1px solid rgba(0,212,255,0.40)',
          color: '#00d4ff',
          boxShadow: '0 0 24px rgba(0,212,255,0.18)',
          opacity: finding ? 0.7 : 1,
        }}
        onMouseEnter={e => { if (!finding) (e.currentTarget as HTMLElement).style.background = 'rgba(0,212,255,0.25)'; }}
        onMouseLeave={e => { if (!finding) (e.currentTarget as HTMLElement).style.background = 'rgba(0,212,255,0.15)'; }}
      >
        <Swords className="h-5 w-5" />
        {finding ? 'Searching…' : 'Find a Match'}
      </button>

      {/* Friends list */}
      {friends.length > 0 && (
        <div className="w-full max-w-sm">
          <p className="mb-3 flex items-center gap-1.5 text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
            <UserPlus className="h-3 w-3" />
            Challenge a friend
          </p>
          <div className="flex flex-col gap-2">
            {friends.map(friend => (
              <button
                key={friend.id}
                onClick={() => handleInviteFriend(friend.id)}
                disabled={!!inviting}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  color: 'var(--text-primary)',
                  opacity: inviting ? 0.6 : 1,
                }}
                onMouseEnter={e => { if (!inviting) (e.currentTarget as HTMLElement).style.background = 'rgba(52,211,153,0.10)'; }}
                onMouseLeave={e => { if (!inviting) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
              >
                <AvatarImage username={friend.username} avatarUrl={friend.avatar_url} size="sm" />
                <span className="flex-1 text-sm font-semibold">{friend.username}</span>
                <span className="text-xs font-bold" style={{ color: '#34d399' }}>
                  {inviting === friend.id ? 'Sending…' : 'Invite ♟'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
