import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TopDeck Live – Overlay",
};

export default function OverlayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="overlay-body">{children}</div>;
}
