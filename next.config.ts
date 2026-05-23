import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NOTE: "standalone" output is only needed for Render (Node.js server).
  // Netlify/Vercel use their own runtime and DON'T need standalone mode.
  // We keep it for Render compatibility but Netlify ignores it via @netlify/plugin-nextjs.
  output: "standalone",
  typescript: {
    // Type checking enabled — all implicit any errors have been resolved
  },
  reactStrictMode: true,
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  // CRITICAL: @libsql/client uses native Node.js addons that must be
  // externalized in the standalone server bundle. Without this, the
  // Turso database connection will crash on Render/production.
  serverExternalPackages: [
    '@libsql/client',
    '@prisma/adapter-libsql',
    'better-sqlite3',
    'sharp',
  ],
  // ── API Versioning ──
  // /api/v1/* routes are rewritten to /api/* internally
  // This allows clients to use versioned endpoints while keeping
  // the filesystem structure flat. Old /api/* routes still work
  // for backward compatibility.
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: '/api/:path*',
      },
    ];
  },
};

export default nextConfig;
