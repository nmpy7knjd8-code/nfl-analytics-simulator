import type { NextConfig } from "next";

const apiOrigin = process.env.NFL_SIM_API_ORIGIN ?? "http://127.0.0.1:8000";
const isStaticExport = process.env.NFL_SIM_STATIC_EXPORT === "1";
/** GitHub Pages project site: /<repo>/demo/ → files under docs/demo/ */
const pagesBasePath = "/nfl-analytics-simulator/demo";

const nextConfig: NextConfig = {
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
