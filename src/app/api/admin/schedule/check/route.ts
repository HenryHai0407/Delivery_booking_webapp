import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { countOverlappingBookings, getScheduleConfig, isWithinWorkingHours } from "@/lib/scheduling";

export async function GET(req: NextRequest) {
  try {
    await requireRole("admin");
    const startRaw = req.nextUrl.searchParams.get("start");
    const endRaw = req.nextUrl.searchParams.get("end");
    const excludeBookingId = req.nextUrl.searchParams.get("excludeBookingId") || undefined;

    if (!startRaw || !endRaw) {
      return NextResponse.json({ error: "start and end are required" }, { status: 400 });
    }
    const start = new Date(startRaw);
    const end = new Date(endRaw);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
      return NextResponse.json({ error: "Invalid schedule window" }, { status: 400 });
    }

    const config = await getScheduleConfig();
    if (!isWithinWorkingHours(start, end, config)) {
      return NextResponse.json({
        ok: false,
        reason: `Outside working hours (${config.workdayStartHour}:00-${config.workdayEndHour}:00).`,
        overlapCount: 0,
        capacity: config.slotCapacity
      });
    }

    const overlapCount = await countOverlappingBookings({ start, end, excludeBookingId });
    const ok = overlapCount < config.slotCapacity;
    return NextResponse.json({
      ok,
      reason: ok ? "Schedule window is available." : "Schedule conflict: slot capacity exceeded.",
      overlapCount,
      capacity: config.slotCapacity
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 403 });
  }
}
