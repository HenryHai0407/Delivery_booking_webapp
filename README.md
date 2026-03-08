# Delivery Booking Webapp (MVP)

Next.js App Router delivery booking platform with customer request flow, admin APIs, driver APIs, append-only events, status state machine, and idempotency handling.

## Stack
- Next.js + TypeScript
- Prisma + PostgreSQL
- Auth.js credentials (MVP)
- SendGrid (email hooks ready)
- Signed upload URL endpoint for POD photos

## Local Development
1. Start DB:
   ```bash
   docker compose up -d
   ```
2. Copy env:
   ```bash
   cp .env.example .env
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Generate Prisma client and migrate:
   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```
5. Run app:
   ```bash
   npm run dev
   ```

## API Surface
Public:
- `POST /api/bookings` (idempotent create)
- `GET /api/bookings/{publicId}?token=...`

Admin (requires `x-role: admin`):
- `GET /api/admin/bookings?page=1&pageSize=20`
- `PATCH /api/admin/bookings/{id}`
- `POST /api/admin/bookings/{id}/assign`
- `POST /api/admin/bookings/{id}/status` (idempotent)

Driver (requires `x-role: driver` + `x-user-id`):
- `GET /api/driver/jobs?date=today`
- `POST /api/driver/jobs/{id}/status` (idempotent)

Uploads:
- `POST /api/uploads/presign`

## Production checklist (Vercel free tier)
1. Create Neon Postgres project and copy pooled `DATABASE_URL`.
2. Set all `.env.example` variables in Vercel Project Settings.
3. Run migrations in CI/CD (`npm run prisma:deploy`).
4. Configure SendGrid API key and verified sender.
5. Configure storage provider (R2/Supabase) and replace presign stub.
6. Add Sentry DSN and alerts.

## Security and reliability notes
- Booking lifecycle enforces state machine transitions.
- Mutation endpoints write append-only `BookingEvent` records.
- Idempotency via `IdempotencyKey` table for booking create and status updates.
- Correlation ID propagated by header (`x-correlation-id`).
- PII minimization in logs (`pickupText`, `dropoffText` redacted).
