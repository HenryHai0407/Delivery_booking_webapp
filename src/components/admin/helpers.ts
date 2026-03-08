import type { AdminBooking, BookingStatus, KanbanColumnKey } from "./types";

export function toIsoDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

export function toCurrency(cents?: number | null) {
  if (cents == null) return "TBD";
  return `EUR ${(cents / 100).toFixed(2)}`;
}

export function shortRoute(pickup: string, dropoff: string) {
  const left = pickup.length > 22 ? `${pickup.slice(0, 22)}...` : pickup;
  const right = dropoff.length > 22 ? `${dropoff.slice(0, 22)}...` : dropoff;
  return `${left} -> ${right}`;
}

export function bookingColumn(booking: AdminBooking): KanbanColumnKey {
  if (booking.status === "cancelled") return "cancelled";
  if (booking.status === "completed") return "completed";
  if (["driver_en_route", "picked_up", "delivered"].includes(booking.status)) return "in_progress";
  if (booking.status === "assigned") return "assigned";
  if (booking.status === "scheduled") return "scheduled";
  if (booking.status === "confirmed") {
    if (booking.scheduledWindowStart && booking.quoteAmountCents != null) return "confirmed";
    return "needs_review";
  }
  return "new";
}

export function routeRiskFlags(booking: AdminBooking) {
  const note = (booking.notes || "").toLowerCase();
  return {
    urgent: note.includes("urgent"),
    fragile: note.includes("fragile"),
    stairs: note.includes("stairs")
  };
}

export function canMoveToStatus(current: BookingStatus, to: BookingStatus, transitions: Record<BookingStatus, BookingStatus[]>) {
  if (current === to) return true;
  return transitions[current]?.includes(to) || false;
}
