import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertRole } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    assertRole(req.headers, "admin");
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
        actorUserId: req.headers.get("x-user-id") || undefined,
        eventType: "assignment",
        payloadJson: JSON.stringify({ driverId: body.driverId })
      }
    });

    return NextResponse.json(assignment, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
