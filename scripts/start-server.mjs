/**
 * start-server.mjs
 * 
 * Finds and starts the standalone Next.js server.
 * Handles workspace-nested standalone output gracefully.
 */

import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

const projectRoot = process.cwd();
const standaloneDir = join(projectRoot, '.next', 'standalone');

// Find server.js recursively
function findServerJs(dir, depth = 0) {
  if (depth > 5) return null;
  const direct = join(dir, 'server.js');
  if (existsSync(direct)) return direct;
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
        const found = findServerJs(join(dir, entry.name), depth + 1);
        if (found) return found;
      }
    }
  } catch {}
  return null;
}

const serverJs = findServerJs(standaloneDir);

if (!serverJs) {
  console.error('[start] ERROR: server.js not found in .next/standalone/');
  console.error('[start] Make sure to run "npm run build" first.');
  process.exit(1);
}

console.log(`[start] Launching server from: ${serverJs}`);

// Set required environment for Render
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.PORT = process.env.PORT || '10000';
process.env.HOSTNAME = process.env.HOSTNAME || '0.0.0.0';

console.log(`[start] PORT=${process.env.PORT}, HOSTNAME=${process.env.HOSTNAME}`);

// Import and start the server
import(serverJs);
