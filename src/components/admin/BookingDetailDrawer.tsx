"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3, Mail, MapPinned, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { STATUS_TRANSITIONS, statusLabel } from "./constants";
import type { AdminBooking, BookingEvent, BookingStatus, DriverOption } from "./types";

function toLocalInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function safeJson(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
  return {};
}

function eventLabel(event: BookingEvent) {
  const payload = safeJson(event.payloadJson);
  if (event.eventType === "status_change") {
    const from = typeof payload.from === "string" ? payload.from : null;
    const to = typeof payload.to === "string" ? payload.to : null;
    if (from && to) return `Status changed: ${from} -> ${to}`;
    if (to) return `Status changed to ${to}`;
    return "Status updated";
  }
  if (event.eventType === "assignment") {
    const driverId = typeof payload.driverId === "string" ? payload.driverId : null;
    return driverId ? `Driver assigned (${driverId.slice(0, 8)}...)` : "Driver assigned";
  }
  if (event.eventType === "pod_uploaded") return "POD uploaded";
  if (event.eventType === "message_sent") return "Notification sent";
  if (event.eventType === "note_added") return "Internal note updated";
  return event.eventType.replaceAll("_", " ");
}

export function BookingDetailDrawer({
  booking,
  open,
  drivers,
  onClose,
  onSaveDetails,
  onAssignDriver,
  onMoveStatus,
  loadingAction
}: {
  booking: AdminBooking | null;
  open: boolean;
  drivers: DriverOption[];
  onClose: () => void;
  onSaveDetails: (args: {
    bookingId: string;
    scheduledWindowStart: string;
    scheduledWindowEnd: string;
    quoteAmountCents: string;
    finalAmountCents: string;
    notes: string;
  }) => Promise<void>;
  onAssignDriver: (bookingId: string, driverId: string) => Promise<void>;
  onMoveStatus: (bookingId: string, status: BookingStatus) => Promise<void>;
  loadingAction: boolean;
}) {
  const [events, setEvents] = useState<BookingEvent[]>([]);
  const [scheduleCheck, setScheduleCheck] = useState<{
    state: "idle" | "checking" | "ok" | "conflict" | "error";
    message: string;
  }>({ state: "idle", message: "" });
  const [draft, setDraft] = useState({
    scheduledWindowStart: "",
    scheduledWindowEnd: "",
    quoteAmountCents: "",
    finalAmountCents: "",
    notes: "",
    driverId: "",
    moveStatus: "" as BookingStatus | ""
  });

  useEffect(() => {
    if (!booking) return;
    setDraft({
      scheduledWindowStart: toLocalInput(booking.scheduledWindowStart),
      scheduledWindowEnd: toLocalInput(booking.scheduledWindowEnd),
      quoteAmountCents: booking.quoteAmountCents == null ? "" : String(booking.quoteAmountCents),
      finalAmountCents: booking.finalAmountCents == null ? "" : String(booking.finalAmountCents),
      notes: booking.notes || "",
      driverId: booking.driverIds?.[0] || "",
      moveStatus: ""
    });
  }, [booking]);

  useEffect(() => {
    if (!booking || !open) return;
    if (!draft.scheduledWindowStart || !draft.scheduledWindowEnd) {
      setScheduleCheck({ state: "idle", message: "" });
      return;
    }

    const start = new Date(draft.scheduledWindowStart);
    const end = new Date(draft.scheduledWindowEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
      setScheduleCheck({ state: "error", message: "Scheduled end must be later than scheduled start." });
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setScheduleCheck({ state: "checking", message: "Checking slot capacity..." });
        const params = new URLSearchParams({
          start: start.toISOString(),
          end: end.toISOString(),
          excludeBookingId: booking.id
        });
        const response = await fetch(`/api/admin/schedule/check?${params.toString()}`);
        const payload = (await response.json()) as {
          ok?: boolean;
          reason?: string;
          overlapCount?: number;
          capacity?: number;
          error?: string;
        };
        if (cancelled) return;
        if (!response.ok) {
          setScheduleCheck({ state: "error", message: payload.error || "Could not validate schedule window." });
          return;
        }
        if (payload.ok) {
          setScheduleCheck({
            state: "ok",
            message: `${payload.reason || "Schedule window is available."} (${payload.overlapCount ?? 0}/${payload.capacity ?? 0} used)`
          });
        } else {
          setScheduleCheck({
            state: "conflict",
            message: `${payload.reason || "Schedule conflict detected."} (${payload.overlapCount ?? 0}/${payload.capacity ?? 0} used)`
          });
        }
      } catch {
        if (!cancelled) {
          setScheduleCheck({ state: "error", message: "Could not validate schedule window." });
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [booking, draft.scheduledWindowEnd, draft.scheduledWindowStart, open]);

  useEffect(() => {
    if (!booking || !open) return;
    const bookingId = booking.id;
    let cancelled = false;
    async function loadTimeline() {
      const response = await fetch(`/api/admin/bookings/${bookingId}/events?limit=30`);
      const payload = (await response.json()) as { data?: BookingEvent[] };
      if (!cancelled) setEvents(payload.data || []);
    }
    void loadTimeline();
    return () => {
      cancelled = true;
    };
  }, [booking, open]);

  const movableStatuses = useMemo(
    () => (booking ? STATUS_TRANSITIONS[booking.status].filter((s) => s !== booking.status) : []),
    [booking]
  );

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent>
        {!booking ? null : (
          <>
            <SheetHeader>
              <SheetTitle>{booking.publicId}</SheetTitle>
              <SheetDescription>Dispatch drawer for quick schedule, assignment, and status updates.</SheetDescription>
            </SheetHeader>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <p className="inline-flex items-center gap-1.5">
                  <Mail className="h-4 w-4" /> {booking.contactEmail || "-"}
                </p>
                <p className="mt-1 inline-flex items-center gap-1.5">
                  <Clock3 className="h-4 w-4" />
                  Requested: {new Date(booking.requestedWindowStart).toLocaleString()}
                </p>
                <p className="mt-1 inline-flex items-start gap-1.5">
                  <MapPinned className="mt-0.5 h-4 w-4" />
                  {booking.pickupText} {"->"} {booking.dropoffText}
                </p>
                <p className="mt-1 inline-flex items-center gap-1.5">
                  <UserRound className="h-4 w-4" /> Staff: {booking.staffRequired || 1}
                </p>
              </div>

              <Separator />

              <div className="grid gap-3">
                <div className="grid gap-1">
                  <Label>Scheduled start</Label>
                  <Input
                    type="datetime-local"
                    value={draft.scheduledWindowStart}
                    onChange={(e) => setDraft((d) => ({ ...d, scheduledWindowStart: e.target.value }))}
                  />
                </div>
                <div className="grid gap-1">
                  <Label>Scheduled end</Label>
                  <Input
                    type="datetime-local"
                    value={draft.scheduledWindowEnd}
                    onChange={(e) => setDraft((d) => ({ ...d, scheduledWindowEnd: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1">
                    <Label>Quote cents</Label>
                    <Input
                      type="number"
                      value={draft.quoteAmountCents}
                      onChange={(e) => setDraft((d) => ({ ...d, quoteAmountCents: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label>Final cents</Label>
                    <Input
                      type="number"
                      value={draft.finalAmountCents}
                      onChange={(e) => setDraft((d) => ({ ...d, finalAmountCents: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid gap-1">
                  <Label>Internal notes</Label>
                  <textarea
                    className="min-h-24 rounded-2xl border border-slate-200 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
                    value={draft.notes}
                    onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                  />
                </div>
                <Button
                  disabled={loadingAction || scheduleCheck.state === "checking" || scheduleCheck.state === "conflict" || scheduleCheck.state === "error"}
                  onClick={() =>
                    onSaveDetails({
                      bookingId: booking.id,
                      scheduledWindowStart: draft.scheduledWindowStart,
                      scheduledWindowEnd: draft.scheduledWindowEnd,
                      quoteAmountCents: draft.quoteAmountCents,
                      finalAmountCents: draft.finalAmountCents,
                      notes: draft.notes
                    })
                  }
                >
                  Save details
                </Button>
                {scheduleCheck.state !== "idle" ? (
                  <p
                    className={`text-xs ${
                      scheduleCheck.state === "ok"
                        ? "text-emerald-700"
                        : scheduleCheck.state === "checking"
                          ? "text-slate-600"
                          : "text-rose-700"
                    }`}
                  >
                    {scheduleCheck.message}
                  </p>
                ) : null}
              </div>

              <Separator />

              <div className="grid gap-3">
                <div className="grid gap-1">
                  <Label>Assign driver</Label>
                  <Select value={draft.driverId} onChange={(e) => setDraft((d) => ({ ...d, driverId: e.target.value }))}>
                    <option value="">Select driver</option>
                    {drivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.email}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    disabled={loadingAction || !draft.driverId}
                    onClick={() => onAssignDriver(booking.id, draft.driverId)}
                  >
                    Assign
                  </Button>
                  <Button
                    disabled={loadingAction}
                    onClick={() =>
                      onMoveStatus(
                        booking.id,
                        booking.status === "requested" ? "confirmed" : booking.status === "confirmed" ? "scheduled" : booking.status
                      )
                    }
                  >
                    Confirm
                  </Button>
                </div>
                <div className="grid gap-1">
                  <Label>Move status</Label>
                  <Select
                    value={draft.moveStatus}
                    onChange={(e) => setDraft((d) => ({ ...d, moveStatus: e.target.value as BookingStatus }))}
                  >
                    <option value="">Choose status</option>
                    {movableStatuses.map((status) => (
                      <option key={status} value={status}>
                        {statusLabel(status)}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    disabled={loadingAction || !draft.moveStatus}
                    onClick={() => draft.moveStatus && onMoveStatus(booking.id, draft.moveStatus)}
                  >
                    Move
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={loadingAction}
                    onClick={() => onMoveStatus(booking.id, "cancelled")}
                  >
                    Cancel booking
                  </Button>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-sm font-semibold text-slate-900">Status timeline</h3>
                <ul className="mt-2 max-h-60 space-y-1 overflow-y-auto pr-1 text-sm text-slate-600">
                  {events.map((event) => (
                    <li key={event.id} className="rounded-xl border border-slate-200 px-2 py-1">
                      {eventLabel(event)} ({new Date(event.createdAt).toLocaleString()})
                    </li>
                  ))}
                  {events.length === 0 ? <li className="text-xs text-slate-500">No events yet.</li> : null}
                </ul>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
