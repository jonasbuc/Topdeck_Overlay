"use client";

import { useSearchParams } from "next/navigation";
import { useTournamentLive } from "@/hooks/useTournamentLive";
import { LowerThird } from "@/components/overlays/LowerThird";

interface Props {
  params: { tid: string };
}

/**
 * /overlay/[tid]/lower-third
 *
 * Horizontal standings lower-third strip.
 * Recommended OBS browser source: 1920×120
 * Custom CSS: body { background: transparent; }
 *
 * Query params:
 *   ?entries=<n>  — number of standings entries to show (default 8)
 *   ?title=&subtitle=&sponsor= — custom lower third copy
 */
export default function LowerThirdOverlayPage({ params }: Props) {
  const { tid } = params;
  const { state } = useTournamentLive(tid);
  const searchParams = useSearchParams();

  const maxEntries = Math.max(
    1,
    parseInt(searchParams.get("entries") ?? "8", 10) || 8
  );
  const title = searchParams.get("title");
  const subtitle = searchParams.get("subtitle");
  const sponsorLine = searchParams.get("sponsor");

  return (
    <LowerThird
      standings={state?.standings ?? []}
      maxEntries={maxEntries}
      title={title}
      subtitle={subtitle}
      sponsorLine={sponsorLine}
    />
  );
}
