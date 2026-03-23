# AeroChess Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real-time multiplayer chess game (AeroChess) to aero-chat-app with Supabase-backed matchmaking, friend invites via encrypted chat messages, and a full-layout takeover UI with Frutiger Aero cloud aesthetics.

**Architecture:** A new `chessStore` (Zustand) drives a `CHESS LAYER` added to `ChatLayout` — the same absolute-positioned layer pattern already used by the GAME LAYER and DEV LAYER. Chess.js handles all local move validation/FEN; Supabase `chess_games` + `chess_queue` tables handle persistence and Realtime sync. Friend invites are sent as encrypted messages with a `__CHESS_INVITE__:` prefix, detected in `ChatWindow` and rendered as an invite card.

**Tech Stack:** `chess.js` v1.x, Supabase Realtime (postgres_changes), Zustand, React 19, Tailwind + inline Aero styles, Unicode chess glyphs colored with CSS.

---

## File Map

### New files
| File | Responsibility |
|------|---------------|
| `supabase/migrations/009_chess.sql` | `chess_games` + `chess_queue` tables + RLS |
| `src/store/chessStore.ts` | All chess state: view flag, lobby/queue/game phase, game data, actions |
| `src/components/chess/AeroChess.tsx` | Root chess component — routes between Lobby / Queue / Game views |
| `src/components/chess/ChessLobby.tsx` | Find-a-match button + friends list for invite |
| `src/components/chess/ChessQueue.tsx` | Waiting-for-opponent animation + cancel |
| `src/components/chess/ChessGame.tsx` | Active game: heartbeat, disconnect timer, resign |
| `src/components/chess/ChessBoard.tsx` | 8×8 cloud board + piece rendering + move selection |
| `src/components/chess/ChessInviteCard.tsx` | Accept/Decline card rendered inside ChatWindow |

### Modified files
| File | Change |
|------|--------|
| `src/components/chat/ChatLayout.tsx` | Add CHESS LAYER (absolute div, same pattern as GAME LAYER) |
| `src/components/chat/ChatWindow.tsx` | Detect `__CHESS_INVITE__:` prefix in decrypted messages; render `<ChessInviteCard />` |
| `src/components/corners/GamesCorner.tsx` | Add Chess entry card that calls `chessStore.openLobby()` |
| `src/store/cornerStore.ts` | No change needed |

---

## Task 1: Install chess.js + create migration

**Files:**
- Create: `supabase/migrations/009_chess.sql`

- [ ] **Step 1.1: Install chess.js**

```bash
cd "aero-chat-app" && pnpm add chess.js
```

Expected: `chess.js` appears in `package.json` dependencies.

- [ ] **Step 1.2: Create migration 009**

Create `supabase/migrations/009_chess.sql`:

```sql
-- Migration 009: AeroChess — chess_games + chess_queue tables

CREATE TABLE public.chess_games (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  blue_player_id   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  green_player_id  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  fen              TEXT        NOT NULL DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  status           TEXT        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending','active','blue_wins','green_wins','draw','abandoned')),
  last_move        JSONB,
  blue_last_seen   TIMESTAMPTZ DEFAULT now(),
  green_last_seen  TIMESTAMPTZ DEFAULT now(),
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.chess_queue (
  id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID  REFERENCES public.profiles(id) ON DELETE CASCADE,
  status      TEXT  NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','matched')),
  game_id     UUID  REFERENCES public.chess_games(id),
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id)
);

-- RLS
ALTER TABLE public.chess_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chess_queue ENABLE ROW LEVEL SECURITY;

-- chess_games: players can read/insert/update games they belong to
CREATE POLICY "chess_games_select" ON public.chess_games FOR SELECT
  USING (auth.uid() = blue_player_id OR auth.uid() = green_player_id);

CREATE POLICY "chess_games_insert" ON public.chess_games FOR INSERT
  WITH CHECK (auth.uid() = blue_player_id OR auth.uid() = green_player_id);

CREATE POLICY "chess_games_update" ON public.chess_games FOR UPDATE
  USING (auth.uid() = blue_player_id OR auth.uid() = green_player_id);

-- chess_queue: authenticated users can read all waiting entries (needed for matchmaking);
-- users can only write their own entry
CREATE POLICY "chess_queue_select" ON public.chess_queue FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "chess_queue_insert" ON public.chess_queue FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "chess_queue_update" ON public.chess_queue FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "chess_queue_delete" ON public.chess_queue FOR DELETE
  USING (auth.uid() = user_id);
```

- [ ] **Step 1.3: Run migration in Supabase dashboard**

Open the Supabase SQL editor for the project and paste + run the contents of `009_chess.sql`.

Verify: both tables appear in the Table Editor with RLS enabled.

- [ ] **Step 1.4: Commit**

```bash
cd "aero-chat-app"
git add supabase/migrations/009_chess.sql package.json pnpm-lock.yaml
git commit -m "feat: add chess.js dep + migration 009 (chess_games, chess_queue)"
```

---

## Task 2: chessStore

**Files:**
- Create: `src/store/chessStore.ts`

- [ ] **Step 2.1: Create `src/store/chessStore.ts`**

