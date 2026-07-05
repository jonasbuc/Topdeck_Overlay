/**
 * Server-side environment variable validation.
 *
 * Throws at startup if required variables are missing, so misconfiguration
 * is caught immediately rather than at runtime.
 *
 * Never log values from this module — some contain secrets.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required environment variable: ${name}\n` +
        `Copy .env.example → .env and fill in the values.`
    );
  }
  return value.trim();
}

function optionalEnv(name: string): string | null {
  const value = process.env[name];
  return value?.trim() || null;
}

export const env = {
  DATABASE_URL: requireEnv("DATABASE_URL"),

  /** Webhook signing secret — from TopDeck developer portal → Endpoints. */
  TOPDECK_WEBHOOK_SECRET: requireEnv("TOPDECK_WEBHOOK_SECRET"),

  /**
   * REST API key — from TopDeck developer portal.
   * Required for: resync, standings fetch, player details, attendees, tournament list.
   * null if not configured.
   */
  TOPDECK_API_KEY: optionalEnv("TOPDECK_API_KEY"),

  /** Base URL used by the local test script. */
  NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000",

  // ── Parking ─────────────────────────────────────────────────────────────

  /**
   * Parking data provider.
   * Supported values: "overpass" (default, free, no key required) | "google_places"
   * Defaults to "overpass" if not set.
   */
  PARKING_PROVIDER: (process.env.PARKING_PROVIDER?.trim() || "overpass") as "overpass" | "google_places",

  /**
   * Google Maps / Places API key.
   * Required only when PARKING_PROVIDER="google_places".
   * null if not configured.
   */
  GOOGLE_MAPS_API_KEY: optionalEnv("GOOGLE_MAPS_API_KEY"),

  // ── Discord ──────────────────────────────────────────────────────────────

  /**
   * Discord bot token — from Discord Developer Portal → Bot → Token.
   * Required for all Discord features (posting messages, registering commands).
   * null if Discord features are not enabled.
   * NEVER log this value.
   */
  DISCORD_BOT_TOKEN: optionalEnv("DISCORD_BOT_TOKEN"),

  /**
   * Discord application client ID — from Developer Portal → General Information.
   * Required for registering slash commands.
   */
  DISCORD_CLIENT_ID: optionalEnv("DISCORD_CLIENT_ID"),

  /**
   * Discord application public key — from Developer Portal → General Information.
   * Required for Ed25519 signature verification on /api/discord/interactions.
   */
  DISCORD_PUBLIC_KEY: optionalEnv("DISCORD_PUBLIC_KEY"),

  /**
   * Discord guild (server) ID — used to register commands to a single server
   * during local development (instant propagation vs global ~1h delay).
   * null in production (commands registered globally).
   */
  DISCORD_GUILD_ID: optionalEnv("DISCORD_GUILD_ID"),
} as const;
