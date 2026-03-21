import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BlockVoice — Your building, fully understood",
  description:
    "BlockVoice gives you transparency on who manages your building, what you're paying for, how well it's being run — and the tools to act when something isn't right.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
