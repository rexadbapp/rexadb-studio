const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, max: number, windowMs: number): void {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  bucket.count++;
  if (bucket.count > max) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    const err = new Error(`Too many requests. Try again in ${retryAfter}s.`);
    (err as any).statusCode = 429;
    (err as any).retryAfter = retryAfter;
    throw err;
  }
}
