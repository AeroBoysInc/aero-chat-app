import { useEffect, useRef, useState, useCallback } from 'react';
import type { Square } from 'chess.js';
import { Chess } from 'chess.js';
import { Flag, Wifi, WifiOff } from 'lucide-react';
import { useChessStore } from '../../store/chessStore';
import { useAuthStore } from '../../store/authStore';
import { ChessBoard3D } from './ChessBoard3D';
import { supabase } from '../../lib/supabase';

const HEARTBEAT_INTERVAL = 10_000; // 10s
const CHECK_INTERVAL     = 5_000;  // 5s
const DISCONNECT_GRACE   = 30;     // seconds

const PIECE_VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const PIECE_GLYPHS: Record<string, string> = {
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
};

function getCaptured(chess: Chess) {
  // Count pieces on board, subtract from starting counts
  const START: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };
  const onBoard: Record<string, Record<string, number>> = { w: {}, b: {} };
  chess.board().flat().forEach(sq => {
    if (!sq) return;
    onBoard[sq.color][sq.type] = (onBoard[sq.color][sq.type] ?? 0) + 1;
  });
  const capturedByBlue: { type: string; count: number }[] = []; // captured black (green) pieces
  const capturedByGreen: { type: string; count: number }[] = []; // captured white (blue) pieces
  Object.entries(START).forEach(([type, start]) => {
    const missingBlack = start - (onBoard['b'][type] ?? 0);
    const missingWhite = start - (onBoard['w'][type] ?? 0);
    if (missingBlack > 0) capturedByBlue.push({ type, count: missingBlack });
    if (missingWhite > 0) capturedByGreen.push({ type, count: missingWhite });
  });
  return { capturedByBlue, capturedByGreen };
}

function materialScore(captured: { type: string; count: number }[]) {
  return captured.reduce((s, c) => s + (PIECE_VALUES[c.type] ?? 0) * c.count, 0);
}

function statusLabel(status: string, myColor: 'blue' | 'green') {
  if (status === 'blue_wins')  return myColor === 'blue'  ? 'You win! 🎉' : 'You lost';
  if (status === 'green_wins') return myColor === 'green' ? 'You win! 🎉' : 'You lost';
  if (status === 'draw')       return 'Draw!';
  if (status === 'abandoned')  return 'Opponent disconnected — you win!';
  return null;
}

