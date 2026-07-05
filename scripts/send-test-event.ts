#!/usr/bin/env node
/**
 * scripts/send-test-event.ts
 *
 * Sends a signed fake TopDeck webhook event to the local development server.
 *
 * Usage:
 *   npm run send-test-event [event-type] [tid]
 *
 * Examples:
 *   npm run send-test-event ping
 *   npm run send-test-event round.published tid_test_001
 *   npm run send-test-event round.started   tid_test_001
 *   npm run send-test-event match.result_reported tid_test_001
 *   npm run send-test-event round.ended      tid_test_001
 *   npm run send-test-event tournament.finished tid_test_001
 *   npm run send-test-event tournament.checkin_started tid_test_001
 *   npm run send-test-event player.registered tid_test_001
 *   npm run send-test-event player.dropped   tid_test_001
 *
 * Environment variables:
 *   TOPDECK_WEBHOOK_SECRET  — must match the value in .env
 *   NEXT_PUBLIC_BASE_URL    — defaults to http://localhost:3000
 */

import { createHmac } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";

// ─── Config ────────────────────────────────────────────────────────────────

const secret = process.env.TOPDECK_WEBHOOK_SECRET;
if (!secret) {
  console.error("❌  TOPDECK_WEBHOOK_SECRET is not set.");
  console.error("    Copy .env.example → .env and fill in the value.");
  process.exit(1);
}

const baseUrl =
  process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

const endpoint = `${baseUrl}/api/webhooks/topdeck`;

// ─── CLI args ───────────────────────────────────────────────────────────────

const eventType = process.argv[2] ?? "ping";
const tidOverride = process.argv[3];

// ─── Load payload ──────────────────────────────────────────────────────────

const payloadDir = join(__dirname, "payloads");
const payloadFile = join(payloadDir, `${eventType}.json`);

let payload: Record<string, unknown>;
try {
  payload = JSON.parse(readFileSync(payloadFile, "utf8"));
} catch {
  console.error(`❌  No sample payload found for event type: ${eventType}`);
  console.error(`    Expected file: ${payloadFile}`);
  console.error(
    `    Available types: ping, round.published, round.started, ` +
      `match.result_reported, round.ended, tournament.finished, ` +
      `tournament.checkin_started, player.registered, player.dropped`
  );
  process.exit(1);
}

// Override tid if provided
if (tidOverride && payload.tid !== null) {
  payload.tid = tidOverride;
}

// Give the event a fresh unique ID and current timestamp (unix ms — not ISO string)
payload.id = `evt_test_${Date.now()}`;
payload.created = Date.now(); // TopDeck uses unix milliseconds

const body = JSON.stringify(payload);

// ─── Sign ──────────────────────────────────────────────────────────────────

// TopDeck sends t= as Unix milliseconds (e.g. t=1751500800000), not seconds
const timestamp = Date.now().toString();
const signed = `${timestamp}.${body}`;
const hmac = createHmac("sha256", secret)
  .update(signed, "utf8")
  .digest("hex");

const signatureHeader = `t=${timestamp},v1=${hmac}`;

// ─── Send ──────────────────────────────────────────────────────────────────

console.log(`\n🚀  Sending ${eventType} event to ${endpoint}`);
console.log(`    tid: ${payload.tid}`);
console.log(`    id:  ${payload.id}`);

try {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-TopDeck-Signature": signatureHeader,
    },
    body,
  });

  const json = await res.json();

  if (res.ok) {
    console.log(`\n✅  ${res.status} ${res.statusText}`);
    console.log("    Response:", JSON.stringify(json, null, 2));
  } else {
    console.error(`\n❌  ${res.status} ${res.statusText}`);
    console.error("    Response:", JSON.stringify(json, null, 2));
    process.exit(1);
  }
} catch (err) {
  console.error(`\n❌  Request failed — is the dev server running?`);
  console.error(`    Run: npm run dev`);
  console.error(`    Error: ${(err as Error).message}`);
  process.exit(1);
}
