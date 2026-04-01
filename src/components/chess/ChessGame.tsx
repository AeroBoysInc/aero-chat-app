import { useEffect, useRef, useState, useCallback } from 'react';
import type { Square } from 'chess.js';
import { Chess } from 'chess.js';
import { Flag, Wifi, WifiOff, Crown, Handshake, Swords, Timer, RotateCcw } from 'lucide-react';
import { useChessStore } from '../../store/chessStore';
import { useAuthStore } from '../../store/authStore';
import { ChessBoard } from './ChessBoard';
import { AvatarImage } from '../ui/AvatarImage';
import { supabase } from '../../lib/supabase';

const HEARTBEAT_INTERVAL = 10_000;
const CHECK_INTERVAL     = 5_000;
const DISCONNECT_GRACE   = 30;

const PIECE_VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const PIECE_GLYPHS: Record<string, string> = {
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
};

function getCaptured(chess: Chess) {
  const START: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };
  const onBoard: Record<string, Record<string, number>> = { w: {}, b: {} };
  chess.board().flat().forEach(sq => {
    if (!sq) return;
    onBoard[sq.color][sq.type] = (onBoard[sq.color][sq.type] ?? 0) + 1;
  });
  const capturedByBlue: { type: string; count: number }[] = [];
  const capturedByGreen: { type: string; count: number }[] = [];
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

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getWinDetails(chess: Chess, status: string, myColor: 'blue' | 'green') {
  const iWon = (status === 'blue_wins' && myColor === 'blue') || (status === 'green_wins' && myColor === 'green');
  const iLost = (status === 'blue_wins' && myColor === 'green') || (status === 'green_wins' && myColor === 'blue');

  let reason = '';
  if (chess.isCheckmate()) reason = 'Checkmate';
  else if (status === 'abandoned') reason = 'Opponent disconnected';
  else if (chess.isStalemate()) reason = 'Stalemate';
  else if (chess.isThreefoldRepetition()) reason = 'Threefold repetition';
  else if (chess.isInsufficientMaterial()) reason = 'Insufficient material';
  else if (chess.isDraw()) reason = 'Draw by 50-move rule';
  else reason = 'Resignation';

  if (status === 'draw') return { title: 'Draw!', subtitle: reason, icon: 'draw' as const };
  if (iWon) return { title: 'Victory!', subtitle: `You won by ${reason.toLowerCase()}`, icon: 'win' as const };
  if (iLost) return { title: 'Defeat', subtitle: `You lost by ${reason.toLowerCase()}`, icon: 'loss' as const };
  return { title: 'Game Over', subtitle: reason, icon: 'draw' as const };
}

