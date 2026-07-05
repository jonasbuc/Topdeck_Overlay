import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TopDeck Live – Overlay",
};

export default function OverlayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Transparent background for OBS browser source */}
        <style>{`
          html, body {
            background: transparent !important;
            overflow: hidden;
          }
        `}</style>
      </head>
      <body className="overlay-body">{children}</body>
    </html>
  );
}
