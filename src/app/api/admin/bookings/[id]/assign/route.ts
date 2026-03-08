import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { userId: actorUserId } = await requireRole("admin");
    const body = await req.json();
    const assignment = await prisma.assignment.create({
      data: {
        bookingId: id,
        driverId: body.driverId
      }
    });

    await prisma.bookingEvent.create({
      data: {
        bookingId: id,
        actorUserId,
        eventType: "assignment",
        payloadJson: JSON.stringify({ driverId: body.driverId })
      }
    });

    return NextResponse.json(assignment, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
