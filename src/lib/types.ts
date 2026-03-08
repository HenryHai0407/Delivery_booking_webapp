export type Role = "admin" | "driver";

export type BookingStatus =
  | "requested"
  | "confirmed"
  | "scheduled"
  | "assigned"
  | "driver_en_route"
  | "picked_up"
  | "delivered"
  | "completed"
  | "cancelled";

export type BookingEventType =
  | "status_change"
  | "note_added"
  | "assignment"
  | "message_sent"
  | "pod_uploaded";
