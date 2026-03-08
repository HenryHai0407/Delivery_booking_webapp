import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authErrorStatus, requireRole } from "@/lib/auth";

export async function GET() {
  try {
    await requireRole("admin");
    const drivers = await prisma.user.findMany({
      where: { role: "driver" },
      select: { id: true, email: true },
      orderBy: { email: "asc" }
    });
    return NextResponse.json({ data: drivers });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: authErrorStatus(error, 403) });
  }
}
