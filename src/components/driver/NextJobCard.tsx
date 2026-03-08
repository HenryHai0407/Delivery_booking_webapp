import { ArrowRight, Clock3, MapPinned } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

export function NextJobCard({ job, onOpen }: { job: DriverJob | null; onOpen: (job: DriverJob) => void }) {
  if (!job) return null;
  return (
    <Card className="overflow-hidden border-slate-200/70 bg-gradient-to-br from-white via-sky-50/80 to-indigo-50/70">
      <CardContent className="p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">Next Job</p>
        <div className="mt-2 flex items-start justify-between gap-2">
          <div>
            <p className="text-lg font-semibold text-slate-900">{job.booking.publicId}</p>
            <p className="mt-1 inline-flex items-center gap-1 text-sm text-slate-600">
              <Clock3 className="h-4 w-4" /> {windowLabel(job.booking.scheduledWindowStart, job.booking.scheduledWindowEnd)}
            </p>
            <p className="mt-2 inline-flex items-start gap-1 text-sm text-slate-700">
              <MapPinned className="mt-0.5 h-4 w-4 text-sky-700" />
              <span className="line-clamp-2">
                {job.booking.pickupText} <ArrowRight className="inline h-3.5 w-3.5" /> {job.booking.dropoffText}
              </span>
            </p>
          </div>
          <Badge className="border-sky-200 bg-sky-50 text-sky-800">{statusLabel(job.booking.status)}</Badge>
        </div>
        <Button className="mt-3 h-11 w-full" onClick={() => onOpen(job)}>
          Open Job
        </Button>
      </CardContent>
    </Card>
  );
}

