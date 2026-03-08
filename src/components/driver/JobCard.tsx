import { AlertTriangle, ArrowRight, Box, Clock3, GlassWater, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { DriverJob } from "./types";

function statusLabel(status: string) {
  if (status === "driver_en_route") return "En Route";
  if (status === "picked_up") return "Picked Up";
  return status.replaceAll("_", " ");
}

function windowLabel(start: string | null, end: string | null) {
  if (!start || !end) return "Time TBD";
  return `${new Date(start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${new Date(end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function short(text: string, max = 28) {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

export function JobCard({ job, onOpen }: { job: DriverJob; onOpen: (job: DriverJob) => void }) {
  const flags = job.booking.riskFlags || { fragile: false, stairs: false, urgent: false };
  return (
    <button type="button" className="w-full text-left" onClick={() => onOpen(job)} aria-label={`Open ${job.booking.publicId}`}>
      <Card className="border-slate-200/80 bg-white/95 transition hover:shadow-md">
        <CardContent className="space-y-2 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-slate-900">{job.booking.publicId}</p>
            <Badge className="border-slate-200 bg-slate-50 text-slate-700">{statusLabel(job.booking.status)}</Badge>
          </div>
          <p className="inline-flex items-center gap-1 text-sm text-slate-600">
            <Clock3 className="h-4 w-4 text-sky-700" /> {windowLabel(job.booking.scheduledWindowStart, job.booking.scheduledWindowEnd)}
          </p>
          <p className="text-sm text-slate-700">
            {short(job.booking.pickupText)} <ArrowRight className="inline h-3.5 w-3.5" /> {short(job.booking.dropoffText)}
          </p>
          <div className="flex items-center justify-between">
            <p className="inline-flex items-center gap-1 text-xs text-slate-600">
              <UserRound className="h-3.5 w-3.5" /> {job.booking.staffRequired || 1} staff
            </p>
            <div className="inline-flex items-center gap-1 text-slate-400">
              <span title="Urgent flag">
                <AlertTriangle className={`h-4 w-4 ${flags.urgent ? "text-rose-500" : ""}`} />
              </span>
              <span title="Fragile flag">
                <GlassWater className={`h-4 w-4 ${flags.fragile ? "text-amber-500" : ""}`} />
              </span>
              <span title="Stairs flag">
                <Box className={`h-4 w-4 ${flags.stairs ? "text-indigo-500" : ""}`} />
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