export function ChessGame() {
  const {
    gameData, myColor, makeMove, resign, updateHeartbeat, backToLobby,
    setGameData, setDisconnectSecondsLeft, disconnectSecondsLeft,
    botGame, makeBotMove, myPlayer, opponentPlayer,
    blueTime, greenTime, tickTimer,
  } = useChessStore();
  useAuthStore();
  const [resignConfirm, setResignConfirm] = useState(false);
  const [opponentOnline, setOpponentOnline] = useState(true);

  // Poll for remote state
  useEffect(() => {
    if (botGame) return;
    if (!gameData?.id) return;
    if (gameData.status !== 'pending' && gameData.status !== 'active') return;
    const id = setInterval(async () => {
      const { data } = await supabase
        .from('chess_games').select('*').eq('id', gameData.id).single();
      if (data && (data.updated_at !== gameData.updated_at || data.status !== gameData.status)) setGameData(data);
    }, 500);
    return () => clearInterval(id);
  }, [gameData?.id, gameData?.status, gameData?.updated_at, setGameData, botGame]);

  const chess = gameData ? new Chess(gameData.fen) : new Chess();
  const isMyTurn =
    gameData?.status === 'active' &&
    ((myColor === 'blue'  && chess.turn() === 'w') ||
     (myColor === 'green' && chess.turn() === 'b'));

  // Timer tick — every second while game is active
  useEffect(() => {
    if (!gameData || gameData.status !== 'active') return;
    const id = setInterval(() => tickTimer(), 1000);
    return () => clearInterval(id);
  }, [gameData?.status, tickTimer]);

  // Heartbeat
  useEffect(() => {
    if (botGame) return;
    if (!myColor || !gameData || gameData.status !== 'active') return;
    updateHeartbeat(myColor);
    const id = setInterval(() => updateHeartbeat(myColor), HEARTBEAT_INTERVAL);
    return () => clearInterval(id);
  }, [myColor, gameData?.status, updateHeartbeat, botGame]);

  // Bot move
  useEffect(() => {
    if (!botGame || !gameData || gameData.status !== 'active') return;
    const c = new Chess(gameData.fen);
    if (c.turn() !== 'b') return;
    const delay = 400 + Math.random() * 600;
    const timer = setTimeout(() => { makeBotMove(); }, delay);
    return () => clearTimeout(timer);
  }, [botGame, gameData?.fen, gameData?.status, makeBotMove]);

  // Disconnect detection
  const secondsRef = useRef<number | null>(null);
  const checkInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkOpponent = useCallback(async () => {
    if (botGame) return;
    if (!gameData || gameData.status !== 'active') return;
    const { data: row } = await supabase
      .from('chess_games')
      .select('blue_last_seen, green_last_seen, status')
      .eq('id', gameData.id).single();
    if (!row || row.status !== 'active') return;
    const opponentSeen = myColor === 'blue' ? row.green_last_seen : row.blue_last_seen;
    const elapsed = (Date.now() - new Date(opponentSeen).getTime()) / 1000;
    if (elapsed > DISCONNECT_GRACE + 5) {
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
  }, [botGame, gameData, myColor, resign, setDisconnectSecondsLeft]);

  useEffect(() => {
    checkInterval.current = setInterval(checkOpponent, CHECK_INTERVAL);
    return () => { if (checkInterval.current) clearInterval(checkInterval.current); };
  }, [checkOpponent]);

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
  const { capturedByBlue, capturedByGreen } = getCaptured(chess);
  const blueAdv  = materialScore(capturedByBlue)  - materialScore(capturedByGreen);
  const greenAdv = materialScore(capturedByGreen) - materialScore(capturedByBlue);

  const myCaptures   = myColor === 'blue' ? capturedByBlue  : capturedByGreen;
  const myAdvantage  = myColor === 'blue' ? blueAdv  : greenAdv;
  const oppCaptures  = myColor === 'blue' ? capturedByGreen : capturedByBlue;
  const oppAdvantage = myColor === 'blue' ? greenAdv : blueAdv;

  const isOpponentTurn = gameData.status === 'active' && !isMyTurn;
  const myTime  = myColor === 'blue' ? blueTime : greenTime;
  const oppTime = myColor === 'blue' ? greenTime : blueTime;

  const moveCount = Math.floor((chess.moveNumber() - 1)) + 1;

  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-2 p-4 overflow-y-auto">
      <style>{`
        @keyframes chess-turn-ring {
          0%, 100% { box-shadow: 0 0 12px rgba(0,212,255,0.50), 0 0 24px rgba(0,212,255,0.25); }
          50%       { box-shadow: 0 0 18px rgba(0,212,255,0.70), 0 0 36px rgba(0,212,255,0.35); }
        }
        @keyframes chess-thinking-dots {
          0%, 80%, 100% { opacity: 0; }
          40% { opacity: 1; }
        }
        @keyframes chess-knight-float {
          0%, 100% { transform: translateY(0) rotate(-5deg); }
          50%       { transform: translateY(-10px) rotate(5deg); }
        }
        @keyframes chess-victory-glow {
          0%, 100% { box-shadow: 0 0 40px rgba(0,212,255,0.20), 0 0 80px rgba(0,212,255,0.10); }
          50%       { box-shadow: 0 0 60px rgba(0,212,255,0.35), 0 0 120px rgba(0,212,255,0.18); }
        }
      `}</style>

      {/* Waiting for invite acceptance */}
      {gameData.status === 'pending' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }}>
          <div className="flex flex-col items-center gap-4 rounded-2xl p-10 text-center"
            style={{ background: 'rgba(0,20,50,0.92)', border: '1px solid rgba(0,212,255,0.30)', boxShadow: '0 0 60px rgba(0,212,255,0.20)' }}>
            <div style={{ fontSize: 48, animation: 'chess-knight-float 3.5s ease-in-out infinite' }}>♟️</div>
            <h2 className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>Waiting for opponent</h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Your invite is on its way. The game will start when they accept.</p>
            <button onClick={backToLobby}
              className="rounded-xl px-6 py-2.5 text-sm font-bold"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-muted)' }}>
              Cancel invite
            </button>
          </div>
        </div>
      )}

      {/* Victory / Defeat / Draw overlay */}
      {finished && (
        <div className="absolute inset-0 z-20 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}>
          <VictoryOverlay
            chess={chess}
            status={gameData.status}
            myColor={myColor}
            myPlayer={myPlayer}
            opponentPlayer={opponentPlayer}
            myTime={myTime}
            oppTime={oppTime}
            moveCount={moveCount}
            onBackToLobby={backToLobby}
          />
        </div>
      )}

      {/* ── Opponent player card ─────────────────────────���──────── */}
      <PlayerCard
        player={opponentPlayer}
        isMyTurn={isOpponentTurn}
        time={oppTime}
        captures={oppCaptures}
        advantage={oppAdvantage}
        isBot={botGame}
        isOpponent
        disconnected={!botGame && !opponentOnline}
        disconnectSeconds={disconnectSecondsLeft}
        captureColor={myColor === 'blue' ? 'dark' : 'light'}
      />

      {/* Board */}
      <ChessBoard
        chess={chess}
        myColor={myColor}
        lastMove={gameData.last_move}
        onMove={handleMove}
        disabled={!isMyTurn || finished}
      />

      {/* ── My player card ────────────────────────────���─────────── */}
      <PlayerCard
        player={myPlayer}
        isMyTurn={isMyTurn && !finished}
        time={myTime}
        captures={myCaptures}
        advantage={myAdvantage}
        captureColor={myColor === 'blue' ? 'light' : 'dark'}
      />

      {/* Resign */}
      {!finished && (
        resignConfirm ? (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Resign?</span>
            <button
              onClick={async () => { await resign(myColor); setResignConfirm(false); }}
              className="rounded-lg px-3 py-1 text-xs font-bold"
              style={{ background: 'rgba(239,68,68,0.20)', border: '1px solid rgba(239,68,68,0.40)', color: '#ef4444' }}>
              Yes, resign
            </button>
            <button onClick={() => setResignConfirm(false)}
              className="rounded-lg px-3 py-1 text-xs font-semibold"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-muted)' }}>
              Cancel
            </button>
          </div>
        ) : (
          <button onClick={() => setResignConfirm(true)}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold mt-1"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.12)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'}>
            <Flag className="h-3 w-3" /> Resign
          </button>
        )
      )}
    </div>
  );
}

