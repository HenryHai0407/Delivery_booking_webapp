import { PrismaClient } from "@prisma/client";

async function seedE2EData() {
  const prisma = new PrismaClient();
  const now = new Date();
  const todayAt = (hour: number, minute = 0) => new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);

  const adminEmail = "admin.e2e@example.com";
  const driverEmail = "driver.e2e@example.com";

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash: "admin123", role: "admin" },
    create: { email: adminEmail, passwordHash: "admin123", role: "admin" }
  });

  const driver = await prisma.user.upsert({
    where: { email: driverEmail },
    update: { passwordHash: "driver123", role: "driver" },
    create: { email: driverEmail, passwordHash: "driver123", role: "driver" }
  });

  const startA = new Date("2030-01-01T10:00:00.000Z");
  const endA = new Date("2030-01-01T12:00:00.000Z");

  await prisma.booking.upsert({
    where: { publicId: "bk_e2e_conflict_a" },
    update: {
      contactEmail: "conflict-a@example.com",
      pickupText: "A Street 1",
      dropoffText: "B Street 2",
      requestedWindowStart: startA,
      requestedWindowEnd: endA,
      scheduledWindowStart: startA,
      scheduledWindowEnd: endA,
      status: "scheduled"
    },
    create: {
      publicId: "bk_e2e_conflict_a",
      customerToken: "tok_e2e_conflict_a",
      contactEmail: "conflict-a@example.com",
      pickupText: "A Street 1",
      dropoffText: "B Street 2",
      requestedWindowStart: startA,
      requestedWindowEnd: endA,
      scheduledWindowStart: startA,
      scheduledWindowEnd: endA,
      status: "scheduled"
    }
  });

  await prisma.booking.upsert({
    where: { publicId: "bk_e2e_conflict_b" },
    update: {
      contactEmail: "conflict-b@example.com",
      pickupText: "C Street 3",
      dropoffText: "D Street 4",
      requestedWindowStart: startA,
      requestedWindowEnd: endA,
      scheduledWindowStart: null,
      scheduledWindowEnd: null,
      status: "confirmed"
    },
    create: {
      publicId: "bk_e2e_conflict_b",
      customerToken: "tok_e2e_conflict_b",
      contactEmail: "conflict-b@example.com",
      pickupText: "C Street 3",
      dropoffText: "D Street 4",
      requestedWindowStart: startA,
      requestedWindowEnd: endA,
      scheduledWindowStart: null,
      scheduledWindowEnd: null,
      status: "confirmed"
    }
  });

  const driverStart = todayAt(11, 0);
  const driverEnd = todayAt(13, 0);
  const driverBooking = await prisma.booking.upsert({
    where: { publicId: "bk_e2e_driver_guard" },
    update: {
      contactEmail: "driver-guard@example.com",
      pickupText: "Pickup Driver 1",
      dropoffText: "Dropoff Driver 2",
      requestedWindowStart: driverStart,
      requestedWindowEnd: driverEnd,
      scheduledWindowStart: driverStart,
      scheduledWindowEnd: driverEnd,
      status: "delivered"
    },
    create: {
      publicId: "bk_e2e_driver_guard",
      customerToken: "tok_e2e_driver_guard",
      contactEmail: "driver-guard@example.com",
      pickupText: "Pickup Driver 1",
      dropoffText: "Dropoff Driver 2",
      requestedWindowStart: driverStart,
      requestedWindowEnd: driverEnd,
      scheduledWindowStart: driverStart,
      scheduledWindowEnd: driverEnd,
      status: "delivered"
    }
  });

  await prisma.assignment.upsert({
    where: { bookingId_driverId: { bookingId: driverBooking.id, driverId: driver.id } },
    update: {},
    create: { bookingId: driverBooking.id, driverId: driver.id }
  });

  try {
    await prisma.$executeRaw`
      INSERT INTO "AppSetting" ("key", "valueJson", "createdAt", "updatedAt")
      VALUES ('schedule_config', ${JSON.stringify({
        slotCapacity: 1,
        workdayStartHour: 8,
        workdayEndHour: 20,
        timezone: "Europe/Helsinki"
      })}, NOW(), NOW())
      ON CONFLICT ("key")
      DO UPDATE SET "valueJson" = ${JSON.stringify({
        slotCapacity: 1,
        workdayStartHour: 8,
        workdayEndHour: 20,
        timezone: "Europe/Helsinki"
      })}, "updatedAt" = NOW()
    `;
  } catch {
    // Table may not exist locally if migration not yet applied; app has fallback behavior.
  }

  await prisma.$disconnect();
}

export default async function globalSetup() {
  await seedE2EData();
}
