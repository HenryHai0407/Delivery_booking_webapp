import type { Role } from "@/lib/types";

export function assertRole(headers: Headers, role: Role): void {
  const incoming = headers.get("x-role");
  if (incoming !== role) {
    throw new Error("Forbidden");
  }
}
