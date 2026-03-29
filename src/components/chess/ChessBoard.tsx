import { useState, useCallback, memo } from 'react';
import type { Chess, Square } from 'chess.js';

/* ── Piece glyphs ────────────────────────────────────────────────────────────
   White uses outline glyphs (♔♕♖♗♘♙), black uses filled (♚♛♜♝♞♟).
   Both render cleanly at large sizes with drop-shadows for depth. */
const WHITE_GLYPHS: Record<string, string> = {
  k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙',
};
const BLACK_GLYPHS: Record<string, string> = {
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
};

interface ChessBoardProps {
  chess: Chess;
  myColor: 'blue' | 'green';
  lastMove: { from: string; to: string } | null;
  onMove: (from: Square, to: Square, promotion?: string) => void;
  disabled: boolean;
}

/* ── Individual square ──────────────────────────────────────────────────── */
interface SquareProps {
  sq: Square;
  piece: ReturnType<Chess['get']>;
  isLight: boolean;
  isSelected: boolean;
  isValidTarget: boolean;
  isLastFrom: boolean;
  isLastTo: boolean;
  isKingInCheck: boolean;
  disabled: boolean;
  onClick: (sq: Square) => void;
  size: number;
}

const SquareCell = memo(function SquareCell({
  sq, piece, isLight, isSelected, isValidTarget,
  isLastFrom, isLastTo, isKingInCheck, disabled, onClick, size,
}: SquareProps) {
  let bg: string;
  if (isSelected) {
    bg = 'rgba(168,85,247,0.50)';
  } else if (isKingInCheck) {
    bg = 'rgba(239,68,68,0.50)';
  } else if (isLastFrom || isLastTo) {
    bg = isLight
      ? 'rgba(245,180,50,0.32)'
      : 'rgba(245,180,50,0.22)';
  } else if (isLight) {
    bg = 'rgba(255,255,255,0.62)';
  } else {
    bg = 'rgba(0,90,180,0.18)';
  }

  const isWhitePiece = piece?.color === 'w';
  const glyph = piece
    ? (isWhitePiece ? WHITE_GLYPHS[piece.type] : BLACK_GLYPHS[piece.type])
    : null;

  return (
    <div
      onClick={() => onClick(sq)}
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: bg,
        cursor: disabled ? 'default' : 'pointer',
        position: 'relative',
        boxShadow: isLight && !isSelected && !isLastFrom && !isLastTo && !isKingInCheck
          ? 'inset 0 1px 2px rgba(255,255,255,0.50)'
          : undefined,
      }}
    >
      {/* Valid move dot */}
      {isValidTarget && !piece && (
        <div style={{
          width: size * 0.28,
          height: size * 0.28,
          borderRadius: '50%',
          background: 'rgba(0,212,255,0.55)',
          boxShadow: '0 0 6px rgba(0,212,255,0.50)',
        }} />
      )}

      {/* Valid capture ring */}
      {isValidTarget && piece && (
        <div style={{
          position: 'absolute',
          inset: 2,
          border: '3px solid rgba(0,212,255,0.65)',
          borderRadius: 4,
          boxShadow: 'inset 0 0 6px rgba(0,212,255,0.25)',
          pointerEvents: 'none',
        }} />
      )}

      {/* Piece */}
      {glyph && (
        <span style={{
          fontSize: size * 0.68,
          lineHeight: 1,
          color: isWhitePiece ? '#ffffff' : '#1a1a2e',
          textShadow: isWhitePiece
            ? '0 1px 3px rgba(0,0,0,0.55), 0 0 1px rgba(0,0,0,0.30)'
            : '0 1px 2px rgba(0,0,0,0.35)',
          userSelect: 'none',
          zIndex: 1,
          position: 'relative',
          filter: isSelected ? 'drop-shadow(0 0 6px rgba(168,85,247,0.70))' : undefined,
        }}>
          {glyph}
        </span>
      )}
    </div>
  );
});

