import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { createBookingSchema } from "@/lib/schemas";
import { withIdempotency } from "@/lib/idempotency";
import { correlationId, safeLog } from "@/lib/logging";
import { notifyBooking } from "@/lib/notifications";

export async function POST(req: NextRequest) {
  const cid = correlationId(req.headers);
  try {
    const contentType = req.headers.get("content-type") || "";
    const body = contentType.includes("application/json")
      ? await req.json()
      : Object.fromEntries((await req.formData()).entries());

    const parsed = createBookingSchema.parse({
      ...body,
      idempotencyKey: (body.idempotencyKey as string) || req.headers.get("idempotency-key") || undefined
    });
    const idempotencyKey = parsed.idempotencyKey ?? randomUUID();

    const result = await withIdempotency(idempotencyKey, "booking_create", async () => {
      const booking = await prisma.booking.create({
        data: {
          publicId: `bk_${randomUUID().slice(0, 8)}`,
          contactEmail: parsed.contactEmail,
          pickupText: parsed.pickupText,
          dropoffText: parsed.dropoffText,
          requestedWindowStart: new Date(parsed.requestedWindowStart),
          requestedWindowEnd: new Date(parsed.requestedWindowEnd),
          status: "requested",
          customerToken: randomUUID(),
          notes: parsed.notes || undefined
        }
      });

      await prisma.bookingEvent.create({
        data: {
          bookingId: booking.id,
          eventType: "status_change",
          payloadJson: JSON.stringify({ to: "requested", correlationId: cid })
        }
      });
      await notifyBooking({
        kind: "booking_received",
        bookingId: booking.id,
        publicId: booking.publicId,
        token: booking.customerToken,
        contactEmail: booking.contactEmail,
        correlationId: cid,
        baseUrl: req.nextUrl.origin
      });

      return { id: booking.id, publicId: booking.publicId, token: booking.customerToken };
    });

    safeLog("booking_created", { correlationId: cid, bookingId: (result as { id: string }).id });
    return NextResponse.json(result, { status: 201, headers: { "x-correlation-id": cid } });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message, correlationId: cid },
      { status: 400, headers: { "x-correlation-id": cid } }
    );
  }
}
