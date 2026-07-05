#!/usr/bin/env tsx
/**
 * scripts/register-discord-commands.ts
 *
 * One-time script to register slash commands with Discord.
 *
 * Usage:
 *   npx tsx scripts/register-discord-commands.ts
 *
 * Behaviour:
 *   - If DISCORD_GUILD_ID is set → registers to that single guild (instant,
 *     for local development / testing)
 *   - If DISCORD_GUILD_ID is not set → registers globally (up to 1 hour for
 *     Discord to propagate to all servers)
 *
 * Required env vars:
 *   DISCORD_BOT_TOKEN   — bot token
 *   DISCORD_CLIENT_ID   — application client ID
 *   DISCORD_GUILD_ID    — (optional) guild ID for instant dev registration
 *
 * Run this script:
 *   1. After creating the Discord application and adding the bot
 *   2. Any time you add, remove, or rename a slash command
 *   3. Once for dev (with DISCORD_GUILD_ID) and once for prod (without)
 *
 * This script is idempotent — safe to run multiple times.
 */

import "dotenv/config";
import { registerCommands } from "@/lib/discord/rest";
import { COMMAND_DEFINITIONS } from "@/lib/discord/commands";

async function main() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const guildId = process.env.DISCORD_GUILD_ID ?? undefined;

  if (!token) {
    console.error("❌ DISCORD_BOT_TOKEN is not set in .env");
    process.exit(1);
  }
  if (!clientId) {
    console.error("❌ DISCORD_CLIENT_ID is not set in .env");
    process.exit(1);
  }

  const scope = guildId ? `guild ${guildId} (instant)` : "global (~1h propagation)";
  console.log(`Registering ${COMMAND_DEFINITIONS.length} command(s) — ${scope}…`);

  try {
    await registerCommands(token, clientId, COMMAND_DEFINITIONS, guildId);
    console.log(`✅ Done! Registered: ${COMMAND_DEFINITIONS.map((c) => `/${(c as { name: string }).name}`).join(", ")}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Mask anything that looks like a token in the error output
    const safe = msg.replace(/\b[A-Za-z0-9_-]{20,}\b/g, "[redacted]");
    console.error("❌ Registration failed:", safe);
    process.exit(1);
  }
}

main();
