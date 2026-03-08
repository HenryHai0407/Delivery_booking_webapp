import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authErrorStatus, requireRole } from "@/lib/auth";
import { getScheduleConfig } from "@/lib/scheduling";

function parseCustomerEstimate(payloadJson: string): { low: number; high: number } | null {
  try {
    const payload = JSON.parse(payloadJson) as Record<string, unknown>;
    if (payload.kind !== "customer_estimate") return null;
    const low = typeof payload.low === "number" ? payload.low : null;
    const high = typeof payload.high === "number" ? payload.high : null;
    if (low == null || high == null) return null;
    return { low, high };
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    await requireRole("admin");

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const overdueCutoff = new Date(now.getTime() - 30 * 60 * 1000);
    const soonWindowEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    const trendStart = new Date(start);
    trendStart.setDate(trendStart.getDate() - 6);
    const scheduleConfig = await getScheduleConfig();

    const [
      todayBookings,
      pendingConfirmations,
      inProgress,
      completedToday,
      recentFinalized,
      overdueRequests,
      unassignedToday,
      startingSoon,
      missingPodCompleted,
      recentScheduledToday
    ] = await Promise.all([
      prisma.booking.count({
        where: {
          createdAt: { gte: start, lt: end }
        }
      }),
      prisma.booking.count({
        where: { status: "requested" }
      }),
      prisma.booking.count({
        where: {
          status: {
            in: ["confirmed", "scheduled", "assigned", "driver_en_route", "picked_up", "delivered"]
          }
        }
      }),
      prisma.booking.count({
        where: {
          status: "completed",
          updatedAt: { gte: start, lt: end }
        }
      }),
      prisma.booking.findMany({
        where: {
          finalAmountCents: { not: null },
          updatedAt: { gte: trendStart }
        },
        orderBy: { updatedAt: "asc" },
        select: {
          finalAmountCents: true,
          updatedAt: true,
          events: {
            where: { eventType: "note_added" },
            orderBy: { createdAt: "desc" },
            select: { payloadJson: true }
          }
        }
      }),
      prisma.booking.count({
        where: {
          status: "requested",
          createdAt: { lt: overdueCutoff }
        }
      }),
      prisma.booking.count({
        where: {
          scheduledWindowStart: { gte: start, lt: end },
          assignments: { none: {} },
          status: { in: ["confirmed", "scheduled"] }
        }
      }),
      prisma.booking.count({
        where: {
          scheduledWindowStart: { gte: now, lte: soonWindowEnd },
          status: { in: ["confirmed", "scheduled", "assigned"] }
        }
      }),
      prisma.booking.count({
        where: {
          status: { in: ["delivered", "completed"] },
          pod: null
        }
      }),
      prisma.booking.findMany({
        where: {
          scheduledWindowStart: { gte: start, lt: end },
          status: { in: ["confirmed", "scheduled", "assigned", "driver_en_route", "picked_up", "delivered"] }
        },
        include: { assignments: { select: { id: true } } },
        orderBy: { scheduledWindowStart: "asc" }
      })
    ]);

    const days: string[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(trendStart);
      day.setDate(trendStart.getDate() + i);
      days.push(day.toISOString().slice(0, 10));
    }

    const buckets = new Map<string, { samples: number; totalDeltaPct: number; onTarget: number }>();
    for (const day of days) {
      buckets.set(day, { samples: 0, totalDeltaPct: 0, onTarget: 0 });
    }

    for (const booking of recentFinalized) {
      const estimate = booking.events.map((event) => parseCustomerEstimate(event.payloadJson)).find((v) => v != null) || null;
      if (!estimate || booking.finalAmountCents == null) continue;
      const day = booking.updatedAt.toISOString().slice(0, 10);
      const bucket = buckets.get(day);
      if (!bucket) continue;
      const finalEur = booking.finalAmountCents / 100;
      const mid = (estimate.low + estimate.high) / 2;
      if (mid <= 0) continue;
      const deltaPct = Math.round(((finalEur - mid) / mid) * 100);
      bucket.samples += 1;
      bucket.totalDeltaPct += deltaPct;
      if (deltaPct === 0) bucket.onTarget += 1;
    }

    const pricingTrend = days.map((day) => {
      const bucket = buckets.get(day) || { samples: 0, totalDeltaPct: 0, onTarget: 0 };
      const averageDeltaPct = bucket.samples > 0 ? Math.round(bucket.totalDeltaPct / bucket.samples) : 0;
      const onTargetPct = bucket.samples > 0 ? Math.round((bucket.onTarget / bucket.samples) * 100) : 0;
      return { day, samples: bucket.samples, averageDeltaPct, onTargetPct };
    });

    const todayBoardMap = new Map<string, { hour: string; total: number; unassigned: number; startingSoon: number }>();
    for (let hour = scheduleConfig.workdayStartHour; hour < scheduleConfig.workdayEndHour; hour++) {
      const key = `${String(hour).padStart(2, "0")}:00`;
      todayBoardMap.set(key, { hour: key, total: 0, unassigned: 0, startingSoon: 0 });
    }
    for (const booking of recentScheduledToday) {
      if (!booking.scheduledWindowStart) continue;
      const hourKey = `${String(booking.scheduledWindowStart.getHours()).padStart(2, "0")}:00`;
      const row = todayBoardMap.get(hourKey) || { hour: hourKey, total: 0, unassigned: 0, startingSoon: 0 };
      row.total += 1;
      if (booking.assignments.length === 0) row.unassigned += 1;
      const startsInTwoHours = booking.scheduledWindowStart >= now && booking.scheduledWindowStart <= soonWindowEnd;
      if (startsInTwoHours) row.startingSoon += 1;
      todayBoardMap.set(hourKey, row);
    }
    const todayBoard = Array.from(todayBoardMap.values()).sort((a, b) => a.hour.localeCompare(b.hour));

    return NextResponse.json({
      todayBookings,
      pendingConfirmations,
      inProgress,
      completedToday,
      pricingTrend,
      scheduleConfig,
      todayBoard,
      alerts: {
        overdueRequests,
        unassignedToday,
        startingSoon,
        missingPodCompleted
      }
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: authErrorStatus(error, 403) });
  }
}
