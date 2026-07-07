import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TopDeck Live",
  description: "Live tournament coverage for cEDH events",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "TopDeck Live",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#111827",
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
