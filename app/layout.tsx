import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "SiteLedger AI",
  description:
    "Human-confirmed daily site records, costed in naira against a Bill of Quantities.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-NG" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
