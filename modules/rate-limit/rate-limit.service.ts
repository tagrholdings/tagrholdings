import { rateLimitRepository } from "./rate-limit.repository";

const PRUNE_PROBABILITY = 0.02;
const PRUNE_AFTER_MS = 24 * 60 * 60 * 1000;

export const rateLimitService = {
  /**
   * Fixed-window limiter shared by every serverless instance (it counts in
   * Postgres). Returns true once `key` has been hit more than `limit` times
   * in the current `windowMs` window — the hit that crosses the limit counts.
   */
  async isLimited(key: string, limit: number, windowMs: number) {
    const now = Date.now();
    const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
    const count = await rateLimitRepository.increment(key, windowStart);

    // Opportunistic cleanup instead of a cron: ~1 call in 50 prunes buckets
    // far older than any window in use.
    if (Math.random() < PRUNE_PROBABILITY) {
      await rateLimitRepository.deleteOlderThan(new Date(now - PRUNE_AFTER_MS));
    }

    return count > limit;
  },
};
