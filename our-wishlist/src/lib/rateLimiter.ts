type Bucket = {
  count: number;
  resetTime: number; // Unix epoch millisecond timestamp
};

const MAX_USERS = 1000;   // evict oldest when exceeded
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;

// Doubly-linked list order (insertion = recent use)
// Map preserves insertion order (oldest = first entry)
const buckets = new Map<string, Bucket>();

function evictExpiredAndCap(): void {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetTime) {
      buckets.delete(key);   // expired — remove
    }
    if (buckets.size <= MAX_USERS) break;  // cap reached
  }
  // Remove oldest entries if capacity exceeded after expiry sweep
  while (buckets.size > MAX_USERS) {
    const oldestKey = buckets.keys().next().value;
    if (oldestKey) buckets.delete(oldestKey);
  }
}

export function isAllowed(userId: string, maxRequests = MAX_REQUESTS): boolean {
  evictExpiredAndCap();
  const now = Date.now();
  const bucket = buckets.get(userId);
  if (!bucket || now > bucket.resetTime) {
    // Re-insert to update Map order (most recently used)
    if (bucket) buckets.delete(userId);
    buckets.set(userId, { count: 1, resetTime: now + WINDOW_MS });
    return true;
  }
  if (bucket.count < maxRequests) {
    bucket.count += 1;
    // Optional re-insertion for MRU update omitted
    return true;
  }
  return false;
}

// Status helper for API responses
export function getRateLimitStatus(userId: string) {
  const bucket = buckets.get(userId);
  const now = Date.now();
  if (!bucket || now > bucket.resetTime) {
    return { allowed: true, remaining: MAX_REQUESTS, resetIn: 0 };
  }
  return {
    allowed: bucket.count < MAX_REQUESTS,
    remaining: Math.max(0, MAX_REQUESTS - bucket.count),
    resetIn: Math.max(0, bucket.resetTime - now),
  };
}
