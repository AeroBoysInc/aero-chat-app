import { useState, useCallback } from 'react';
import type { Chess, Square } from 'chess.js';

// Unicode pieces — filled black glyphs, colored via CSS
const GLYPHS: Record<string, string> = {
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
};

interface ChessBoardProps {
  chess: Chess;
  myColor: 'blue' | 'green';
  lastMove: { from: string; to: string } | null;
  onMove: (from: Square, to: Square, promotion?: string) => void;
  disabled: boolean;
}

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
      // Re-select own piece
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

    // Select a piece
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

  const boardSize = 52; // px per square

  return (
    <div style={{
      display: 'inline-block',
      borderRadius: 14,
      overflow: 'hidden',
      boxShadow: '0 8px 40px rgba(0,150,255,0.25), 0 0 0 2px rgba(0,212,255,0.20)',
    }}>
      <div style={{ display: 'flex' }}>
        {/* Rank labels */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          justifyContent: 'space-around',
          padding: '0 4px 20px 6px',
          background: 'rgba(0,130,210,0.15)',
        }}>
          {orderedRanks.map(r => (
            <span key={r} style={{
              fontSize: 10, color: 'rgba(0,212,255,0.65)', fontWeight: 700,
              width: 10, height: boardSize,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {r}
            </span>
          ))}
        </div>

        <div>
          {/* Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(8, ${boardSize}px)`,
            gridTemplateRows:    `repeat(8, ${boardSize}px)`,
          }}>
            {orderedRanks.map(rank =>
              orderedFiles.map(file => {
                const sq      = `${file}${rank}` as Square;
                const piece   = chess.get(sq);
                const isLight = (file.charCodeAt(0) + parseInt(rank)) % 2 === 0;
                const isSelected    = sq === selected;
                const isValidTarget = validMoves.includes(sq);
                const isLastFrom    = lastMove?.from === sq;
                const isLastTo      = lastMove?.to   === sq;
                const isKingInCheck =
                  chess.inCheck() &&
                  piece?.type === 'k' &&
                  piece.color === chess.turn();

                let bg: string;
                if (isSelected) {
                  bg = 'rgba(168,85,247,0.55)';
                } else if (isLastFrom || isLastTo) {
                  bg = isLight ? 'rgba(245,158,11,0.40)' : 'rgba(245,158,11,0.28)';
                } else if (isKingInCheck) {
                  bg = 'rgba(239,68,68,0.60)';
                } else if (isLight) {
                  bg = 'radial-gradient(ellipse at 30% 35%, rgba(255,255,255,0.92) 0%, rgba(200,235,255,0.82) 55%, rgba(160,215,255,0.72) 100%)';
                } else {
                  bg = 'rgba(0,130,210,0.24)';
                }

                const pieceColor = piece
                  ? (piece.color === 'w' ? '#00d4ff' : '#34d399')
                  : undefined;

                return (
                  <div
                    key={sq}
                    onClick={() => handleSquareClick(sq)}
                    style={{
                      width: boardSize, height: boardSize,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: bg,
                      cursor: disabled ? 'default' : 'pointer',
                      position: 'relative',
                      transition: 'background 0.1s',
                      boxShadow: isLight && !isSelected && !isLastFrom && !isLastTo && !isKingInCheck
                        ? 'inset 0 1px 3px rgba(255,255,255,0.55)'
                        : undefined,
                    }}
                  >
                    {/* Valid move dot (empty square) */}
                    {isValidTarget && !piece && (
                      <div style={{
                        width: 16, height: 16, borderRadius: '50%',
                        background: 'rgba(0,212,255,0.60)',
                        boxShadow: '0 0 8px rgba(0,212,255,0.65)',
                        pointerEvents: 'none',
                      }} />
                    )}

                    {/* Valid capture ring */}
                    {isValidTarget && piece && (
                      <div style={{
                        position: 'absolute', inset: 2,
                        border: '3px solid rgba(0,212,255,0.75)',
                        borderRadius: 4,
                        boxShadow: 'inset 0 0 8px rgba(0,212,255,0.30)',
                        pointerEvents: 'none',
                      }} />
                    )}

                    {/* Piece */}
                    {piece && (
                      <span style={{
                        fontSize: 34, lineHeight: 1,
                        color: pieceColor,
                        textShadow: pieceColor === '#00d4ff'
                          ? '0 0 10px rgba(0,212,255,0.85), 0 1px 2px rgba(0,0,0,0.40)'
                          : '0 0 10px rgba(52,211,153,0.85), 0 1px 2px rgba(0,0,0,0.40)',
                        userSelect: 'none',
                        zIndex: 1,
                        position: 'relative',
                      }}>
                        {GLYPHS[piece.type]}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* File labels */}
          <div style={{
            display: 'flex',
            background: 'rgba(0,130,210,0.15)',
            paddingBottom: 4, paddingTop: 2,
          }}>
            <div style={{ width: 0 }} /> {/* spacer aligns with rank label column */}
            {orderedFiles.map(f => (
              <span key={f} style={{
                width: boardSize, textAlign: 'center',
                fontSize: 10, color: 'rgba(0,212,255,0.65)', fontWeight: 700,
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
