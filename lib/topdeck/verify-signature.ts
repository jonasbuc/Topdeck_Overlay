/**
 * TopDeck webhook signature verification.
 *
 * Signature format (from X-TopDeck-Signature header):
 *   t=<unix_milliseconds>,v1=<hex_hmac_sha256>
 *
 * IMPORTANT: `t` is Unix MILLISECONDS, not seconds.
 * Example from live TopDeck header: t=1751500800000
 *
 * HMAC message is: `${t}.${rawBody}`
 *
 * Security guarantees:
 * - Uses Node.js `crypto.timingSafeEqual` to prevent timing attacks.
 * - Optionally rejects payloads with timestamps older than TOLERANCE.
 * - Never logs the secret.
 */

import { createHmac, timingSafeEqual } from "crypto";

/** Maximum age of a webhook timestamp before it is rejected (5 minutes, in ms). */
export const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Parse the `X-TopDeck-Signature` header.
 *
 * Returns `null` if the header is missing or malformed.
 */
export function parseSignatureHeader(
  header: string | null | undefined
): { t: string; v1: string } | null {
  if (!header) return null;

  const tMatch = header.match(/(?:^|,)t=([^,]+)/);
  const v1Match = header.match(/(?:^|,)v1=([^,]+)/);

  if (!tMatch || !v1Match) return null;

  return { t: tMatch[1], v1: v1Match[1] };
}

/**
 * Verify a TopDeck webhook request.
 *
 * @param rawBody   Raw request body (Buffer or string) — MUST NOT be parsed.
 * @param header    Value of the `X-TopDeck-Signature` request header.
 * @param secret    Webhook endpoint secret (from env).
 * @param nowMs     Current time in milliseconds (injectable for testing).
 */
export function verifyTopDeckSignature(
  rawBody: Buffer | string,
  header: string | null | undefined,
  secret: string,
  nowMs: number = Date.now()
): VerifyResult {
  const parsed = parseSignatureHeader(header);

  if (!parsed) {
    return { ok: false, reason: "missing or malformed X-TopDeck-Signature header" };
  }

  const { t, v1 } = parsed;

  // ── 1. Timestamp replay protection ──────────────────────────────────────
  const timestamp = parseInt(t, 10);
  if (isNaN(timestamp)) {
    return { ok: false, reason: "non-numeric timestamp in signature header" };
  }

  const ageMs = Math.abs(nowMs - timestamp);
  if (ageMs > TIMESTAMP_TOLERANCE_MS) {
    return {
      ok: false,
      reason: `timestamp too old or too far in the future (age=${ageMs}ms, tolerance=${TIMESTAMP_TOLERANCE_MS}ms)`,
    };
  }

  // ── 2. Compute expected HMAC ─────────────────────────────────────────────
  const body = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
  const signedPayload = `${t}.${body}`;

  const expected = createHmac("sha256", secret)
    .update(signedPayload, "utf8")
    .digest("hex");

  // ── 3. Constant-time comparison ──────────────────────────────────────────
  let receivedBuf: Buffer;
  let expectedBuf: Buffer;
  try {
    receivedBuf = Buffer.from(v1, "hex");
    expectedBuf = Buffer.from(expected, "hex");
  } catch {
    return { ok: false, reason: "invalid hex in signature" };
  }

  // Both buffers must be the same length for timingSafeEqual
  if (receivedBuf.length !== expectedBuf.length) {
    return { ok: false, reason: "signature length mismatch" };
  }

  const match = timingSafeEqual(receivedBuf, expectedBuf);
  if (!match) {
    return { ok: false, reason: "signature mismatch" };
  }

  return { ok: true };
}
