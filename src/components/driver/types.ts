export type DriverStatus = "assigned" | "driver_en_route" | "picked_up" | "delivered" | "completed" | "cancelled";

export type DriverTimelineEntry = {
  id: string;
  label: string;
  timestamp: string;
};

export type DriverJob = {
  id: string;
  bookingId: string;
  booking: {
    id: string;
    publicId: string;
    status: DriverStatus;
    pickupText: string;
    dropoffText: string;
    scheduledWindowStart: string | null;
    scheduledWindowEnd: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    notes?: string | null;
    staffRequired?: number | null;
    riskFlags?: {
      urgent: boolean;
      fragile: boolean;
      stairs: boolean;
    };
    timeline?: DriverTimelineEntry[];
    pod?: {
      id: string;
      photos: Array<{ id: string; storageUrl: string; createdAt: string }>;
    } | null;
  };
};

export type DriverTabKey = "today" | "upcoming" | "completed";

