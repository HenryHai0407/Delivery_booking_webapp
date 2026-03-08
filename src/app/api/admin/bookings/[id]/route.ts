import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertRole } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    assertRole(req.headers, "admin");
    const body = await req.json();
    const booking = await prisma.booking.update({
      where: { id: params.id },
      data: {
        scheduledWindowStart: body.scheduledWindowStart ? new Date(body.scheduledWindowStart) : undefined,
        scheduledWindowEnd: body.scheduledWindowEnd ? new Date(body.scheduledWindowEnd) : undefined,
        quoteAmountCents: body.quoteAmountCents,
        finalAmountCents: body.finalAmountCents,
        notes: body.notes
      }
    });

    await prisma.bookingEvent.create({
      data: {
        bookingId: booking.id,
        eventType: "note_added",
        actorUserId: req.headers.get("x-user-id") || undefined,
        payloadJson: JSON.stringify({ notesUpdated: Boolean(body.notes) })
      }
    });

    return NextResponse.json(booking);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
