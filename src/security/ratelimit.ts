type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5_000;

export function allowRequest(key: string, limit = 60, windowMs = 60_000, now = Date.now()): boolean {
  if (buckets.size > MAX_BUCKETS) {
    for (const [id, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(id);
    }
  }

  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

export function requestKey(headers: Headers | { get?(name: string): string | null | undefined }): string {
  const read = (name: string) => headers.get?.(name) ?? null;
  return (
    read("cf-connecting-ip") ||
    read("x-forwarded-for")?.split(",")[0]?.trim() ||
    read("x-real-ip") ||
    "local"
  );
}

export function resetRateLimits(): void {
  buckets.clear();
}
