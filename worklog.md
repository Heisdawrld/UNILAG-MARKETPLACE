# UNILAG Market Place — Worklog

> Single source of truth for project state. Updated as work progresses.
> Last reset: 2026-07-08 (cleared broken-lineage debugging noise).

---

## Project Status: LIVE & DEPLOYED

**Live URL:** https://www.unilagmarketplace.online/
**Repo:** https://github.com/Heisdawrld/UNILAG-MARKETPLACE
**Current commit (main):** `0c6bd76` — fix: move build-essential packages to dependencies for Render
**Remote main:** `0c6bd76` (in sync with local)

### Deployed & Verified Working (2026-07-08)
- `/api/health` → **200** `{"status":"ok","database":"connected","turso":"configured","clerk":"configured"}`
- `/` → **200** full page renders, Clerk live key (`pk_live_...unilagmarketplace.online`) loads, branding correct ("UNILAG Marketplace")
- Render build: `npm install && npx prisma generate && npm run build` ✅
- Render start: `npm run start` (→ `NODE_ENV=production tsx server.ts`) ✅

---

## Architecture (Current Truth)

### Stack
- **Framework:** Next.js 16.2.6 (App Router, Turbopack, `output: "standalone"`)
- **Language:** TypeScript 5.9.3
- **Styling:** Tailwind CSS 4 + shadcn/ui (New York)
- **Database:** Turso (LibSQL) via `@prisma/adapter-libsql` 6.11.1; local SQLite fallback in dev
- **Auth:** Clerk (`@clerk/nextjs` 7.3.5) — conditional middleware bypasses cleanly when keys missing
- **Server:** Custom `server.ts` (via `tsx`) — NOT `next start`. Loads modules fresh from node_modules.
- **Realtime:** Socket.io (initialized inside `server.ts`)
- **Payments:** Flutterwave (mode: `locked` — not yet active)
- **Push:** Web Push (VAPID) — configured
- **Maps:** Leaflet (campus map for deliveries)

### Key Files
- `server.ts` — custom Node.js entry; boots Next.js + Socket.io + graceful shutdown
- `src/proxy.ts` — Next.js 16 middleware (Clerk + CSRF + security headers + API versioning)
- `src/lib/db.ts` — **lazy Prisma Proxy**; returns `null` gracefully if DB unconfigured (never crashes the process — this is why the site stays up even if Turso has issues)
- `scripts/copy-standalone-assets.mjs` — finds `server.js` in standalone output (handles workspace nesting) and copies `.next/static` + `public/`
- `prisma/schema.prisma` — 29 models
- `render.yaml` — single web service, free tier, health check at `/api/health`

### Build-essential packages in `dependencies` (NOT devDependencies)
These MUST stay in `dependencies` because Render's `npm install` skips devDeps when `NODE_ENV=production`:
- `tsx` (start command runs `tsx server.ts`)
- `@tailwindcss/postcss`, `tailwindcss`, `tw-animate-css` (CSS processing at build time)
- `typescript` (kept in deps; `ignoreBuildErrors: true` anyway)

`next.config.ts` has `typescript.ignoreBuildErrors: true` + `eslint.ignoreDuringBuilds: true` so missing `@types/*` (which stay in devDeps) don't break the build.

---

## Render Dashboard Settings (LOCKED IN — do not change)

- **Build Command:** `npm install && npx prisma generate && npm run build`
- **Start Command:** `npm run start`
- **Plan:** free (hibernates after 15 min inactivity — consider UptimeRobot pinging `/api/health`)
- **Health Check:** `/api/health`

### Environment Variables (set in Render dashboard)
- `TURSO_DATABASE_URL` — `libsql://...turso.io` ✅ configured
- `TURSO_AUTH_TOKEN` — ✅ configured
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — `pk_live_...` ✅ configured
- `CLERK_SECRET_KEY` — `sk_live_...` ✅ configured
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` — push notifications
- `FLUTTERWAVE_MODE` — `locked` (payments disabled until official account ready)
- `NODE_ENV` — `production`
- `PORT` — `3000`

---

## Known Issues / Next Priorities

### 1. `/api/listings` returns 500 "Failed to fetch listings" (HIGH PRIORITY)
- **Likely cause:** Turso database has no tables. The working commit's start command (`npm run start`) does NOT run a schema-sync step (unlike the broken lineage which had `sync-turso-schema.mjs`). Turso needs its schema pushed once.
- **Fix options:**
  - (a) Run `npx prisma db push` against Turso locally with the Turso URL/token, OR
  - (b) Add a one-time schema-sync script to the Render start command, OR
  - (c) Use `prisma migrate diff` to generate `schema.sql` and execute it against Turso
- **Verify after fix:** `curl https://www.unilagmarketplace.online/api/listings?sort=newest&limit=8` should return JSON array

### 2. UptimeRobot keep-alive (MEDIUM)
- Render free tier hibernates after 15 min inactivity → cold starts (~30s) for first visitor
- Set up UptimeRobot to ping `https://www.unilagmarketplace.online/api/health` every 5-10 min

### 3. Flutterwave payments activation (LATER — business decision)
- Currently `locked` mode. Needs official UNILAG Marketplace Flutterwave account + keys to go live.

---

## Git State

### Branches
- `main` — `0c6bd76` (LIVE, deployed) ← active
- `backup/broken-main-911b6b5` — safety backup of the old broken lineage (can delete after confirming stable)
- `fix/lazy-db-init`, `fix/standalone-conflict` — stale branches from broken-lineage debugging (can delete)
- `pr-1` — fetched PR #1 ref (older feature work; review before merging)

### Safety nets
- Broken lineage preserved at `backup/broken-main-911b6b5` if we ever need to reference it
- The working commit `85993936ca8439948781d1f3218a09c01aaa55e2` is now in main's history (no longer orphaned)

---

## Standing Rules for All Agents

1. **Never** reintroduce `src/instrumentation.ts` — it crashes Edge Runtime in Next.js 16.
2. **Never** change the start command away from `npm run start` — the custom `server.ts` is load-bearing (Socket.io, lazy DB, graceful shutdown).
3. **Never** move `tsx`, `@tailwindcss/postcss`, `tailwindcss`, `tw-animate-css`, or `typescript` back to devDependencies — Render's prod install skips devDeps.
4. Keep `typescript.ignoreBuildErrors` + `eslint.ignoreDuringBuilds` true in `next.config.ts` unless all `@types/*` are moved to deps.
5. The DB client (`src/lib/db.ts`) is a lazy Proxy by design — it returns `null` gracefully. Don't "fix" it to throw; that's what caused the 502 cascade on the broken lineage.
6. Before pushing, always verify with: `NODE_ENV=production npm install --omit=dev && npx prisma generate && npx next build` locally.

---

## Handover — Next Phase Goals

The site is deployed and healthy. Next phase = **growth & polish**:
1. **Fix the listings 500** (Turso schema sync) — see Known Issues #1
2. **Verify all core flows end-to-end** on the live site via agent-browser (browse, search, auth, listings detail)
3. **Improve styling details** (per project rules — more polish, more features)
4. **Add functionality** — user-driven priorities

When continuing work, read this file FIRST, then assess current state with agent-browser before making changes.
