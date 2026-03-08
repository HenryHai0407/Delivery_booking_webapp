import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { assertTransition } from "@/lib/state-machine";
import { updateStatusSchema } from "@/lib/schemas";
import { withIdempotency } from "@/lib/idempotency";
import { correlationId } from "@/lib/logging";
import { notifyBooking } from "@/lib/notifications";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const cid = correlationId(req.headers);
  try {
    const { userId: actorUserId } = await requireRole("admin");
    const body = updateStatusSchema.parse(await req.json());

    const result = await withIdempotency(body.idempotencyKey, `admin_status_${params.id}`, async () => {
      const booking = await prisma.booking.findUniqueOrThrow({ where: { id: params.id } });
      assertTransition(booking.status as never, body.status as never);

      const updated = await prisma.booking.update({ where: { id: params.id }, data: { status: body.status } });
      await prisma.bookingEvent.create({
        data: {
          bookingId: params.id,
          actorUserId,
          eventType: "status_change",
          payloadJson: JSON.stringify({ from: booking.status, to: body.status, note: body.note })
        }
      });
      if (body.status === "confirmed" || body.status === "completed") {
        await notifyBooking({
          kind: body.status === "confirmed" ? "booking_confirmed" : "booking_completed",
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
