import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    await requireRole("admin");
    const page = Number(req.nextUrl.searchParams.get("page") || "1");
    const pageSize = Math.min(Number(req.nextUrl.searchParams.get("pageSize") || "20"), 100);
    const status = req.nextUrl.searchParams.get("status") || undefined;
    const publicId = req.nextUrl.searchParams.get("publicId") || undefined;
    const dateFromRaw = req.nextUrl.searchParams.get("dateFrom");
    const dateToRaw = req.nextUrl.searchParams.get("dateTo");

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

    const bookings = await prisma.booking.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    });
    const total = await prisma.booking.count({ where });

    return NextResponse.json({ page, pageSize, total, filters: { status, publicId, dateFrom: dateFromRaw, dateTo: dateToRaw }, data: bookings });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 403 });
  }
}
