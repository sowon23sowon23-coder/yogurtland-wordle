import 'server-only';
import { cookies } from 'next/headers';
import { scoreGuess } from './scoring';
import { isAllowedGuess } from './wordlist';
import { decideRewardTier } from './reward-tier';
import { MAX_ATTEMPTS } from './types';
import type { GameStatus, GuessResponse, TodayResponse } from './types';

// Demo mode: used automatically when the Supabase env vars are missing, so the
// game can be played end to end before the database exists. Progress lives in a
// browser cookie instead of the `games` table. Nothing here is trusted for
// anything valuable: no reward codes are ever issued in demo mode.

const DEMO_COOKIE = 'yl_demo';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function isDemoMode(): boolean {
  return !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY;
}

/** d = play date, g = today's guesses, p/w/s = plays / wins / streak. */
type DemoState = { d: string; g: string[]; p: number; w: number; s: number };

const isCount = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0;

function readState(playDate: string): DemoState {
  const fresh: DemoState = { d: playDate, g: [], p: 0, w: 0, s: 0 };
  const raw = cookies().get(DEMO_COOKIE)?.value;
  if (!raw) return fresh;

  try {
    const v = JSON.parse(raw) as Partial<DemoState>;
    const guessesOk =
      Array.isArray(v.g) &&
      v.g.length <= MAX_ATTEMPTS &&
      v.g.every((x) => typeof x === 'string' && /^[A-Z]{5}$/.test(x));
    if (typeof v.d !== 'string' || !guessesOk || !isCount(v.p) || !isCount(v.w) || !isCount(v.s)) {
      return fresh;
    }
    // A new day keeps the stats but starts a clean board.
    return { d: playDate, g: v.d === playDate ? (v.g as string[]) : [], p: v.p, w: v.w, s: v.s };
  } catch {
    return fresh;
  }
}

function writeState(state: DemoState): void {
  cookies().set(DEMO_COOKIE, JSON.stringify(state), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
  });
}

function statusOf(state: DemoState, answer: string): GameStatus {
  if (state.g.length === 0) return 'not_started';
  if (state.g[state.g.length - 1] === answer) return 'won';
  return state.g.length >= MAX_ATTEMPTS ? 'lost' : 'in_progress';
}

export function getDemoToday(playDate: string, answer: string): TodayResponse {
  const state = readState(playDate);
  const status = statusOf(state, answer);
  const finished = status === 'won' || status === 'lost';
  return {
    playDate,
    status,
    attempts: state.g.length,
    attemptsRemaining: Math.max(0, MAX_ATTEMPTS - state.g.length),
    maxAttempts: MAX_ATTEMPTS,
    guesses: state.g.map((guess) => ({ guess, marks: scoreGuess(guess, answer) })),
    rewardTier: status === 'won' ? decideRewardTier(state.g.length) : null,
    answer: finished ? answer : null,
    stats: { plays: state.p, wins: state.w, streak: state.s },
  };
}

/** `guess` is already normalized and checked for length and characters by the caller. */
export function submitDemoGuess(guess: string, playDate: string, answer: string): GuessResponse {
  const state = readState(playDate);
  const before = statusOf(state, answer);
  if (before === 'won' || before === 'lost') return { ok: false, reason: 'already_finished' };
  if (guess !== answer && !isAllowedGuess(guess)) return { ok: false, reason: 'not_in_wordlist' };

  state.g.push(guess);
  const status = statusOf(state, answer);
  const finished = status === 'won' || status === 'lost';
  if (finished) {
    state.p += 1;
    state.w += status === 'won' ? 1 : 0;
    state.s = status === 'won' ? state.s + 1 : 0;
  }
  writeState(state);

  return {
    ok: true,
    marks: scoreGuess(guess, answer),
    attempt: state.g.length,
    attemptsRemaining: Math.max(0, MAX_ATTEMPTS - state.g.length),
    status,
    rewardTier: status === 'won' ? decideRewardTier(state.g.length) : null,
    answer: finished ? answer : null,
  };
}

/** What the reward route needs: did today's demo game end in a win? */
export function getDemoResult(playDate: string, answer: string): GameStatus {
  return statusOf(readState(playDate), answer);
}
