import type { BookingStatus, KanbanColumnKey } from "./types";

export const KANBAN_COLUMNS: Array<{ key: KanbanColumnKey; title: string; showByDefault: boolean }> = [
  { key: "new", title: "New", showByDefault: true },
  { key: "needs_review", title: "Needs Review", showByDefault: true },
  { key: "confirmed", title: "Confirmed", showByDefault: true },
  { key: "scheduled", title: "Scheduled", showByDefault: true },
  { key: "assigned", title: "Assigned", showByDefault: true },
  { key: "in_progress", title: "In Progress", showByDefault: true },
  { key: "completed", title: "Completed", showByDefault: true },
  { key: "cancelled", title: "Cancelled", showByDefault: false }
];

export const STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  requested: ["confirmed", "cancelled"],
  confirmed: ["scheduled", "cancelled"],
  scheduled: ["assigned", "cancelled"],
  assigned: ["driver_en_route", "cancelled"],
  driver_en_route: ["picked_up", "cancelled"],
  picked_up: ["delivered", "cancelled"],
  delivered: ["completed"],
  completed: [],
  cancelled: []
};

export function statusLabel(status: BookingStatus) {
  return status.replaceAll("_", " ");
}
