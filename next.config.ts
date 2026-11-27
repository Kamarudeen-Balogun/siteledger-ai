import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  devIndicators: false,
  serverExternalPackages: ["pdfjs-dist", "xlsx"],
  outputFileTracingIncludes: { "/api/reports/**": ["./public/fonts/*.ttf"], "/api/shared/**": ["./public/fonts/*.ttf"], "/api/telegram/webhook": ["./public/fonts/*.ttf"] },
  async rewrites() { return { beforeFiles: [{ source: "/api/reports/demo/pdf", destination: "/demo/siteledger-demo.pdf" }], afterFiles: [], fallback: [] }; },
  // Short, guessable URLs for the feedback inbox and the feedback form:
  // /admin is the owner's feedback inbox, /feedback is the form. Both
  // keep their server-side access checks at the destination.
  async redirects() { return [
    { source: "/feedback", destination: "/account/feedback", permanent: false },
    { source: "/admin", destination: "/account/feedback?view=admin", permanent: false },
    { source: "/admin/feedback", destination: "/account/feedback?view=admin", permanent: false },
  ]; },
  async headers() {return [{source:"/today",headers:[{key:"X-SiteLedger-Offline-Shell",value:"public"},{key:"Referrer-Policy",value:"no-referrer"}]},
    ...["/account/:path*","/projects/:path*","/reports","/help","/about","/invite","/shared/:path*"].map(source=>({source,headers:[{key:"Cache-Control",value:"private, no-store"},{key:"Referrer-Policy",value:"no-referrer"}]})),
    ...["/api/reports/demo/pdf","/demo/siteledger-demo.pdf"].map(source=>({source,headers:[{key:"Content-Disposition",value:'attachment; filename="SiteLedger-Demo-2026-11-06.pdf"'},{key:"Cache-Control",value:"public, max-age=3600"}]}))];},
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