export function ChessGame() {
  const { gameData, myColor, makeMove, resign, updateHeartbeat, backToLobby, setGameData, setDisconnectSecondsLeft, disconnectSecondsLeft } = useChessStore();
  useAuthStore(); // keep store subscription alive
  const [resignConfirm, setResignConfirm] = useState(false);
  const [opponentOnline, setOpponentOnline] = useState(true);

  // Poll for remote state: pending→active transition + opponent moves
  // (fallback for when Supabase Realtime is not enabled on chess_games)
  useEffect(() => {
    if (!gameData?.id) return;
    if (gameData.status !== 'pending' && gameData.status !== 'active') return;

    const id = setInterval(async () => {
      const { data } = await supabase
        .from('chess_games')
        .select('*')
        .eq('id', gameData.id)
        .single();
      if (data && (data.updated_at !== gameData.updated_at || data.status !== gameData.status)) setGameData(data);
    }, 500);
    return () => clearInterval(id);
  }, [gameData?.id, gameData?.status, gameData?.updated_at, setGameData]);

  const chess = gameData ? new Chess(gameData.fen) : new Chess();
  const isMyTurn =
    gameData?.status === 'active' &&
    ((myColor === 'blue'  && chess.turn() === 'w') ||
     (myColor === 'green' && chess.turn() === 'b'));

  // Heartbeat: keep my last_seen fresh
  useEffect(() => {
    if (!myColor || !gameData || gameData.status !== 'active') return;
    updateHeartbeat(myColor);
    const id = setInterval(() => updateHeartbeat(myColor), HEARTBEAT_INTERVAL);
    return () => clearInterval(id);
  }, [myColor, gameData?.status, updateHeartbeat]);

  // Disconnect detection
  const secondsRef = useRef<number | null>(null);
  const checkInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkOpponent = useCallback(async () => {
    if (!gameData || gameData.status !== 'active') return;
    const { data: row } = await supabase
      .from('chess_games')
      .select('blue_last_seen, green_last_seen, status')
      .eq('id', gameData.id)
      .single();
    if (!row || row.status !== 'active') return;

    const opponentSeen = myColor === 'blue' ? row.green_last_seen : row.blue_last_seen;
    const elapsed = (Date.now() - new Date(opponentSeen).getTime()) / 1000;

    if (elapsed > DISCONNECT_GRACE + 5) {
      // Grace expired — declare winner
      setOpponentOnline(false);
      await resign(myColor === 'blue' ? 'green' : 'blue');
      setDisconnectSecondsLeft(null);
    } else if (elapsed > HEARTBEAT_INTERVAL / 1000 + 2) {
      setOpponentOnline(false);
      const remaining = Math.max(0, Math.round(DISCONNECT_GRACE - elapsed));
      secondsRef.current = remaining;
      setDisconnectSecondsLeft(remaining);
    } else {
      setOpponentOnline(true);
      setDisconnectSecondsLeft(null);
    }
  }, [gameData, myColor, resign, setDisconnectSecondsLeft]);

  useEffect(() => {
    checkInterval.current = setInterval(checkOpponent, CHECK_INTERVAL);
    return () => { if (checkInterval.current) clearInterval(checkInterval.current); };
  }, [checkOpponent]);

  // Countdown timer when opponent is disconnected
  useEffect(() => {
    if (disconnectSecondsLeft === null) return;
    const t = setInterval(() => {
      setDisconnectSecondsLeft(Math.max(0, (secondsRef.current ?? 0) - 1));
      secondsRef.current = Math.max(0, (secondsRef.current ?? 0) - 1);
    }, 1000);
    return () => clearInterval(t);
  }, [disconnectSecondsLeft !== null, setDisconnectSecondsLeft]);

  async function handleMove(from: Square, to: Square, promotion?: string) {
    await makeMove(from, to, promotion);
  }

  if (!gameData || !myColor) return null;

  const finished = gameData.status !== 'active' && gameData.status !== 'pending';
  const result   = statusLabel(gameData.status, myColor);
  const { capturedByBlue, capturedByGreen } = getCaptured(chess);
  const blueAdvantage  = materialScore(capturedByBlue)  - materialScore(capturedByGreen);
  const greenAdvantage = materialScore(capturedByGreen) - materialScore(capturedByBlue);

  const myCaptures   = myColor === 'blue' ? capturedByBlue  : capturedByGreen;
  const myAdvantage  = myColor === 'blue' ? blueAdvantage   : greenAdvantage;
  const oppCaptures  = myColor === 'blue' ? capturedByGreen : capturedByBlue;
  const oppAdvantage = myColor === 'blue' ? greenAdvantage  : blueAdvantage;

  const opponentColorName = myColor === 'blue' ? 'Green' : 'Blue';
  const opponentDot = myColor === 'blue' ? '🟢' : '🔵';
  const myDot       = myColor === 'blue' ? '🔵' : '🟢';

  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-3 p-4 overflow-y-auto">
      <style>{`
        @keyframes chess-knight-float {
          0%, 100% { transform: translateY(0) rotate(-5deg); }
          50%       { transform: translateY(-10px) rotate(5deg); }
        }
      `}</style>

      {/* Waiting for invite acceptance */}
      {gameData.status === 'pending' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }}>
          <div className="flex flex-col items-center gap-4 rounded-2xl p-10 text-center"
            style={{ background: 'rgba(0,20,50,0.92)', border: '1px solid rgba(0,212,255,0.30)', boxShadow: '0 0 60px rgba(0,212,255,0.20)' }}>
            <div style={{ fontSize: 48, animation: 'chess-knight-float 3.5s ease-in-out infinite' }}>♟️</div>
            <h2 className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>Waiting for opponent…</h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Your invite is on its way. The game will start when they accept.</p>
            <button
              onClick={backToLobby}
              className="rounded-xl px-6 py-2.5 text-sm font-bold"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-muted)' }}>
              Cancel invite
            </button>
          </div>
        </div>
      )}

      {/* Result overlay */}
      {finished && result && (
        <div className="absolute inset-0 z-20 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }}>
          <div className="flex flex-col items-center gap-4 rounded-2xl p-10 text-center"
            style={{ background: 'rgba(0,20,50,0.92)', border: '1px solid rgba(0,212,255,0.30)', boxShadow: '0 0 60px rgba(0,212,255,0.20)' }}>
            <div style={{ fontSize: 48 }}>
              {result.includes('win') ? '🏆' : result.includes('Draw') ? '🤝' : '😔'}
            </div>
            <h2 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>{result}</h2>
            <button
              onClick={backToLobby}
              className="rounded-xl px-6 py-2.5 text-sm font-bold"
              style={{ background: 'rgba(0,212,255,0.15)', border: '1px solid rgba(0,212,255,0.40)', color: '#00d4ff' }}>
              Back to lobby
            </button>
          </div>
        </div>
      )}

      {/* Opponent row */}
      <div className="flex w-full max-w-[450px] items-center gap-2 px-1">
        <span style={{ fontSize: 16 }}>{opponentDot}</span>
        <span className="flex-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {opponentColorName}
        </span>

        {/* Disconnect warning */}
        {!opponentOnline && disconnectSecondsLeft !== null && (
          <span className="flex items-center gap-1 text-xs font-bold" style={{ color: '#f59e0b' }}>
            <WifiOff className="h-3 w-3" />
            {disconnectSecondsLeft}s
          </span>
        )}
        {opponentOnline && (
          <Wifi className="h-3.5 w-3.5" style={{ color: 'rgba(52,211,153,0.60)' }} />
        )}

        {/* Opponent captures */}
        <div className="flex flex-wrap gap-0.5">
          {oppCaptures.map(({ type, count }) => (
            Array.from({ length: count }).map((_, i) => (
              <span key={`${type}-${i}`} style={{
                fontSize: 13,
                color: myColor === 'blue' ? '#34d399' : '#00d4ff',
                opacity: 0.75,
              }}>
                {PIECE_GLYPHS[type]}
              </span>
            ))
          ))}
          {oppAdvantage > 0 && (
            <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>+{oppAdvantage}</span>
          )}
        </div>
      </div>

      {/* Board */}
      <ChessBoard3D
        chess={chess}
        myColor={myColor}
        lastMove={gameData.last_move}
        onMove={handleMove}
        disabled={!isMyTurn || finished}
      />

      {/* My row */}
      <div className="flex w-full max-w-[450px] items-center gap-2 px-1">
        <span style={{ fontSize: 16 }}>{myDot}</span>
        <span className="flex-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          You {isMyTurn && !finished && <span style={{ color: '#00d4ff', fontSize: 11 }}>● your turn</span>}
        </span>

        {/* My captures */}
        <div className="flex flex-wrap gap-0.5">
          {myCaptures.map(({ type, count }) => (
            Array.from({ length: count }).map((_, i) => (
              <span key={`${type}-${i}`} style={{
                fontSize: 13,
                color: myColor === 'blue' ? '#34d399' : '#00d4ff',
                opacity: 0.75,
              }}>
                {PIECE_GLYPHS[type]}
              </span>
            ))
          ))}
          {myAdvantage > 0 && (
            <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>+{myAdvantage}</span>
          )}
        </div>
      </div>

      {/* Turn indicator */}
      {!finished && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {isMyTurn ? 'Your move' : `Waiting for ${opponentColorName}…`}
        </p>
      )}

      {/* Resign */}
      {!finished && (
        resignConfirm ? (
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Resign?</span>
            <button
              onClick={async () => { await resign(myColor); setResignConfirm(false); }}
              className="rounded-lg px-3 py-1 text-xs font-bold"
              style={{ background: 'rgba(239,68,68,0.20)', border: '1px solid rgba(239,68,68,0.40)', color: '#ef4444' }}>
              Yes, resign
            </button>
            <button
              onClick={() => setResignConfirm(false)}
              className="rounded-lg px-3 py-1 text-xs font-semibold"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-muted)' }}>
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setResignConfirm(true)}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.12)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'}>
            <Flag className="h-3 w-3" />
            Resign
          </button>
        )
      )}
    </div>
  );
}
