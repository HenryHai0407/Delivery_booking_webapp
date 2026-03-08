import { prisma } from "@/lib/db";
import type { BookingStatus, Prisma } from "@prisma/client";

export type ScheduleConfig = {
  slotCapacity: number;
  workdayStartHour: number;
  workdayEndHour: number;
  timezone: string;
};

const DEFAULT_CONFIG: ScheduleConfig = {
  slotCapacity: Number(process.env.BOOKING_SLOT_CAPACITY || 3),
  workdayStartHour: Number(process.env.BOOKING_WORKDAY_START_HOUR || 8),
  workdayEndHour: Number(process.env.BOOKING_WORKDAY_END_HOUR || 20),
  timezone: process.env.BOOKING_TIMEZONE || "Europe/Helsinki"
};

function asInt(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : fallback;
}

function asText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export async function getScheduleConfig(): Promise<ScheduleConfig> {
  try {
    const rows = await prisma.$queryRaw<Array<{ valueJson: string }>>`
      SELECT "valueJson"
      FROM "AppSetting"
      WHERE "key" = 'schedule_config'
      LIMIT 1
    `;
    const stored = rows[0];
    if (!stored) return DEFAULT_CONFIG;
    const parsed = JSON.parse(stored.valueJson) as Record<string, unknown>;
    return {
      slotCapacity: Math.max(1, asInt(parsed.slotCapacity, DEFAULT_CONFIG.slotCapacity)),
      workdayStartHour: Math.max(0, Math.min(23, asInt(parsed.workdayStartHour, DEFAULT_CONFIG.workdayStartHour))),
      workdayEndHour: Math.max(1, Math.min(24, asInt(parsed.workdayEndHour, DEFAULT_CONFIG.workdayEndHour))),
      timezone: asText(parsed.timezone, DEFAULT_CONFIG.timezone)
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function isWithinWorkingHours(start: Date, end: Date, config: ScheduleConfig) {
  if (start >= end) return false;
  const startHour = start.getHours() + start.getMinutes() / 60;
  const endHour = end.getHours() + end.getMinutes() / 60;
  return startHour >= config.workdayStartHour && endHour <= config.workdayEndHour;
}

export async function countOverlappingBookings(input: {
  start: Date;
  end: Date;
  excludeBookingId?: string;
}) {
  const where: Prisma.BookingWhereInput = {
    status: { notIn: ["cancelled", "completed"] as BookingStatus[] },
    ...(input.excludeBookingId ? { id: { not: input.excludeBookingId } } : {}),
    OR: [
      {
        AND: [
          { scheduledWindowStart: { not: null, lt: input.end } },
          { scheduledWindowEnd: { not: null, gt: input.start } }
        ]
      },
      {
        AND: [{ scheduledWindowStart: null }, { requestedWindowStart: { lt: input.end } }, { requestedWindowEnd: { gt: input.start } }]
      }
    ]
  };
  return prisma.booking.count({ where });
}
