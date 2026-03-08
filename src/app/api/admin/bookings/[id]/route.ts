import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { updateBookingDetailsSchema } from "@/lib/schemas";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId: actorUserId } = await requireRole("admin");
    const body = updateBookingDetailsSchema.parse(await req.json());
    const booking = await prisma.booking.update({
      where: { id: params.id },
      data: {
        scheduledWindowStart: body.scheduledWindowStart ? new Date(body.scheduledWindowStart) : null,
        scheduledWindowEnd: body.scheduledWindowEnd ? new Date(body.scheduledWindowEnd) : null,
        quoteAmountCents: body.quoteAmountCents,
        finalAmountCents: body.finalAmountCents,
        notes: body.notes ?? null
      }
    });

    await prisma.bookingEvent.create({
      data: {
        bookingId: booking.id,
        eventType: "note_added",
        actorUserId,
        payloadJson: JSON.stringify({ notesUpdated: Boolean(body.notes) })
      }
    });

    return NextResponse.json(booking);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
