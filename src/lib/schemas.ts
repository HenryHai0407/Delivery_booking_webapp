import { z } from "zod";

const isoDateTimeWithOffset = z.string().datetime({ offset: true });

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

const addressSchema = z
  .string()
  .min(5)
  .max(300)
  .transform(normalizeWhitespace);

export const createBookingSchema = z.object({
  contactEmail: z.string().trim().toLowerCase().email(),
  pickupText: addressSchema,
  dropoffText: addressSchema,
  requestedWindowStart: isoDateTimeWithOffset,
  requestedWindowEnd: isoDateTimeWithOffset,
  staffRequired: z.coerce.number().int().min(1).max(8),
  notes: z.string().trim().max(1000).optional(),
  idempotencyKey: z.string().min(8).optional(),
  estimateLowEur: z.coerce.number().int().nonnegative().optional(),
  estimateHighEur: z.coerce.number().int().nonnegative().optional(),
  estimateBilledHours: z.coerce.number().positive().optional(),
  estimateDistanceKm: z.coerce.number().positive().optional(),
  estimateEtaMinutes: z.coerce.number().int().positive().optional(),
  estimateTrafficEtaMinutes: z.coerce.number().int().positive().optional(),
  estimateTrafficLevel: z.enum(["free", "moderate", "busy", "heavy", "unknown"]).optional(),
  estimateProvider: z.enum(["google", "osm"]).optional(),
  estimateUpdatedAt: isoDateTimeWithOffset.optional()
}).superRefine((value, ctx) => {
  const start = new Date(value.requestedWindowStart);
  const end = new Date(value.requestedWindowEnd);
  if (start >= end) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["requestedWindowEnd"],
      message: "requestedWindowEnd must be later than requestedWindowStart"
    });
  }
  if (value.pickupText.toLowerCase() === value.dropoffText.toLowerCase()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["dropoffText"],
      message: "Dropoff must be different from pickup"
    });
  }
  const hasEstimate = value.estimateLowEur != null || value.estimateHighEur != null;
  if (hasEstimate) {
    if (value.estimateLowEur == null || value.estimateHighEur == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["estimateLowEur"],
        message: "estimateLowEur and estimateHighEur must both be provided"
      });
    } else if (value.estimateHighEur < value.estimateLowEur) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["estimateHighEur"],
        message: "estimateHighEur must be >= estimateLowEur"
      });
    }
  }
});

export const updateBookingDetailsSchema = z
  .object({
    scheduledWindowStart: isoDateTimeWithOffset.nullable().optional(),
    scheduledWindowEnd: isoDateTimeWithOffset.nullable().optional(),
    quoteAmountCents: z.number().int().nonnegative().nullable().optional(),
    finalAmountCents: z.number().int().nonnegative().nullable().optional(),
    notes: z.string().trim().max(1000).nullable().optional()
  })
  .superRefine((value, ctx) => {
    const hasStart = value.scheduledWindowStart != null;
    const hasEnd = value.scheduledWindowEnd != null;
    if (hasStart !== hasEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scheduledWindowStart"],
        message: "scheduledWindowStart and scheduledWindowEnd must be set together"
      });
      return;
    }
    if (hasStart && hasEnd) {
      const start = new Date(value.scheduledWindowStart as string);
      const end = new Date(value.scheduledWindowEnd as string);
      if (start >= end) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["scheduledWindowEnd"],
          message: "scheduledWindowEnd must be later than scheduledWindowStart"
        });
      }
    }
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
