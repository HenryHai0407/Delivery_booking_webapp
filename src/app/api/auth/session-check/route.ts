import { NextResponse } from "next/server";
import { authSession } from "@/auth/auth";

export async function GET() {
  try {
    const session = await authSession();
    const user = session?.user;
    if (!user?.id || !user.role) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }
    return NextResponse.json({ authenticated: true, role: user.role });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}

