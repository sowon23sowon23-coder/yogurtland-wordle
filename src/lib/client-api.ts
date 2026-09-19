import type { GuessResponse, RewardResponse, TodayResponse } from './types';

// Thin fetch wrappers for the browser. They never throw: network failures and
// non-JSON server errors come back as typed results the UI can show.

export type TodayResult = { ok: true; data: TodayResponse } | { ok: false };

export async function fetchToday(): Promise<TodayResult> {
  try {
    const res = await fetch('/api/today', { cache: 'no-store' });
    if (!res.ok) return { ok: false };
    return { ok: true, data: (await res.json()) as TodayResponse };
  } catch {
    return { ok: false };
  }
}

export type ClientGuessResponse = GuessResponse | { ok: false; reason: 'network' | 'server' };

export async function postGuess(guess: string): Promise<ClientGuessResponse> {
  try {
    const res = await fetch('/api/guess', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guess }),
    });
    const data: unknown = await res.json().catch(() => null);
    if (data && typeof (data as { ok?: unknown }).ok === 'boolean') {
      return data as GuessResponse;
    }
    return { ok: false, reason: 'server' };
  } catch {
    return { ok: false, reason: 'network' };
  }
}

export type ClientRewardResponse =
  | RewardResponse
  | { status: 'error'; reason: 'network' | 'server' };

export async function claimReward(): Promise<ClientRewardResponse> {
  try {
    const res = await fetch('/api/reward', { method: 'POST' });
    const data: unknown = await res.json().catch(() => null);
    if (data && typeof (data as { status?: unknown }).status === 'string') {
      return data as RewardResponse;
    }
    return { status: 'error', reason: 'server' };
  } catch {
    return { status: 'error', reason: 'network' };
  }
}
