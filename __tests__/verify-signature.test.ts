import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";
import {
  verifyTopDeckSignature,
  parseSignatureHeader,
  TIMESTAMP_TOLERANCE_MS,
} from "@/lib/topdeck/verify-signature";

// ─── helpers ──────────────────────────────────────────────────────────────────

const SECRET = "test_secret_abc123";

/**
 * Build a valid X-TopDeck-Signature header.
 * `t=` uses Unix milliseconds (not seconds) — matching real TopDeck behaviour.
 */
function makeHeader(body: string, secret = SECRET, nowMs?: number): string {
  const t = (nowMs ?? Date.now()).toString();
  const signed = `${t}.${body}`;
  const hmac = createHmac("sha256", secret).update(signed, "utf8").digest("hex");
  return `t=${t},v1=${hmac}`;
}

// ─── parseSignatureHeader ─────────────────────────────────────────────────────

describe("parseSignatureHeader", () => {
  it("parses a valid header", () => {
    const result = parseSignatureHeader("t=1751500800000,v1=abcdef01");
    expect(result).toEqual({ t: "1751500800000", v1: "abcdef01" });
  });

  it("returns null for missing header", () => {
    expect(parseSignatureHeader(null)).toBeNull();
    expect(parseSignatureHeader(undefined)).toBeNull();
    expect(parseSignatureHeader("")).toBeNull();
  });

  it("returns null when t is missing", () => {
    expect(parseSignatureHeader("v1=abcdef")).toBeNull();
  });

  it("returns null when v1 is missing", () => {
    expect(parseSignatureHeader("t=1751500800000")).toBeNull();
  });
});

// ─── verifyTopDeckSignature ───────────────────────────────────────────────────

describe("verifyTopDeckSignature", () => {
  const body = JSON.stringify({ id: "evt_001", type: "ping", tid: null });
  const nowMs = Date.now();

  it("accepts a valid signature", () => {
    const header = makeHeader(body, SECRET, nowMs);
    const result = verifyTopDeckSignature(body, header, SECRET, nowMs);
    expect(result.ok).toBe(true);
  });

  it("rejects a missing signature header", () => {
    const result = verifyTopDeckSignature(body, null, SECRET, nowMs);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/missing/i);
  });

  it("rejects an invalid signature (wrong secret)", () => {
    const header = makeHeader(body, "wrong_secret", nowMs);
    const result = verifyTopDeckSignature(body, header, SECRET, nowMs);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/mismatch/i);
  });

  it("rejects a tampered body", () => {
    const header = makeHeader(body, SECRET, nowMs);
    const tamperedBody = body.replace("ping", "round.started");
    const result = verifyTopDeckSignature(tamperedBody, header, SECRET, nowMs);
    expect(result.ok).toBe(false);
  });

  it("rejects a timestamp that is too old", () => {
    const oldMs = nowMs - TIMESTAMP_TOLERANCE_MS - 10;
    const header = makeHeader(body, SECRET, oldMs);
    const result = verifyTopDeckSignature(body, header, SECRET, nowMs);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/timestamp/i);
  });

  it("rejects a timestamp too far in the future", () => {
    const futureMs = nowMs + TIMESTAMP_TOLERANCE_MS + 10;
    const header = makeHeader(body, SECRET, futureMs);
    const result = verifyTopDeckSignature(body, header, SECRET, nowMs);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/timestamp/i);
  });

  it("accepts a timestamp near the tolerance boundary", () => {
    const borderMs = nowMs - TIMESTAMP_TOLERANCE_MS + 5;
    const header = makeHeader(body, SECRET, borderMs);
    const result = verifyTopDeckSignature(body, header, SECRET, nowMs);
    expect(result.ok).toBe(true);
  });

  it("works with Buffer body", () => {
    const buf = Buffer.from(body, "utf8");
    const header = makeHeader(body, SECRET, nowMs);
    const result = verifyTopDeckSignature(buf, header, SECRET, nowMs);
    expect(result.ok).toBe(true);
  });
});
