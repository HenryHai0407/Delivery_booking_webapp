import { NextRequest, NextResponse } from "next/server";
import { assertRole } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    assertRole(req.headers, "driver");
    const body = await req.json();
    const key = `pod/${body.bookingId}/${Date.now()}-${body.filename}`;

    return NextResponse.json({
      key,
      method: "PUT",
      uploadUrl: `https://example-r2-signed-url.local/${key}?signature=replace-me`,
      expiresInSeconds: 300,
      note: "Wire this to Cloudflare R2 or Supabase Storage signed URL in production"
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 403 });
  }
}
