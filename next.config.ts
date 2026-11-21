import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  outputFileTracingIncludes: { "/api/reports/**": ["./public/fonts/*.ttf"] },
  async headers() {return [{source:"/today",headers:[{key:"X-SiteLedger-Offline-Shell",value:"public"},{key:"Referrer-Policy",value:"no-referrer"}]}];},
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
