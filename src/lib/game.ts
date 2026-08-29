import 'server-only';
import { getSupabaseAdmin } from './supabase-admin';
import { scoreGuess } from './scoring';
import { isAllowedGuess } from './wordlist';
import { decideRewardTier } from './reward-tier';
import { MAX_ATTEMPTS } from './types';
import type {
  GameStatus,
  GuessRecord,
  GuessResponse,
  SessionStats,
  TodayResponse,
} from './types';

// Which calendar day "today" is, for a store chain operating on US time.
// Override with GAME_TIMEZONE if a different region is needed.
const GAME_TIMEZONE = process.env.GAME_TIMEZONE || 'America/Los_Angeles';

export function getPlayDate(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD, which is exactly the `date` column format.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: GAME_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

type WordRow = { id: string; word: string };

type GameRow = {
  id: string;
  session_id: string;
  word_id: string;
  play_date: string;
  guesses: GuessRecord[];
  attempts: number;
  result: 'in_progress' | 'win' | 'loss';
  finished_at: string | null;
};

type SessionRow = { plays: number; wins: number; streak: number };

const GAME_COLUMNS =
  'id, session_id, word_id, play_date, guesses, attempts, result, finished_at';

async function fetchLiveWordForToday(playDate: string): Promise<WordRow | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('words')
    .select('id, word')
    .eq('play_date', playDate)
    .eq('status', 'live')
    .maybeSingle();

  if (error) throw error;
  return data as WordRow | null;
}

async function fetchGame(sessionId: string, playDate: string): Promise<GameRow | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('games')
    .select(GAME_COLUMNS)
    .eq('session_id', sessionId)
    .eq('play_date', playDate)
    .maybeSingle();

  if (error) throw error;
  return data as GameRow | null;
}

async function fetchSessionStats(sessionId: string): Promise<SessionStats> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('sessions')
    .select('plays, wins, streak')
    .eq('id', sessionId)
    .maybeSingle();

  if (error) throw error;
  const row = (data as SessionRow | null) ?? { plays: 0, wins: 0, streak: 0 };
  return { plays: row.plays, wins: row.wins, streak: row.streak };
}

async function bumpSessionStats(sessionId: string, won: boolean): Promise<void> {
  const supabase = getSupabaseAdmin();
  const stats = await fetchSessionStats(sessionId);
  const { error } = await supabase
    .from('sessions')
    .update({
      plays: stats.plays + 1,
      wins: stats.wins + (won ? 1 : 0),
      streak: won ? stats.streak + 1 : 0,
      last_seen_at: new Date().toISOString(),
    })
    .eq('id', sessionId);
  if (error) throw error;
}

function toStatus(result: GameRow['result']): GameStatus {
  if (result === 'win') return 'won';
  if (result === 'loss') return 'lost';
  return 'in_progress';
}

/** Builds the client-safe snapshot of today's game. Never includes the
 * answer unless the game has already finished for this session. */
export async function getTodayState(sessionId: string): Promise<TodayResponse> {
  const playDate = getPlayDate();
  const [game, stats] = await Promise.all([
    fetchGame(sessionId, playDate),
    fetchSessionStats(sessionId),
  ]);

  if (!game) {
    return {
      playDate,
      status: 'not_started',
      attempts: 0,
      attemptsRemaining: MAX_ATTEMPTS,
      maxAttempts: MAX_ATTEMPTS,
      guesses: [],
      rewardTier: null,
      answer: null,
      stats,
    };
  }

  const status = toStatus(game.result);
  const finished = status === 'won' || status === 'lost';

  let answer: string | null = null;
  if (finished) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('words')
      .select('word')
      .eq('id', game.word_id)
      .maybeSingle();
    if (error) throw error;
    answer = (data as { word: string } | null)?.word ?? null;
  }

  return {
    playDate,
    status,
    attempts: game.attempts,
    attemptsRemaining: Math.max(0, MAX_ATTEMPTS - game.attempts),
    maxAttempts: MAX_ATTEMPTS,
    guesses: game.guesses ?? [],
    rewardTier: status === 'won' ? decideRewardTier(game.attempts) : null,
    answer,
    stats,
  };
}

function normalizeGuess(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  return raw.trim().toUpperCase();
}

/** Validates, scores, and persists one guess. Creates today's game row on
 * the first guess of the day rather than on every /api/today read. */
export async function submitGuess(
  sessionId: string,
  rawGuess: unknown
): Promise<GuessResponse> {
  const guess = normalizeGuess(rawGuess);
  if (guess === null || guess.length !== 5) {
    return { ok: false, reason: 'invalid_length' };
  }
  if (!/^[A-Z]{5}$/.test(guess)) {
    return { ok: false, reason: 'invalid_characters' };
  }

  const playDate = getPlayDate();
  const word = await fetchLiveWordForToday(playDate);
  if (!word) {
    return { ok: false, reason: 'no_word_today' };
  }

  if (guess !== word.word && !isAllowedGuess(guess)) {
    return { ok: false, reason: 'not_in_wordlist' };
  }

  const supabase = getSupabaseAdmin();
  let game = await fetchGame(sessionId, playDate);

  if (!game) {
    const { data, error } = await supabase
      .from('games')
      .insert({ session_id: sessionId, word_id: word.id, play_date: playDate })
      .select(GAME_COLUMNS)
      .single();

    if (error) {
      // Unique (session_id, play_date) violation: a concurrent request for
      // the same session/day created it first. Re-fetch instead of failing.
      if (error.code === '23505') {
        game = await fetchGame(sessionId, playDate);
      } else {
        throw error;
      }
    } else {
      game = data as GameRow;
    }
  }

  if (!game) throw new Error("Failed to load or create today's game.");
  if (game.result !== 'in_progress') {
    return { ok: false, reason: 'already_finished' };
  }

  const marks = scoreGuess(guess, word.word);
  const nextGuesses: GuessRecord[] = [...(game.guesses ?? []), { guess, marks }];
  const attempts = game.attempts + 1;
  const won = guess === word.word;
  const finished = won || attempts >= MAX_ATTEMPTS;
  const result: GameRow['result'] = won ? 'win' : finished ? 'loss' : 'in_progress';

  const { error: updateError } = await supabase
    .from('games')
    .update({
      guesses: nextGuesses,
      attempts,
      result,
      finished_at: finished ? new Date().toISOString() : null,
    })
    .eq('id', game.id);

  if (updateError) throw updateError;
  if (finished) await bumpSessionStats(sessionId, won);

  return {
    ok: true,
    marks,
    attempt: attempts,
    attemptsRemaining: Math.max(0, MAX_ATTEMPTS - attempts),
    status: toStatus(result),
    rewardTier: won ? decideRewardTier(attempts) : null,
    answer: finished ? word.word : null,
  };
}

/** Minimal lookup used by the reward route — just enough to check the game
 * belongs to this session, finished as a win, and how many attempts it took. */
export async function getTodayGameForReward(
  sessionId: string
): Promise<{ id: string; result: GameRow['result']; attempts: number } | null> {
  const playDate = getPlayDate();
  const game = await fetchGame(sessionId, playDate);
  if (!game) return null;
  return { id: game.id, result: game.result, attempts: game.attempts };
}
