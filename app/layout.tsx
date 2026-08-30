import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BIS Habit Lab | Applied Commerce®",
  description: "A quiet, private learner experience for investigating habits through story, reflection, evidence and a seven-day experiment.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
