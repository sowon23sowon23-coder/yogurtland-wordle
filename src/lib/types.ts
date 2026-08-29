export type TileMark = 'correct' | 'present' | 'absent';

export type GuessRecord = {
  guess: string;
  marks: TileMark[];
};

export type GameStatus = 'not_started' | 'in_progress' | 'won' | 'lost';

export type RewardTier = 'free_topping' | 'ten_percent';

export type SessionStats = {
  plays: number;
  wins: number;
  streak: number;
};

export const MAX_ATTEMPTS = 6;

export type TodayResponse = {
  playDate: string;
  status: GameStatus;
  attempts: number;
  attemptsRemaining: number;
  maxAttempts: typeof MAX_ATTEMPTS;
  guesses: GuessRecord[];
  rewardTier: RewardTier | null;
  /** Only present once the game has finished (won or lost) for this session. */
  answer: string | null;
  stats: SessionStats;
};

export type GuessErrorReason =
  | 'invalid_length'
  | 'invalid_characters'
  | 'not_in_wordlist'
  | 'already_finished'
  | 'no_word_today'
  | 'no_session';

export type GuessResponse =
  | {
      ok: true;
      marks: TileMark[];
      attempt: number;
      attemptsRemaining: number;
      status: GameStatus;
      rewardTier: RewardTier | null;
      answer: string | null;
    }
  | { ok: false; reason: GuessErrorReason };

export type RewardResponse =
  | { status: 'assigned'; code: string; expiresAt: string | null; tier: RewardTier }
  | { status: 'sold_out' }
  | { status: 'error'; reason: 'not_a_winner' | 'no_session' | 'no_game_today' };
