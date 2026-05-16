/**
 * copy-standalone-assets.mjs
 * 
 * Next.js standalone output varies based on workspace detection.
 * On Render, server.js is typically at .next/standalone/server.js
 * But if Turbopack detects a parent workspace, it nests under:
 *   .next/standalone/<workspace>/<project>/server.js
 * 
 * This script finds server.js wherever it is and copies the
 * required static assets and public directory next to it.
 */

import { existsSync, cpSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';

const projectRoot = process.cwd();
const standaloneDir = join(projectRoot, '.next', 'standalone');

// Find server.js - it could be directly in standalone/ or nested
function findServerJs(dir, depth = 0) {
  if (depth > 5) return null;
  
  const direct = join(dir, 'server.js');
  if (existsSync(direct)) return direct;
  
  // Check nested directories (workspace detection)
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
  console.error('[build] ERROR: Could not find server.js in .next/standalone/');
  console.error('[build] The standalone output may not have been generated.');
  process.exit(1);
}

const serverDir = dirname(serverJs);
const standaloneNext = join(serverDir, '.next');
const standalonePublic = join(serverDir, 'public');

console.log(`[build] Found server.js at: ${serverJs}`);
console.log(`[build] Server directory: ${serverDir}`);

// Copy .next/static → standalone/.next/static
const staticSrc = join(projectRoot, '.next', 'static');
if (existsSync(staticSrc)) {
  mkdirSync(join(standaloneNext, 'static'), { recursive: true });
  cpSync(staticSrc, join(standaloneNext, 'static'), { recursive: true });
  console.log('[build] Copied .next/static to standalone');
} else {
  console.warn('[build] WARNING: .next/static not found, skipping');
}

// Copy public → standalone/public
const publicSrc = join(projectRoot, 'public');
if (existsSync(publicSrc)) {
  mkdirSync(standalonePublic, { recursive: true });
  cpSync(publicSrc, standalonePublic, { recursive: true });
  console.log('[build] Copied public/ to standalone');
} else {
  console.warn('[build] WARNING: public/ not found, skipping');
}

console.log('[build] Standalone assets ready!');
