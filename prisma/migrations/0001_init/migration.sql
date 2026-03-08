-- Initial MVP schema generated manually for portability
CREATE TYPE "Role" AS ENUM ('admin', 'driver');
CREATE TYPE "BookingStatus" AS ENUM ('requested', 'confirmed', 'scheduled', 'assigned', 'driver_en_route', 'picked_up', 'delivered', 'completed', 'cancelled');
CREATE TYPE "BookingEventType" AS ENUM ('status_change', 'note_added', 'assignment', 'message_sent', 'pod_uploaded');

CREATE TABLE "User" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  "role" "Role" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "Booking" (
  "id" TEXT PRIMARY KEY,
  "publicId" TEXT NOT NULL UNIQUE,
  "customerToken" TEXT NOT NULL,
  "pickupText" TEXT NOT NULL,
  "dropoffText" TEXT NOT NULL,
  "requestedWindowStart" TIMESTAMP(3) NOT NULL,
  "requestedWindowEnd" TIMESTAMP(3) NOT NULL,
  "scheduledWindowStart" TIMESTAMP(3),
  "scheduledWindowEnd" TIMESTAMP(3),
  "status" "BookingStatus" NOT NULL DEFAULT 'requested',
  "quoteAmountCents" INTEGER,
  "finalAmountCents" INTEGER,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "Booking_status_createdAt_idx" ON "Booking"("status", "createdAt" DESC);
CREATE INDEX "Booking_scheduledWindowStart_idx" ON "Booking"("scheduledWindowStart");

CREATE TABLE "BookingItem" (
  "id" TEXT PRIMARY KEY,
  "bookingId" TEXT NOT NULL REFERENCES "Booking"("id") ON DELETE CASCADE,
  "description" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "notes" TEXT
);

CREATE TABLE "Assignment" (
  "id" TEXT PRIMARY KEY,
  "bookingId" TEXT NOT NULL REFERENCES "Booking"("id") ON DELETE CASCADE,
  "driverId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Assignment_bookingId_driverId_key" UNIQUE ("bookingId", "driverId")
);
CREATE INDEX "Assignment_driverId_createdAt_idx" ON "Assignment"("driverId", "createdAt" DESC);

CREATE TABLE "BookingEvent" (
  "id" TEXT PRIMARY KEY,
  "bookingId" TEXT NOT NULL REFERENCES "Booking"("id") ON DELETE CASCADE,
  "actorUserId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "eventType" "BookingEventType" NOT NULL,
  "payloadJson" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "BookingEvent_bookingId_createdAt_idx" ON "BookingEvent"("bookingId", "createdAt" DESC);

CREATE TABLE "Pod" (
  "id" TEXT PRIMARY KEY,
  "bookingId" TEXT NOT NULL UNIQUE REFERENCES "Booking"("id") ON DELETE CASCADE,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "PodPhoto" (
  "id" TEXT PRIMARY KEY,
  "podId" TEXT NOT NULL REFERENCES "Pod"("id") ON DELETE CASCADE,
  "objectKey" TEXT NOT NULL,
  "storageUrl" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "PodPhoto_podId_createdAt_idx" ON "PodPhoto"("podId", "createdAt" DESC);

CREATE TABLE "IdempotencyKey" (
  "key" TEXT PRIMARY KEY,
  "scope" TEXT NOT NULL,
  "responseJson" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "IdempotencyKey_scope_createdAt_idx" ON "IdempotencyKey"("scope", "createdAt" DESC);
