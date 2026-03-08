import { authSession } from "@/auth/auth";
import type { Role } from "@/lib/types";

export class AccessError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AccessError";
    this.status = status;
  }
}

export function authErrorStatus(error: unknown, fallback = 400) {
  if (error instanceof AccessError) return error.status;
  return fallback;
}

export async function requireRole(role: Role): Promise<{ userId: string; role: Role }> {
  let session: { user?: { id?: string; role?: Role } } | null = null;
  try {
    session = (await authSession()) as { user?: { id?: string; role?: Role } } | null;
  } catch {
    throw new AccessError("Unauthorized", 401);
  }
  const user = session?.user;
  if (!user?.id || !user.role) {
    throw new AccessError("Unauthorized", 401);
  }
  if (user.role !== role) {
    throw new AccessError("Forbidden", 403);
  }
  return { userId: user.id, role: user.role };
}
