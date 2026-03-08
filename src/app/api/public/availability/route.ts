import { NextRequest, NextResponse } from "next/server";
import { countOverlappingBookings, getScheduleConfig, isWithinWorkingHours } from "@/lib/scheduling";

function parsePositiveInt(input: string | undefined, fallback: number) {
  if (!input) return fallback;
  const n = Number(input);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

export async function GET(req: NextRequest) {
  try {
    const startRaw = req.nextUrl.searchParams.get("start");
    if (!startRaw) {
      return NextResponse.json({ error: "Missing start query param" }, { status: 400 });
    }
    const start = new Date(startRaw);
    if (Number.isNaN(start.getTime())) {
      return NextResponse.json({ error: "Invalid start datetime" }, { status: 400 });
    }

    const durationMinutes = parsePositiveInt(req.nextUrl.searchParams.get("duration") || undefined, 120);
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
    const config = await getScheduleConfig();
    if (!isWithinWorkingHours(start, end, config)) {
      return NextResponse.json({
        start: start.toISOString(),
        end: end.toISOString(),
        durationMinutes,
        overlapCount: 0,
        capacity: config.slotCapacity,
        available: false,
        message: `Outside working hours (${config.workdayStartHour}:00-${config.workdayEndHour}:00).`
      });
    }

    const overlapCount = await countOverlappingBookings({ start, end });

    const available = overlapCount < config.slotCapacity;
    const message = available
      ? overlapCount === config.slotCapacity - 1
        ? "Limited capacity left for this time slot."
        : "This time slot is currently available."
      : "This time slot is currently full. Please choose another start time.";

    return NextResponse.json({
      start: start.toISOString(),
      end: end.toISOString(),
      durationMinutes,
      overlapCount,
      capacity: config.slotCapacity,
      available,
      message
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
