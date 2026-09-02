export const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 14;
export const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
export const ACTIVITY_COOKIE = "sps-auth-activity";

export const authCookieOptions = {
  maxAge: SESSION_COOKIE_MAX_AGE,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

function activitySecret() {
  return process.env.AUTH_ACTIVITY_SECRET || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "local-development-activity-secret";
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function signingKey() {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(activitySecret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function createActivityToken(userId: string, timestamp = Date.now()) {
  const payload = `${userId}.${timestamp}`;
  const signature = await crypto.subtle.sign("HMAC", await signingKey(), new TextEncoder().encode(payload));
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifyActivityToken(token: string | undefined, userId: string) {
  if (!token) return { valid: false, inconsistent: false, expired: false };
  const parts = token.split(".");
  if (parts.length !== 3) return { valid: false, inconsistent: true, expired: false };

  const [tokenUserId, timestampValue, signatureValue] = parts;
  const timestamp = Number(timestampValue);
  if (!tokenUserId || !Number.isFinite(timestamp) || !signatureValue) {
    return { valid: false, inconsistent: true, expired: false };
  }

  try {
    const signatureValid = await crypto.subtle.verify(
      "HMAC",
      await signingKey(),
      fromBase64Url(signatureValue),
      new TextEncoder().encode(`${tokenUserId}.${timestampValue}`),
    );
    if (!signatureValid || tokenUserId !== userId) return { valid: false, inconsistent: true, expired: false };
    return { valid: true, inconsistent: false, expired: Date.now() - timestamp > IDLE_TIMEOUT_MS };
  } catch {
    return { valid: false, inconsistent: true, expired: false };
  }
}

export function safeNextPath(value: string | null | undefined, fallback = "/") {
  return value?.startsWith("/") && !value.startsWith("//") ? value : fallback;
}
