/**
 * Best-effort, in-memory fixed-window rate limiter — no external store
 * (Redis, etc.), so this only actually limits within one warm serverless
 * instance. On Vercel that's not perfectly accurate across cold starts or
 * concurrent instances, but it's enough to blunt the obvious case this
 * guards against: a single account (or script) hammering an endpoint that
 * calls the paid Anthropic API. A real distributed limiter would need a
 * shared store this app doesn't otherwise have any use for.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Sweeping only every so many calls (rather than on every single one) —
// this map is small in practice (one entry per currently-active user per
// limited route), so an occasional full pass is enough to keep long-idle
// entries from lingering forever without paying the cost on every request.
let callsSinceSweep = 0;
const SWEEP_EVERY = 200;

function sweepExpired(now: number) {
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}

/**
 * Returns whether `key` is still under `limit` calls within the current
 * `windowMs` window, incrementing its count as a side effect when it is.
 * Callers share one bucket namespace by key — prefix with a route name
 * (e.g. `review:${userId}`) so different endpoints don't share a budget.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  callsSinceSweep += 1;
  if (callsSinceSweep >= SWEEP_EVERY) {
    callsSinceSweep = 0;
    sweepExpired(now);
  }

  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }
  if (bucket.count >= limit) {
    return { allowed: false, retryAfterMs: bucket.resetAt - now };
  }
  bucket.count += 1;
  return { allowed: true, retryAfterMs: 0 };
}
