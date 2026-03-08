import { Mail, CalendarClock, RouteIcon, Users, ListChecks } from "lucide-react";
import type { SummaryProps } from "./types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

function displayDate(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

export function BookingSummarySidebar({ values, routeEstimate, plannedEnd, onEditStep }: SummaryProps) {
  return (
    <aside className="space-y-4 lg:sticky lg:top-6">
      <Card>
        <CardHeader>
          <CardTitle>Your request summary</CardTitle>
          <CardDescription>Live preview while you complete the steps.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-slate-900">
                <Mail className="h-4 w-4 text-slate-500" /> {values.contactEmail || "-"}
              </p>
              {onEditStep ? (
                <button className="text-xs text-slate-500 hover:text-slate-700" onClick={() => onEditStep(1)}>
                  Edit
                </button>
              ) : null}
            </div>
            <p className="flex items-center gap-2 text-slate-900">
              <CalendarClock className="h-4 w-4 text-slate-500" /> {displayDate(values.requestedWindowStart)}
            </p>
            <p className="text-xs text-slate-500">Planned end (estimate): {plannedEnd ? displayDate(plannedEnd) : "-"}</p>
          </div>

          <Separator />

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-slate-900">
                <RouteIcon className="h-4 w-4 text-slate-500" /> Route
              </p>
              {onEditStep ? (
                <button className="text-xs text-slate-500 hover:text-slate-700" onClick={() => onEditStep(2)}>
                  Edit
                </button>
              ) : null}
            </div>
            <p className="text-slate-600">{values.pickupText || "Pickup not set"}</p>
            <p className="text-slate-600">{values.dropoffText || "Dropoff not set"}</p>
            {routeEstimate ? (
              <p className="text-xs text-slate-500">
                ETA {routeEstimate.etaMinutes} min, {routeEstimate.distanceKm.toFixed(1)} km, EUR {routeEstimate.lowEur} - EUR {routeEstimate.highEur}
              </p>
            ) : (
              <p className="text-xs text-slate-500">Route estimate appears after Step 2 addresses are filled.</p>
            )}
          </div>

          <Separator />

          <div className="space-y-1 text-sm text-slate-900">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-500" /> {values.staffRequired || "-"} staff
              </p>
              {onEditStep ? (
                <button className="text-xs text-slate-500 hover:text-slate-700" onClick={() => onEditStep(3)}>
                  Edit
                </button>
              ) : null}
            </div>
            <p className="text-xs text-slate-600">{values.notes?.trim() ? values.notes : "No notes yet"}</p>
          </div>
        </CardContent>
      </Card>

      <Alert>
        <AlertTitle>Estimated only</AlertTitle>
        <AlertDescription>Final quote and exact schedule are confirmed by admin after review.</AlertDescription>
      </Alert>

      <Card className="border-slate-200/80 shadow-none">
        <CardContent className="pt-6">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <ListChecks className="h-4 w-4 text-slate-500" /> Timeline
          </p>
          <ol className="mt-2 space-y-1 text-sm text-slate-600">
            <li>1. Request sent</li>
            <li>2. We confirm</li>
            <li>3. Job scheduled</li>
          </ol>
        </CardContent>
      </Card>
    </aside>
  );
}
