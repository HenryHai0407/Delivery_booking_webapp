import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export async function GET() {
  try {
    await requireRole("admin");

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const [todayBookings, pendingConfirmations, inProgress, completedToday] = await Promise.all([
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
      })
    ]);

    return NextResponse.json({
      todayBookings,
      pendingConfirmations,
      inProgress,
      completedToday
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 403 });
  }
}
