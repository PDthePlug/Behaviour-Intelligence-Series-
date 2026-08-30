import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BIS Outcomes Cloud | Applied Commerce®",
  description: "Behaviour Intelligence Series™ learner and institutional platform for privacy-preserving behavioural evidence, descriptive programme outcomes and cohort reporting.",
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
