type Bucket = { count: number; reset: number };
const buckets = new Map<string, Bucket>();

export async function rateLimited(key: string): Promise<boolean> {
  const now = Date.now();
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    try {
      const redisKey = `contextmap:rate:${key}:${Math.floor(now / 60_000)}`;
      const response = await fetch(`${url}/pipeline`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify([["INCR", redisKey], ["EXPIRE", redisKey, 65]]) });
      if (!response.ok) return true;
      const result = await response.json() as Array<{ result?: number }>;
      return Number(result?.[0]?.result ?? 31) > 30;
    } catch { return true; }
  }
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.reset) { buckets.set(key, { count: 1, reset: now + 60_000 }); return false; }
  bucket.count += 1;
  if (buckets.size > 5_000) for (const [entry, value] of buckets) if (now >= value.reset) buckets.delete(entry);
  return bucket.count > 30;
}

export function requestKey(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}
