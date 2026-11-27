import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import "./globals.css";
import { AppNavigation } from "@/components/app-navigation";

export const metadata: Metadata = {
  title: "SiteLedger AI",
  description:
    "Human-confirmed daily site records, costed against a Bill of Quantities.",
  authors: [{ name: "Kamarudeen Balogun", url: "https://github.com/Kamarudeen-Balogun" }],
  creator: "Kamarudeen Balogun",
  publisher: "CodeFlowX",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };
const initialTheme = "(()=>{let mode;try{mode=localStorage.getItem('siteledger-theme')}catch{}if(mode==='dark'){document.documentElement.dataset.theme='dark'}})()";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-NG" className="h-full antialiased" data-theme="light" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: initialTheme }}/></head>
      <body className="min-h-full"><Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive"/><AppNavigation>{children}</AppNavigation></body>
    </html>
  );
}
