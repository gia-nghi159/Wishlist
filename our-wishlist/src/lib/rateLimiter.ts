type Bucket = {
  count: number;
  resetTime: number; // Unix epoch millisecond timestamp
};

const WINDOW_MS = 60_000; // 1-minute window
const MAX_REQUESTS = 10;

// In-memory bucket store: userId -> Bucket
const buckets = new Map<string, Bucket>();

export function isAllowed(userId: string, maxRequests = MAX_REQUESTS): boolean {
  const now = Date.now();
  const bucket = buckets.get(userId);
  if (!bucket || now > bucket.resetTime) {
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
