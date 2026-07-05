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
   * Required for Phase 2+ features: resync, standings fetch, player details,
   * attendees, tournament list. null if not configured.
   */
  TOPDECK_API_KEY: optionalEnv("TOPDECK_API_KEY"),

  /** Base URL used by the local test script. */
  NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000",
} as const;
