"use client";

import { useTournamentLive } from "@/hooks/useTournamentLive";
import { FeatureMatch } from "@/components/overlays/FeatureMatch";

interface Props {
  params: { tid: string; table: string };
}

/**
 * /overlay/[tid]/feature/[table]
 *
 * Feature match overlay addressed by table number in the URL path.
 * Preferred over the query-param version (/feature?table=N) for OBS
 * scene collections where clean URLs matter.
 *
 * Examples:
 *   /overlay/tid_001/feature/1   → feature table 1
 *   /overlay/tid_001/feature/5   → feature table 5
 *
 * If the table number is not found in the current pairings, falls back
 * to auto-selection (Active → Pending → first).
 *
 * Recommended OBS source: 1920×300 or 1920×1080
 * Custom CSS: body { background: transparent; }
 */
export default function FeatureMatchDynamicPage({ params }: Props) {
  const { tid, table } = params;
  const { state } = useTournamentLive(tid);

  const tableNumber = parseInt(table, 10) || undefined;

  return <FeatureMatch state={state} tableNumber={tableNumber} />;
}