/* ── Board ──────────────────────────────────────────────────────────────── */
export function ChessBoard({ chess, myColor, lastMove, onMove, disabled }: ChessBoardProps) {
  const [selected, setSelected]     = useState<Square | null>(null);
  const [validMoves, setValidMoves] = useState<Square[]>([]);

  const flipped      = myColor === 'green';
  const files        = ['a','b','c','d','e','f','g','h'];
  const ranks        = ['8','7','6','5','4','3','2','1'];
  const orderedFiles = flipped ? [...files].reverse() : files;
  const orderedRanks = flipped ? [...ranks].reverse() : ranks;

  const handleSquareClick = useCallback((sq: Square) => {
    if (disabled) return;

    if (selected) {
      if (validMoves.includes(sq)) {
        const piece = chess.get(selected);
        const isPromotion =
          piece?.type === 'p' &&
          ((myColor === 'blue'  && sq[1] === '8') ||
           (myColor === 'green' && sq[1] === '1'));
        onMove(selected, sq, isPromotion ? 'q' : undefined);
        setSelected(null);
        setValidMoves([]);
        return;
      }
      const piece = chess.get(sq);
      const isMyPiece =
        piece &&
        ((myColor === 'blue'  && piece.color === 'w') ||
         (myColor === 'green' && piece.color === 'b'));
      if (isMyPiece) {
        const moves = chess.moves({ square: sq, verbose: true }).map(m => m.to as Square);
        setSelected(sq);
        setValidMoves(moves);
        return;
      }
      setSelected(null);
      setValidMoves([]);
      return;
    }

    const piece = chess.get(sq);
    const isMyPiece =
      piece &&
      ((myColor === 'blue'  && piece.color === 'w') ||
       (myColor === 'green' && piece.color === 'b'));
    if (!isMyPiece) return;
    const moves = chess.moves({ square: sq, verbose: true }).map(m => m.to as Square);
    setSelected(sq);
    setValidMoves(moves);
  }, [disabled, selected, validMoves, chess, myColor, onMove]);

  const SQ = 56;

  return (
    <div style={{
      display: 'inline-block',
      borderRadius: 16,
      overflow: 'hidden',
      background: 'rgba(255,255,255,0.10)',
      backdropFilter: 'blur(20px) saturate(1.6)',
      WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
      border: '1px solid rgba(255,255,255,0.22)',
      boxShadow: '0 8px 40px rgba(0,60,140,0.22), inset 0 1px 0 rgba(255,255,255,0.30)',
    }}>
      <div style={{ display: 'flex' }}>
        {/* Rank labels */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-around',
          padding: `4px 5px ${20 + 4}px 7px`,
        }}>
          {orderedRanks.map(r => (
            <span key={r} style={{
              fontSize: 10,
              color: 'var(--text-muted)',
              fontWeight: 700,
              width: 12,
              height: SQ,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0.7,
            }}>
              {r}
            </span>
          ))}
        </div>

        <div>
          {/* Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(8, ${SQ}px)`,
            gridTemplateRows: `repeat(8, ${SQ}px)`,
            borderRadius: 8,
            overflow: 'hidden',
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)',
          }}>
            {orderedRanks.map(rank =>
              orderedFiles.map(file => {
                const sq      = `${file}${rank}` as Square;
                const piece   = chess.get(sq);
                const isLight = (file.charCodeAt(0) + parseInt(rank)) % 2 === 0;
                const isKingInCheck =
                  chess.inCheck() &&
                  piece?.type === 'k' &&
                  piece.color === chess.turn();

                return (
                  <SquareCell
                    key={sq}
                    sq={sq}
                    piece={piece}
                    isLight={isLight}
                    isSelected={sq === selected}
                    isValidTarget={validMoves.includes(sq)}
                    isLastFrom={lastMove?.from === sq}
                    isLastTo={lastMove?.to === sq}
                    isKingInCheck={isKingInCheck}
                    disabled={disabled}
                    onClick={handleSquareClick}
                    size={SQ}
                  />
                );
              })
            )}
          </div>

          {/* File labels */}
          <div style={{
            display: 'flex',
            paddingBottom: 5,
            paddingTop: 4,
          }}>
            {orderedFiles.map(f => (
              <span key={f} style={{
                width: SQ,
                textAlign: 'center',
                fontSize: 10,
                color: 'var(--text-muted)',
                fontWeight: 700,
                opacity: 0.7,
              }}>
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
