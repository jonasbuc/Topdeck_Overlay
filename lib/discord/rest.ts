/**
 * Discord REST client factory.
 *
 * Wraps @discordjs/rest to provide a configured REST client for sending
 * messages, creating followup responses, and registering commands.
 *
 * Security:
 *   - The DISCORD_BOT_TOKEN is passed directly to the REST client.
 *   - This module must NEVER log the token. Log "[discord] REST client ready"
 *     at most, with no token details.
 *   - The REST client instance is created fresh per-call (stateless); there
 *     is no persistent connection.
 */

import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v10";
import type { RESTPostAPIChannelMessageJSONBody } from "discord-api-types/v10";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DiscordMessage {
  content?: string;
  embeds?: import("./types").DiscordEmbed[];
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a Discord REST client authenticated with the bot token.
 * Returns null if DISCORD_BOT_TOKEN is not set so callers can degrade
 * gracefully rather than throwing at startup.
 *
 * The token is never included in any log output from this module.
 */
export function createDiscordRest(token: string | null): REST | null {
  if (!token) return null;
  return new REST({ version: "10" }).setToken(token);
}

// ─── Message sending ──────────────────────────────────────────────────────────

/**
 * Send a message to a Discord channel.
 *
 * @param token     - Bot token (from env.DISCORD_BOT_TOKEN)
 * @param channelId - Target channel snowflake ID
 * @param message   - Message body (content and/or embeds)
 *
 * Returns true on success, false on any error (error is logged).
 * Never throws — the caller (notifier) should not fail the webhook handler
 * because of a Discord delivery failure.
 */
export async function sendDiscordMessage(
  token: string,
  channelId: string,
  message: DiscordMessage
): Promise<boolean> {
  const rest = createDiscordRest(token);
  if (!rest) return false;

  try {
    await rest.post(Routes.channelMessages(channelId), {
      body: message as RESTPostAPIChannelMessageJSONBody,
    });
    return true;
  } catch (err) {
    // Log the error type but never the token
    const message_ = err instanceof Error ? err.message : String(err);
    // Mask anything that looks like a token (starts with "Bot " or is long hex)
    const safe = message_.replace(/\b[A-Za-z0-9_-]{20,}\b/g, "[redacted]");
    console.error(`[discord] sendMessage to channel ${channelId} failed: ${safe}`);
    return false;
  }
}

/**
 * Send a followup message to a deferred interaction.
 * Used for slash commands that need > 3 seconds (e.g. parking fetch).
 */
export async function sendInteractionFollowup(
  token: string,
  applicationId: string,
  interactionToken: string,
  message: DiscordMessage
): Promise<boolean> {
  const rest = createDiscordRest(token);
  if (!rest) return false;

  try {
    await rest.post(
      Routes.webhookMessage(applicationId, interactionToken),
      { body: message as RESTPostAPIChannelMessageJSONBody }
    );
    return true;
  } catch (err) {
    const message_ = err instanceof Error ? err.message : String(err);
    const safe = message_.replace(/\b[A-Za-z0-9_-]{20,}\b/g, "[redacted]");
    console.error(`[discord] sendFollowup failed: ${safe}`);
    return false;
  }
}

/**
 * Register slash commands for the application.
 * Pass a guildId to register to a single guild (instant — for dev).
 * Omit guildId to register globally (up to 1 hour propagation — for prod).
 */
export async function registerCommands(
  token: string,
  clientId: string,
  commands: object[],
  guildId?: string
): Promise<void> {
  const rest = createDiscordRest(token);
  if (!rest) throw new Error("DISCORD_BOT_TOKEN is not set");

  const route = guildId
    ? Routes.applicationGuildCommands(clientId, guildId)
    : Routes.applicationCommands(clientId);

  await rest.put(route, { body: commands });

  const scope = guildId ? `guild ${guildId}` : "global";
  console.info(`[discord] Registered ${commands.length} command(s) — ${scope}`);
}
