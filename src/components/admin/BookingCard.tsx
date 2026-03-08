import { AlertTriangle, Box, GlassWater, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { shortRoute, toCurrency, routeRiskFlags } from "./helpers";
import { STATUS_TRANSITIONS, statusLabel } from "./constants";
import type { AdminBooking, BookingStatus } from "./types";

export function BookingCard({
  booking,
  onOpen,
  onMove
}: {
  booking: AdminBooking;
  onOpen: () => void;
  onMove: (to: BookingStatus) => void;
}) {
  const risks = routeRiskFlags(booking);
  const canMove = STATUS_TRANSITIONS[booking.status];
  const displayTime = booking.scheduledWindowStart || booking.requestedWindowStart;
  const needsDriver = ["scheduled", "assigned", "driver_en_route", "picked_up", "delivered"].includes(booking.status);
  const missingDriver = needsDriver && (!booking.driverIds || booking.driverIds.length === 0);
  const missingQuote = booking.quoteAmountCents == null;

  return (
    <Card className="cursor-pointer border-slate-200/80 bg-white/95 transition hover:-translate-y-0.5 hover:shadow-lg">
      <CardContent className="space-y-3 pt-4">
        <button className="w-full text-left" onClick={onOpen} aria-label={`Open booking ${booking.publicId}`}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">{booking.contactEmail || booking.publicId}</p>
            <Badge className="border-slate-200 bg-slate-50 text-slate-700">{statusLabel(booking.status)}</Badge>
          </div>
          <p className="mt-1 text-xs text-slate-500">{new Date(displayTime).toLocaleString()}</p>
          <p className="mt-2 text-sm text-slate-700">{shortRoute(booking.pickupText, booking.dropoffText)}</p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
            <p className="inline-flex items-center gap-1">
              <UserRound className="h-3.5 w-3.5" /> {booking.staffRequired || 1} staff
            </p>
            <p className="inline-flex items-center gap-1">
              <Box className="h-3.5 w-3.5" /> {toCurrency(booking.quoteAmountCents)}
            </p>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {missingDriver ? <Badge className="border-amber-200 bg-amber-50 text-amber-800">Unassigned</Badge> : null}
            {missingQuote ? <Badge className="border-slate-200 bg-slate-50 text-slate-700">Quote TBD</Badge> : null}
            {booking.notificationFailed ? <Badge className="border-rose-200 bg-rose-50 text-rose-700">Notify failed</Badge> : null}
          </div>
        </button>
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1 text-slate-400">
            <span title="Urgent flag">
              <AlertTriangle className={`h-4 w-4 ${risks.urgent ? "text-rose-500" : ""}`} />
            </span>
            <span title="Fragile flag">
              <GlassWater className={`h-4 w-4 ${risks.fragile ? "text-amber-500" : ""}`} />
            </span>
            <span title="Stairs flag">
              <Box className={`h-4 w-4 ${risks.stairs ? "text-indigo-500" : ""}`} />
            </span>
          </div>
          <Select
            aria-label={`Move booking ${booking.publicId}`}
            className="h-8 w-auto min-w-[130px] text-xs"
            value={booking.status}
            onChange={(e) => onMove(e.target.value as BookingStatus)}
          >
            <option value={booking.status}>Move to...</option>
            {canMove.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
