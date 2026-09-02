type BotSubmission = {
  website?: string;
  faxNumber?: string;
  contactPreference?: string;
  startedAt?: number;
};

const MIN_HUMAN_COMPLETION_MS = 2500;
const buckets = new Map<string, { count: number; resetAt: number }>();

export function looksLikeBot(data: BotSubmission) {
  return Boolean(
    String(data.website || "").trim() ||
    String(data.faxNumber || "").trim() ||
    String(data.contactPreference || "").trim() ||
    !Number.isFinite(Number(data.startedAt)) ||
    Date.now() - Number(data.startedAt) < MIN_HUMAN_COMPLETION_MS,
  );
}

export function allowAuthAttempt(key: string, limit = 5, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

export function clientIp(headers: Headers) {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}
