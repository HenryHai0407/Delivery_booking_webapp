import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole("admin");
    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || "30"), 100);

    const events = await prisma.bookingEvent.findMany({
      where: { bookingId: params.id },
      orderBy: { createdAt: "desc" },
      take: Number.isFinite(limit) ? limit : 30,
      select: {
        id: true,
        eventType: true,
        payloadJson: true,
        createdAt: true,
        actorUserId: true
      }
    });

    return NextResponse.json({ data: events });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 403 });
  }
}
