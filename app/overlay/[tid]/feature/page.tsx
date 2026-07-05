"use client";

import { useSearchParams } from "next/navigation";
import { useTournamentLive } from "@/hooks/useTournamentLive";
import { FeatureMatch } from "@/components/overlays/FeatureMatch";

interface Props {
  params: { tid: string };
}

/**
 * /overlay/[tid]/feature
 *
 * Query params:
 *   ?table=<n>   — which table to feature (default: auto-select Active/Pending)
 *
 * Recommended OBS source: 1920×300 (lower third) or 1920×1080 (fullscreen)
 * Custom CSS: body { background: transparent; }
 */
export default function FeatureMatchOverlayPage({ params }: Props) {
  const { tid } = params;
  const { state } = useTournamentLive(tid);
  const searchParams = useSearchParams();

  const tableParam = searchParams.get("table");
  const tableNumber = tableParam ? (parseInt(tableParam, 10) || undefined) : undefined;

  return <FeatureMatch state={state} tableNumber={tableNumber} />;
}
