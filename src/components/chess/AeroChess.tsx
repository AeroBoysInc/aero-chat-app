import { useChessStore } from '../../store/chessStore';
import { ChessLobby } from './ChessLobby';
import { ChessQueue } from './ChessQueue';
import { ChessGame }  from './ChessGame';

export function AeroChess() {
  const { phase } = useChessStore();

  if (phase === 'lobby') return <ChessLobby />;
  if (phase === 'queue') return <ChessQueue />;
  if (phase === 'game')  return <ChessGame />;
  return null;
}
