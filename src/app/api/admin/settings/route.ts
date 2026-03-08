import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { getScheduleConfig } from "@/lib/scheduling";

export async function GET() {
  try {
    await requireRole("admin");
    const scheduleConfig = await getScheduleConfig();
    return NextResponse.json({ scheduleConfig });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 403 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireRole("admin");
    const body = (await req.json()) as Partial<{
      slotCapacity: number;
      workdayStartHour: number;
      workdayEndHour: number;
      timezone: string;
    }>;

    const current = await getScheduleConfig();
    const next = {
      slotCapacity: Math.max(1, Math.floor(body.slotCapacity ?? current.slotCapacity)),
      workdayStartHour: Math.max(0, Math.min(23, Math.floor(body.workdayStartHour ?? current.workdayStartHour))),
      workdayEndHour: Math.max(1, Math.min(24, Math.floor(body.workdayEndHour ?? current.workdayEndHour))),
      timezone: typeof body.timezone === "string" && body.timezone.trim() ? body.timezone.trim() : current.timezone
    };
    if (next.workdayEndHour <= next.workdayStartHour) {
      return NextResponse.json({ error: "workdayEndHour must be greater than workdayStartHour." }, { status: 400 });
    }

    const valueJson = JSON.stringify(next);
    await prisma.$executeRaw`
      INSERT INTO "AppSetting" ("key", "valueJson", "createdAt", "updatedAt")
      VALUES ('schedule_config', ${valueJson}, NOW(), NOW())
      ON CONFLICT ("key")
      DO UPDATE SET "valueJson" = ${valueJson}, "updatedAt" = NOW()
    `;

    return NextResponse.json({ scheduleConfig: next });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
