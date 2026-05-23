# UNILAG Marketplace

**Buy, sell & run errands on campus — University of Lagos**

A full-stack campus marketplace built with Next.js 16, featuring real-time delivery tracking, escrow payments, and an inDrive-style negotiation system.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router, standalone output) |
| **Auth** | Clerk |
| **Database** | Turso (libSQL) via Prisma ORM |
| **Real-time** | Socket.io + Upstash Redis (GEO) |
| **Payments** | Flutterwave (locked/sandbox/live modes) |
| **Image Storage** | Uploadthing (cloud) with base64 fallback |
| **Push Notifications** | Web Push (VAPID) |
| **Validation** | Zod v4 |
| **UI** | Tailwind CSS 4, shadcn/ui, Radix UI |
| **Deployment** | Render (Node.js) |

## Features

- **Marketplace** — Buy & sell items, search, categories, boosts
- **Stores** — Vendor profiles with dedicated shop pages
- **Real-time Chat** — Socket.io powered messaging between buyers and sellers
- **Delivery System** — InDrive-style delivery with 9-state lifecycle:
  `created → searching → runner_assigned → runner_en_route → picked_up → in_transit → delivered → completed`
- **Escrow Payments** — Flutterwave integration with 12% platform commission
- **Runner Dashboard** — GPS tracking, earnings, wallet, payout requests
- **Admin Panel** — User management, reports, delivery oversight, payout approvals
- **PWA** — Installable, offline-capable with push notifications
- **Security** — HMAC Socket.io auth, CSRF protection, rate limiting, Zod validation, XSS sanitization

## Quick Start

### Prerequisites

