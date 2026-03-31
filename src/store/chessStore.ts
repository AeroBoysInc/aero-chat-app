import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { getBotMove, type BotDifficulty } from '../lib/chessAI';

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

  // Bot
  botGame: boolean;
  botDifficulty: BotDifficulty | null;

  // Actions
  openLobby:   () => void;
  closeChess:  () => void;
  backToLobby: () => void;

  joinQueue:  (userId: string) => Promise<void>;
  leaveQueue: () => Promise<void>;

  startGame: (gameId: string, myColor: ChessColor) => Promise<void>;

  makeMove:  (from: string, to: string, promotion?: string) => Promise<void>;
  resign:    (losingColor: ChessColor) => Promise<void>;

  updateHeartbeat:          (myColor: ChessColor) => Promise<void>;
  setGameData:              (data: ChessGameRow) => void;
  setDisconnectSecondsLeft: (n: number | null) => void;

  startBotGame: (difficulty: BotDifficulty) => void;
  makeBotMove:  () => Promise<void>;
}

let _gameChannel:  ReturnType<typeof supabase.channel> | null = null;
let _queueChannel: ReturnType<typeof supabase.channel> | null = null;

export const useChessStore = create<ChessState>((set, get) => ({
  chessViewActive: false,
  phase: null,
  queueEntryId: null,
  gameId: null,
  gameData: null,
  myColor: null,
  disconnectSecondsLeft: null,
  botGame: false,
  botDifficulty: null,

  openLobby: () => set({ chessViewActive: true, phase: 'lobby' }),

  backToLobby: () => {
    if (_gameChannel) { supabase.removeChannel(_gameChannel); _gameChannel = null; }
    set({ phase: 'lobby', gameId: null, gameData: null, myColor: null, disconnectSecondsLeft: null, botGame: false, botDifficulty: null });
  },

  closeChess: () => {
    if (_gameChannel)  { supabase.removeChannel(_gameChannel);  _gameChannel  = null; }
    if (_queueChannel) { supabase.removeChannel(_queueChannel); _queueChannel = null; }
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
      botGame: false,
      botDifficulty: null,
    });
  },

  joinQueue: async (userId) => {
    // Look for another waiting player
    const { data: waiting } = await supabase
      .from('chess_queue')
      .select('id, user_id')
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

      // Update the waiting player's queue entry
      await supabase
        .from('chess_queue')
        .update({ status: 'matched', game_id: game.id })
        .eq('id', waiting.id);

      // Insert + immediately mark as matched for myself
      const { data: myEntry } = await supabase
        .from('chess_queue')
        .insert({ user_id: userId, status: 'matched', game_id: game.id })
        .select()
        .single();

      set({ queueEntryId: myEntry?.id ?? null });
      await get().startGame(game.id, myColor);
    } else {
      // No match — join queue and wait
      const { data: entry } = await supabase
        .from('chess_queue')
        .insert({ user_id: userId })
        .select()
        .single();

      if (!entry) return;
      set({ queueEntryId: entry.id, phase: 'queue' });

      // Subscribe to this queue entry — fires when matched
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

  startBotGame: (difficulty) => {
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

  startGame: async (gameId, myColor) => {
    const { data: game } = await supabase
      .from('chess_games')
      .select('*')
      .eq('id', gameId)
      .single();

    set({ gameId, myColor, gameData: game as ChessGameRow, phase: 'game' });

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

    const { Chess } = await import('chess.js');
    const chess = new Chess(gameData.fen);
    const move = chess.move({ from, to, ...(promotion ? { promotion } : {}) });
    if (!move) return;

    const newFen = chess.fen();
    let newStatus: ChessGameRow['status'] = 'active';
    if (chess.isCheckmate()) {
      // The side whose turn it now is has been mated — they lose
      newStatus = chess.turn() === 'w' ? 'green_wins' : 'blue_wins';
    } else if (chess.isDraw()) {
      newStatus = 'draw';
    }

    // Optimistic local update — don't wait for Realtime
    const updatedAt = new Date().toISOString();
    get().setGameData({
      ...gameData,
      fen: newFen,
      last_move: { from, to, promotion },
      status: newStatus,
      updated_at: updatedAt,
    });

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
  },

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

  updateHeartbeat: async (myColor) => {
    const { gameId } = get();
    if (!gameId) return;
    const col = myColor === 'blue' ? 'blue_last_seen' : 'green_last_seen';
    await supabase
      .from('chess_games')
      .update({ [col]: new Date().toISOString() })
      .eq('id', gameId);
  },

  setGameData:              (data) => set({ gameData: data }),
  setDisconnectSecondsLeft: (n)    => set({ disconnectSecondsLeft: n }),
}));
