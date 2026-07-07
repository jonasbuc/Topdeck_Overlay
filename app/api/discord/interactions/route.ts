/**
 * POST /api/discord/interactions
 *
 * Handles Discord slash command interactions delivered via HTTP.
 *
 * This serverless-compatible approach requires NO persistent gateway
 * connection — Discord sends interactions as signed HTTP POST requests
 * to this endpoint. Works on Vercel, Railway, and any Node.js host.
 *
 * Security:
 *   1. Verify Ed25519 signature (Discord requires this; returns 401 on failure)
 *   2. Respond to PING with { type: 1 }
 *   3. Dispatch APPLICATION_COMMAND interactions to the right handler
 *   4. Return 501 for unrecognised commands
 *
 * Response timing:
 *   Discord requires a response within 3 seconds. All handlers that do
 *   async work (DB reads, parking API) are fast enough to respond inline.
 *   The `/topdeck parking` command may take longer on a cold cache miss.
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyDiscordSignature } from "@/lib/discord/verify";
import {
  InteractionResponseType,
  type DiscordInteraction,
  type InteractionResponse,
} from "@/lib/discord/types";
import { CMD } from "@/lib/discord/commands";
import { handleLink } from "@/lib/discord/commands/link";
import { handleUnlink } from "@/lib/discord/commands/unlink";
import { handleStandings } from "@/lib/discord/commands/standings";
import { handlePairings } from "@/lib/discord/commands/pairings";
import { handleParking } from "@/lib/discord/commands/parking";
import { handleEventHub } from "@/lib/discord/commands/event";
import { handlePlayerLookup } from "@/lib/discord/commands/player";
import { handleAnnouncementTemplate } from "@/lib/discord/commands/announce";
import { handleStaffLinks } from "@/lib/discord/commands/staff";
import { handleSettings } from "@/lib/discord/commands/settings";
import { handleSetup } from "@/lib/discord/commands/setup";
import { handleTest } from "@/lib/discord/commands/test";

export const dynamic = "force-dynamic";

// ─── Interaction types ────────────────────────────────────────────────────────

const INTERACTION_TYPE = {
  PING: 1,
  APPLICATION_COMMAND: 2,
} as const;

type ResolvedCommand = {
  name: string | undefined;
  interaction: DiscordInteraction;
};

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Discord is not configured — return 503 rather than a 500
  if (!env.DISCORD_PUBLIC_KEY) {
    return NextResponse.json({ error: "Discord integration not configured" }, { status: 503 });
  }

  // ── 1. Read raw body (required for signature verification) ─────────────
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: "failed to read body" }, { status: 400 });
  }

  // ── 2. Verify Ed25519 signature ─────────────────────────────────────────
  const timestamp = req.headers.get("x-signature-timestamp");
  const signature = req.headers.get("x-signature-ed25519");

  const result = verifyDiscordSignature(
    rawBody,
    timestamp,
    signature,
    env.DISCORD_PUBLIC_KEY
  );

  if (!result.ok) {
    console.warn("[discord/interactions] invalid signature:", result.reason);
    return NextResponse.json({ error: "invalid request signature" }, { status: 401 });
  }

  // ── 3. Parse interaction ────────────────────────────────────────────────
  let interaction: DiscordInteraction;
  try {
    interaction = JSON.parse(rawBody) as DiscordInteraction;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  // ── 4. Respond to PING (Discord endpoint verification) ─────────────────
  if (interaction.type === INTERACTION_TYPE.PING) {
    return NextResponse.json({ type: InteractionResponseType.PONG });
  }

  // ── 5. Dispatch slash commands ──────────────────────────────────────────
  if (interaction.type === INTERACTION_TYPE.APPLICATION_COMMAND) {
    const resolved = resolveCommand(interaction);
    const commandName = resolved.name;
    const commandInteraction = resolved.interaction;
    let response: InteractionResponse;

    try {
      switch (commandName) {
        case CMD.LINK:       response = await handleLink(commandInteraction); break;
        case CMD.UNLINK:     response = await handleUnlink(commandInteraction); break;
        case CMD.STANDINGS:  response = await handleStandings(commandInteraction); break;
        case CMD.PAIRINGS:   response = await handlePairings(commandInteraction); break;
        case CMD.PARKING:    response = await handleParking(commandInteraction); break;
        case CMD.EVENT:      response = await handleEventHub(commandInteraction); break;
        case CMD.PLAYER:     response = await handlePlayerLookup(commandInteraction); break;
        case CMD.ANNOUNCE:   response = await handleAnnouncementTemplate(commandInteraction); break;
        case CMD.STAFF:      response = await handleStaffLinks(commandInteraction); break;
        case CMD.SETTINGS:   response = await handleSettings(commandInteraction); break;
        case CMD.SETUP:      response = await handleSetup(commandInteraction); break;
        case CMD.TEST:       response = await handleTest(commandInteraction); break;
        default:
          return NextResponse.json({ error: `unknown command: ${commandName ?? "unknown"}` }, { status: 501 });
      }
    } catch (err) {
      console.error(`[discord/interactions] handler error for /topdeck ${commandName ?? "unknown"}:`, err instanceof Error ? err.message : err);
      response = {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: "❌ An unexpected error occurred. Please try again.", flags: 64 },
      };
    }

    return NextResponse.json(response);
  }

  // Unknown interaction type
  return NextResponse.json({ error: "unknown interaction type" }, { status: 400 });
}

function resolveCommand(interaction: DiscordInteraction): ResolvedCommand {
  const rootName = interaction.data?.name;

  if (rootName !== CMD.TOPDECK) {
    return { name: rootName, interaction };
  }

  const subcommand = interaction.data?.options?.[0];
  if (!subcommand) {
    return { name: undefined, interaction };
  }

  return {
    name: subcommand.name,
    interaction: {
      ...interaction,
      data: {
        ...interaction.data!,
        name: subcommand.name,
        options: subcommand.options ?? [],
      },
    },
  };
}
