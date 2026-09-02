import assert from "node:assert/strict";
import test from "node:test";
import { allowAuthAttempt, looksLikeBot } from "./auth-forms";
import { createActivityToken, IDLE_TIMEOUT_MS, safeNextPath, verifyActivityToken } from "./auth-security";

test("rejects honeypot values and implausibly fast submissions", () => {
  assert.equal(looksLikeBot({ website: "https://spam.example", startedAt: Date.now() - 5000 }), true);
  assert.equal(looksLikeBot({ startedAt: Date.now() }), true);
  assert.equal(looksLikeBot({ startedAt: Date.now() - 3000 }), false);
});

test("rate limits repeated authentication attempts", () => {
  const key = `test:${crypto.randomUUID()}`;
  assert.equal(allowAuthAttempt(key, 2), true);
  assert.equal(allowAuthAttempt(key, 2), true);
  assert.equal(allowAuthAttempt(key, 2), false);
});

test("accepts a signed current activity token and detects tampering and expiry", async () => {
  const token = await createActivityToken("user-1");
  assert.deepEqual(await verifyActivityToken(token, "user-1"), { valid: true, inconsistent: false, expired: false });
  assert.equal((await verifyActivityToken(`${token}x`, "user-1")).inconsistent, true);

  const expired = await createActivityToken("user-1", Date.now() - IDLE_TIMEOUT_MS - 1);
  assert.deepEqual(await verifyActivityToken(expired, "user-1"), { valid: true, inconsistent: false, expired: true });
});

test("only permits local next paths", () => {
  assert.equal(safeNextPath("/admin/inventory"), "/admin/inventory");
  assert.equal(safeNextPath("https://malicious.example"), "/");
  assert.equal(safeNextPath("//malicious.example"), "/");
});
