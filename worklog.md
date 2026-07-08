# UNILAG Market Place — Worklog

> Single source of truth for project state. Updated as work progresses.
> Last updated: 2026-07-08 (post Turso schema sync + db-test diagnostic)

---

## Project Status: LIVE & DEPLOYED (with one known issue)

**Live URL:** https://www.unilagmarketplace.online/
**Repo:** https://github.com/Heisdawrld/UNILAG-MARKETPLACE
**Current commit (main):** `0046a6a` — diag: add /api/db-test endpoint
**Remote main:** `0046a6a` (in sync)

### Deployed & Verified Working
- `/api/health` → **200** `{"status":"ok","database":"connected","turso":"configured","clerk":"configured"}`
- `/` → **200** full page renders, Clerk live key loads, branding correct
- Sign-in page renders, Clerk OTP email sends successfully
- Render build: `npm install && npx prisma generate && npm run build` ✅
- Render start: `npm run start` (→ `NODE_ENV=production tsx server.ts`) ✅

### Current Known Issue (ACTIVE — fixing)
- **After Clerk sign-in + OTP code entry, home page shows "Retry Loading"**
- Root cause chain:
  1. The home page (`src/app/page.tsx`) has a 12-second bootstrap timer
  2. After sign-in, it calls `/api/auth/clerk-me` to sync the Clerk user to DB
  3. If that API crashes (DB query fails), the timer fires → "Retry Loading" screen
  4. `/api/listings` also returns 500 "Failed to fetch listings"
- **Turso DB IS populated** — I synced the schema directly (71 tables created, 36 already existed, 0 failed). DB now has 31 tables, 5 users, 19 listings (verified via direct libsql query)
- **The live server's Prisma client still can't query Turso** despite DB being correct
- Added `/api/db-test` diagnostic endpoint (commit `0046a6a`) to capture the exact error — waiting for Render rebuild to test

---

## Environment Variables (SAVED in .env — gitignored, NOT in repo)

All env vars are stored locally in `/home/z/my-project/.env` (gitignored).
The following keys are configured (values redacted here to avoid GitHub secret-scanner blocks):

- `CLERK_SECRET_KEY` — sk_live_... (Clerk live secret key)
- `DATABASE_URL` — file:./build.db (local fallback only)
- `NEXT_PUBLIC_APP_URL` — https://www.unilagmarketplace.online
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` — /
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` — /
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — pk_live_... (Clerk live publishable key)
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL` — /sign-in
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL` — /sign-up
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — BLI... (web push public key)
- `NODE_ENV` — production
- `SEED_SECRET_KEY` — unilag-dev-seed-2026
- `TURSO_AUTH_TOKEN` — eyJ... (Turso JWT auth token)
- `TURSO_DATABASE_URL` — libsql://unilag-marketplace-xgvantage.aws-us-west-2.turso.io
- `VAPID_PRIVATE_KEY` — geCC... (web push private key)

**Render dashboard env vars match** (user confirmed these are set on Render).
To get full secret values, read `/home/z/my-project/.env` directly.

---

## Architecture (Current Truth)

### Stack
- **Framework:** Next.js 16.2.6 (App Router, Turbopack, `output: "standalone"`)
- **Language:** TypeScript 5.9.3
- **Styling:** Tailwind CSS 4 + shadcn/ui (New York)
- **Database:** Turso (LibSQL) `libsql://unilag-marketplace-xgvantage.aws-us-west-2.turso.io` via `@prisma/adapter-libsql` 6.11.1
- **Auth:** Clerk (`@clerk/nextjs` 7.3.5) — live keys, conditional middleware bypass when missing
- **Server:** Custom `server.ts` (via `tsx`) — NOT `next start`. Boots Next.js + Socket.io + Turso schema sync + graceful shutdown
- **Realtime:** Socket.io (initialized inside `server.ts`)
- **Payments:** Flutterwave (mode: `locked` — not yet active)
- **Push:** Web Push (VAPID) — configured with real keys
- **Maps:** Leaflet (campus map for deliveries)

