import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import "./globals.css";
import "@/components/transplant-public.css";
import "@/components/transplant-desktop.css";
import { AppNavigation } from "@/components/app-navigation";
import { OG_IMAGE, SITE_DESCRIPTION, SITE_KEYWORDS, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "SiteLedger AI — From site voice note to costed record",
    template: "%s",
  },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  authors: [{ name: "Kamarudeen Balogun", url: "https://github.com/Kamarudeen-Balogun" }],
  creator: "Kamarudeen Balogun",
  publisher: "CodeFlowX",
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: "website",
    locale: "en_NG",
    url: SITE_URL,
    siteName: "SiteLedger AI",
    title: "SiteLedger AI — From site voice note to costed record",
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "SiteLedger AI — From site voice note to costed record",
    description: SITE_DESCRIPTION,
    images: [`${SITE_URL}/og-image.png`],
  },
  robots: { index: true, follow: true },
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
