import { z } from "zod";

export const createBookingSchema = z.object({
  pickupText: z.string().min(5),
  dropoffText: z.string().min(5),
  requestedWindowStart: z.string(),
  requestedWindowEnd: z.string(),
  notes: z.string().optional(),
  idempotencyKey: z.string().min(8)
});

export const updateStatusSchema = z.object({
  status: z.enum([
    "requested",
    "confirmed",
    "scheduled",
    "assigned",
    "driver_en_route",
    "picked_up",
    "delivered",
    "completed",
    "cancelled"
  ]),
  idempotencyKey: z.string().min(8),
  note: z.string().optional()
});
