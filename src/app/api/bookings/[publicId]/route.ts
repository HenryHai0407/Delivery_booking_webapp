import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function safeJson(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
  return {};
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }

  const booking = await prisma.booking.findFirst({
    where: { publicId, customerToken: token },
    select: {
      publicId: true,
      status: true,
      requestedWindowStart: true,
      requestedWindowEnd: true,
      scheduledWindowStart: true,
      scheduledWindowEnd: true,
      quoteAmountCents: true,
      notes: true,
      events: {
        where: {
          eventType: {
            in: ["status_change", "message_sent", "pod_uploaded"]
          }
        },
        orderBy: { createdAt: "asc" },
        select: {
          eventType: true,
          payloadJson: true,
          createdAt: true
        }
      }
    }
  });

  if (!booking) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const events = booking.events.map((event) => {
    const payload = safeJson(event.payloadJson);
    return {
      eventType: event.eventType,
      createdAt: event.createdAt,
      statusFrom: typeof payload.from === "string" ? payload.from : undefined,
      statusTo: typeof payload.to === "string" ? payload.to : undefined
    };
  });

  return NextResponse.json({
    publicId: booking.publicId,
    status: booking.status,
    requestedWindowStart: booking.requestedWindowStart,
    requestedWindowEnd: booking.requestedWindowEnd,
    scheduledWindowStart: booking.scheduledWindowStart,
    scheduledWindowEnd: booking.scheduledWindowEnd,
    quoteAmountCents: booking.quoteAmountCents,
    notes: booking.notes,
    events
  });
}
