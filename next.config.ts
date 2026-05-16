import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // CRITICAL: @libsql/client uses native Node.js addons that must be
  // externalized in the standalone server bundle. Without this, the
  // Turso database connection will crash on Render/production.
  serverExternalPackages: [
    '@libsql/client',
    '@prisma/adapter-libsql',
    'better-sqlite3',
    'sharp',
  ],
};

export default nextConfig;
