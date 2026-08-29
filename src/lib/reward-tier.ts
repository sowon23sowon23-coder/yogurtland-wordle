import type { RewardTier } from './types';

/** Solve in 3 or fewer → free topping. Solve in 4-6 → 10% off. */
export function decideRewardTier(attempts: number): RewardTier {
  return attempts <= 3 ? 'free_topping' : 'ten_percent';
}
