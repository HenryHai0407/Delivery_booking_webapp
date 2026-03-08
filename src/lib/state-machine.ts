import type { BookingStatus } from "@/lib/types";

const transitions: Record<BookingStatus, BookingStatus[]> = {
  requested: ["confirmed", "cancelled"],
  confirmed: ["scheduled", "cancelled"],
  scheduled: ["assigned", "cancelled"],
  assigned: ["driver_en_route", "cancelled"],
  driver_en_route: ["picked_up", "cancelled"],
  picked_up: ["delivered"],
  delivered: ["completed"],
  completed: [],
  cancelled: []
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return transitions[from].includes(to);
}

export function assertTransition(from: BookingStatus, to: BookingStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid status transition from ${from} to ${to}`);
  }
}
