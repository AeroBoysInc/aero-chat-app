# Chess Bots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Easy / Medium / Hard bot opponents to AeroChess that run entirely client-side with no database or network calls.

**Architecture:** A new `chessAI.ts` module provides `getBotMove(fen, difficulty)` using minimax with alpha-beta pruning + piece-square tables. The chess store gains a `startBotGame(difficulty)` action that creates a local-only `ChessGameRow` (no Supabase). `ChessGame.tsx` checks a `botGame` flag to skip all DB polling, heartbeat, and disconnect logic, and auto-triggers bot moves after the player's turn. The lobby gets a "Play vs Bot" section with three difficulty buttons.

**Tech Stack:** chess.js (already installed), Zustand (existing store), React

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/chessAI.ts` | **Create** | Pure AI engine: evaluation function with piece-square tables, minimax with alpha-beta, `getBotMove()` |
| `src/store/chessStore.ts` | **Modify** | Add `botDifficulty`, `botGame` flag, `startBotGame()`, `makeBotMove()` actions, guard existing DB calls |
| `src/components/chess/ChessGame.tsx` | **Modify** | Skip DB effects when `botGame`, trigger bot move after player moves, show "Bot" label instead of disconnect UI |
| `src/components/chess/ChessLobby.tsx` | **Modify** | Add "Play vs Bot" section with Easy/Medium/Hard buttons |

---

### Task 1: Chess AI Engine

**Files:**
- Create: `src/lib/chessAI.ts`

- [ ] **Step 1: Create the AI module with piece values and piece-square tables**

```typescript
// src/lib/chessAI.ts
import { Chess, type Square } from 'chess.js';

export type BotDifficulty = 'easy' | 'medium' | 'hard';

/* Piece base values (centipawns) */
const PIECE_VALUE: Record<string, number> = {
  p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000,
};

/* Piece-square tables — bonus/penalty by board position (white's perspective).
   Indexed [row 0..7][col 0..7] where row 0 = rank 8, row 7 = rank 1. */
const PST: Record<string, number[][]> = {
  p: [
    [ 0,  0,  0,  0,  0,  0,  0,  0],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10],
    [ 5,  5, 10, 25, 25, 10,  5,  5],
    [ 0,  0,  0, 20, 20,  0,  0,  0],
    [ 5, -5,-10,  0,  0,-10, -5,  5],
    [ 5, 10, 10,-20,-20, 10, 10,  5],
    [ 0,  0,  0,  0,  0,  0,  0,  0],
  ],
  n: [
    [-50,-40,-30,-30,-30,-30,-40,-50],
    [-40,-20,  0,  0,  0,  0,-20,-40],
    [-30,  0, 10, 15, 15, 10,  0,-30],
    [-30,  5, 15, 20, 20, 15,  5,-30],
    [-30,  0, 15, 20, 20, 15,  0,-30],
    [-30,  5, 10, 15, 15, 10,  5,-30],
    [-40,-20,  0,  5,  5,  0,-20,-40],
    [-50,-40,-30,-30,-30,-30,-40,-50],
  ],
  b: [
    [-20,-10,-10,-10,-10,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0, 10, 10, 10, 10,  0,-10],
    [-10,  5,  5, 10, 10,  5,  5,-10],
    [-10,  0,  5, 10, 10,  5,  0,-10],
    [-10, 10, 10, 10, 10, 10, 10,-10],
    [-10,  5,  0,  0,  0,  0,  5,-10],
    [-20,-10,-10,-10,-10,-10,-10,-20],
  ],
  r: [
    [ 0,  0,  0,  0,  0,  0,  0,  0],
    [ 5, 10, 10, 10, 10, 10, 10,  5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [ 0,  0,  0,  5,  5,  0,  0,  0],
  ],
  q: [
    [-20,-10,-10, -5, -5,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5,  5,  5,  5,  0,-10],
    [ -5,  0,  5,  5,  5,  5,  0, -5],
    [  0,  0,  5,  5,  5,  5,  0, -5],
    [-10,  5,  5,  5,  5,  5,  0,-10],
    [-10,  0,  5,  0,  0,  0,  0,-10],
    [-20,-10,-10, -5, -5,-10,-10,-20],
  ],
  k: [
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-20,-30,-30,-40,-40,-30,-30,-20],
    [-10,-20,-20,-20,-20,-20,-20,-10],
    [ 20, 20,  0,  0,  0,  0, 20, 20],
    [ 20, 30, 10,  0,  0, 10, 30, 20],
  ],
};

