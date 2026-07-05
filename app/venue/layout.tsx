import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TopDeck Live – Venue Display",
};

/**
 * Venue layout — solid dark background, no scrolling.
 * Designed for projectors and large screens at the tournament venue.
 *
 * Imports globals.css so overlay CSS classes are available.
 * Unlike the overlay layout, the background is NOT transparent.
 */
export default function VenueLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <style>{`
          html, body {
            margin: 0;
            padding: 0;
            overflow: hidden;
            background: #0f0f14;
          }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
