/**
 * Simple in-memory rate limiter for login attempts, keyed by loginId+IP.
 * Good enough for an FYP single-instance deployment. For multi-instance
 * production, replace with a Redis-backed limiter.
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 8;

export function checkLoginRateLimit(key: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }

  if (bucket.count >= MAX_ATTEMPTS) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { allowed: true };
}

export function resetLoginRateLimit(key: string) {
  buckets.delete(key);
}