- Node.js 18+
- A Turso database ([turso.tech](https://turso.tech))
- A Clerk account ([clerk.com](https://clerk.com))

### Setup

```bash
# Clone the repo
git clone https://github.com/Heisdawrld/UNILAG-MARKETPLACE.git
cd UNILAG-MARKETPLACE

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Copy environment variables
cp .env.example .env
# Fill in your .env values (see Configuration below)

# Run development server
npm run dev
```

The app will be available at `http://localhost:3000`.

### Seeding (Development Only)

```bash
# Set SEED_SECRET_KEY in .env, then:
curl -X POST http://localhost:3000/api/seed \
  -H "x-seed-key: YOUR_SEED_SECRET_KEY"
```

## Configuration

All configuration is via environment variables. Copy `.env.example` to `.env` and fill in the values.

### Required (Production)

| Variable | Description |
|----------|-------------|
| `TURSO_DATABASE_URL` | Turso database URL (`libsql://...`) |
| `TURSO_AUTH_TOKEN` | Turso auth token |
| `DATABASE_URL` | Same as `TURSO_DATABASE_URL` in prod, or `file:./dev.db` for local |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key |

### Optional (Features degrade gracefully if not set)

| Variable | Description | Fallback |
|----------|-------------|----------|
| `UPSTASH_REDIS_REST_URL` | Redis for real-time + rate limiting | Real-time features disabled |
| `UPSTASH_REDIS_REST_TOKEN` | Redis auth token | — |
| `SOCKET_TOKEN_SECRET` | HMAC secret for Socket.io tokens | Auto-generated on Render |
| `UPLOADTHING_TOKEN` | Cloud image storage | Base64 compression |
| `FLUTTERWAVE_SECRET_KEY` | Payment processing | Locked mode (mock) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Push notifications | Push disabled |
| `VAPID_PRIVATE_KEY` | Push notifications | Push disabled |
| `ADMIN_EMAILS` | Auto-promote these emails to admin | No admin access |
| `ADMIN_USERNAMES` | Auto-promote these usernames to admin | No admin access |

### Payment Modes

| `FLUTTERWAVE_MODE` | Behavior |
|---------------------|----------|
| `locked` | All payments return mock responses (default, safe) |
| `sandbox` | Flutterwave test mode, no real money |
| `live` | Real money — only use with official account |

## Deployment (Render)

### One-Click Deploy

The included `render.yaml` contains the full service definition:

1. Push to GitHub
2. Create a new Render account or log in
3. Create a new **Web Service** and connect your GitHub repo
4. Render will detect `render.yaml` automatically
5. Set the required secret environment variables in the Render dashboard
6. Render auto-generates `SOCKET_TOKEN_SECRET`, `SEED_SECRET_KEY`, and `CRON_SECRET`

### Manual Deploy

```bash
# Build command (set in Render)
npm install && npx prisma generate && npm run build

# Start command
npm run start
```

### Database Migrations

On first deployment, run:

```bash
npx prisma db push
```

This creates all tables in your Turso database.

## Project Structure

```
├── prisma/
│   ├── schema.prisma          # Database schema
│   ├── seed.ts                # Seed data
│   └── migrations/            # Migration files
├── public/                    # Static assets, PWA icons
├── scripts/
│   ├── copy-standalone-assets.mjs  # Post-build asset copy
│   ├── migrate-turso.mjs           # Turso migration helper
│   └── start-server.mjs            # Standalone server start
├── server.ts                  # Custom Node.js server (Socket.io)
├── src/
│   ├── proxy.ts               # Next.js 16 middleware (auth, CSRF, security headers)
│   ├── middleware.ts           # Re-export from proxy.ts
│   ├── app/
│   │   ├── layout.tsx         # Root layout (Clerk, ThemeProvider)
│   │   ├── page.tsx           # Home page
│   │   ├── admin/             # Admin dashboard
│   │   ├── delivery/          # Customer delivery pages
│   │   ├── runner/            # Runner dashboard
│   │   ├── payment-locked/    # Payment disabled page
│   │   ├── sign-in/           # Clerk sign-in
│   │   ├── sign-up/           # Clerk sign-up
│   │   ├── api/               # API routes (58 endpoints)
│   │   ├── error.tsx          # Error boundary
│   │   └── global-error.tsx   # Global error boundary
│   ├── components/
│   │   ├── delivery/          # Delivery UI components
│   │   ├── marketplace/       # Marketplace UI components
│   │   ├── tasks/             # Task/runner components
│   │   ├── map/               # Campus map component
│   │   ├── ui/                # shadcn/ui components
│   │   └── PWAInstallPrompt.tsx
│   ├── hooks/                 # Custom React hooks
│   ├── lib/
│   │   ├── auth.ts            # Auth helpers (getCurrentUser, requireAuth)
│   │   ├── auth-guard.ts      # Centralized auth guards
│   │   ├── admin-auth.ts      # Admin authorization
│   │   ├── db.ts              # Prisma client (graceful degradation)
│   │   ├── redis.ts           # Upstash Redis client
│   │   ├── redis-location.ts  # Runner GEO location helpers
│   │   ├── socket-server.ts   # Socket.io server (events, auth)
│   │   ├── socket-auth.ts     # HMAC token auth for Socket.io
│   │   ├── escrow.ts          # Delivery escrow payment flow
│   │   ├── flutterwave.ts     # Payment gateway integration
│   │   ├── validation.ts      # Zod schemas for all API inputs
│   │   ├── sanitize.ts        # XSS/input sanitization
│   │   ├── rate-limit.ts      # Rate limiting (Redis + in-memory fallback)
│   │   ├── image-service.ts   # Image upload (Uploadthing + base64)
│   │   ├── image-processing.ts # Sharp-based image compression
│   │   ├── uploadthing.ts     # File router for Uploadthing
│   │   ├── push.ts            # Push notification sender
│   │   ├── runner-dispatch.ts # Campus boundary, trip estimation
│   │   ├── runner-pricing.ts  # Dynamic pricing guide
│   │   └── env-check.ts       # Startup environment validation
│   ├── store/                 # Zustand stores
│   └── types/                 # TypeScript type definitions
├── render.yaml                # Render deployment config
├── next.config.ts             # Next.js configuration
├── package.json
└── vitest.config.ts           # Test configuration
```

## API Endpoints

### Auth
- `GET /api/auth/me` — Current user profile
- `GET /api/auth/socket-token` — Generate Socket.io auth token
- `POST /api/auth/register` — Register new user
- `POST /api/auth/clerk-sync` — Clerk webhook (Svix verified)

### Marketplace
- `GET /api/listings` — Search/filter listings (public)
- `POST /api/listings` — Create listing (auth required)
- `GET /api/stores` — List stores
- `POST /api/reviews` — Create review
- `GET /api/saved` — User's saved listings

### Delivery
- `GET /api/deliveries` — List user's deliveries
- `POST /api/deliveries` — Create delivery order
- `GET /api/deliveries/[id]` — Delivery details
- `GET /api/deliveries/[id]/track` — Real-time tracking data
- `POST /api/deliveries/[id]/pay` — Pay for delivery (escrow)

### Runner
- `GET /api/runner/deliveries` — Runner's delivery history
- `GET /api/runner/earnings` — Earnings summary
- `GET /api/runner/wallet` — Wallet balance
- `POST /api/runner/payout` — Request payout

### Payments
- `POST /api/payments/initialize` — Initialize Flutterwave payment
- `GET /api/payments/verify` — Verify payment (redirect)
- `POST /api/payments/webhook` — Flutterwave webhook (HMAC verified)
- `GET /api/payments/banks` — List Nigerian banks

### Admin
- `GET /api/admin/stats` — Platform statistics
- `GET /api/admin/deliveries` — All deliveries
- `GET /api/admin/payouts` — Payout requests
- `PATCH /api/admin/payouts/[id]` — Approve/reject payout

## Security

- **Socket.io Auth** — HMAC-signed tokens (5-min expiry), legacy userId deprecated
- **CSRF Protection** — Origin/Referer + X-Requested-With double-check
- **Rate Limiting** — Per-endpoint limits (Redis-backed, in-memory fallback)
- **Input Validation** — Zod schemas on all API request bodies
- **XSS Prevention** — HTML stripping, sanitization utilities
- **Webhook Verification** — Timing-safe HMAC for Flutterwave, Svix for Clerk
- **SQL Injection** — Prisma parameterized queries
- **Security Headers** — X-Content-Type-Options, X-Frame-Options, CSP, Referrer-Policy

## License

Private — University of Lagos
