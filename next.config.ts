import type { NextConfig } from "next";
import { securityHeadersForEnv } from "./src/lib/security/headers";

const appEnv = (process.env.APP_ENV?.trim().toLowerCase() || "development") as
  | "development"
  | "preview"
  | "production";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    const base = securityHeadersForEnv(appEnv, appEnv !== "development");
    return [
      {
        source: "/:path*",
        headers: Object.entries(base).map(([key, value]) => ({ key, value })),
      },
    ];
  },
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
