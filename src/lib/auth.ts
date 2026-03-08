import { authSession } from "@/auth/auth";
import type { Role } from "@/lib/types";

export async function requireRole(role: Role): Promise<{ userId: string; role: Role }> {
  const session = await authSession();
  const user = session?.user;
  if (!user?.id || user.role !== role) {
    throw new Error("Forbidden");
  }
  return { userId: user.id, role: user.role };
}
