import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { notifyBooking } from "@/lib/notifications";
import { correlationId } from "@/lib/logging";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cid = correlationId(req.headers);
  try {
    const { id } = await params;
    const { userId: actorUserId } = await requireRole("admin");
    const body = (await req.json().catch(() => ({}))) as { kind?: "booking_received" | "booking_confirmed" | "booking_completed" };
    const booking = await prisma.booking.findUniqueOrThrow({ where: { id } });

    await notifyBooking({
      kind: body.kind || "booking_received",
      bookingId: booking.id,
      publicId: booking.publicId,
      token: booking.customerToken,
      contactEmail: booking.contactEmail,
      actorUserId,
      correlationId: cid,
      baseUrl: req.nextUrl.origin
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