### Key Files
- `server.ts` — custom Node.js entry; boots Next.js + Socket.io + **Turso schema sync** + graceful shutdown
- `src/proxy.ts` — Next.js 16 middleware (Clerk + CSRF + security headers + API versioning)
- `src/lib/db.ts` — **lazy Prisma Proxy**; returns `null` gracefully if DB unconfigured (never crashes the process)
- `scripts/sync-turso-schema.mjs` — reads `prisma/schema.sql`, executes against Turso (idempotent)
- `scripts/copy-standalone-assets.mjs` — copies `.next/static` + `public/` into standalone output
- `prisma/schema.sql` — 763 lines, 107 SQL statements, generates all 31 tables + indexes
- `prisma/schema.prisma` — 29 models
- `src/app/api/db-test/route.ts` — diagnostic endpoint (runs `db.user.count()` + `db.listing.count()`, returns error details)
- `src/app/api/health/route.ts` — health check (no DB query, just env checks)
- `render.yaml` — single web service, free tier, health check at `/api/health`

### Build-essential packages in `dependencies` (NOT devDependencies)
- `tsx` (start command runs `tsx server.ts`)
- `@tailwindcss/postcss`, `tailwindcss`, `tw-animate-css` (CSS processing at build time)
- `typescript` (kept in deps; `ignoreBuildErrors: true` anyway)

`next.config.ts` has `typescript.ignoreBuildErrors: true` + `eslint.ignoreDuringBuilds: true`.

---

## Render Dashboard Settings (LOCKED IN — do not change)

- **Build Command:** `npm install && npx prisma generate && npm run build`
- **Start Command:** `npm run start`
- **Plan:** free (hibernates after 15 min inactivity)
- **Health Check:** `/api/health`

---

## Git History (recent commits, newest first)

- `0046a6a` diag: add /api/db-test to diagnose live Turso connection failure
- `b90d8e0` fix: auto-sync Turso schema on server startup + run sync now
- `53225ef` docs: clean memory reset — worklog reflects current true state only
- `0c6bd76` fix: move build-essential packages to dependencies for Render
- `e76f321` fix: move tsx to dependencies so start command works on Render
- `fa77097` docs: worklog — restore main to working commit 8599393
- `8599393` fix: Clerk SDK crash with placeholder keys — bypass when not configured ← LAST KNOWN WORKING (full app)

### Branches
- `main` — `0046a6a` (LIVE) ← active
- `backup/broken-main-911b6b5` — safety backup of old broken lineage
- `fix/lazy-db-init`, `fix/standalone-conflict`, `pr-1` — stale, can delete

---

## Standing Rules for All Agents

1. **Never** reintroduce `src/instrumentation.ts` — crashes Edge Runtime in Next.js 16.
2. **Never** change the start command away from `npm run start` — custom `server.ts` is load-bearing.
3. **Never** move `tsx`, `@tailwindcss/postcss`, `tailwindcss`, `tw-animate-css`, or `typescript` back to devDependencies.
4. Keep `typescript.ignoreBuildErrors` + `eslint.ignoreDuringBuilds` true in `next.config.ts`.
5. The DB client (`src/lib/db.ts`) is a lazy Proxy by design — returns `null` gracefully. Don't "fix" it to throw.
6. `.env` is gitignored — never commit secrets. They live in `.env` locally and Render dashboard in prod.
7. Before pushing, verify with: `NODE_ENV=production npm install --omit=dev && npx prisma generate && npx next build`.
8. **Always update this worklog** after every change — the user relies on it for memory continuity across sessions.

---

## Handover — Next Phase Goals

### Immediate (in progress)
1. **Fix the Turso query failure on live server** — use `/api/db-test` to capture exact error, then fix
2. **Verify sign-in → home page flow works end-to-end** (no more "Retry Loading")
3. **Verify all core flows** on live site via agent-browser (browse, search, auth, listings detail, messages)

### Growth & Polish (next)
4. Improve styling details (per project rules — more polish)
5. Add functionality — user-driven priorities
6. Set up UptimeRobot keep-alive pings to `/api/health` (Render free tier hibernates)

When continuing work, read this file FIRST, then assess current state with agent-browser before making changes.
