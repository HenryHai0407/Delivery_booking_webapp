import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createSignedUpload } from "@/lib/storage";
import { correlationId, safeLog } from "@/lib/logging";

export async function POST(req: NextRequest) {
  const cid = correlationId(req.headers);
  try {
    await requireRole("driver");
    const body = (await req.json()) as { bookingId?: string; filename?: string; expiresInSeconds?: number };
    if (!body.bookingId || !body.filename) {
      return NextResponse.json({ error: "Missing bookingId or filename" }, { status: 400 });
    }

    const signed = await createSignedUpload({
      bookingId: body.bookingId,
      filename: body.filename,
      expiresInSeconds: body.expiresInSeconds
    });

    return NextResponse.json({ ...signed }, { headers: { "x-correlation-id": cid } });
  } catch (error) {
    safeLog("upload_presign_failed", {
      correlationId: cid,
      error: (error as Error).message
    });
    return NextResponse.json({ error: (error as Error).message, correlationId: cid }, { status: 400, headers: { "x-correlation-id": cid } });
  }
}
