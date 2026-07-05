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
  LINK: "link",
  UNLINK: "unlink",
  STANDINGS: "standings",
  PAIRINGS: "pairings",
  PARKING: "parking",
  SETTINGS: "settings",
  TEST: "test",
} as const;

// ─── Command definitions ──────────────────────────────────────────────────────

export const COMMAND_DEFINITIONS = [
  new SlashCommandBuilder()
    .setName(CMD.LINK)
    .setDescription("Link a TopDeck tournament to this channel")
    .addStringOption((opt) =>
      opt
        .setName("tid")
        .setDescription("TopDeck tournament ID (e.g. tid_abc123)")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName(CMD.UNLINK)
    .setDescription("Remove the TopDeck tournament link from this channel"),

  new SlashCommandBuilder()
    .setName(CMD.STANDINGS)
    .setDescription("Post the current tournament standings")
    .addIntegerOption((opt) =>
      opt
        .setName("top")
        .setDescription("How many players to show (default: 8)")
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(50)
    ),

  new SlashCommandBuilder()
    .setName(CMD.PAIRINGS)
    .setDescription("Post the latest round pairings"),

  new SlashCommandBuilder()
    .setName(CMD.PARKING)
    .setDescription("Post parking options near the tournament venue"),

  new SlashCommandBuilder()
    .setName(CMD.SETTINGS)
    .setDescription("Show the current notification settings for this channel"),

  new SlashCommandBuilder()
    .setName(CMD.TEST)
    .setDescription("Send a test message to verify the bot is working"),
].map((cmd) => cmd.toJSON());
