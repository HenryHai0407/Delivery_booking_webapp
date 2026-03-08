import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { updateStatusSchema } from "@/lib/schemas";
import { assertTransition } from "@/lib/state-machine";
import { withIdempotency } from "@/lib/idempotency";
import { correlationId } from "@/lib/logging";
import { notifyBooking } from "@/lib/notifications";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cid = correlationId(req.headers);
  try {
    const { id } = await params;
    const { userId: actorUserId } = await requireRole("driver");
    const body = updateStatusSchema.parse(await req.json());

    const result = await withIdempotency(body.idempotencyKey, `driver_status_${id}`, async () => {
      const booking = await prisma.booking.findUniqueOrThrow({ where: { id } });
      assertTransition(booking.status as never, body.status as never);
      if (body.status === "completed") {
        const pod = await prisma.pod.findUnique({
          where: { bookingId: id },
          select: { id: true, photos: { select: { id: true }, take: 1 } }
        });
        if (!pod || pod.photos.length === 0) {
          throw new Error("Upload POD photo first before setting status to completed.");
        }
      }
      const updated = await prisma.booking.update({ where: { id }, data: { status: body.status } });
      await prisma.bookingEvent.create({
        data: {
          bookingId: id,
          actorUserId,
          eventType: "status_change",
          payloadJson: JSON.stringify({ from: booking.status, to: body.status, source: "driver" })
        }
      });
      if (body.status === "completed") {
        await notifyBooking({
          kind: "booking_completed",
          bookingId: booking.id,
          publicId: booking.publicId,
          token: booking.customerToken,
          contactEmail: booking.contactEmail,
          actorUserId,
          correlationId: cid,
          baseUrl: req.nextUrl.origin
        });
      }
      return updated;
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
