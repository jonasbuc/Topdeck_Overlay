/**
 * Discord interaction signature verification.
 *
 * Discord sends every interaction as an HTTP POST to our endpoint.
 * We must verify the Ed25519 signature before processing — Discord will
 * temporarily disable the endpoint if we accept unsigned requests.
 *
 * Signature format:
 *   X-Signature-Ed25519: <hex-encoded signature>
 *   X-Signature-Timestamp: <unix seconds as string>
 *   Body: raw JSON bytes
 *
 * Message signed by Discord: "<timestamp><body>"
 *
 * Verification uses tweetnacl (pure-JS, no native bindings) so it works
 * on all deployment targets including Vercel Edge and Node.js.
 *
 * Reference: https://discord.com/developers/docs/interactions/receiving-and-responding#security-and-authorization
 */

import nacl from "tweetnacl";

// ─── Result type ──────────────────────────────────────────────────────────────

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    const byte = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (isNaN(byte)) return null;
    bytes[i] = byte;
  }
  return bytes;
}

// ─── Verifier ────────────────────────────────────────────────────────────────

/**
 * Verify a Discord interaction request signature.
 *
 * @param rawBody       - The raw request body string (before JSON.parse)
 * @param timestamp     - Value of X-Signature-Timestamp header
 * @param signature     - Value of X-Signature-Ed25519 header (hex)
 * @param publicKey     - The application's public key (hex) from Discord dev portal
 *
 * @returns `{ ok: true }` on success, `{ ok: false, reason: string }` on failure.
 */
export function verifyDiscordSignature(
  rawBody: string,
  timestamp: string | null,
  signature: string | null,
  publicKey: string
): VerifyResult {
  if (!timestamp) {
    return { ok: false, reason: "missing X-Signature-Timestamp header" };
  }
  if (!signature) {
    return { ok: false, reason: "missing X-Signature-Ed25519 header" };
  }

  const sigBytes = hexToBytes(signature);
  if (!sigBytes || sigBytes.length !== 64) {
    return { ok: false, reason: "signature is not valid 64-byte hex" };
  }

  const pubKeyBytes = hexToBytes(publicKey);
  if (!pubKeyBytes || pubKeyBytes.length !== 32) {
    return { ok: false, reason: "public key is not valid 32-byte hex" };
  }

  const message = new TextEncoder().encode(timestamp + rawBody);

  const valid = nacl.sign.detached.verify(message, sigBytes, pubKeyBytes);

  if (!valid) {
    return { ok: false, reason: "signature verification failed" };
  }

  return { ok: true };
}