/**
 * Evaluate the board from white's perspective (positive = white advantage).
 * Sums material value + piece-square positional bonus for each piece.
 */
function evaluate(chess: Chess): number {
  if (chess.isCheckmate()) {
    // Side to move is mated — that side loses
    return chess.turn() === 'w' ? -99999 : 99999;
  }
  if (chess.isDraw()) return 0;

  let score = 0;
  const board = chess.board();
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const sq = board[row][col];
      if (!sq) continue;
      const value = PIECE_VALUE[sq.type] + (PST[sq.type]?.[sq.color === 'w' ? row : 7 - row]?.[col] ?? 0);
      score += sq.color === 'w' ? value : -value;
    }
  }
  return score;
}

/**
 * Minimax with alpha-beta pruning.
 * Returns evaluation score from white's perspective.
 */
function minimax(chess: Chess, depth: number, alpha: number, beta: number, maximizing: boolean): number {
  if (depth === 0 || chess.isGameOver()) {
    return evaluate(chess);
  }

  const moves = chess.moves();

  if (maximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      chess.move(move);
      const eval_ = minimax(chess, depth - 1, alpha, beta, false);
      chess.undo();
      maxEval = Math.max(maxEval, eval_);
      alpha = Math.max(alpha, eval_);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      chess.move(move);
      const eval_ = minimax(chess, depth - 1, alpha, beta, true);
      chess.undo();
      minEval = Math.min(minEval, eval_);
      beta = Math.min(beta, eval_);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

const DEPTH: Record<BotDifficulty, number> = {
  easy: 1,
  medium: 2,
  hard: 4,
};

/**
 * Pick the best move for the current side to move.
 * - Easy: depth 1 (basically one-move lookahead, often blunders)
 * - Medium: depth 2 (sees immediate threats)
 * - Hard: depth 4 (solid positional play)
 */
export function getBotMove(fen: string, difficulty: BotDifficulty): { from: string; to: string; promotion?: string } | null {
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) return null;

  // Easy: 30% chance of a random move to make it beatable
  if (difficulty === 'easy' && Math.random() < 0.3) {
    const m = moves[Math.floor(Math.random() * moves.length)];
    return { from: m.from, to: m.to, promotion: m.promotion };
  }

  const maximizing = chess.turn() === 'w';
  const depth = DEPTH[difficulty];
  let bestMove = moves[0];
  let bestEval = maximizing ? -Infinity : Infinity;

  for (const move of moves) {
    chess.move(move);
    const eval_ = minimax(chess, depth - 1, -Infinity, Infinity, !maximizing);
    chess.undo();

    if (maximizing ? eval_ > bestEval : eval_ < bestEval) {
      bestEval = eval_;
      bestMove = move;
    }
  }

  return { from: bestMove.from, to: bestMove.to, promotion: bestMove.promotion };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/chessAI.ts
git commit -m "feat(chess): add minimax AI engine with piece-square tables"
```

---

### Task 2: Chess Store — Bot Game Support

**Files:**
- Modify: `src/store/chessStore.ts`

- [ ] **Step 1: Add bot state fields and `startBotGame` action**

Add to the `ChessState` interface after `disconnectSecondsLeft`:

```typescript
  // Bot
  botGame: boolean;
  botDifficulty: BotDifficulty | null;
```

Add to the interface actions section:

```typescript
  startBotGame: (difficulty: BotDifficulty) => void;
  makeBotMove:  () => Promise<void>;
```

Add import at top of file:

```typescript
import { getBotMove, type BotDifficulty } from '../lib/chessAI';
```

Add initial state values in the `create` call (alongside other initial values):

```typescript
  botGame: false,
  botDifficulty: null,
```

- [ ] **Step 2: Implement `startBotGame`**

Add after the `leaveQueue` action:

```typescript
  startBotGame: (difficulty) => {
    // Player is always blue (white). Bot is green (black).
    const localGame: ChessGameRow = {
      id: `bot-${Date.now()}`,
      blue_player_id: 'local-player',
      green_player_id: 'bot',
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      status: 'active',
      last_move: null,
      blue_last_seen: new Date().toISOString(),
      green_last_seen: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    set({
      phase: 'game',
      gameId: localGame.id,
      gameData: localGame,
      myColor: 'blue',
      botGame: true,
      botDifficulty: difficulty,
    });
  },
```

- [ ] **Step 3: Implement `makeBotMove`**

Add after `startBotGame`:

```typescript
  makeBotMove: async () => {
    const { gameData, botDifficulty } = get();
    if (!gameData || !botDifficulty) return;

    const result = getBotMove(gameData.fen, botDifficulty);
    if (!result) return;

    const { Chess } = await import('chess.js');
    const chess = new Chess(gameData.fen);
    const move = chess.move({ from: result.from, to: result.to, ...(result.promotion ? { promotion: result.promotion } : {}) });
    if (!move) return;

    const newFen = chess.fen();
    let newStatus: ChessGameRow['status'] = 'active';
    if (chess.isCheckmate()) {
      newStatus = chess.turn() === 'w' ? 'green_wins' : 'blue_wins';
    } else if (chess.isDraw()) {
      newStatus = 'draw';
    }

    set({
      gameData: {
        ...gameData,
        fen: newFen,
        last_move: { from: result.from, to: result.to, promotion: result.promotion },
        status: newStatus,
        updated_at: new Date().toISOString(),
      },
    });
  },
```

- [ ] **Step 4: Guard `makeMove` to skip DB for bot games**

In the existing `makeMove` action, after the optimistic local update block (`get().setGameData({...})`), wrap the Supabase update in a bot check:

```typescript
    // Skip DB write for bot games
    if (!get().botGame) {
      await supabase
        .from('chess_games')
        .update({
          fen: newFen,
          last_move: { from, to, promotion },
          status: newStatus,
          updated_at: updatedAt,
        })
        .eq('id', gameId);
    }
```

- [ ] **Step 5: Guard `resign` to skip DB for bot games**

Replace the existing `resign` action body:

```typescript
  resign: async (losingColor) => {
    const { gameId, gameData, botGame } = get();
    if (!gameId) return;
    const status = losingColor === 'blue' ? 'green_wins' : 'blue_wins';
    if (botGame) {
      if (gameData) set({ gameData: { ...gameData, status } });
    } else {
      await supabase.from('chess_games').update({ status }).eq('id', gameId);
    }
  },
```

- [ ] **Step 6: Reset bot fields in `backToLobby` and `closeChess`**

In `backToLobby`, add to the `set()` call: `botGame: false, botDifficulty: null`

In `closeChess`, add to the `set()` call: `botGame: false, botDifficulty: null`

- [ ] **Step 7: Commit**

```bash
git add src/store/chessStore.ts
git commit -m "feat(chess): add bot game state and actions to chess store"
```

---

### Task 3: ChessGame — Bot Move Trigger & Skip Network Logic

**Files:**
- Modify: `src/components/chess/ChessGame.tsx`

- [ ] **Step 1: Import `botGame` and `makeBotMove` from the store**

Update the store destructure at the top of the component:

```typescript
const { gameData, myColor, makeMove, resign, updateHeartbeat, backToLobby, setGameData, setDisconnectSecondsLeft, disconnectSecondsLeft, botGame, makeBotMove } = useChessStore();
```

- [ ] **Step 2: Guard DB polling effect — skip for bot games**

In the first `useEffect` (the polling interval at lines ~58-71), add an early return:

```typescript
  useEffect(() => {
    if (botGame) return; // Bot games are local-only
    if (!gameData?.id) return;
    // ... rest unchanged
```

- [ ] **Step 3: Guard heartbeat effect — skip for bot games**

In the heartbeat `useEffect` (lines ~80-85):

```typescript
  useEffect(() => {
    if (botGame) return;
    if (!myColor || !gameData || gameData.status !== 'active') return;
    // ... rest unchanged
```

- [ ] **Step 4: Guard disconnect detection — skip for bot games**

In the `checkOpponent` callback (lines ~91-117), add an early return:

```typescript
  const checkOpponent = useCallback(async () => {
    if (botGame) return;
    if (!gameData || gameData.status !== 'active') return;
    // ... rest unchanged
```

Add `botGame` to the dependency array.

- [ ] **Step 5: Add bot move effect — trigger after player moves**

Add this new `useEffect` after the heartbeat effect:

```typescript
  // Bot move: after player moves, wait a short delay then trigger bot
  useEffect(() => {
    if (!botGame || !gameData || gameData.status !== 'active') return;
    // Bot is green (black), so trigger when it's black's turn
    const chess = new Chess(gameData.fen);
    if (chess.turn() !== 'b') return;

    const delay = 400 + Math.random() * 600; // 400-1000ms thinking time
    const timer = setTimeout(() => { makeBotMove(); }, delay);
    return () => clearTimeout(timer);
  }, [botGame, gameData?.fen, gameData?.status, makeBotMove]);
```

Note: `Chess` is already imported at the top of the file.

- [ ] **Step 6: Update opponent row to show "Bot" label**

In the opponent row section, update the label and hide disconnect/wifi UI for bot games:

Replace the opponent name and wifi/disconnect section:

```typescript
      {/* Opponent row */}
      <div className="flex w-full max-w-[450px] items-center gap-2 px-1">
        <span style={{ fontSize: 16 }}>{opponentDot}</span>
        <span className="flex-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {botGame ? `Bot (${useChessStore.getState().botDifficulty})` : opponentColorName}
        </span>

        {/* Disconnect warning — online games only */}
        {!botGame && !opponentOnline && disconnectSecondsLeft !== null && (
          <span className="flex items-center gap-1 text-xs font-bold" style={{ color: '#f59e0b' }}>
            <WifiOff className="h-3 w-3" />
            {disconnectSecondsLeft}s
          </span>
        )}
        {!botGame && opponentOnline && (
          <Wifi className="h-3.5 w-3.5" style={{ color: 'rgba(52,211,153,0.60)' }} />
        )}
```

- [ ] **Step 7: Update turn indicator for bot games**

Replace the turn indicator text:

```typescript
      {!finished && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {isMyTurn ? 'Your move' : botGame ? 'Bot is thinking...' : `Waiting for ${opponentColorName}...`}
        </p>
      )}
```

- [ ] **Step 8: Commit**

```bash
git add src/components/chess/ChessGame.tsx
git commit -m "feat(chess): bot move trigger + skip network logic for bot games"
```

---

### Task 4: Chess Lobby — Play vs Bot UI

**Files:**
- Modify: `src/components/chess/ChessLobby.tsx`

- [ ] **Step 1: Import `startBotGame` and add Bot icon**

Add to imports:

```typescript
import { Swords, UserPlus, X, Bot } from 'lucide-react';
```

Add to store destructure:

```typescript
const { closeChess, joinQueue, startGame, startBotGame } = useChessStore();
```

- [ ] **Step 2: Update subtitle**

Change the subtitle text from:

```typescript
Real-time 1v1 — 🔵 Blue vs 🟢 Green
```

to:

```typescript
Play friends, find opponents, or challenge a bot
```

- [ ] **Step 3: Add "Play vs Bot" section between Find Match and Friends**

Insert this block after the Find Match button and before the friends list:

```tsx
      {/* Play vs Bot */}
      <div className="w-full max-w-sm">
        <p className="mb-3 flex items-center gap-1.5 text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          <Bot className="h-3 w-3" />
          Play vs Bot
        </p>
        <div className="flex gap-2">
          {([
            { level: 'easy' as const,   label: 'Easy',   color: '#34d399' },
            { level: 'medium' as const, label: 'Medium', color: '#f59e0b' },
            { level: 'hard' as const,   label: 'Hard',   color: '#ef4444' },
          ]).map(({ level, label, color }) => (
            <button
              key={level}
              onClick={() => startBotGame(level)}
              className="flex-1 flex flex-col items-center gap-1 rounded-xl px-4 py-3 text-sm font-bold"
              style={{
                background: `${color}12`,
                border: `1px solid ${color}40`,
                color,
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = `${color}22`}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = `${color}12`}
            >
              {label}
              <span className="text-[10px] font-normal opacity-60">
                {level === 'easy' ? 'Beginner' : level === 'medium' ? 'Intermediate' : 'Advanced'}
              </span>
            </button>
          ))}
        </div>
      </div>
```

- [ ] **Step 4: Commit**

```bash
git add src/components/chess/ChessLobby.tsx
git commit -m "feat(chess): add Play vs Bot section to lobby with difficulty picker"
```

---

### Task 5: Build & Deploy

**Files:** None (verification only)

- [ ] **Step 1: Build and verify**

```bash
cd aero-chat-app && pnpm build
```

Expected: Clean build with no type errors.

- [ ] **Step 2: Commit any fixes, push, deploy**

```bash
git push origin main
vercel --prod --yes
```
