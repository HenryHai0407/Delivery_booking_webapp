import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { updateBookingDetailsSchema } from "@/lib/schemas";
import { countOverlappingBookings, getScheduleConfig, isWithinWorkingHours } from "@/lib/scheduling";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { userId: actorUserId } = await requireRole("admin");
    const body = updateBookingDetailsSchema.parse(await req.json());
    if (body.scheduledWindowStart && body.scheduledWindowEnd) {
      const start = new Date(body.scheduledWindowStart);
      const end = new Date(body.scheduledWindowEnd);
      const config = await getScheduleConfig();
      if (!isWithinWorkingHours(start, end, config)) {
        return NextResponse.json(
          { error: `Scheduled window must be within working hours (${config.workdayStartHour}:00-${config.workdayEndHour}:00).` },
          { status: 400 }
        );
      }
      const overlapCount = await countOverlappingBookings({ start, end, excludeBookingId: id });
      if (overlapCount >= config.slotCapacity) {
        return NextResponse.json(
          { error: `Schedule conflict: ${overlapCount}/${config.slotCapacity} active slots already occupied in that window.` },
          { status: 400 }
        );
      }
    }

    const booking = await prisma.booking.update({
      where: { id },
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
