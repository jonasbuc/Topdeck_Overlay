import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TopDeck Live",
    short_name: "TopDeck",
    description: "Live cEDH tournament companion for players and organizers.",
    start_url: "/tournaments",
    scope: "/",
    display: "standalone",
    background_color: "#0f1117",
    theme_color: "#111827",
    icons: [
      {
        src: "/topdeck-live-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/topdeck-live-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
