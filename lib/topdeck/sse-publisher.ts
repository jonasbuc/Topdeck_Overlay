/**
 * Server-Sent Events publisher.
 *
 * Maintains an in-process subscriber map keyed by `tid`.
 * When the event processor updates tournament state it calls `publish(tid, state)`
 * and every connected browser receives the update immediately.
 *
 * This is a simple single-process implementation that works well for:
 * - Local development
 * - Single-server deployments (e.g. Railway, Fly, a single VPS)
 *
 * For multi-process / serverless deployments you would replace the in-memory
 * map with a pub/sub backend (Redis, Upstash, etc.).
 */

import type { LiveTournamentState } from "@/lib/topdeck/types";

type Subscriber = (state: LiveTournamentState) => void;

// Keyed by tid → set of subscriber callbacks
const subscribers = new Map<string, Set<Subscriber>>();

/**
 * Subscribe to live state updates for a tournament.
 * Returns an `unsubscribe` function that the caller MUST invoke on cleanup.
 */
export function subscribe(tid: string, callback: Subscriber): () => void {
  if (!subscribers.has(tid)) {
    subscribers.set(tid, new Set());
  }
  subscribers.get(tid)!.add(callback);

  return () => {
    subscribers.get(tid)?.delete(callback);
    // Clean up empty sets to avoid memory leaks
    if (subscribers.get(tid)?.size === 0) {
      subscribers.delete(tid);
    }
  };
}

/**
 * Publish a new state to all subscribers of a tournament.
 * Called by the event processor after each successful state mutation.
 */
export function publish(tid: string, state: LiveTournamentState): void {
  const subs = subscribers.get(tid);
  if (!subs || subs.size === 0) return;

  for (const callback of subs) {
    try {
      callback(state);
    } catch {
      // Individual subscriber errors must not break other subscribers
    }
  }
}

/** Returns the number of active subscribers for a tournament (useful for logging). */
export function subscriberCount(tid: string): number {
  return subscribers.get(tid)?.size ?? 0;
}
