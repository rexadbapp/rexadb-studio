import { AppError } from './app-error';

const buckets = new Map<string, { count: number; resetAt: number }>();
const MAX_BUCKETS = 10_000;
const CLEANUP_INTERVAL = 60_000;
let lastCleanup = 0;

function evictStaleEntries(): void {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) {
      buckets.delete(key);
    }
  }
}

export function checkRateLimit(key: string, max: number, windowMs: number): void {
  const now = Date.now();

  if (buckets.size > MAX_BUCKETS && now - lastCleanup > CLEANUP_INTERVAL) {
    evictStaleEntries();
    lastCleanup = now;
  }

  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  bucket.count++;
  if (bucket.count > max) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    throw new AppError(`Too many requests. Try again in ${retryAfter}s.`, 429, 'RATE_LIMITED');
  }
}
