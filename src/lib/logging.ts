import { randomUUID } from "crypto";

export function correlationId(headers: Headers): string {
  return headers.get("x-correlation-id") ?? randomUUID();
}

export function safeLog(message: string, details: Record<string, unknown>) {
  const redacted = { ...details };
  delete redacted.pickupText;
  delete redacted.dropoffText;
  delete redacted.contactEmail;
  console.info(message, redacted);
}
