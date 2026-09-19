import 'server-only';
import { getSupabaseAdmin } from './supabase-admin';
import { DEMO_ANSWER, getPlayDate, getTodayGameForReward } from './game';
import { getDemoResult, isDemoMode } from './demo-game';
import { decideRewardTier } from './reward-tier';
import type { RewardResponse, RewardTier } from './types';

async function claimRewardCode(
  gameId: string,
  tier: RewardTier
): Promise<{ code: string; expires_at: string | null } | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc('claim_reward_code', {
    p_game_id: gameId,
    p_tier: tier,
  });
  if (error) throw error;

  // claim_reward_code returns a set (zero or one row); supabase-js gives an array.
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.code) return null;
  return row as { code: string; expires_at: string | null };
}

export async function claimRewardForSession(sessionId: string): Promise<RewardResponse> {
  if (isDemoMode()) {
    // No reward pool exists without the database, so never invent a code.
    const status = getDemoResult(getPlayDate(), DEMO_ANSWER);
    if (status === 'not_started') return { status: 'error', reason: 'no_game_today' };
    if (status !== 'won') return { status: 'error', reason: 'not_a_winner' };
    return { status: 'demo' };
  }

  const game = await getTodayGameForReward(sessionId);
  if (!game) return { status: 'error', reason: 'no_game_today' };
  if (game.result !== 'win') return { status: 'error', reason: 'not_a_winner' };

  const tier = decideRewardTier(game.attempts);
  const claimed = await claimRewardCode(game.id, tier);
  if (!claimed) return { status: 'sold_out' };

  return {
    status: 'assigned',
    code: claimed.code,
    expiresAt: claimed.expires_at,
    tier,
  };
}
