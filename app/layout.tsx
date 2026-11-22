import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { CreatorCredit } from "@/components/creator-credit";
import { AppNavigation } from "@/components/app-navigation";

export const metadata: Metadata = {
  title: "SiteLedger AI",
  description:
    "Human-confirmed daily site records, costed against a Bill of Quantities.",
  authors: [{ name: "Kamarudeen Balogun", url: "https://github.com/Kamarudeen-Balogun" }],
  creator: "Kamarudeen Balogun",
  publisher: "CodeFlowX",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-NG" className="h-full antialiased">
      <body className="min-h-full"><AppNavigation>{children}<CreatorCredit /></AppNavigation></body>
    </html>
  );
}
