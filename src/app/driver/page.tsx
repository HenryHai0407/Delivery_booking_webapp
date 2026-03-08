"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, WifiOff } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { DriverHeader } from "@/components/driver/DriverHeader";
import { DriverTabs } from "@/components/driver/DriverTabs";
import { NextJobCard } from "@/components/driver/NextJobCard";
import { JobCard } from "@/components/driver/JobCard";
import { JobDetailSheet } from "@/components/driver/JobDetailSheet";
import type { DriverJob, DriverStatus, DriverTabKey } from "@/components/driver/types";
import { enqueueStatusUpdate, flushStatusQueue, queueLength } from "@/lib/driver/offlineQueue";

type Toast = { id: string; kind: "success" | "error"; message: string };

function newKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isRetryableNetworkError(message: string) {
  const m = message.toLowerCase();
  return m.includes("network") || m.includes("fetch") || m.includes("offline") || m.includes("timeout");
}

export default function DriverPage() {
  const [jobs, setJobs] = useState<DriverJob[]>([]);
  const [tab, setTab] = useState<DriverTabKey>("today");
  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState(false);
  const [online, setOnline] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [queuedCount, setQueuedCount] = useState(0);

  const redirectToLogin = useCallback(() => {
    const callbackUrl = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/login?callbackUrl=${callbackUrl}`;
  }, []);

  const sessionHeartbeat = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session-check", { cache: "no-store" });
      if (response.status === 401) {
        redirectToLogin();
        return;
      }
      const payload = (await response.json().catch(() => null)) as { authenticated?: boolean; role?: string } | null;
      if (!response.ok || !payload?.authenticated || payload.role !== "driver") {
        redirectToLogin();
      }
    } catch {
      // Ignore transient network issues in heartbeat.
    }
  }, [redirectToLogin]);

  const pushToast = useCallback((kind: Toast["kind"], message: string) => {
    const id = newKey();
    setToasts((current) => [...current, { id, kind, message }]);
    setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/driver/jobs?date=today");
      if (response.status === 401 || response.status === 403) {
        redirectToLogin();
        return;
      }
      const payload = (await response.json()) as DriverJob[] | { error?: string };
      if (!response.ok || !Array.isArray(payload)) {
        throw new Error((payload as { error?: string }).error || "Failed to load jobs.");
      }
      setJobs(payload);
    } catch (err) {
      pushToast("error", (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [pushToast, redirectToLogin]);

  const sendStatus = useCallback(
    async (bookingId: string, toStatus: DriverStatus, idempotencyKey: string) => {
      const response = await fetch(`/api/driver/jobs/${bookingId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: toStatus, idempotencyKey })
      });
      if (response.status === 401 || response.status === 403) {
        redirectToLogin();
        throw new Error("Session expired. Redirecting to login.");
      }
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Failed to update status.");
      return payload;
    },
    [redirectToLogin]
  );

  const flushQueueNow = useCallback(async () => {
    if (!online) return;
    const result = await flushStatusQueue(async (item) => {
      try {
        await sendStatus(item.bookingId, item.toStatus as DriverStatus, item.idempotencyKey);
        return { ok: true, retryable: false };
      } catch (err) {
        const message = (err as Error).message;
        return { ok: false, retryable: isRetryableNetworkError(message), error: message };
      }
    });
    setQueuedCount(queueLength());
    if (result.sent > 0) {
      pushToast("success", `Synced ${result.sent} queued status update(s).`);
      await loadJobs();
    }
    if (result.failed > 0 && result.lastError) {
      pushToast("error", result.lastError);
    }
  }, [loadJobs, online, pushToast, sendStatus]);

  useEffect(() => {
    const syncOnline = () => setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    syncOnline();
    setQueuedCount(queueLength());
    window.addEventListener("online", syncOnline);
    window.addEventListener("offline", syncOnline);
    return () => {
      window.removeEventListener("online", syncOnline);
      window.removeEventListener("offline", syncOnline);
    };
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    if (!online) return;
    void flushQueueNow();
  }, [online, flushQueueNow]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void sessionHeartbeat();
    }, 60_000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") void sessionHeartbeat();
    };
    window.addEventListener("focus", onVisibility);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onVisibility);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [sessionHeartbeat]);

  const sorted = useMemo(() => {
    return [...jobs].sort((a, b) => {
      const aTime = a.booking.scheduledWindowStart ? new Date(a.booking.scheduledWindowStart).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.booking.scheduledWindowStart ? new Date(b.booking.scheduledWindowStart).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });
  }, [jobs]);

  const nextJob = useMemo(
    () => sorted.find((j) => !["completed", "cancelled"].includes(j.booking.status)) || null,
    [sorted]
  );

  const counts = useMemo(() => {
    const now = Date.now();
    return {
      today: jobs.filter((j) => j.booking.status !== "cancelled").length,
      upcoming: jobs.filter((j) => {
        const start = j.booking.scheduledWindowStart ? new Date(j.booking.scheduledWindowStart).getTime() : now + 1;
        return !["completed", "cancelled", "delivered"].includes(j.booking.status) && start >= now;
      }).length,
      completed: jobs.filter((j) => ["completed", "delivered"].includes(j.booking.status)).length
    };
  }, [jobs]);

  const visibleJobs = useMemo(() => {
    if (tab === "completed") return sorted.filter((j) => ["completed", "delivered"].includes(j.booking.status));
    if (tab === "upcoming") {
      const now = Date.now();
      return sorted.filter((j) => {
        const start = j.booking.scheduledWindowStart ? new Date(j.booking.scheduledWindowStart).getTime() : now + 1;
        return !["completed", "cancelled", "delivered"].includes(j.booking.status) && start >= now;
      });
    }
    return sorted.filter((j) => j.booking.status !== "cancelled");
  }, [sorted, tab]);

  const selectedJob = useMemo(() => jobs.find((j) => j.booking.id === selectedJobId) || null, [jobs, selectedJobId]);

  async function updateStatusOptimistic(job: DriverJob, toStatus: DriverStatus) {
    if (toStatus === "completed" && !job.booking.pod?.photos?.length) {
      pushToast("error", "Upload POD photo before completing this job.");
      return;
    }
    if (toStatus === "completed") {
      const ok = window.confirm("Complete this job now? This action is final for drivers.");
      if (!ok) return;
    }

    const snapshot = jobs;
    setJobs((current) => current.map((j) => (j.booking.id === job.booking.id ? { ...j, booking: { ...j.booking, status: toStatus } } : j)));
    setLoadingAction(true);
    const idempotencyKey = newKey();

    try {
      if (!online) throw new Error("offline");
      await sendStatus(job.booking.id, toStatus, idempotencyKey);
      pushToast("success", `Status updated to ${toStatus.replaceAll("_", " ")}.`);
      await loadJobs();
    } catch (err) {
      const message = (err as Error).message;
      if (message === "offline" || isRetryableNetworkError(message)) {
        enqueueStatusUpdate({ bookingId: job.booking.id, toStatus, idempotencyKey });
        setQueuedCount(queueLength());
        pushToast("success", "You are offline. Update queued and will sync automatically.");
      } else {
        setJobs(snapshot);
        pushToast("error", message);
      }
    } finally {
      setLoadingAction(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-3 py-4 pb-24 md:px-6 md:py-6">
      <DriverHeader online={online} onRefresh={() => void loadJobs()} refreshing={loading} />

      {!online ? (
        <Alert className="border-rose-200 bg-rose-50 text-rose-900">
          <AlertTitle className="inline-flex items-center gap-1">
            <WifiOff className="h-4 w-4" /> Offline mode
          </AlertTitle>
          <AlertDescription>Status updates will queue and sync when connection is restored.</AlertDescription>
        </Alert>
      ) : null}

      {queuedCount > 0 ? (
        <Alert className="border-sky-200 bg-sky-50 text-sky-900">
          <AlertTitle>{queuedCount} pending sync item(s)</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>Queued updates will retry automatically while online.</span>
            <button className="text-xs font-semibold underline underline-offset-2" onClick={() => void flushQueueNow()}>
              Retry now
            </button>
          </AlertDescription>
        </Alert>
      ) : null}

      <DriverTabs value={tab} onChange={setTab} counts={counts} />
      <NextJobCard job={nextJob} onOpen={(job) => setSelectedJobId(job.booking.id)} />

      <section className="space-y-2">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : null}
        {!loading && visibleJobs.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center text-sm text-slate-600">
            No jobs in this tab. You&apos;re clear for now.
          </div>
        ) : null}
        {!loading
          ? visibleJobs.map((job) => <JobCard key={job.id} job={job} onOpen={(next) => setSelectedJobId(next.booking.id)} />)
          : null}
      </section>

      <JobDetailSheet
        open={Boolean(selectedJob)}
        job={selectedJob}
        onClose={() => setSelectedJobId(null)}
        loadingStatus={loadingAction}
        onNextStatus={(toStatus) => selectedJob && void updateStatusOptimistic(selectedJob, toStatus)}
        onRefresh={loadJobs}
        onNavigatePickup={() => {
          if (!selectedJob) return;
          const query = encodeURIComponent(selectedJob.booking.pickupText);
          window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank", "noopener,noreferrer");
        }}
        onNavigateDropoff={() => {
          if (!selectedJob) return;
          const query = encodeURIComponent(selectedJob.booking.dropoffText);
          window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank", "noopener,noreferrer");
        }}
        onCall={() => {
          if (!selectedJob?.booking.contactPhone) {
            pushToast("error", "No phone number available for this booking.");
            return;
          }
          window.location.href = `tel:${selectedJob.booking.contactPhone}`;
        }}
        onCopyAddress={async () => {
          if (!selectedJob) return;
          const text = `${selectedJob.booking.pickupText} -> ${selectedJob.booking.dropoffText}`;
          await navigator.clipboard.writeText(text);
          pushToast("success", "Route copied to clipboard.");
        }}
      />

      <div className="fixed right-3 top-3 z-[80] space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`min-w-[260px] rounded-2xl border px-3 py-2 text-sm shadow-lg ${
              toast.kind === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-900"
            }`}
          >
            <p className="inline-flex items-center gap-1.5">
              {toast.kind === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              {toast.message}
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
