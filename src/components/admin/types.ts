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

export type KanbanColumnKey =
  | "new"
  | "needs_review"
  | "confirmed"
  | "scheduled"
  | "assigned"
  | "in_progress"
  | "completed"
  | "cancelled";

export type AdminBooking = {
  id: string;
  publicId: string;
  status: BookingStatus;
  pickupText: string;
  dropoffText: string;
  contactEmail?: string | null;
  requestedWindowStart: string;
  requestedWindowEnd: string;
  scheduledWindowStart?: string | null;
  scheduledWindowEnd?: string | null;
  quoteAmountCents?: number | null;
  finalAmountCents?: number | null;
  notes?: string | null;
  latestPodPhotoUrl?: string | null;
  notificationFailed?: boolean;
  notificationFailureReason?: string | null;
  customerEstimate?: {
    low: number;
    high: number;
    currency: string;
  } | null;
  staffRequired?: number | null;
  driverIds?: string[];
  createdAt: string;
  updatedAt: string;
};

export type BookingEvent = {
  id: string;
  eventType: string;
  payloadJson: string;
  createdAt: string;
  actorUserId?: string | null;
};

export type DriverOption = {
  id: string;
  email: string;
};

export type AdminStats = {
  todayBookings: number;
  pendingConfirmations: number;
  inProgress: number;
  completedToday: number;
};
