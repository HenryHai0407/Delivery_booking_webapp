import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: { publicId: string } }) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }

  const booking = await prisma.booking.findUnique({
    where: { publicId: params.publicId },
    select: {
      publicId: true,
      status: true,
      requestedWindowStart: true,
      requestedWindowEnd: true,
      scheduledWindowStart: true,
      scheduledWindowEnd: true,
      quoteAmountCents: true,
      notes: true,
      customerToken: true
    }
  });

  if (!booking || booking.customerToken !== token) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { customerToken, ...safe } = booking;
  return NextResponse.json(safe);
}
