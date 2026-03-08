"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Sparkles } from "lucide-react";
import { KpiHeader } from "@/components/admin/KpiHeader";
import { FiltersBar } from "@/components/admin/FiltersBar";
import { BookingsKanban } from "@/components/admin/BookingsKanban";
import { BookingDetailDrawer } from "@/components/admin/BookingDetailDrawer";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdminBooking, AdminStats, BookingStatus, DriverOption } from "@/components/admin/types";

type ToastMessage = { id: string; kind: "success" | "error"; message: string };
type AdminPreset = "today" | "needs_assignment" | "at_risk";

const ADMIN_PRESET_KEY = "admin_filters_preset_v1";

const STATUSES: BookingStatus[] = [
  "requested",
  "confirmed",
  "scheduled",
  "assigned",
  "driver_en_route",
  "picked_up",
  "delivered",
  "completed",
  "cancelled"
];

function newKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

function plusDaysISODate(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function presetFilters(preset: AdminPreset) {
  if (preset === "today") {
    return {
      from: todayISODate(),
      to: plusDaysISODate(1),
      status: "",
      q: "",
      driverId: "",
      includeCancelled: false,
      unassignedOnly: false,
      missingPodOnly: false
    };
  }
  if (preset === "needs_assignment") {
    return {
      from: todayISODate(),
      to: plusDaysISODate(7),
      status: "scheduled",
      q: "",
      driverId: "",
      includeCancelled: false,
      unassignedOnly: true,
      missingPodOnly: false
    };
  }
  return {
    from: todayISODate(),
    to: plusDaysISODate(7),
    status: "delivered",
    q: "",
    driverId: "",
    includeCancelled: false,
    unassignedOnly: false,
    missingPodOnly: true
  };
}

export default function AdminPage() {
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [stats, setStats] = useState<AdminStats>({
    todayBookings: 0,
    pendingConfirmations: 0,
    inProgress: 0,
    completedToday: 0
  });
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState(false);
  const [filtersDraft, setFiltersDraft] = useState({
    from: todayISODate(),
    to: plusDaysISODate(7),
    status: "",
    q: "",
    driverId: "",
    includeCancelled: false,
    unassignedOnly: false,
    missingPodOnly: false
  });
  const [filtersApplied, setFiltersApplied] = useState(filtersDraft);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

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
      if (!response.ok || !payload?.authenticated || payload.role !== "admin") {
        redirectToLogin();
      }
    } catch {
      // Ignore transient network issues in heartbeat.
    }
  }, [redirectToLogin]);

  const pushToast = useCallback((kind: ToastMessage["kind"], message: string) => {
    const id = newKey();
    setToasts((current) => [...current, { id, kind, message }]);
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3500);
  }, []);

  const applyPreset = useCallback((preset: AdminPreset) => {
    const next = presetFilters(preset);
    setFiltersDraft(next);
    setFiltersApplied(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ADMIN_PRESET_KEY, preset);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const bookingParams = new URLSearchParams({
        page: "1",
        pageSize: "200",
        from: filtersApplied.from,
        to: filtersApplied.to
      });
      if (filtersApplied.status) bookingParams.set("status", filtersApplied.status);
      if (filtersApplied.q) bookingParams.set("q", filtersApplied.q.trim());
      if (filtersApplied.driverId) bookingParams.set("driver_id", filtersApplied.driverId);
      if (filtersApplied.unassignedOnly) bookingParams.set("unassignedOnly", "true");
      if (filtersApplied.missingPodOnly) bookingParams.set("missingPodOnly", "true");

      const [bookingRes, driverRes, statsRes] = await Promise.all([
        fetch(`/api/admin/bookings?${bookingParams.toString()}`),
        fetch("/api/admin/drivers"),
        fetch("/api/admin/stats")
      ]);

      if ([bookingRes.status, driverRes.status, statsRes.status].some((status) => status === 401 || status === 403)) {
        redirectToLogin();
        return;
      }

      const bookingPayload = (await bookingRes.json()) as { data?: AdminBooking[]; error?: string };
      const driverPayload = (await driverRes.json()) as { data?: DriverOption[]; error?: string };
      const statsPayload = (await statsRes.json()) as AdminStats & { error?: string };

      if (!bookingRes.ok) throw new Error(bookingPayload.error || "Failed to load bookings");
      if (!driverRes.ok) throw new Error(driverPayload.error || "Failed to load drivers");
      if (!statsRes.ok) throw new Error(statsPayload.error || "Failed to load KPI stats");

      setBookings(bookingPayload.data || []);
      setDrivers(driverPayload.data || []);
      setStats({
        todayBookings: statsPayload.todayBookings,
        pendingConfirmations: statsPayload.pendingConfirmations,
        inProgress: statsPayload.inProgress,
        completedToday: statsPayload.completedToday
      });
    } catch (error) {
      pushToast("error", (error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [filtersApplied, pushToast, redirectToLogin]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(ADMIN_PRESET_KEY);
    if (raw === "today" || raw === "needs_assignment" || raw === "at_risk") {
      applyPreset(raw);
    }
  }, [applyPreset]);

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

  const selectedBooking = useMemo(
    () => bookings.find((booking) => booking.id === selectedBookingId) || null,
    [bookings, selectedBookingId]
  );

  const visibleBookings = useMemo(
    () => (filtersApplied.includeCancelled ? bookings : bookings.filter((booking) => booking.status !== "cancelled")),
    [bookings, filtersApplied.includeCancelled]
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTypingField = tag === "input" || tag === "textarea" || target?.isContentEditable;

      if (event.key === "/" && !isTypingField) {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (event.key === "j" || event.key === "k") {
        if (isTypingField) return;
        event.preventDefault();
        if (visibleBookings.length === 0) return;
        const currentIndex = visibleBookings.findIndex((b) => b.id === selectedBookingId);
        const delta = event.key === "j" ? 1 : -1;
        const nextIndex = currentIndex < 0 ? 0 : (currentIndex + delta + visibleBookings.length) % visibleBookings.length;
        setSelectedBookingId(visibleBookings[nextIndex].id);
        return;
      }

      if (event.key === "e") {
        if (isTypingField) return;
        event.preventDefault();
        if (selectedBookingId) return;
        if (visibleBookings[0]) setSelectedBookingId(visibleBookings[0].id);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedBookingId, visibleBookings]);

  const optimisticUpdate = useCallback(
    async (mutateLocal: () => void, request: () => Promise<Response>, successMsg: string) => {
      const snapshot = bookings;
      mutateLocal();
      setLoadingAction(true);
      try {
        const response = await request();
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        if (!response.ok) throw new Error(payload?.error || "Update failed");
        pushToast("success", successMsg);
      } catch (error) {
        setBookings(snapshot);
        pushToast("error", (error as Error).message);
      } finally {
        setLoadingAction(false);
      }
    },
    [bookings, pushToast]
  );

  async function moveStatus(bookingId: string, status: BookingStatus) {
    const booking = bookings.find((item) => item.id === bookingId);
    if (status === "cancelled") {
      const ok = window.confirm(`Cancel booking ${booking?.publicId || bookingId}?`);
      if (!ok) return;
    }
    if (status === "completed") {
      const ok = window.confirm(`Mark booking ${booking?.publicId || bookingId} as completed?`);
      if (!ok) return;
    }
    if (status === "completed" && booking && !booking.latestPodPhotoUrl) {
      pushToast("error", "Cannot complete booking without POD photo.");
      return;
    }

    await optimisticUpdate(
      () => {
        setBookings((current) => current.map((booking) => (booking.id === bookingId ? { ...booking, status } : booking)));
      },
      () =>
        fetch(`/api/admin/bookings/${bookingId}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, idempotencyKey: newKey() })
        }),
      `Status updated to ${status.replaceAll("_", " ")}`
    );
    await loadData();
  }

  async function assignDriver(bookingId: string, driverId: string) {
    await optimisticUpdate(
      () => {
        setBookings((current) =>
          current.map((booking) => (booking.id === bookingId ? { ...booking, driverIds: [driverId], status: "assigned" } : booking))
        );
      },
      () =>
        fetch(`/api/admin/bookings/${bookingId}/assign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ driverId })
        }),
      "Driver assigned"
    );
    await loadData();
  }

  async function saveDetails(args: {
    bookingId: string;
    scheduledWindowStart: string;
    scheduledWindowEnd: string;
    quoteAmountCents: string;
    finalAmountCents: string;
    notes: string;
  }) {
    setLoadingAction(true);
    try {
      const response = await fetch(`/api/admin/bookings/${args.bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledWindowStart: args.scheduledWindowStart ? new Date(args.scheduledWindowStart).toISOString() : null,
          scheduledWindowEnd: args.scheduledWindowEnd ? new Date(args.scheduledWindowEnd).toISOString() : null,
          quoteAmountCents: args.quoteAmountCents ? Number(args.quoteAmountCents) : null,
          finalAmountCents: args.finalAmountCents ? Number(args.finalAmountCents) : null,
          notes: args.notes || null
        })
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Failed to save details");
      pushToast("success", "Booking details saved");
      await loadData();
    } catch (error) {
      pushToast("error", (error as Error).message);
    } finally {
      setLoadingAction(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200/80 bg-gradient-to-r from-slate-900 via-sky-900 to-indigo-900 p-5 text-white">
        <p className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.12em] text-sky-200">
          <Sparkles className="h-3.5 w-3.5" /> Dispatch Center
        </p>
        <h1 className="mt-1 text-2xl font-semibold md:text-3xl">Admin Kanban Dashboard</h1>
        <p className="mt-1 text-sm text-sky-100/90">Review requests, dispatch drivers, and move jobs through execution with minimal clicks.</p>
      </section>

      <KpiHeader stats={stats} />

      <FiltersBar
        value={filtersDraft}
        statuses={STATUSES}
        drivers={drivers}
        searchInputRef={searchInputRef}
        onChange={setFiltersDraft}
        onApply={() => setFiltersApplied(filtersDraft)}
        onReset={() => {
          const reset = {
            from: todayISODate(),
            to: plusDaysISODate(7),
            status: "",
            q: "",
            driverId: "",
            includeCancelled: false,
            unassignedOnly: false,
            missingPodOnly: false
          };
          setFiltersDraft(reset);
          setFiltersApplied(reset);
          if (typeof window !== "undefined") {
            window.localStorage.removeItem(ADMIN_PRESET_KEY);
          }
        }}
        onPreset={applyPreset}
      />

      {loading ? (
        <section className="overflow-x-auto rounded-3xl border border-slate-200/80 bg-white/60 p-3">
          <div className="flex min-h-[50vh] gap-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="min-w-[280px] space-y-3 rounded-3xl border border-slate-200/80 bg-white/70 p-3">
                <Skeleton className="h-6 w-28" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {!loading ? (
        <BookingsKanban
          bookings={visibleBookings}
          includeCancelled={filtersApplied.includeCancelled}
          onOpenBooking={(booking) => setSelectedBookingId(booking.id)}
          onMoveBooking={(booking, status) => {
            if (booking.status !== status) void moveStatus(booking.id, status);
          }}
        />
      ) : null}

      <BookingDetailDrawer
        booking={selectedBooking}
        open={Boolean(selectedBooking)}
        onClose={() => setSelectedBookingId(null)}
        drivers={drivers}
        onSaveDetails={saveDetails}
        onAssignDriver={assignDriver}
        onMoveStatus={moveStatus}
        loadingAction={loadingAction}
      />

      <div className="fixed right-3 top-3 z-[70] space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`min-w-[280px] rounded-2xl border px-3 py-2 text-sm shadow-lg ${
              toast.kind === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-rose-200 bg-rose-50 text-rose-800"
            }`}
          >
            <p className="inline-flex items-center gap-1.5">
              {toast.kind === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              {toast.message}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
