import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId: actorUserId } = await requireRole("admin");
    const body = await req.json();
    const assignment = await prisma.assignment.create({
      data: {
        bookingId: params.id,
        driverId: body.driverId
      }
    });

    await prisma.bookingEvent.create({
      data: {
        bookingId: params.id,
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
