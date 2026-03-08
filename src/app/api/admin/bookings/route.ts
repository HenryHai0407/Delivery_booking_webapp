import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { authErrorStatus, requireRole } from "@/lib/auth";

function parseCustomerEstimate(payloadJson: string): { low: number; high: number; currency: string } | null {
  try {
    const payload = JSON.parse(payloadJson) as Record<string, unknown>;
    if (payload.kind !== "customer_estimate") return null;
    const low = typeof payload.low === "number" ? payload.low : null;
    const high = typeof payload.high === "number" ? payload.high : null;
    if (low == null || high == null) return null;
    const currency = typeof payload.currency === "string" ? payload.currency : "EUR";
    return { low, high, currency };
  } catch {
    return null;
  }
}

function parseMessageSent(payloadJson: string): { sent: boolean; reason: string | null } | null {
  try {
    const payload = JSON.parse(payloadJson) as Record<string, unknown>;
    if (typeof payload.sent !== "boolean") return null;
    const reason = typeof payload.reason === "string" ? payload.reason : null;
    return { sent: payload.sent, reason };
  } catch {
    return null;
  }
}

function parseCustomerRequirements(payloadJson: string): { staffRequired: number } | null {
  try {
    const payload = JSON.parse(payloadJson) as Record<string, unknown>;
    if (payload.kind !== "customer_requirements") return null;
    const staffRequired = typeof payload.staffRequired === "number" ? payload.staffRequired : null;
    if (staffRequired == null) return null;
    return { staffRequired };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    await requireRole("admin");
    const page = Number(req.nextUrl.searchParams.get("page") || "1");
    const pageSize = Math.min(Number(req.nextUrl.searchParams.get("pageSize") || "20"), 100);
    const status = req.nextUrl.searchParams.get("status") || undefined;
    const publicId = req.nextUrl.searchParams.get("publicId") || undefined;
    const q = req.nextUrl.searchParams.get("q") || undefined;
    const driverId = req.nextUrl.searchParams.get("driver_id") || undefined;
    const fromRaw = req.nextUrl.searchParams.get("from");
    const toRaw = req.nextUrl.searchParams.get("to");
    const dateFromRaw = req.nextUrl.searchParams.get("dateFrom");
    const dateToRaw = req.nextUrl.searchParams.get("dateTo");
    const scheduledFromRaw = req.nextUrl.searchParams.get("scheduledFrom");
    const scheduledToRaw = req.nextUrl.searchParams.get("scheduledTo");
    const unassignedOnly = req.nextUrl.searchParams.get("unassignedOnly") === "true";
    const missingPodOnly = req.nextUrl.searchParams.get("missingPodOnly") === "true";

    const where: Prisma.BookingWhereInput = {};
    if (status) where.status = status as Prisma.EnumBookingStatusFilter["equals"];
    if (publicId) where.publicId = { contains: publicId, mode: "insensitive" };
    if (q) {
      where.OR = [
        { publicId: { contains: q, mode: "insensitive" } },
        { contactEmail: { contains: q, mode: "insensitive" } },
        { pickupText: { contains: q, mode: "insensitive" } },
        { dropoffText: { contains: q, mode: "insensitive" } }
      ];
    }
    if (driverId) where.assignments = { some: { driverId } };

    if (dateFromRaw || dateToRaw) {
      const createdAt: Prisma.DateTimeFilter = {};
      if (dateFromRaw) {
        const from = new Date(dateFromRaw);
        if (Number.isNaN(from.getTime())) throw new Error("Invalid dateFrom");
        createdAt.gte = from;
      }
      if (dateToRaw) {
        const to = new Date(dateToRaw);
        if (Number.isNaN(to.getTime())) throw new Error("Invalid dateTo");
        createdAt.lte = to;
      }
      where.createdAt = createdAt;
    }
    const scheduledWindowStart: Prisma.DateTimeNullableFilter = {};
    if (scheduledFromRaw) {
      const from = new Date(scheduledFromRaw);
      if (Number.isNaN(from.getTime())) throw new Error("Invalid scheduledFrom");
      scheduledWindowStart.gte = from;
    }
    if (scheduledToRaw) {
      const to = new Date(scheduledToRaw);
      if (Number.isNaN(to.getTime())) throw new Error("Invalid scheduledTo");
      scheduledWindowStart.lte = to;
    }
    if (fromRaw) {
      const from = new Date(fromRaw);
      if (Number.isNaN(from.getTime())) throw new Error("Invalid from");
      scheduledWindowStart.gte = from;
    }
    if (toRaw) {
      const to = new Date(toRaw);
      if (Number.isNaN(to.getTime())) throw new Error("Invalid to");
      scheduledWindowStart.lte = to;
    }
    if (scheduledWindowStart.gte || scheduledWindowStart.lte) {
      where.scheduledWindowStart = scheduledWindowStart;
    }
    if (unassignedOnly) where.assignments = { none: {} };
    if (missingPodOnly) where.pod = null;

    const bookings = await prisma.booking.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        pod: {
          select: {
            id: true,
            photos: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { storageUrl: true }
            }
          }
        },
        assignments: {
          select: { driverId: true }
        },
        events: {
          where: { eventType: { in: ["note_added", "message_sent"] } },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { eventType: true, payloadJson: true }
        }
      }
    });
    const total = await prisma.booking.count({ where });

    const data = bookings.map((booking) => {
      const estimate = booking.events
        .filter((e) => e.eventType === "note_added")
        .map((e) => parseCustomerEstimate(e.payloadJson))
        .find((v) => v != null) || null;
      const failedMessage = booking.events
        .filter((e) => e.eventType === "message_sent")
        .map((e) => parseMessageSent(e.payloadJson))
        .find((v) => v != null && !v.sent) || null;
      const requirement = booking.events
        .filter((e) => e.eventType === "note_added")
        .map((e) => parseCustomerRequirements(e.payloadJson))
        .find((v) => v != null) || null;
      const safeBooking = {
        id: booking.id,
        publicId: booking.publicId,
        customerToken: booking.customerToken,
        contactEmail: booking.contactEmail,
        pickupText: booking.pickupText,
        dropoffText: booking.dropoffText,
        requestedWindowStart: booking.requestedWindowStart,
        requestedWindowEnd: booking.requestedWindowEnd,
        scheduledWindowStart: booking.scheduledWindowStart,
        scheduledWindowEnd: booking.scheduledWindowEnd,
        status: booking.status,
        quoteAmountCents: booking.quoteAmountCents,
        finalAmountCents: booking.finalAmountCents,
        notes: booking.notes,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
        latestPodPhotoUrl: booking.pod?.photos?.[0]?.storageUrl || null,
        notificationFailed: Boolean(failedMessage),
        notificationFailureReason: failedMessage?.reason || null,
        staffRequired: requirement?.staffRequired || null,
        driverIds: booking.assignments.map((a) => a.driverId)
      };
      return { ...safeBooking, customerEstimate: estimate };
    });

    return NextResponse.json({
      page,
      pageSize,
      total,
      filters: {
        status,
        publicId,
        q,
        driverId,
        from: fromRaw,
        to: toRaw,
        dateFrom: dateFromRaw,
        dateTo: dateToRaw,
        scheduledFrom: scheduledFromRaw,
        scheduledTo: scheduledToRaw,
        unassignedOnly,
        missingPodOnly
      },
      data
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: authErrorStatus(error, 403) });
  }
}
