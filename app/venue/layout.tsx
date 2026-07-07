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
  return <div className="venue-layout-body">{children}</div>;
}