```typescript
import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export type ChessPhase = 'lobby' | 'queue' | 'game';
export type ChessColor = 'blue' | 'green';

export interface ChessGameRow {
  id: string;
  blue_player_id: string;
  green_player_id: string;
  fen: string;
  status: 'pending' | 'active' | 'blue_wins' | 'green_wins' | 'draw' | 'abandoned';
  last_move: { from: string; to: string; promotion?: string } | null;
  blue_last_seen: string;
  green_last_seen: string;
  updated_at: string;
}

interface ChessState {
  // View
  chessViewActive: boolean;
  phase: ChessPhase | null;

  // Queue
  queueEntryId: string | null;

  // Game
  gameId: string | null;
  gameData: ChessGameRow | null;
  myColor: ChessColor | null;

  // Disconnect grace
  disconnectSecondsLeft: number | null;

  // Actions
  openLobby:  () => void;
  closeChess: () => void;

  joinQueue:  (userId: string) => Promise<void>;
  leaveQueue: () => Promise<void>;

  /** Called after matchmaking or invite acceptance — subscribes to game channel */
  startGame: (gameId: string, myColor: ChessColor) => Promise<void>;

  makeMove:  (from: string, to: string, promotion?: string) => Promise<void>;
  resign:    (myColor: ChessColor) => Promise<void>;
  acceptDraw: () => Promise<void>;

  updateHeartbeat: (myColor: ChessColor) => Promise<void>;
  setGameData: (data: ChessGameRow) => void;
  setDisconnectSecondsLeft: (n: number | null) => void;
}

let _gameChannel: ReturnType<typeof supabase.channel> | null = null;
let _queueChannel: ReturnType<typeof supabase.channel> | null = null;

export const useChessStore = create<ChessState>((set, get) => ({
  chessViewActive: false,
  phase: null,
  queueEntryId: null,
  gameId: null,
  gameData: null,
  myColor: null,
  disconnectSecondsLeft: null,

  openLobby: () => set({ chessViewActive: true, phase: 'lobby' }),

  closeChess: () => {
    // Clean up channels
    if (_gameChannel)  { supabase.removeChannel(_gameChannel);  _gameChannel  = null; }
    if (_queueChannel) { supabase.removeChannel(_queueChannel); _queueChannel = null; }
    // Remove own queue entry if still waiting
    const { queueEntryId } = get();
    if (queueEntryId) {
      supabase.from('chess_queue').delete().eq('id', queueEntryId);
    }
    set({
      chessViewActive: false,
      phase: null,
      queueEntryId: null,
      gameId: null,
      gameData: null,
      myColor: null,
      disconnectSecondsLeft: null,
    });
  },

  joinQueue: async (userId) => {
    // Check for an existing waiting player
    const { data: waiting } = await supabase
      .from('chess_queue')
      .select('*, profile:profiles!user_id(id,username)')
      .eq('status', 'waiting')
      .neq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (waiting) {
      // Match found — randomize colors
      const blueIsMe = Math.random() < 0.5;
      const blueId   = blueIsMe ? userId : waiting.user_id;
      const greenId  = blueIsMe ? waiting.user_id : userId;
      const myColor: ChessColor = blueIsMe ? 'blue' : 'green';

      const { data: game, error } = await supabase
        .from('chess_games')
        .insert({ blue_player_id: blueId, green_player_id: greenId, status: 'active' })
        .select()
        .single();

      if (error || !game) return;

      // Update both queue entries
      await supabase
        .from('chess_queue')
        .update({ status: 'matched', game_id: game.id })
        .eq('id', waiting.id);

      // For myself, insert + immediately update (or just skip queue for myself)
      const { data: myEntry } = await supabase
        .from('chess_queue')
        .insert({ user_id: userId, status: 'matched', game_id: game.id })
        .select()
        .single();

      set({ queueEntryId: myEntry?.id ?? null });
      await get().startGame(game.id, myColor);
    } else {
      // No match — insert into queue and wait
      const { data: entry } = await supabase
        .from('chess_queue')
        .insert({ user_id: userId })
        .select()
        .single();

      if (!entry) return;
      set({ queueEntryId: entry.id, phase: 'queue' });

      // Subscribe to own queue entry for the 'matched' update
      _queueChannel = supabase
        .channel(`chess_queue:${entry.id}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'chess_queue',
          filter: `id=eq.${entry.id}`,
        }, async (payload) => {
          const row = payload.new as { status: string; game_id: string };
          if (row.status !== 'matched' || !row.game_id) return;
          // Determine color from the game row
          const { data: game } = await supabase
            .from('chess_games')
            .select('*')
            .eq('id', row.game_id)
            .single();
          if (!game) return;
          const myColor: ChessColor = game.blue_player_id === userId ? 'blue' : 'green';
          await get().startGame(row.game_id, myColor);
        })
        .subscribe();
    }
  },

  leaveQueue: async () => {
    const { queueEntryId } = get();
    if (queueEntryId) {
      await supabase.from('chess_queue').delete().eq('id', queueEntryId);
    }
    if (_queueChannel) { supabase.removeChannel(_queueChannel); _queueChannel = null; }
    set({ queueEntryId: null, phase: 'lobby' });
  },

  startGame: async (gameId, myColor) => {
    // Fetch initial game state
    const { data: game } = await supabase
      .from('chess_games')
      .select('*')
      .eq('id', gameId)
      .single();

    set({ gameId, myColor, gameData: game as ChessGameRow, phase: 'game' });

    // Subscribe to game updates
    if (_gameChannel) { supabase.removeChannel(_gameChannel); }
    _gameChannel = supabase
      .channel(`chess_game:${gameId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chess_games',
        filter: `id=eq.${gameId}`,
      }, (payload) => {
        get().setGameData(payload.new as ChessGameRow);
      })
      .subscribe();
  },

  makeMove: async (from, to, promotion) => {
    const { gameId, gameData } = get();
    if (!gameId || !gameData) return;
    // chess.js validation happens in ChessGame before calling makeMove
    const { Chess } = await import('chess.js');
    const chess = new Chess(gameData.fen);
    const move = chess.move({ from, to, promotion: promotion ?? 'q' });
    if (!move) return;

    const newFen = chess.fen();
    let newStatus: ChessGameRow['status'] = 'active';
    if (chess.isCheckmate()) {
      newStatus = chess.turn() === 'w' ? 'green_wins' : 'blue_wins'; // loser just moved
    } else if (chess.isDraw()) {
      newStatus = 'draw';
    }

    await supabase
      .from('chess_games')
      .update({
        fen: newFen,
        last_move: { from, to, promotion },
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', gameId);
  },

  resign: async (myColor) => {
    const { gameId } = get();
    if (!gameId) return;
    const status = myColor === 'blue' ? 'green_wins' : 'blue_wins';
    await supabase.from('chess_games').update({ status }).eq('id', gameId);
  },

  acceptDraw: async () => {
    const { gameId } = get();
    if (!gameId) return;
    await supabase.from('chess_games').update({ status: 'draw' }).eq('id', gameId);
  },

  updateHeartbeat: async (myColor) => {
    const { gameId } = get();
    if (!gameId) return;
    const col = myColor === 'blue' ? 'blue_last_seen' : 'green_last_seen';
    await supabase
      .from('chess_games')
      .update({ [col]: new Date().toISOString() })
      .eq('id', gameId);
  },

  setGameData: (data) => set({ gameData: data }),
  setDisconnectSecondsLeft: (n) => set({ disconnectSecondsLeft: n }),
}));
```

- [ ] **Step 2.2: Verify TypeScript compiles**

```bash
cd "aero-chat-app" && pnpm build 2>&1 | tail -5
```

Expected: `✓ built` with exit 0.

- [ ] **Step 2.3: Commit**

```bash
cd "aero-chat-app"
git add src/store/chessStore.ts
git commit -m "feat: add chessStore (matchmaking, game sync, heartbeat)"
```

---

## Task 3: ChessBoard component

**Files:**
- Create: `src/components/chess/ChessBoard.tsx`

The board renders an 8×8 grid using a `chess.js` instance passed as a prop. It handles:
- Square coloring (cloud light / sky dark)
- Piece rendering (Unicode glyphs, blue/green colored)
- Move selection state (selected square → valid move highlights)
- Last move highlight
- Board flip for green player

- [ ] **Step 3.1: Create `src/components/chess/ChessBoard.tsx`**

```typescript
import { useState, useCallback } from 'react';
import type { Chess, Square } from 'chess.js';

// Unicode pieces — always use filled black glyphs, colored via CSS
const GLYPHS: Record<string, string> = {
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
};

interface ChessBoardProps {
  chess: Chess;                          // live chess.js instance (read-only here)
  myColor: 'blue' | 'green';
  lastMove: { from: string; to: string } | null;
  onMove: (from: Square, to: Square, promotion?: string) => void;
  disabled: boolean;                     // true when it's not my turn or game is over
}

export function ChessBoard({ chess, myColor, lastMove, onMove, disabled }: ChessBoardProps) {
  const [selected, setSelected] = useState<Square | null>(null);
  const [validMoves, setValidMoves] = useState<Square[]>([]);

  const flipped = myColor === 'green'; // green sees rank 8 at bottom

  const files = ['a','b','c','d','e','f','g','h'];
  const ranks = ['8','7','6','5','4','3','2','1'];

  const orderedFiles = flipped ? [...files].reverse() : files;
  const orderedRanks = flipped ? [...ranks].reverse() : ranks;

  const handleSquareClick = useCallback((sq: Square) => {
    if (disabled) return;

    // If a piece is already selected
    if (selected) {
      if (validMoves.includes(sq)) {
        // Check for pawn promotion
        const piece = chess.get(selected);
        const isPromotion =
          piece?.type === 'p' &&
          ((myColor === 'blue' && sq[1] === '8') ||
           (myColor === 'green' && sq[1] === '1'));

        onMove(selected, sq, isPromotion ? 'q' : undefined);
        setSelected(null);
        setValidMoves([]);
        return;
      }
      // Clicking own piece — reselect
      const piece = chess.get(sq);
      const isMyPiece =
        piece &&
        ((myColor === 'blue' && piece.color === 'w') ||
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

    // No piece selected — select one
    const piece = chess.get(sq);
    const isMyPiece =
      piece &&
      ((myColor === 'blue' && piece.color === 'w') ||
       (myColor === 'green' && piece.color === 'b'));

    if (!isMyPiece) return;
    const moves = chess.moves({ square: sq, verbose: true }).map(m => m.to as Square);
    setSelected(sq);
    setValidMoves(moves);
  }, [disabled, selected, validMoves, chess, myColor, onMove]);

  return (
    <div style={{
      display: 'inline-block',
      borderRadius: 14,
      overflow: 'hidden',
      boxShadow: '0 8px 40px rgba(0,150,255,0.25), 0 0 0 2px rgba(0,212,255,0.20)',
      background: 'rgba(0,180,255,0.15)',
    }}>
      {/* Rank labels + board */}
      <div style={{ display: 'flex' }}>
        {/* Rank labels left */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around', padding: '4px 4px 4px 6px' }}>
          {orderedRanks.map(r => (
            <span key={r} style={{ fontSize: 10, color: 'rgba(0,212,255,0.6)', fontWeight: 700, lineHeight: 1, width: 10, textAlign: 'center', height: 52, display: 'flex', alignItems: 'center' }}>
              {r}
            </span>
          ))}
        </div>

        {/* Grid */}
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 52px)', gridTemplateRows: 'repeat(8, 52px)' }}>
            {orderedRanks.map(rank =>
              orderedFiles.map(file => {
                const sq = `${file}${rank}` as Square;
                const piece = chess.get(sq);
                const isLight = (file.charCodeAt(0) + parseInt(rank)) % 2 === 0;
                const isSelected    = sq === selected;
                const isValidTarget = validMoves.includes(sq);
                const isLastFrom    = lastMove?.from === sq;
                const isLastTo      = lastMove?.to === sq;
                const isCheck       = chess.inCheck() &&
                  piece?.type === 'k' &&
                  ((chess.turn() === 'w' && piece.color === 'w') || (chess.turn() === 'b' && piece.color === 'b'));

                // Square background
                let bg = isLight
                  ? 'radial-gradient(ellipse at 30% 35%, rgba(255,255,255,0.90) 0%, rgba(200,235,255,0.80) 60%, rgba(160,215,255,0.70) 100%)'
                  : 'rgba(0,130,210,0.22)';

                if (isSelected)  bg = 'rgba(168,85,247,0.45)';
                if (isLastFrom || isLastTo) bg = isLight
                  ? 'rgba(245,158,11,0.35)'
                  : 'rgba(245,158,11,0.25)';
                if (isCheck) bg = 'rgba(239,68,68,0.55)';

                const pieceColor = piece
                  ? (piece.color === 'w' ? '#00d4ff' : '#34d399')
                  : undefined;

                return (
                  <div
                    key={sq}
                    onClick={() => handleSquareClick(sq)}
                    style={{
                      width: 52, height: 52,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: bg,
                      cursor: disabled ? 'default' : 'pointer',
                      position: 'relative',
                      transition: 'background 0.1s',
                      boxShadow: isLight ? 'inset 0 1px 3px rgba(255,255,255,0.6)' : undefined,
                    }}
                  >
                    {/* Valid move indicator */}
                    {isValidTarget && !piece && (
                      <div style={{
                        width: 16, height: 16,
                        borderRadius: '50%',
                        background: 'rgba(0,212,255,0.55)',
                        boxShadow: '0 0 8px rgba(0,212,255,0.6)',
                      }} />
                    )}
                    {isValidTarget && piece && (
                      <div style={{
                        position: 'absolute', inset: 0,
                        borderRadius: 0,
                        border: '3px solid rgba(0,212,255,0.70)',
                        boxShadow: 'inset 0 0 8px rgba(0,212,255,0.35)',
                        pointerEvents: 'none',
                      }} />
                    )}

                    {/* Piece */}
                    {piece && (
                      <span style={{
                        fontSize: 34,
                        lineHeight: 1,
                        color: pieceColor,
                        textShadow: pieceColor === '#00d4ff'
                          ? '0 0 10px rgba(0,212,255,0.80)'
                          : '0 0 10px rgba(52,211,153,0.80)',
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

          {/* File labels bottom */}
          <div style={{ display: 'flex', paddingLeft: 0, paddingBottom: 4 }}>
            {orderedFiles.map(f => (
              <span key={f} style={{ width: 52, textAlign: 'center', fontSize: 10, color: 'rgba(0,212,255,0.6)', fontWeight: 700 }}>
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3.2: Verify build**

```bash
cd "aero-chat-app" && pnpm build 2>&1 | tail -5
```

- [ ] **Step 3.3: Commit**

```bash
git add src/components/chess/ChessBoard.tsx
git commit -m "feat: ChessBoard component (cloud squares, cyan/green pieces, move highlights)"
```

---

## Task 4: ChessLobby + ChessQueue components

**Files:**
- Create: `src/components/chess/ChessLobby.tsx`
- Create: `src/components/chess/ChessQueue.tsx`

- [ ] **Step 4.1: Create `src/components/chess/ChessLobby.tsx`**

```typescript
import { useState } from 'react';
import { Swords, UserPlus, X } from 'lucide-react';
import { useChessStore } from '../../store/chessStore';
import { useAuthStore } from '../../store/authStore';
import { useFriendStore } from '../../store/friendStore';
import { AvatarImage } from '../ui/AvatarImage';
import { supabase } from '../../lib/supabase';
import { encryptMessage, loadPrivateKey } from '../../lib/crypto';

const CHESS_INVITE_PREFIX = '__CHESS_INVITE__';

export function ChessLobby() {
  const { closeChess, joinQueue, startGame } = useChessStore();
  const { user } = useAuthStore();
  const { friends } = useFriendStore();
  const [inviting, setInviting] = useState<string | null>(null); // friendId being invited

  async function handleFindMatch() {
    if (!user) return;
    await joinQueue(user.id);
  }

  async function handleInviteFriend(friendId: string) {
    if (!user) return;
    setInviting(friendId);

    // Randomize colors
    const blueIsMe = Math.random() < 0.5;
    const blueId   = blueIsMe ? user.id : friendId;
    const greenId  = blueIsMe ? friendId : user.id;
    const myColor  = blueIsMe ? 'blue' as const : 'green' as const;

    // Create game with 'pending' status
    const { data: game, error } = await supabase
      .from('chess_games')
      .insert({ blue_player_id: blueId, green_player_id: greenId, status: 'pending' })
      .select()
      .single();

    if (error || !game) { setInviting(null); return; }

    // Fetch friend's public key and send encrypted invite message
    const { data: profile } = await supabase
      .from('profiles')
      .select('public_key')
      .eq('id', friendId)
      .single();

    if (profile?.public_key) {
      const privateKey = loadPrivateKey(user.id);
      if (privateKey) {
        const content = `${CHESS_INVITE_PREFIX}:${game.id}:${user.username}`;
        const encrypted = encryptMessage(content, profile.public_key, privateKey);
        await supabase.from('messages').insert({
          sender_id: user.id,
          recipient_id: friendId,
          content: encrypted,
        });
      }
    }

    setInviting(null);
    await startGame(game.id, myColor);
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 p-8">
      <style>{`
        @keyframes chess-float {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-8px); }
        }
      `}</style>

      {/* Close */}
      <button
        onClick={closeChess}
        className="absolute top-5 right-5 flex h-9 w-9 items-center justify-center rounded-xl"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-muted)' }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.12)'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'}
      >
        <X className="h-4 w-4" />
      </button>

      {/* Logo */}
      <div style={{ animation: 'chess-float 3s ease-in-out infinite', fontSize: 64 }}>♟️</div>

      <div className="text-center">
        <h1 className="text-3xl font-black" style={{ color: 'var(--text-primary)', letterSpacing: -1 }}>
          Aero<span style={{ color: '#00d4ff' }}>Chess</span>
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          Real-time chess — Blue vs Green
        </p>
      </div>

      {/* Find match */}
      <button
        onClick={handleFindMatch}
        className="flex items-center gap-3 rounded-2xl px-8 py-4 text-base font-bold transition-all"
        style={{
          background: 'rgba(0,212,255,0.15)',
          border: '1px solid rgba(0,212,255,0.40)',
          color: '#00d4ff',
          boxShadow: '0 0 24px rgba(0,212,255,0.20)',
        }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(0,212,255,0.25)'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(0,212,255,0.15)'}
      >
        <Swords className="h-5 w-5" />
        Find a Match
      </button>

      {/* Invite friends */}
      {friends.length > 0 && (
        <div className="w-full max-w-sm">
          <p className="mb-3 text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
            <UserPlus className="inline h-3 w-3 mr-1" />
            Challenge a friend
          </p>
          <div className="flex flex-col gap-2">
            {friends.map(friend => (
              <button
                key={friend.id}
                onClick={() => handleInviteFriend(friend.id)}
                disabled={inviting === friend.id}
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
                <AvatarImage profile={friend} size={32} />
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
```

- [ ] **Step 4.2: Create `src/components/chess/ChessQueue.tsx`**

```typescript
import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useChessStore } from '../../store/chessStore';

export function ChessQueue() {
  const { leaveQueue } = useChessStore();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6">
      <style>{`
        @keyframes chess-pulse-ring {
          0%   { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(0,212,255,0.6); }
          70%  { transform: scale(1);    box-shadow: 0 0 0 20px rgba(0,212,255,0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(0,212,255,0); }
        }
        @keyframes chess-dots {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40%           { opacity: 1;   transform: scale(1.1); }
        }
      `}</style>

      {/* Pulsing orb */}
      <div style={{
        width: 80, height: 80,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,212,255,0.4) 0%, rgba(0,150,220,0.15) 100%)',
        animation: 'chess-pulse-ring 1.8s ease-in-out infinite',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 36,
      }}>
        ♟️
      </div>

      <div className="text-center">
        <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
          Finding opponent
          <span style={{ display: 'inline-flex', gap: 3, marginLeft: 4 }}>
            {[0,1,2].map(i => (
              <span key={i} style={{
                width: 4, height: 4,
                borderRadius: '50%',
                background: '#00d4ff',
                display: 'inline-block',
                animation: `chess-dots 1.4s ease-in-out ${i * 0.2}s infinite`,
              }} />
            ))}
          </span>
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
```

- [ ] **Step 4.3: Verify build**

```bash
cd "aero-chat-app" && pnpm build 2>&1 | tail -5
```

- [ ] **Step 4.4: Commit**

```bash
git add src/components/chess/ChessLobby.tsx src/components/chess/ChessQueue.tsx
git commit -m "feat: ChessLobby (find match + friend invite) + ChessQueue (waiting animation)"
```

---

## Task 5: ChessGame component

**Files:**
- Create: `src/components/chess/ChessGame.tsx`

This is the main active-game view. It owns:
- Local chess.js instance synced from Supabase FEN
- Heartbeat (10s interval)
- Disconnect detection (5s interval, 30s grace timer)
- Move handling (validate locally → write to Supabase)
- Sidebar: player info, captured pieces, turn indicator, resign button

- [ ] **Step 5.1: Create `src/components/chess/ChessGame.tsx`**

```typescript
import { useEffect, useRef, useState, useCallback } from 'react';
import { Chess, type Square } from 'chess.js';
import { Flag, RotateCcw } from 'lucide-react';
import { useChessStore } from '../../store/chessStore';
import { useAuthStore } from '../../store/authStore';
import { useFriendStore } from '../../store/friendStore';
import { ChessBoard } from './ChessBoard';
import { AvatarImage } from '../ui/AvatarImage';
import type { Profile } from '../../store/authStore';

const HEARTBEAT_MS        = 10_000;
const DISCONNECT_CHECK_MS = 5_000;
const GRACE_SECONDS       = 30;

function CapturedPieces({ pieces, color }: { pieces: string[]; color: 'blue' | 'green' }) {
  const glyphs: Record<string, string> = { k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟' };
  const c = color === 'blue' ? '#00d4ff' : '#34d399';
  return (
    <div className="flex flex-wrap gap-0.5" style={{ minHeight: 20 }}>
      {pieces.map((p, i) => (
        <span key={i} style={{ fontSize: 16, color: c, opacity: 0.7 }}>{glyphs[p] ?? p}</span>
      ))}
    </div>
  );
}

export function ChessGame() {
  const { gameData, myColor, makeMove, resign, closeChess, updateHeartbeat, setDisconnectSecondsLeft, disconnectSecondsLeft } = useChessStore();
  const { user } = useAuthStore();
  const { friends } = useFriendStore();

  const chessRef = useRef<Chess>(new Chess(gameData?.fen));
  const [, forceRender] = useState(0);
  const disconnectTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync chess.js when FEN changes from Supabase
  useEffect(() => {
    if (!gameData?.fen) return;
    try {
      chessRef.current = new Chess(gameData.fen);
      forceRender(n => n + 1);
    } catch { /* invalid FEN - ignore */ }
  }, [gameData?.fen]);

  // Heartbeat
  useEffect(() => {
    if (!myColor) return;
    const id = setInterval(() => updateHeartbeat(myColor), HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [myColor, updateHeartbeat]);

  // Disconnect detection
  useEffect(() => {
    if (!gameData || !myColor) return;

    const id = setInterval(() => {
      const g = useChessStore.getState().gameData;
      if (!g || g.status !== 'active') return;

      const opponentLastSeen = new Date(
        myColor === 'blue' ? g.green_last_seen : g.blue_last_seen
      ).getTime();
      const secondsAgo = (Date.now() - opponentLastSeen) / 1000;

      if (secondsAgo > GRACE_SECONDS) {
        // Grace expired — I win
        clearInterval(id);
        resign(myColor === 'blue' ? 'green' : 'blue'); // resign *for* opponent
      } else if (secondsAgo > 5) {
        // Opponent seems disconnected — start countdown
        const remaining = Math.ceil(GRACE_SECONDS - secondsAgo);
        setDisconnectSecondsLeft(remaining);
      } else {
        setDisconnectSecondsLeft(null);
      }
    }, DISCONNECT_CHECK_MS);

    disconnectTimerRef.current = id;
    return () => clearInterval(id);
  }, [gameData?.id, myColor]);

  const handleMove = useCallback(async (from: Square, to: Square, promotion?: string) => {
    await makeMove(from, to, promotion);
  }, [makeMove]);

  if (!gameData || !myColor) return null;

  const chess = chessRef.current;
  const isMyTurn = (myColor === 'blue' && chess.turn() === 'w') || (myColor === 'green' && chess.turn() === 'b');
  const isOver   = gameData.status !== 'active';

  // Opponent profile
  const opponentId = myColor === 'blue' ? gameData.green_player_id : gameData.blue_player_id;
  const opponent   = friends.find((f: Profile) => f.id === opponentId);

  // Captured pieces (simplified — count difference)
  const board = chess.board().flat().filter(Boolean);
  const blueCaptures: string[] = [];
  const greenCaptures: string[] = [];
  ['p','n','b','r','q'].forEach(type => {
    const startCount = type === 'p' ? 8 : type === 'q' ? 1 : 2;
    const blueCount  = board.filter(p => p?.type === type && p.color === 'w').length;
    const greenCount = board.filter(p => p?.type === type && p.color === 'b').length;
    for (let i = blueCount; i < startCount; i++) blueCaptures.push(type);
    for (let i = greenCount; i < startCount; i++) greenCaptures.push(type);
  });

  // Result message
  let resultMsg = '';
  if (gameData.status === 'blue_wins')  resultMsg = myColor === 'blue'  ? '🎉 You win!'     : '😔 You lost';
  if (gameData.status === 'green_wins') resultMsg = myColor === 'green' ? '🎉 You win!'     : '😔 You lost';
  if (gameData.status === 'draw')       resultMsg = '🤝 Draw!';
  if (gameData.status === 'abandoned')  resultMsg = '🏳 Game abandoned';

  return (
    <div className="flex h-full overflow-hidden" style={{ background: 'var(--sidebar-bg)' }}>

      {/* Board area */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4">

          {/* Disconnect warning */}
          {disconnectSecondsLeft !== null && (
            <div className="rounded-xl px-4 py-2 text-sm font-semibold"
              style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.40)', color: '#f59e0b' }}>
              ⚠ Opponent disconnected — {disconnectSecondsLeft}s until forfeit
            </div>
          )}

          {/* Result banner */}
          {isOver && (
            <div className="rounded-2xl px-6 py-3 text-lg font-black"
              style={{
                background: resultMsg.includes('win') ? 'rgba(0,212,255,0.12)' : 'rgba(255,255,255,0.07)',
                border: resultMsg.includes('win') ? '1px solid rgba(0,212,255,0.35)' : '1px solid rgba(255,255,255,0.12)',
                color: resultMsg.includes('win') ? '#00d4ff' : 'var(--text-primary)',
              }}>
              {resultMsg}
            </div>
          )}

          <ChessBoard
            chess={chess}
            myColor={myColor}
            lastMove={gameData.last_move}
            onMove={handleMove}
            disabled={!isMyTurn || isOver}
          />

          {/* Turn indicator */}
          {!isOver && (
            <p className="text-sm font-semibold" style={{ color: isMyTurn ? '#00d4ff' : 'var(--text-muted)' }}>
              {isMyTurn ? '⬆ Your turn' : "⏳ Opponent's turn"}
            </p>
          )}
        </div>
      </div>

      {/* Sidebar */}
      <div className="flex flex-col gap-4 p-5 w-56 flex-shrink-0"
        style={{ borderLeft: '1px solid var(--panel-divider)' }}>

        {/* Opponent */}
        <div className="flex flex-col gap-2">
          <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Opponent</p>
          <div className="flex items-center gap-2">
            {opponent ? (
              <AvatarImage profile={opponent} size={28} />
            ) : (
              <div className="h-7 w-7 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
            )}
            <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              {opponent?.username ?? 'Opponent'}
            </span>
            <span className="ml-auto text-lg">
              {myColor === 'blue' ? '🟢' : '🔵'}
            </span>
          </div>
          <CapturedPieces pieces={myColor === 'blue' ? greenCaptures : blueCaptures} color={myColor === 'blue' ? 'blue' : 'green'} />
        </div>

        <div style={{ height: 1, background: 'var(--panel-divider)' }} />

        {/* Me */}
        <div className="flex flex-col gap-2">
          <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>You</p>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: myColor === 'blue' ? 'rgba(0,212,255,0.20)' : 'rgba(52,211,153,0.20)', color: myColor === 'blue' ? '#00d4ff' : '#34d399' }}>
              {user?.username?.[0]?.toUpperCase()}
            </div>
            <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{user?.username}</span>
            <span className="ml-auto text-lg">{myColor === 'blue' ? '🔵' : '🟢'}</span>
          </div>
          <CapturedPieces pieces={myColor === 'blue' ? blueCaptures : greenCaptures} color={myColor} />
        </div>

        <div className="flex-1" />

        {/* Actions */}
        {!isOver ? (
          <button
            onClick={() => resign(myColor)}
            className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all"
            style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.28)', color: '#ef4444' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.20)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.10)'}
          >
            <Flag className="h-4 w-4" />
            Resign
          </button>
        ) : (
          <button
            onClick={closeChess}
            className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all"
            style={{ background: 'rgba(0,212,255,0.12)', border: '1px solid rgba(0,212,255,0.35)', color: '#00d4ff' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(0,212,255,0.22)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(0,212,255,0.12)'}
          >
            <RotateCcw className="h-4 w-4" />
            Back to chat
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5.2: Verify build**

```bash
cd "aero-chat-app" && pnpm build 2>&1 | tail -5
```

- [ ] **Step 5.3: Commit**

```bash
git add src/components/chess/ChessGame.tsx
git commit -m "feat: ChessGame component (heartbeat, disconnect detection, resign)"
```

---

## Task 6: AeroChess root + ChessInviteCard

**Files:**
- Create: `src/components/chess/AeroChess.tsx`
- Create: `src/components/chess/ChessInviteCard.tsx`

- [ ] **Step 6.1: Create `src/components/chess/AeroChess.tsx`**

```typescript
import { useChessStore } from '../../store/chessStore';
import { ChessLobby }  from './ChessLobby';
import { ChessQueue }  from './ChessQueue';
import { ChessGame }   from './ChessGame';

export function AeroChess() {
  const { phase } = useChessStore();

  return (
    <div className="flex h-full flex-col relative" style={{ background: 'var(--sidebar-bg)', borderRadius: 16, border: '1px solid var(--sidebar-border)', overflow: 'hidden' }}>
      {phase === 'lobby' && <ChessLobby />}
      {phase === 'queue' && <ChessQueue />}
      {phase === 'game'  && <ChessGame />}
    </div>
  );
}
```

- [ ] **Step 6.2: Create `src/components/chess/ChessInviteCard.tsx`**

```typescript
import { useState } from 'react';
import { useChessStore } from '../../store/chessStore';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';

interface ChessInviteCardProps {
  gameId: string;
  inviterName: string;
  messageId: string;
}

export function ChessInviteCard({ gameId, inviterName }: ChessInviteCardProps) {
  const { startGame, openLobby, chessViewActive } = useChessStore();
  const { user } = useAuthStore();
  const [accepted, setAccepted] = useState(false);
  const [declined, setDeclined] = useState(false);

  async function handleAccept() {
    if (!user) return;
    setAccepted(true);
    // Activate the game row
    await supabase.from('chess_games').update({ status: 'active' }).eq('id', gameId);
    // Determine my color
    const { data: game } = await supabase.from('chess_games').select('*').eq('id', gameId).single();
    if (!game) return;
    const myColor = game.blue_player_id === user.id ? 'blue' as const : 'green' as const;
    if (!chessViewActive) openLobby(); // ensure chess layer is visible
    await startGame(gameId, myColor);
  }

  async function handleDecline() {
    setDeclined(true);
    await supabase.from('chess_games').update({ status: 'abandoned' }).eq('id', gameId);
  }

  if (declined) {
    return (
      <div className="rounded-xl px-3 py-2 text-xs" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>
        ♟ Chess challenge declined
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: 'rgba(0,212,255,0.10)', color: '#00d4ff' }}>
        ♟ Chess game starting…
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-3 max-w-xs"
      style={{ background: 'rgba(168,85,247,0.10)', border: '1px solid rgba(168,85,247,0.30)', boxShadow: '0 0 20px rgba(168,85,247,0.10)' }}>
      <div className="flex items-center gap-2 mb-2.5">
        <span style={{ fontSize: 22 }}>♟️</span>
        <div>
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>AeroChess Challenge</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{inviterName} challenged you!</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleAccept}
          className="flex-1 rounded-xl py-1.5 text-xs font-bold transition-all"
          style={{ background: 'rgba(0,212,255,0.18)', border: '1px solid rgba(0,212,255,0.45)', color: '#00d4ff' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(0,212,255,0.30)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(0,212,255,0.18)'}
        >
          Accept ♟
        </button>
        <button
          onClick={handleDecline}
          className="flex-1 rounded-xl py-1.5 text-xs font-bold transition-all"
          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.30)', color: '#ef4444' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.22)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.12)'}
        >
          Decline
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 6.3: Verify build**

```bash
cd "aero-chat-app" && pnpm build 2>&1 | tail -5
```

- [ ] **Step 6.4: Commit**

```bash
git add src/components/chess/AeroChess.tsx src/components/chess/ChessInviteCard.tsx
git commit -m "feat: AeroChess root router + ChessInviteCard (accept/decline in chat)"
```

---

## Task 7: Wire up ChatLayout (CHESS LAYER)

**Files:**
- Modify: `src/components/chat/ChatLayout.tsx`

Add a `CHESS LAYER` using the exact same absolute-positioned slide-in pattern as the existing GAME LAYER. The chess layer appears on top of everything when `chessViewActive` is true.

- [ ] **Step 7.1: Edit `src/components/chat/ChatLayout.tsx`**

At the top, add imports:
```typescript
import { useChessStore } from '../../store/chessStore';
import { AeroChess } from '../chess/AeroChess';
```

Inside `ChatLayout()`, destructure `chessViewActive`:
```typescript
const { chessViewActive } = useChessStore();
```

Update `anyViewActive`:
```typescript
const anyViewActive = gameViewActive || devViewActive || chessViewActive;
```

After the DEV LAYER `</div>` closing tag and before the outer `</div>` wrapper, add:
```tsx
{/* CHESS LAYER */}
<div
  style={{
    position: 'absolute',
    inset: 0,
    transform: chessViewActive ? 'translateX(0)' : 'translateX(102%)',
    opacity: chessViewActive ? 1 : 0,
    transition: 'transform 0.38s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.32s ease',
    pointerEvents: chessViewActive ? 'auto' : 'none',
    willChange: 'transform',
    zIndex: 10,
  }}
>
  <AeroChess />
</div>
```

- [ ] **Step 7.2: Verify build**

```bash
cd "aero-chat-app" && pnpm build 2>&1 | tail -5
```

- [ ] **Step 7.3: Commit**

```bash
git add src/components/chat/ChatLayout.tsx
git commit -m "feat: add CHESS LAYER to ChatLayout (full-layout takeover for AeroChess)"
```

---

## Task 8: Add Chess to GamesCorner + detect invites in ChatWindow

**Files:**
- Modify: `src/components/corners/GamesCorner.tsx`
- Modify: `src/components/chat/ChatWindow.tsx`

- [ ] **Step 8.1: Add chess card to GamesCorner**

In `src/components/corners/GamesCorner.tsx`, add at the top:
```typescript
import { useChessStore } from '../../store/chessStore';
```

Inside `GameHub()`, add a chess launch button before the GAMES grid (or as the first entry). The simplest approach: add a standalone "AeroChess" featured card above the grid:

```tsx
function GameHub() {
  const { closeGameView, selectGame } = useCornerStore();
  const { openLobby } = useChessStore();

  function launchChess() {
    closeGameView();   // dismiss Games Corner
    openLobby();       // open Chess layer
  }

  // ... rest of existing component, with launchChess available
```

Add a chess card as the first item in the `GAMES` array (or as a special featured button). Recommended approach — add `'chess'` as a special game entry with `onClick` override:

Add to `GAMES` array:
```typescript
{
  id: 'chess' as SelectedGame,  // add 'chess' to SelectedGame type in cornerStore
  icon: '♟️',
  label: 'AeroChess',
  desc: 'Real-time multiplayer chess!',
  available: true,
  color: '#a855f7',
},
```

Update `cornerStore.ts` — add `'chess'` to `SelectedGame`:
```typescript
export type SelectedGame = 'bubblepop' | 'tropico' | 'twentyfortyeight' | 'typingtest' | 'wordle' | 'chess' | null;
```

In the `GameHub` click handler, detect chess specially:
```typescript
onClick={() => {
  if (game.id === 'chess') { launchChess(); return; }
  game.available && game.id && selectGame(game.id);
}}
```

- [ ] **Step 8.2: Detect `__CHESS_INVITE__:` in ChatWindow**

In `src/components/chat/ChatWindow.tsx`, add import at top:
```typescript
import { ChessInviteCard } from '../chess/ChessInviteCard';
```

In the message render section, find where `msg.content` is displayed. Add detection before the regular text render:

```typescript
// Inside the message bubble render
const CHESS_PREFIX = '__CHESS_INVITE__:';
if (msg.content.startsWith(CHESS_PREFIX)) {
  const [gameId, inviterName] = msg.content.slice(CHESS_PREFIX.length).split(':');
  return (
    <ChessInviteCard
      key={msg.id}
      gameId={gameId}
      inviterName={inviterName ?? 'Someone'}
      messageId={msg.id}
    />
  );
}
```

This check goes immediately before the existing bubble `<div>` that renders `msg.content` as text.

- [ ] **Step 8.3: Verify full build**

```bash
cd "aero-chat-app" && pnpm build 2>&1 | tail -10
```

Expected: `✓ built` with exit 0. No TypeScript errors.

- [ ] **Step 8.4: Commit**

```bash
git add src/components/corners/GamesCorner.tsx src/store/cornerStore.ts src/components/chat/ChatWindow.tsx
git commit -m "feat: wire AeroChess into GamesCorner + detect chess invites in ChatWindow"
```

---

## Task 9: Final verification + deploy

- [ ] **Step 9.1: Run full build one final time**

```bash
cd "aero-chat-app" && pnpm build 2>&1
```

Expected: TypeScript passes, Vite builds successfully, only the existing chunk-size warning (not an error).

- [ ] **Step 9.2: Deploy to Vercel production**

```bash
cd "aero-chat-app" && vercel --prod --yes
```

- [ ] **Step 9.3: Final commit tag**

```bash
git add -A
git commit -m "feat: AeroChess — real-time multiplayer chess with matchmaking and friend invites"
```

---

## Manual Testing Checklist

After deploy, verify these flows:

- [ ] Migration 009 is applied in Supabase (both tables visible in Table Editor)
- [ ] Games Corner → AeroChess card → chess layer slides in over full layout
- [ ] Find Match: two browser tabs, both click Find Match → game starts with board visible
- [ ] Moves sync in real-time between both tabs
- [ ] Check/checkmate detection shows correct result banner
- [ ] Friend invite: send invite via chess lobby → invite card appears in friend's chat → Accept opens board
- [ ] Resign button updates status and shows result banner for both players
- [ ] Disconnect: close one tab → 30s countdown appears → winner declared after 30s
- [ ] Back to chat button returns to normal layout