/* ── Player Card ─────────────────────────���──────────────────────────────── */

interface PlayerCardProps {
  player: { id: string; username: string; avatar_url: string | null } | null;
  isMyTurn: boolean;
  time: number;
  captures: { type: string; count: number }[];
  advantage: number;
  isBot?: boolean;
  isOpponent?: boolean;
  disconnected?: boolean;
  disconnectSeconds?: number | null;
  captureColor: 'light' | 'dark';
}

function PlayerCard({
  player, isMyTurn, time, captures, advantage,
  isOpponent, disconnected, disconnectSeconds, captureColor,
}: PlayerCardProps) {
  const timeLow = time < 60;

  return (
    <div
      className="flex w-full items-center gap-3 rounded-2xl px-4 py-3"
      style={{
        maxWidth: 640,
        background: isMyTurn
          ? 'rgba(0,212,255,0.08)'
          : 'rgba(255,255,255,0.04)',
        border: isMyTurn
          ? '1px solid rgba(0,212,255,0.25)'
          : '1px solid rgba(255,255,255,0.08)',
        transition: 'background 0.3s, border-color 0.3s',
      }}
    >
      {/* Avatar with active-turn ring */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {isMyTurn && (
          <div style={{
            position: 'absolute',
            inset: -4,
            borderRadius: '50%',
            border: '2px solid rgba(0,212,255,0.60)',
            animation: 'chess-turn-ring 2s ease-in-out infinite',
            pointerEvents: 'none',
          }} />
        )}
        <AvatarImage
          username={player?.username ?? '?'}
          avatarUrl={player?.avatar_url}
          size="lg"
        />
      </div>

      {/* Name + status */}
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
          {player?.username ?? (isOpponent ? 'Opponent' : 'You')}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {isMyTurn && (
            <span className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: '#00d4ff' }}>
              Thinking
              <span style={{ display: 'inline-flex', gap: 1 }}>
                {[0, 1, 2].map(i => (
                  <span key={i} style={{
                    animation: `chess-thinking-dots 1.4s ease-in-out ${i * 0.2}s infinite`,
                    fontSize: 11,
                  }}>.</span>
                ))}
              </span>
            </span>
          )}
          {!isMyTurn && !disconnected && (
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {isOpponent ? 'Waiting' : 'Your turn next'}
            </span>
          )}
          {disconnected && disconnectSeconds !== null && disconnectSeconds !== undefined && (
            <span className="flex items-center gap-1 text-[11px] font-bold" style={{ color: '#f59e0b' }}>
              <WifiOff className="h-3 w-3" /> Disconnected ({disconnectSeconds}s)
            </span>
          )}
        </div>

        {/* Captured pieces */}
        {captures.length > 0 && (
          <div className="flex flex-wrap items-center gap-0.5 mt-1">
            {captures.map(({ type, count }) =>
              Array.from({ length: count }).map((_, i) => (
                <span key={`${type}-${i}`} style={{
                  fontSize: 13,
                  color: captureColor === 'light' ? 'var(--text-primary)' : 'var(--text-muted)',
                  opacity: 0.8,
                }}>
                  {PIECE_GLYPHS[type]}
                </span>
              ))
            )}
            {advantage > 0 && (
              <span className="text-[11px] font-bold ml-1" style={{ color: 'var(--text-muted)' }}>+{advantage}</span>
            )}
          </div>
        )}
      </div>

      {/* Timer */}
      <div className="flex flex-col items-end gap-0.5" style={{ flexShrink: 0 }}>
        <div
          className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-mono text-sm font-bold"
          style={{
            background: isMyTurn
              ? timeLow ? 'rgba(239,68,68,0.20)' : 'rgba(0,212,255,0.15)'
              : 'rgba(255,255,255,0.06)',
            border: isMyTurn
              ? timeLow ? '1px solid rgba(239,68,68,0.40)' : '1px solid rgba(0,212,255,0.30)'
              : '1px solid rgba(255,255,255,0.10)',
            color: isMyTurn
              ? timeLow ? '#ef4444' : '#00d4ff'
              : 'var(--text-muted)',
            minWidth: 72,
            justifyContent: 'center',
          }}
        >
          <Timer className="h-3.5 w-3.5" style={{ opacity: 0.7 }} />
          {formatTime(time)}
        </div>
        {isOpponent && !disconnected && (
          <Wifi className="h-3 w-3 mr-1" style={{ color: 'rgba(52,211,153,0.50)' }} />
        )}
      </div>
    </div>
  );
}

