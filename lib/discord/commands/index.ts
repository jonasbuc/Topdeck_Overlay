/**
 * Discord slash command definitions.
 *
 * This module exports the list of command definition objects (used by the
 * registration script) and the command name constants (used by the
 * interaction route to dispatch to the right handler).
 */

import { SlashCommandBuilder } from "@discordjs/builders";

// ─── Command names ────────────────────────────────────────────────────────────

export const CMD = {
  TOPDECK: "topdeck",
  LINK: "link",
  UNLINK: "unlink",
  STANDINGS: "standings",
  PAIRINGS: "pairings",
  PARKING: "parking",
  EVENT: "event",
  SETTINGS: "settings",
  SETUP: "setup",
  TEST: "test",
} as const;

// ─── Command definitions ──────────────────────────────────────────────────────

export const COMMAND_DEFINITIONS = [
  new SlashCommandBuilder()
    .setName(CMD.TOPDECK)
    .setDescription("Manage TopDeck Live tournament coverage")
    .addSubcommand((sub) =>
      sub
        .setName(CMD.LINK)
        .setDescription("Link a TopDeck tournament to this channel")
        .addStringOption((opt) =>
          opt
            .setName("tid")
            .setDescription("TopDeck tournament ID (e.g. tid_abc123)")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName(CMD.UNLINK)
        .setDescription("Remove the TopDeck tournament link from this channel")
    )
    .addSubcommand((sub) =>
      sub
        .setName(CMD.STANDINGS)
        .setDescription("Post the current tournament standings")
        .addIntegerOption((opt) =>
          opt
            .setName("top")
            .setDescription("How many players to show (default: 8)")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(50)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName(CMD.PAIRINGS)
        .setDescription("Post the latest round pairings")
    )
    .addSubcommand((sub) =>
      sub
        .setName(CMD.PARKING)
        .setDescription("Post parking options near the tournament venue")
    )
    .addSubcommand((sub) =>
      sub
        .setName(CMD.EVENT)
        .setDescription("Post a public event hub with useful player links")
        .addStringOption((opt) =>
          opt
            .setName("tid")
            .setDescription("TopDeck tournament ID (defaults to linked channel)")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName(CMD.SETTINGS)
        .setDescription("Show the current notification settings for this channel")
    )
    .addSubcommand((sub) =>
      sub
        .setName(CMD.SETUP)
        .setDescription("Guided setup links for a TopDeck Live tournament")
        .addStringOption((opt) =>
          opt
            .setName("tid")
            .setDescription("TopDeck tournament ID to link first")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName(CMD.TEST)
        .setDescription("Send a test message to verify the bot is working")
    ),
].map((cmd) => cmd.toJSON());
