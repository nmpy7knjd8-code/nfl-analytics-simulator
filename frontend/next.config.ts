import type { NextConfig } from "next";

const apiOrigin = process.env.NFL_SIM_API_ORIGIN ?? "http://127.0.0.1:8000";
const isStaticExport = process.env.NFL_SIM_STATIC_EXPORT === "1";
/** GitHub Pages project site: the app is served at the site root (/<repo>/). Old /demo/ links redirect (scripts/write-redirects.mjs). */
const pagesBasePath = "/nfl-analytics-simulator";

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_BASE_PATH: isStaticExport ? pagesBasePath : "" },
  ...(isStaticExport
    ? {
        output: "export" as const,
        basePath: pagesBasePath,
        assetPrefix: pagesBasePath,
        images: { unoptimized: true },
        trailingSlash: true,
      }
    : {
        async rewrites() {
          return [
            {
              source: "/api/:path*",
              destination: `${apiOrigin}/:path*`,
            },
          ];
        },
      }),
};

export default nextConfig;
