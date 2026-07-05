import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TopDeck Live",
  description: "Live tournament coverage for cEDH events",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
