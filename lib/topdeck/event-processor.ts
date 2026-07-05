/**
 * Event processor.
 *
 * Maps each TopDeck webhook event type to a state mutation via
 * `patchTournamentState`.
 *
 * Conflict resolution:
 *   TopDeck does NOT guarantee delivery order. We compare `event.created`
 *   (unix ms) against `state.lastEventCreated` (unix ms) to reject stale
 *   events. For match results we use per-entry `reportedAt` for finer
 *   granularity.
 *
 * Corrections (match.result_reported):
 *   Under rapid corrections an earlier `event.created` may carry a later
 *   snapshot. We track `reportedAt` per table entry and only update if the
 *   incoming event is not older than what we have stored.
 */

import { getTournamentState, patchTournamentState } from "./tournament-state";
import type {
  TopDeckWebhookEvent,
  LiveTournamentState,
  MatchResultEntry,
  RoundSnapshot,
} from "./types";

export async function processEvent(
  event: TopDeckWebhookEvent
): Promise<LiveTournamentState | null> {
  // Ping events are handled in the route — they never reach the processor
  if (event.type === "ping") return null;

  // All non-ping events must have a non-null tid
  if (!event.tid) return null;

  const tid = event.tid;
  const eventCreatedMs = event.created; // unix ms

  switch (event.type) {
    // ── tournament.checkin_started ──────────────────────────────────────────
    case "tournament.checkin_started": {
      const { stage } = event.data;
      return patchTournamentState(tid, {
        name: event.tournament!.name,
        game: event.tournament!.game,
        format: event.tournament!.format,
        checkinStarted: true,
        checkinStage: stage,
        lastEventId: event.id,
        lastEventCreated: eventCreatedMs,
      });
    }

    // ── round.published ────────────────────────────────────────────────────
    case "round.published": {
      const { stage, round, roundLabel, tables } = event.data;
      const existing = await getTournamentState(tid);

      // Reject if a newer event has already been applied
      if (existing && existing.lastEventCreated > eventCreatedMs) {
        return existing;
      }

      // Infer player list from tables when roster is empty or has new players
      const existingPlayers = existing?.players ?? [];
      const existingIds = new Set(existingPlayers.map((p) => p.id));
      const inferredPlayers = [...existingPlayers];
      for (const t of tables) {
        for (const p of t.players) {
          if (!existingIds.has(p.id)) {
            existingIds.add(p.id);
            inferredPlayers.push(p);
          }
        }
      }

      return patchTournamentState(tid, {
        name: event.tournament!.name,
        game: event.tournament!.game,
        format: event.tournament!.format,
        currentStage: stage,
        currentRound: round,
        roundLabel: String(roundLabel),
        roundStatus: "pending",
        tables,
        players: inferredPlayers,
        lastEventId: event.id,
        lastEventCreated: eventCreatedMs,
      });
    }

    // ── round.started ──────────────────────────────────────────────────────
    case "round.started": {
      const { stage, round, roundLabel, startedAt, roundTimeMinutes } = event.data;
      const existing = await getTournamentState(tid);

      if (existing && existing.lastEventCreated > eventCreatedMs) {
        return existing;
      }

      return patchTournamentState(tid, {
        name: event.tournament!.name,
        game: event.tournament!.game,
        format: event.tournament!.format,
        currentStage: stage,
        currentRound: round,
        roundLabel: String(roundLabel),
        roundStatus: "active",
        roundStartedAt: startedAt,
        roundTimeMinutes,
        lastEventId: event.id,
        lastEventCreated: eventCreatedMs,
      });
    }

    // ── match.result_reported ──────────────────────────────────────────────
    case "match.result_reported": {
      const { stage, round, result, table } = event.data;
      const existing = await getTournamentState(tid);
      if (!existing) return null;

      // result = "reset" with no table means the result was cleared
      if (!table) {
        // Remove the result entry for this stage+round (if any was stored)
        // We don't know the tableNumber here, so just record the event
        return patchTournamentState(tid, {
          lastEventId: event.id,
          lastEventCreated: eventCreatedMs,
        });
      }

      // Check if we already have a newer entry for this table
      const existingEntry = existing.matchResults.find(
        (r) =>
          r.stage === stage &&
          r.round === round &&
          r.tableNumber === table.table
      );
      if (existingEntry && existingEntry.reportedAt > eventCreatedMs) {
        // Our stored result is newer — skip this (stale) event
        return existing;
      }

      // Update the table snapshot in the current tables list
      const updatedTables = existing.tables.map((t) =>
        t.table === table.table ? table : t
      );

      // Build the result feed entry
      const resultEntry: MatchResultEntry = {
        stage,
        round,
        tableNumber: table.table,
        table,
        result,
        reportedAt: eventCreatedMs,
      };

      // Replace any existing entry for this stage+round+table, then prepend
      const filteredResults = existing.matchResults.filter(
        (r) =>
          !(r.stage === stage && r.round === round && r.tableNumber === table.table)
      );

      return patchTournamentState(tid, {
        tables: updatedTables,
        matchResults: [resultEntry, ...filteredResults],
        lastEventId: event.id,
        lastEventCreated: eventCreatedMs,
      });
    }

    // ── round.ended ────────────────────────────────────────────────────────
    case "round.ended": {
      const { stage, round, roundLabel, standings } = event.data;
      const existing = await getTournamentState(tid);

      if (existing && existing.lastEventCreated > eventCreatedMs) {
        return existing;
      }

      // Build a history snapshot from current tables + final standings
      const snapshot: RoundSnapshot = {
        stage,
        round,
        roundLabel: String(roundLabel),
        tables: existing?.tables ?? [],
        standings,
        endedAt: eventCreatedMs,
      };
      const existingHistory = existing?.roundHistory ?? [];
      const roundHistory: RoundSnapshot[] = [
        ...existingHistory.filter(
          (h) => !(h.stage === stage && h.round === round)
        ),
        snapshot,
      ];

      // Only update current round state if this is the current or a newer round
      const isCurrentOrNewer =
        !existing ||
        stage > existing.currentStage ||
        (stage === existing.currentStage && round >= existing.currentRound);

      if (isCurrentOrNewer) {
        return patchTournamentState(tid, {
          name: event.tournament!.name,
          game: event.tournament!.game,
          format: event.tournament!.format,
          currentStage: stage,
          currentRound: round,
          roundLabel: String(roundLabel),
          roundStatus: "ended",
          standings,
          roundHistory,
          lastEventId: event.id,
          lastEventCreated: eventCreatedMs,
        });
      }

      // Past round — only update history without touching current state
      return patchTournamentState(tid, {
        roundHistory,
        lastEventId: event.id,
        lastEventCreated: eventCreatedMs,
      });
    }

    // ── tournament.finished ────────────────────────────────────────────────
    case "tournament.finished": {
      const { endedAt, participantCount, winner, standings } = event.data;
      return patchTournamentState(tid, {
        name: event.tournament!.name,
        game: event.tournament!.game,
        format: event.tournament!.format,
        status: "Complete",
        finished: true,
        finishedAt: endedAt,
        standings,
        winner,
        participantCount,
        roundStatus: "ended",
        lastEventId: event.id,
        lastEventCreated: eventCreatedMs,
      });
    }

    // ── player.registered ─────────────────────────────────────────────────
    case "player.registered": {
      const { player } = event.data;
      const existing = await getTournamentState(tid);
      const players = existing?.players ?? [];

      // Upsert by player ID
      const updatedPlayers = players.some((p) => p.id === player.id)
        ? players.map((p) => (p.id === player.id ? player : p))
        : [...players, player];

      return patchTournamentState(tid, {
        name: event.tournament!.name,
        game: event.tournament!.game,
        format: event.tournament!.format,
        players: updatedPlayers,
        participantCount: updatedPlayers.length,
        lastEventId: event.id,
        lastEventCreated: eventCreatedMs,
      });
    }

    // ── player.dropped ────────────────────────────────────────────────────
    case "player.dropped": {
      const { player, droppedInRound } = event.data;
      const existing = await getTournamentState(tid);
      const dropped = existing?.droppedPlayers ?? [];

      // Deduplicate by player ID
      const alreadyDropped = dropped.some((d) => d.player.id === player.id);
      const updatedDropped = alreadyDropped
        ? dropped
        : [...dropped, { player, droppedInRound }];

      return patchTournamentState(tid, {
        droppedPlayers: updatedDropped,
        lastEventId: event.id,
        lastEventCreated: eventCreatedMs,
      });
    }

    default: {
      // Exhaustive check — TypeScript will error if a new event type is added
      // to the union but not handled above.
      const _exhaustive: never = event;
      void _exhaustive;
      return null;
    }
  }
}
