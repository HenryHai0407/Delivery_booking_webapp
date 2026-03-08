import { AlertCircle, CheckCircle2, Circle, Clock3, PackageCheck, Truck } from "lucide-react";
import { prisma } from "@/lib/db";
import { SupportActions } from "@/components/portal/support-actions";
import { PortalStatusTools } from "@/components/portal/portal-status-tools";

interface PortalProps {
  params: Promise<{ publicId: string }>;
  searchParams: Promise<{ token?: string }>;
}

type PortalStep = {
  id: string;
  label: string;
  done: boolean;
  current: boolean;
};

function safeJson(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
  return {};
}

function statusLabel(value: string) {
  if (value === "driver_en_route") return "Driver en route";
  if (value === "picked_up") return "Picked up";
  return value.replaceAll("_", " ");
}

function money(cents: number | null) {
  if (cents == null) return "Pending quote";
  return new Intl.NumberFormat("fi-FI", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function stepList(status: string): PortalStep[] {
  const order = ["requested", "confirmed", "scheduled", "assigned", "driver_en_route", "picked_up", "delivered", "completed"];
  const index = order.indexOf(status);
  const isCancelled = status === "cancelled";

  const requestDone = index >= 0 || isCancelled;
  const confirmedDone = ["confirmed", "scheduled", "assigned", "driver_en_route", "picked_up", "delivered", "completed"].includes(status);
  const activeDeliveryDone = ["driver_en_route", "picked_up", "delivered", "completed"].includes(status);
  const completedDone = status === "completed";

  return [
    { id: "requested", label: "Request received", done: requestDone, current: status === "requested" },
    {
      id: "confirmed",
      label: "Confirmed and scheduled",
      done: confirmedDone,
      current: status === "confirmed" || status === "scheduled" || status === "assigned"
    },
    { id: "active", label: "In progress", done: activeDeliveryDone, current: status === "driver_en_route" || status === "picked_up" || status === "delivered" },
    { id: "completed", label: "Completed", done: completedDone, current: status === "completed" }
  ];
}

function timelineText(eventType: string, payloadJson: string) {
  const payload = safeJson(payloadJson);
  if (eventType === "status_change") {
    const to = typeof payload.to === "string" ? payload.to : "updated";
    return `Status changed to ${statusLabel(to)}`;
  }
  if (eventType === "pod_uploaded") return "Proof of delivery uploaded";
  return "Notification sent";
}

export default async function PortalPage({ params, searchParams }: PortalProps) {
  const { publicId } = await params;
  const query = await searchParams;
  const token = query.token;

  if (!token) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-900">
          <p className="inline-flex items-center gap-2 font-semibold">
            <AlertCircle className="h-4 w-4" /> Missing token
          </p>
          <p className="mt-1 text-sm">Use the full tracking link from your booking email.</p>
        </div>
      </main>
    );
  }

  const booking = await prisma.booking.findUnique({
    where: { publicId },
    select: {
      publicId: true,
      customerToken: true,
      status: true,
      requestedWindowStart: true,
      requestedWindowEnd: true,
      scheduledWindowStart: true,
      scheduledWindowEnd: true,
      quoteAmountCents: true,
      notes: true,
      updatedAt: true,
      events: {
        where: { eventType: { in: ["status_change", "message_sent", "pod_uploaded"] } },
        orderBy: { createdAt: "asc" },
        select: { id: true, eventType: true, payloadJson: true, createdAt: true }
      }
    }
  });

  if (!booking || booking.customerToken !== token) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-900">
          <p className="inline-flex items-center gap-2 font-semibold">
            <AlertCircle className="h-4 w-4" /> Booking not found
          </p>
          <p className="mt-1 text-sm">Please check your tracking link and try again.</p>
        </div>
      </main>
    );
  }

  const steps = stepList(booking.status);
  const isCancelled = booking.status === "cancelled";

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-6 md:py-8">
      <section className="rounded-3xl border border-slate-200/80 bg-gradient-to-r from-slate-900 via-sky-900 to-indigo-900 p-5 text-white">
        <p className="text-xs uppercase tracking-[0.12em] text-sky-200">Booking Portal</p>
        <h1 className="mt-1 text-2xl font-semibold md:text-3xl">Track your move</h1>
        <p className="mt-1 text-sm text-sky-100/90">
          Booking <span className="font-semibold">{booking.publicId}</span> - Last updated {booking.updatedAt.toLocaleString()}
        </p>
        <PortalStatusTools updatedAtIso={booking.updatedAt.toISOString()} />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-800">Status: {statusLabel(booking.status)}</span>
          {isCancelled ? <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-sm text-rose-700">Cancelled</span> : null}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, idx) => (
            <div
              key={step.id}
              className={`rounded-2xl border px-3 py-2 text-sm ${
                step.done
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : step.current
                    ? "border-sky-200 bg-sky-50 text-sky-800"
                    : "border-slate-200 bg-slate-50 text-slate-600"
              }`}
            >
              <p className="inline-flex items-center gap-1.5 font-medium">
                {step.done ? <CheckCircle2 className="h-4 w-4" /> : step.current ? <Clock3 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                {idx + 1}. {step.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-900">Schedule and quote</h2>
          <div className="mt-3 space-y-1 text-sm text-slate-700">
            <p>
              <strong>Requested:</strong> {booking.requestedWindowStart.toLocaleString()} - {booking.requestedWindowEnd.toLocaleString()}
            </p>
            <p>
              <strong>Scheduled:</strong>{" "}
              {booking.scheduledWindowStart && booking.scheduledWindowEnd
                ? `${booking.scheduledWindowStart.toLocaleString()} - ${booking.scheduledWindowEnd.toLocaleString()}`
                : "Not scheduled yet"}
            </p>
            <p>
              <strong>Quote:</strong> {money(booking.quoteAmountCents)}
            </p>
            <p>
              <strong>Notes:</strong> {booking.notes || "No notes"}
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-900">What happens next</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            <li className="inline-flex items-center gap-2">
              <PackageCheck className="h-4 w-4 text-sky-700" /> We review and confirm schedule details
            </li>
            <li className="inline-flex items-center gap-2">
              <Truck className="h-4 w-4 text-sky-700" /> Driver starts delivery and updates progress
            </li>
            <li className="inline-flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-sky-700" /> You receive completion confirmation by email
            </li>
          </ul>
          <div className="mt-4 border-t border-slate-200 pt-3">
            <p className="mb-2 text-xs uppercase tracking-[0.08em] text-slate-500">Need help?</p>
            <SupportActions bookingId={booking.publicId} />
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold text-slate-900">Timeline</h2>
        {booking.events.length === 0 ? <p className="mt-2 text-sm text-slate-600">No updates yet.</p> : null}
        {booking.events.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {booking.events.map((item) => (
              <li key={item.id} className="rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
                {timelineText(item.eventType, item.payloadJson)} ({item.createdAt.toLocaleString()})
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </main>
  );
}

