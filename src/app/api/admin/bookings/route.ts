import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertRole } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    assertRole(req.headers, "admin");
    const page = Number(req.nextUrl.searchParams.get("page") || "1");
    const pageSize = Math.min(Number(req.nextUrl.searchParams.get("pageSize") || "20"), 100);
    const status = req.nextUrl.searchParams.get("status") || undefined;

    const bookings = await prisma.booking.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    });
    const total = await prisma.booking.count({ where: status ? { status } : undefined });

    return NextResponse.json({ page, pageSize, total, data: bookings });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 403 });
  }
}
