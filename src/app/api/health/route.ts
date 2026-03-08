import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateEnv } from "@/lib/env";

export async function GET() {
  const envValidation = validateEnv();
  let dbOk = true;
  let dbError: string | null = null;

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    dbOk = false;
    dbError = (error as Error).message;
  }

  const ok = dbOk && envValidation.errors.length === 0;
  return NextResponse.json(
    {
      ok,
      timestamp: new Date().toISOString(),
      checks: {
        db: dbOk ? "ok" : "failed",
        env: envValidation.ok ? "ok" : "failed"
      },
      errors: [...envValidation.errors, ...(dbError ? [`db: ${dbError}`] : [])],
      warnings: envValidation.warnings
    },
    { status: ok ? 200 : 503 }
  );
}
