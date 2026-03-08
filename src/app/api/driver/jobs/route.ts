import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export async function GET() {
  try {
    const { userId: driverId } = await requireRole("driver");

    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const jobs = await prisma.assignment.findMany({
      where: {
        driverId,
        booking: {
          scheduledWindowStart: {
            gte: start,
            lt: end
          }
        }
      },
      include: { booking: true }
    });

    return NextResponse.json(jobs);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 403 });
  }
}
