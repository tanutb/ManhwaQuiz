import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Manhwa Quiz",
  description: "Guess the manhwa from its cover — multiplayer",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased font-sans bg-[var(--bg)] text-[var(--text)] min-h-screen flex flex-col">
        <div className="flex-1">{children}</div>
        <footer className="text-center py-4 text-sm text-[var(--text-muted)]">
          Data from MangaDex
        </footer>
      </body>
    </html>
  );
}
