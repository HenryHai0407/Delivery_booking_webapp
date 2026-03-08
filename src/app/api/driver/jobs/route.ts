import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authErrorStatus, requireRole } from "@/lib/auth";

function parseCustomerRequirements(payloadJson: string): { staffRequired: number } | null {
  try {
    const payload = JSON.parse(payloadJson) as Record<string, unknown>;
    if (payload.kind !== "customer_requirements") return null;
    const staffRequired = typeof payload.staffRequired === "number" ? payload.staffRequired : null;
    if (staffRequired == null) return null;
    return { staffRequired };
  } catch {
    return null;
  }
}

function parseStatusLabel(payloadJson: string, fallback: string) {
  try {
    const payload = JSON.parse(payloadJson) as Record<string, unknown>;
    const to = typeof payload.to === "string" ? payload.to : fallback;
    return to.replaceAll("_", " ");
  } catch {
    return fallback.replaceAll("_", " ");
  }
}

function riskFlags(notes: string | null | undefined) {
  const text = (notes || "").toLowerCase();
  return {
    urgent: text.includes("urgent"),
    fragile: text.includes("fragile"),
    stairs: text.includes("stairs")
  };
}

export async function GET() {
  try {
    const { userId: driverId } = await requireRole("driver");

    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const jobs = await prisma.assignment.findMany({
      where: {
        driverId,
        booking: {
          scheduledWindowStart: {
            gte: start,
            lt: end
          }
        }
      },
      include: {
        booking: {
          include: {
            events: {
              where: { eventType: { in: ["note_added", "status_change"] } },
              orderBy: { createdAt: "desc" },
              take: 20,
              select: { id: true, eventType: true, payloadJson: true, createdAt: true }
            },
            pod: {
              select: {
                id: true,
                photos: {
                  orderBy: { createdAt: "desc" },
                  take: 1,
                  select: { id: true, storageUrl: true, createdAt: true }
                }
              }
            }
          }
        }
      }
    });

    const data = jobs.map((job) => {
      const requirement = job.booking.events
        .filter((event) => event.eventType === "note_added")
        .map((event) => parseCustomerRequirements(event.payloadJson))
        .find((v) => v != null);

      const timeline = job.booking.events
        .filter((event) => event.eventType === "status_change")
        .map((event) => ({
          id: event.id,
          label: parseStatusLabel(event.payloadJson, event.eventType),
          timestamp: event.createdAt.toISOString()
        }));

      return {
        id: job.id,
        bookingId: job.bookingId,
        booking: {
          id: job.booking.id,
          publicId: job.booking.publicId,
          status: job.booking.status,
          pickupText: job.booking.pickupText,
          dropoffText: job.booking.dropoffText,
          scheduledWindowStart: job.booking.scheduledWindowStart,
          scheduledWindowEnd: job.booking.scheduledWindowEnd,
          contactEmail: job.booking.contactEmail,
          contactPhone: null,
          notes: job.booking.notes,
          staffRequired: requirement?.staffRequired || 1,
          riskFlags: riskFlags(job.booking.notes),
          timeline,
          pod: job.booking.pod
        }
      };
    });

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: authErrorStatus(error, 403) });
  }
}
