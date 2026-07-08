# UNILAG Market Place — Worklog

---
Task ID: restore-working-lineage
Agent: main
Task: Restore main to last known working commit (8599393) — fix persistent 502/URL_INVALID on Render

Work Log:
- User reported https://www.unilagmarketplace.online/ returning 502 on all endpoints (/, /api/health, /api/db-test)
- User identified commit `85993936ca8439948781d1f3218a09c01aaa55e2` as "the last working commit that deployed on render, full time working where everything was actually loading"
- Investigation found this commit was NOT in local repo, reflog, or dangling objects — it was orphaned by a force-push
- Fetched directly from GitHub: `git fetch origin 85993936ca8439948781d1f3218a09c01aaa55e2`
- Discovered 8599393 is on a COMPLETELY DIFFERENT lineage from current main (911b6b5):
  - 357 files differ, 38533 insertions vs 33974 deletions
  - Current main was a re-cloned/re-initialized codebase that lost critical architecture
- Key differences (working 8599393 vs broken main 911b6b5):
  - Server entry: Custom `server.ts` via `tsx` (loads modules from node_modules) vs `next start`
  - DB client: Lazy Proxy that returns null gracefully (never crashes) vs eager init that throws
  - Clerk middleware: `proxy.ts` with conditional bypass when keys invalid/missing vs crash on missing keys
  - serverExternalPackages: [@libsql/client, @prisma/adapter-libsql, better-sqlite3, sharp] vs none
  - Prisma models: 29 vs 16 (working version is far more complete)
  - Branding: Already correct "UNILAG Market Place" with zero "tote-U" references
- Created backup branch `backup/broken-main-911b6b5` (safety net)
- Reset main to 8599393: `git reset --hard 85993936ca8439948781d1f3218a09c01aaa55e2`
- Reinstalled dependencies: `bun install` (778 packages)
- Generated Prisma client: `npx prisma generate`
- Verified production build: `npx next build` → compiled successfully in 24.5s
- Ran `node scripts/copy-standalone-assets.mjs` → standalone assets copied successfully
- Tested custom server locally on port 3099:
  - /api/health → HTTP 200, {"status":"ok","services":{"database":"connected"}}
  - / → HTTP 200, 20KB
  - Socket.io: ENABLED
- About to force-push to origin to trigger Render deploy

Stage Summary:
- Root cause of ALL prior failures: main was on a broken re-cloned lineage that lost the custom server.ts, lazy DB proxy, and conditional Clerk middleware
- The "URL_INVALID" error was a symptom of the broken lineage's eager DB init crashing on private-field corruption — the working lineage's lazy Proxy never crashes
- The "Edge Runtime instrumentation error" was from a file that only existed on the broken lineage
- Fix: restore main to 8599393 (the last working commit) and force-push
- Backup of broken main preserved at `backup/broken-main-911b6b5` branch
- Render build command: `npm install && npx prisma generate && npm run build`
- Render start command: `npm run start` (→ `NODE_ENV=production tsx server.ts`)

Unresolved Issues / Risks:
- `tsx` is in devDependencies — Render sets NODE_ENV=production, which could make `npm install` skip devDeps. However, user confirmed this commit worked before, so Render's install behavior must include devDeps (or tsx resolves via npx). Will monitor deploy log.
- The `skills/` directory in the sandbox causes a local type-check error but is NOT tracked in git (won't exist on Render) — no action needed
- Render free tier hibernates after 15 min inactivity — consider UptimeRobot keep-alive pings to /api/health
- After deploy succeeds, need to verify Clerk auth + Turso DB work end-to-end on the live site
