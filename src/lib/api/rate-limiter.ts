// ============================================================
// In-Memory Rate Limiter — Sliding Window (per API key)
// ============================================================

interface RateLimitEntry {
  timestamps: number[];
}

class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    // Clean up old entries every 60 seconds
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
  }

  destroy() {
    clearInterval(this.cleanupInterval);
  }

  /**
   * Check if a request is allowed under rate limits.
   * Returns { allowed, retryAfterMs }.
   */
  check(keyId: string, limits: { perMin: number; perHour: number; perDay: number }): {
    allowed: boolean;
    retryAfterMs: number;
    remaining: { min: number; hour: number; day: number };
  } {
    const now = Date.now();
    const entry = this.getOrCreate(keyId);

    // Filter out timestamps outside the relevant windows
    const oneMinAgo = now - 60_000;
    const oneHourAgo = now - 3_600_000;
    const oneDayAgo = now - 86_400_000;

    // Clean the array (keep only last 24h)
    entry.timestamps = entry.timestamps.filter((t) => t > oneDayAgo);

    const minCount = entry.timestamps.filter((t) => t > oneMinAgo).length;
    const hourCount = entry.timestamps.filter((t) => t > oneHourAgo).length;
    const dayCount = entry.timestamps.length;

    // Check minute limit first
    if (minCount >= limits.perMin) {
      const oldestInWindow = entry.timestamps
        .filter((t) => t > oneMinAgo)[0];
      const retryAfter = oldestInWindow ? oldestInWindow + 60_000 - now : 60_000;
      return {
        allowed: false,
        retryAfterMs: retryAfter,
        remaining: { min: 0, hour: Math.max(0, limits.perHour - hourCount), day: Math.max(0, limits.perDay - dayCount) },
      };
    }

    // Check hour limit
    if (hourCount >= limits.perHour) {
      const oldestInWindow = entry.timestamps
        .filter((t) => t > oneHourAgo)[0];
      const retryAfter = oldestInWindow ? oldestInWindow + 3_600_000 - now : 3_600_000;
      return {
        allowed: false,
        retryAfterMs: retryAfter,
        remaining: { min: Math.max(0, limits.perMin - minCount), hour: 0, day: Math.max(0, limits.perDay - dayCount) },
      };
    }

    // Check day limit
    if (dayCount >= limits.perDay) {
      const oldestInWindow = entry.timestamps[0];
      const retryAfter = oldestInWindow ? oldestInWindow + 86_400_000 - now : 86_400_000;
      return {
        allowed: false,
        retryAfterMs: retryAfter,
        remaining: { min: Math.max(0, limits.perMin - minCount), hour: Math.max(0, limits.perHour - hourCount), day: 0 },
      };
    }

    // Record this request
    entry.timestamps.push(now);

    return {
      allowed: true,
      retryAfterMs: 0,
      remaining: {
        min: Math.max(0, limits.perMin - minCount - 1),
        hour: Math.max(0, limits.perHour - hourCount - 1),
        day: Math.max(0, limits.perDay - dayCount - 1),
      },
    };
  }

  /** Record a request timestamp (for logging after the fact) */
  record(keyId: string) {
    const entry = this.getOrCreate(keyId);
    entry.timestamps.push(Date.now());
  }

  /** Reset all limits for a key */
  reset(keyId: string) {
    this.store.delete(keyId);
  }

  /** Get current usage for a key */
  getUsage(keyId: string): { min: number; hour: number; day: number } {
    const now = Date.now();
    const entry = this.store.get(keyId);
    if (!entry) return { min: 0, hour: 0, day: 0 };

    const oneMinAgo = now - 60_000;
    const oneHourAgo = now - 3_600_000;
    const oneDayAgo = now - 86_400_000;

    return {
      min: entry.timestamps.filter((t) => t > oneMinAgo).length,
      hour: entry.timestamps.filter((t) => t > oneHourAgo).length,
      day: entry.timestamps.filter((t) => t > oneDayAgo).length,
    };
  }

  private getOrCreate(keyId: string): RateLimitEntry {
    let entry = this.store.get(keyId);
    if (!entry) {
      entry = { timestamps: [] };
      this.store.set(keyId, entry);
    }
    return entry;
  }

  private cleanup() {
    const oneDayAgo = Date.now() - 86_400_000;
    for (const [key, entry] of this.store) {
      entry.timestamps = entry.timestamps.filter((t) => t > oneDayAgo);
      if (entry.timestamps.length === 0) {
        this.store.delete(key);
      }
    }
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter();
