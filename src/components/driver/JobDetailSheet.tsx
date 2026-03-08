"use client";

import { Clock3, Mail, MapPinned, Phone, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PodUploader } from "./PodUploader";
import { StatusActionBar } from "./StatusActionBar";
import type { DriverJob, DriverStatus } from "./types";

function statusLabel(status: string) {
  if (status === "driver_en_route") return "En Route";
  if (status === "picked_up") return "Picked Up";
  return status.replaceAll("_", " ");
}

function windowLabel(start: string | null, end: string | null) {
  if (!start || !end) return "Time TBD";
  return `${new Date(start).toLocaleString()} - ${new Date(end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export function JobDetailSheet({
  open,
  job,
  onClose,
  loadingStatus,
  onNextStatus,
  onRefresh,
  onNavigatePickup,
  onNavigateDropoff,
  onCall,
  onCopyAddress
}: {
  open: boolean;
  job: DriverJob | null;
  onClose: () => void;
  loadingStatus: boolean;
  onNextStatus: (to: DriverStatus) => void;
  onRefresh: () => Promise<void> | void;
  onNavigatePickup: () => void;
  onNavigateDropoff: () => void;
  onCall: () => void;
  onCopyAddress: () => void;
}) {
  const canUploadPod = Boolean(job && (job.booking.status === "delivered" || job.booking.status === "completed"));

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="responsive">
        {!job ? null : (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                {job.booking.publicId} <Badge className="border-slate-200 bg-slate-50 text-slate-700">{statusLabel(job.booking.status)}</Badge>
              </SheetTitle>
              <SheetDescription>Fast dispatch actions for this job.</SheetDescription>
            </SheetHeader>

            <div className="space-y-3 pb-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <p className="inline-flex items-center gap-1.5">
                  <Clock3 className="h-4 w-4 text-sky-700" /> {windowLabel(job.booking.scheduledWindowStart, job.booking.scheduledWindowEnd)}
                </p>
                <p className="mt-1 inline-flex items-start gap-1.5">
                  <MapPinned className="mt-0.5 h-4 w-4 text-sky-700" />
                  {job.booking.pickupText} {"->"} {job.booking.dropoffText}
                </p>
                <p className="mt-1 inline-flex items-center gap-1.5">
                  <Mail className="h-4 w-4 text-sky-700" /> {job.booking.contactEmail || "No email"}
                </p>
                <p className="mt-1 inline-flex items-center gap-1.5">
                  <Phone className="h-4 w-4 text-sky-700" /> {job.booking.contactPhone || "No phone"}
                </p>
                <p className="mt-1 inline-flex items-center gap-1.5">
                  <UserRound className="h-4 w-4 text-sky-700" /> {job.booking.staffRequired || 1} staff
                </p>
              </div>

              {job.booking.notes ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-xs uppercase tracking-[0.1em] text-slate-500">Notes</p>
                  <p className="mt-1 text-sm text-slate-700">{job.booking.notes}</p>
                </div>
              ) : null}

              <Separator />

              <div>
                <h3 className="text-sm font-semibold text-slate-900">Timeline</h3>
                <ul className="mt-2 space-y-1 text-sm text-slate-600">
                  {(job.booking.timeline || []).slice(0, 6).map((entry) => (
                    <li key={entry.id} className="rounded-xl border border-slate-200 px-2 py-1">
                      {entry.label} ({new Date(entry.timestamp).toLocaleString()})
                    </li>
                  ))}
                  {(job.booking.timeline || []).length === 0 ? <li className="text-xs text-slate-500">No timeline entries yet.</li> : null}
                </ul>
              </div>

              {canUploadPod ? (
                <PodUploader bookingId={job.booking.id} disabled={loadingStatus} onPersisted={onRefresh} />
              ) : (
                <p className="text-xs text-slate-500">POD upload appears after delivered status.</p>
              )}
            </div>

            <StatusActionBar
              status={job.booking.status}
              loading={loadingStatus}
              onNextStatus={onNextStatus}
              onNavigatePickup={onNavigatePickup}
              onNavigateDropoff={onNavigateDropoff}
              onCall={onCall}
              onCopy={onCopyAddress}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
