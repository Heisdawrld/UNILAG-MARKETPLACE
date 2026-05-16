import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NOTE: "standalone" output is only needed for Render (Node.js server).
  // Netlify/Vercel use their own runtime and DON'T need standalone mode.
  // We keep it for Render compatibility but Netlify ignores it via @netlify/plugin-nextjs.
  output: "standalone",
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
