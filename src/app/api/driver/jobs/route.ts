import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertRole } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    assertRole(req.headers, "driver");
    const driverId = req.headers.get("x-user-id");
    if (!driverId) throw new Error("Missing x-user-id");

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