/* ── Victory Overlay ───────────────────────────────���────────────────────── */

interface VictoryOverlayProps {
  chess: Chess;
  status: string;
  myColor: 'blue' | 'green';
  myPlayer: { id: string; username: string; avatar_url: string | null } | null;
  opponentPlayer: { id: string; username: string; avatar_url: string | null } | null;
  myTime: number;
  oppTime: number;
  moveCount: number;
  onBackToLobby: () => void;
}

function VictoryOverlay({
  chess, status, myColor, myPlayer, opponentPlayer,
  myTime, oppTime, moveCount, onBackToLobby,
}: VictoryOverlayProps) {
  const details = getWinDetails(chess, status, myColor);
  const isWin = details.icon === 'win';
  const isDraw = details.icon === 'draw';

  return (
    <div
      className="flex flex-col items-center gap-5 rounded-3xl p-8 text-center"
      style={{
        background: 'rgba(0,20,50,0.95)',
        border: isWin
          ? '1px solid rgba(0,212,255,0.40)'
          : isDraw
            ? '1px solid rgba(245,158,11,0.30)'
            : '1px solid rgba(255,255,255,0.15)',
        animation: isWin ? 'chess-victory-glow 3s ease-in-out infinite' : undefined,
        minWidth: 320,
        maxWidth: 400,
      }}
    >
      {/* Icon */}
      <div style={{ fontSize: 56 }}>
        {isWin ? <Crown className="h-14 w-14" style={{ color: '#00d4ff' }} />
         : isDraw ? <Handshake className="h-14 w-14" style={{ color: '#f59e0b' }} />
         : <Swords className="h-14 w-14" style={{ color: 'var(--text-muted)' }} />}
      </div>

      {/* Title */}
      <div>
        <h2 className="text-3xl font-black" style={{
          color: isWin ? '#00d4ff' : isDraw ? '#f59e0b' : 'var(--text-primary)',
        }}>
          {details.title}
        </h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          {details.subtitle}
        </p>
      </div>

      {/* Player matchup */}
      <div className="flex items-center gap-4 w-full justify-center">
        <div className="flex flex-col items-center gap-1">
          <AvatarImage username={myPlayer?.username ?? '?'} avatarUrl={myPlayer?.avatar_url} size="lg" />
          <span className="text-xs font-semibold truncate max-w-[80px]" style={{ color: 'var(--text-primary)' }}>
            {myPlayer?.username ?? 'You'}
          </span>
        </div>
        <span className="text-lg font-black" style={{ color: 'var(--text-muted)' }}>vs</span>
        <div className="flex flex-col items-center gap-1">
          <AvatarImage username={opponentPlayer?.username ?? '?'} avatarUrl={opponentPlayer?.avatar_url} size="lg" />
          <span className="text-xs font-semibold truncate max-w-[80px]" style={{ color: 'var(--text-primary)' }}>
            {opponentPlayer?.username ?? 'Opponent'}
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex gap-4 w-full justify-center">
        <StatBadge label="Moves" value={String(moveCount)} />
        <StatBadge label="Your time" value={formatTime(myTime)} />
        <StatBadge label="Opp. time" value={formatTime(oppTime)} />
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-1">
        <button
          onClick={onBackToLobby}
          className="flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold"
          style={{
            background: 'rgba(0,212,255,0.15)',
            border: '1px solid rgba(0,212,255,0.40)',
            color: '#00d4ff',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(0,212,255,0.25)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(0,212,255,0.15)'}
        >
          <RotateCcw className="h-4 w-4" />
          Play Again
        </button>
      </div>
    </div>
  );
}

function StatBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-xl px-3 py-2"
      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}
