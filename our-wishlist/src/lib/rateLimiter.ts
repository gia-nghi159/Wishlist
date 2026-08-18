// src/lib/rateLimiter.ts

/**
 * Simple in‑memory rate limiter.
 * Tracks requests per user ID for a given time window (default 1 minute).
 * Returns true if request is allowed, false otherwise.
 * Note: In a serverless environment each invocation gets a fresh instance,
 * so this works for the current Vercel edge function (single instance per
 * container). For production you would replace it with Redis or a DB.
 */

type Bucket = {
  count: number;
  resetTime: number; // epoch ms when bucket resets
};

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 10; // default, can be tweaked per endpoint

// Map userId -> bucket
const buckets = new Map<string, Bucket>();

export function isAllowed(userId: string, maxRequests = MAX_REQUESTS): boolean {
  const now = Date.now();
  const bucket = buckets.get(userId);
  if (!bucket || now > bucket.resetTime) {
    // start a new bucket
    buckets.set(userId, { count: 1, resetTime: now + WINDOW_MS });
    return true;
  }
  if (bucket.count < maxRequests) {
    bucket.count += 1;
    return true;
  }
  return false;
}

// Helper to get remaining time for a retry‑After header
export function getRetryAfter(userId: string): number {
  const bucket = buckets.get(userId);
  if (!bucket) return 0;
  const now = Date.now();
  return Math.max(0, bucket.resetTime - now);
}
