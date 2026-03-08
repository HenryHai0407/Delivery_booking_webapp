# Delivery Booking Webapp (MVP)

Next.js App Router delivery booking platform with customer request flow, admin APIs, driver APIs, append-only events, status state machine, and idempotency handling.

## Stack
- Next.js + TypeScript
- Prisma + PostgreSQL
- Auth.js credentials (MVP)
- SendGrid (booking received/confirmed/completed notifications)
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
- `POST /api/bookings` (idempotent create, requires `contactEmail`)
- `GET /api/bookings/{publicId}?token=...`

Admin (requires authenticated `admin` session):
- `GET /api/admin/bookings?page=1&pageSize=20&status=&publicId=&dateFrom=&dateTo=`
- `GET /api/admin/stats`
- `PATCH /api/admin/bookings/{id}`
- `POST /api/admin/bookings/{id}/assign`
- `POST /api/admin/bookings/{id}/status` (idempotent)
- `GET /api/admin/bookings/{id}/events?limit=30`

Driver (requires authenticated `driver` session):
- `GET /api/driver/jobs?date=today`
- `POST /api/driver/jobs/{id}/status` (idempotent)
- `POST /api/driver/jobs/{id}/pod` (persist POD metadata + audit event)

Uploads:
- `POST /api/uploads/presign`

Health:
- `GET /api/health` (returns `200` when DB + required env checks pass, else `503`)

## Production checklist (Vercel free tier)
1. Create Neon Postgres project and copy pooled `DATABASE_URL`.
2. Set all `.env.example` variables in Vercel Project Settings.
3. Run migrations in CI/CD (`npm run prisma:deploy`).
4. Configure SendGrid API key and verified sender.
5. Configure storage provider (R2/Supabase) and replace presign stub.
6. Add Sentry DSN and alerts.
7. Run deployment guard before release:
   ```bash
   npm run deploy:check
   ```

## Security and reliability notes
- Booking lifecycle enforces state machine transitions.
- Mutation endpoints write append-only `BookingEvent` records.
- Notification attempts are also audited in `BookingEvent` with `message_sent`.
- Idempotency via `IdempotencyKey` table for booking create and status updates.
- Correlation ID propagated by header (`x-correlation-id`).
- PII minimization in logs (`pickupText`, `dropoffText`, `contactEmail` redacted).
- Staff identity is enforced via Auth.js session role (`admin` / `driver`), not request headers.
- Booking/scheduling datetimes are validated as timezone-aware ISO strings (`...Z` / offset), and end time must be after start time.
- Notification delivery failures are non-blocking for booking/status updates and are logged/audited via `message_sent` events.
- POD metadata persistence is retry-safe for duplicate uploads with same `objectKey` (deduplicated response).

## Staff authentication setup (MVP)
- Visit `/login` and sign in with a `User` record from DB.
- Credentials provider currently validates `email` + exact `passwordHash` value for MVP.
- Seed users manually, example:
  ```sql
  INSERT INTO "User" ("id","email","passwordHash","role")
  VALUES
    ('admin_seed_1','admin@example.com','admin123','admin'),
    ('driver_seed_1','driver@example.com','driver123','driver');
  ```

## Storage provider setup
- `STORAGE_PROVIDER` supports `r2` or `supabase`.
- For `r2` configure:
  - `STORAGE_BUCKET`
  - `R2_ENDPOINT` (for example `https://<accountid>.r2.cloudflarestorage.com`)
  - `R2_ACCESS_KEY_ID`
  - `R2_SECRET_ACCESS_KEY`
  - `R2_REGION` (default `auto`)
- For `supabase` configure:
  - `STORAGE_BUCKET`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Driver POD flow now uploads file bytes to the signed URL, then stores `objectKey` + `storageUrl` in DB and appends a `pod_uploaded` event.

## Route preview map
- Booking form route panel supports:
  - Google Maps + traffic-aware ETA when `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set.
  - OpenStreetMap/OSRM fallback when Google key is not configured.
- To enable Google route + traffic status:
  - Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in `.env`.
  - Restrict API key by HTTP referrer in Google Cloud Console.
  - Enable Maps JavaScript API + Directions API.

## Deployment hardening
- `npm run check:env`: validates runtime env config (strictness controlled by `DEPLOYMENT_STRICT_ENV`).
- `npm run deploy:check`: runs env validation + Prisma deploy + production build.
- Set `DEPLOYMENT_STRICT_ENV=true` in CI/production to enforce integration env requirements.
