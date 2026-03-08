import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

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

function escapeCsv(value: unknown) {
  const s = value == null ? "" : String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: NextRequest) {
  try {
    await requireRole("admin");

    const status = req.nextUrl.searchParams.get("status") || undefined;
    const publicId = req.nextUrl.searchParams.get("publicId") || undefined;
    const dateFromRaw = req.nextUrl.searchParams.get("dateFrom");
    const dateToRaw = req.nextUrl.searchParams.get("dateTo");
    const scheduledFromRaw = req.nextUrl.searchParams.get("scheduledFrom");
    const scheduledToRaw = req.nextUrl.searchParams.get("scheduledTo");
    const unassignedOnly = req.nextUrl.searchParams.get("unassignedOnly") === "true";
    const missingPodOnly = req.nextUrl.searchParams.get("missingPodOnly") === "true";
    const estimateDelta = req.nextUrl.searchParams.get("estimateDelta") || "all";

    const where: Prisma.BookingWhereInput = {};
    if (status) where.status = status as Prisma.EnumBookingStatusFilter["equals"];
    if (publicId) where.publicId = { contains: publicId, mode: "insensitive" };
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
    if (scheduledFromRaw || scheduledToRaw) {
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
      where.scheduledWindowStart = scheduledWindowStart;
    }
    if (unassignedOnly) where.assignments = { none: {} };
    if (missingPodOnly) where.pod = null;

    const bookings = await prisma.booking.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        events: {
          where: { eventType: "note_added" },
          orderBy: { createdAt: "desc" },
          take: 6,
          select: { payloadJson: true }
        }
      }
    });

    const rows = bookings
      .map((booking) => {
        const estimate = booking.events.map((e) => parseCustomerEstimate(e.payloadJson)).find((v) => v != null) || null;
        const finalEur = booking.finalAmountCents == null ? null : booking.finalAmountCents / 100;
        const estimateMid = estimate ? (estimate.low + estimate.high) / 2 : null;
        const deltaPct =
          estimateMid && finalEur != null && estimateMid > 0 ? Math.round(((finalEur - estimateMid) / estimateMid) * 100) : null;
        return {
          publicId: booking.publicId,
          status: booking.status,
          contactEmail: booking.contactEmail || "",
          pickupText: booking.pickupText,
          dropoffText: booking.dropoffText,
          requestedWindowStart: booking.requestedWindowStart.toISOString(),
          requestedWindowEnd: booking.requestedWindowEnd.toISOString(),
          scheduledWindowStart: booking.scheduledWindowStart?.toISOString() || "",
          scheduledWindowEnd: booking.scheduledWindowEnd?.toISOString() || "",
          quoteEur: booking.quoteAmountCents == null ? "" : (booking.quoteAmountCents / 100).toFixed(2),
          finalEur: finalEur == null ? "" : finalEur.toFixed(2),
          estimateLowEur: estimate ? estimate.low : "",
          estimateHighEur: estimate ? estimate.high : "",
          deltaPct: deltaPct == null ? "" : deltaPct
        };
      })
      .filter((row) => {
        if (estimateDelta === "all") return true;
        if (row.deltaPct === "") return false;
        const delta = Number(row.deltaPct);
        if (estimateDelta === "over") return delta > 0;
        if (estimateDelta === "under") return delta < 0;
        if (estimateDelta === "on_target") return delta === 0;
        return true;
      });

    const header = [
      "public_id",
      "status",
      "contact_email",
      "pickup",
      "dropoff",
      "requested_window_start",
      "requested_window_end",
      "scheduled_window_start",
      "scheduled_window_end",
      "quote_eur",
      "final_eur",
      "estimate_low_eur",
      "estimate_high_eur",
      "delta_pct"
    ];

    const csvLines = [
      header.join(","),
      ...rows.map((row) =>
        [
          row.publicId,
          row.status,
          row.contactEmail,
          row.pickupText,
          row.dropoffText,
          row.requestedWindowStart,
          row.requestedWindowEnd,
          row.scheduledWindowStart,
          row.scheduledWindowEnd,
          row.quoteEur,
          row.finalEur,
          row.estimateLowEur,
          row.estimateHighEur,
          row.deltaPct
        ]
          .map(escapeCsv)
          .join(",")
      )
    ];

    const filename = `bookings_export_${new Date().toISOString().slice(0, 10)}.csv`;
    return new NextResponse(csvLines.join("\n"), {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`
      }
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
