"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type BookingStatus =
  | "requested"
  | "confirmed"
  | "scheduled"
  | "assigned"
  | "driver_en_route"
  | "picked_up"
  | "delivered"
  | "completed"
  | "cancelled";

type Booking = {
  id: string;
  publicId: string;
  status: BookingStatus;
  pickupText: string;
  dropoffText: string;
  contactEmail?: string | null;
  scheduledWindowStart?: string | null;
  scheduledWindowEnd?: string | null;
  quoteAmountCents?: number | null;
  finalAmountCents?: number | null;
  notes?: string | null;
  customerEstimate?: {
    low: number;
    high: number;
    currency: string;
  } | null;
  latestPodPhotoUrl?: string | null;
  notificationFailed?: boolean;
  notificationFailureReason?: string | null;
  createdAt: string;
};

type BookingEvent = {
  id: string;
  eventType: string;
  payloadJson: string;
  createdAt: string;
  actorUserId?: string | null;
};

type AdminStats = {
  todayBookings: number;
  pendingConfirmations: number;
  inProgress: number;
  completedToday: number;
  alerts?: {
    overdueRequests: number;
    unassignedToday: number;
    startingSoon: number;
    missingPodCompleted: number;
  };
  pricingTrend?: Array<{
    day: string;
    samples: number;
    averageDeltaPct: number;
    onTargetPct: number;
  }>;
  scheduleConfig?: {
    slotCapacity: number;
    workdayStartHour: number;
    workdayEndHour: number;
    timezone: string;
  };
  todayBoard?: Array<{
    hour: string;
    total: number;
    unassigned: number;
    startingSoon: number;
  }>;
};

type EstimateDeltaFilter = "all" | "over" | "under" | "on_target";
type AppliedFilters = {
  status: string;
  publicId: string;
  dateFrom: string;
  dateTo: string;
  scheduledFrom: string;
  scheduledTo: string;
  unassignedOnly: boolean;
  missingPodOnly: boolean;
};

const statuses: BookingStatus[] = [
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

function localDateTimeToIso(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function summarizeEvent(event: BookingEvent) {
  try {
    const payload = JSON.parse(event.payloadJson) as Record<string, unknown>;
    if (event.eventType === "status_change") {
      const from = typeof payload.from === "string" ? payload.from : null;
      const to = typeof payload.to === "string" ? payload.to : "updated";
      return from ? `${from} -> ${to}` : `to ${to}`;
    }
    if (event.eventType === "assignment") {
      const driverId = typeof payload.driverId === "string" ? payload.driverId : "unknown";
      return `driver ${driverId}`;
    }
    if (event.eventType === "message_sent") {
      const kind = typeof payload.kind === "string" ? payload.kind : "notification";
      const sent = payload.sent === true ? "sent" : "not_sent";
      return `${kind} (${sent})`;
    }
    if (event.eventType === "pod_uploaded") {
      return "pod uploaded";
    }
    if (event.eventType === "note_added") {
      const kind = typeof payload.kind === "string" ? payload.kind : "";
      if (kind === "customer_estimate") {
        const low = typeof payload.low === "number" ? payload.low : null;
        const high = typeof payload.high === "number" ? payload.high : null;
        if (low != null && high != null) return `customer estimate EUR ${low}-${high}`;
      }
      if (kind === "customer_requirements") {
        const staffRequired = typeof payload.staffRequired === "number" ? payload.staffRequired : null;
        if (staffRequired != null) return `staff required: ${staffRequired}`;
      }
      if (payload.notesUpdated === true) return "notes updated";
    }
  } catch {
    return "";
  }
  return "";
}

function getEstimateDelta(booking: Booking): { roundedPct: number; trend: "higher" | "lower" | "on target"; color: string } | null {
  if (booking.finalAmountCents == null || !booking.customerEstimate) return null;
  const finalEur = booking.finalAmountCents / 100;
  const estimateMid = (booking.customerEstimate.low + booking.customerEstimate.high) / 2;
  if (estimateMid <= 0) return null;
  const deltaPct = ((finalEur - estimateMid) / estimateMid) * 100;
  const rounded = Math.round(deltaPct);
  const trend = rounded > 0 ? "higher" : rounded < 0 ? "lower" : "on target";
  const color = rounded > 10 ? "#b91c1c" : rounded < -10 ? "#166534" : "#92400e";
  return { roundedPct: rounded, trend, color };
}

function estimateDeltaBadge(booking: Booking) {
  const delta = getEstimateDelta(booking);
  if (!delta) return null;
  return (
    <p className="small" style={{ color: delta.color }}>
      Final vs estimate: {delta.roundedPct > 0 ? "+" : ""}
      {delta.roundedPct}% ({delta.trend})
    </p>
  );
}

export function AdminConsole() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stats, setStats] = useState<AdminStats>({
    todayBookings: 0,
    pendingConfirmations: 0,
    inProgress: 0,
    completedToday: 0,
    alerts: {
      overdueRequests: 0,
      unassignedToday: 0,
      startingSoon: 0,
      missingPodCompleted: 0
    },
    pricingTrend: []
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterPublicId, setFilterPublicId] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterScheduledFrom, setFilterScheduledFrom] = useState("");
  const [filterScheduledTo, setFilterScheduledTo] = useState("");
  const [filterUnassignedOnly, setFilterUnassignedOnly] = useState(false);
  const [filterMissingPodOnly, setFilterMissingPodOnly] = useState(false);
  const [filterEstimateDelta, setFilterEstimateDelta] = useState<EstimateDeltaFilter>("all");
  const [appliedFilters, setAppliedFilters] = useState<AppliedFilters>({
    status: "",
    publicId: "",
    dateFrom: "",
    dateTo: "",
    scheduledFrom: "",
    scheduledTo: "",
    unassignedOnly: false,
    missingPodOnly: false
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [statusDrafts, setStatusDrafts] = useState<Record<string, BookingStatus>>({});
  const [driverDrafts, setDriverDrafts] = useState<Record<string, string>>({});
  const [scheduleStartDrafts, setScheduleStartDrafts] = useState<Record<string, string>>({});
  const [scheduleEndDrafts, setScheduleEndDrafts] = useState<Record<string, string>>({});
  const [quoteDrafts, setQuoteDrafts] = useState<Record<string, string>>({});
  const [finalDrafts, setFinalDrafts] = useState<Record<string, string>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [eventsByBooking, setEventsByBooking] = useState<Record<string, BookingEvent[]>>({});
  const [eventsLoadingId, setEventsLoadingId] = useState<string | null>(null);
  const [alertHint, setAlertHint] = useState<string | null>(null);
  const [podPreviewUrl, setPodPreviewUrl] = useState<string | null>(null);
  const [scheduleSettings, setScheduleSettings] = useState({
    slotCapacity: "3",
    workdayStartHour: "8",
    workdayEndHour: "20",
    timezone: "Europe/Helsinki"
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [scheduleValidationByBooking, setScheduleValidationByBooking] = useState<Record<string, string>>({});

  const loadStats = useCallback(async () => {
    const response = await fetch("/api/admin/stats");
    const payload = (await response.json()) as AdminStats & { error?: string };
    if (!response.ok) throw new Error(payload.error || "Failed to load stats");
    setStats({
      todayBookings: payload.todayBookings,
      pendingConfirmations: payload.pendingConfirmations,
      inProgress: payload.inProgress,
      completedToday: payload.completedToday,
      alerts: payload.alerts || {
        overdueRequests: 0,
        unassignedToday: 0,
        startingSoon: 0,
        missingPodCompleted: 0
      },
      pricingTrend: payload.pricingTrend || [],
      scheduleConfig: payload.scheduleConfig,
      todayBoard: payload.todayBoard || []
    });
    if (payload.scheduleConfig) {
      setScheduleSettings({
        slotCapacity: String(payload.scheduleConfig.slotCapacity),
        workdayStartHour: String(payload.scheduleConfig.workdayStartHour),
        workdayEndHour: String(payload.scheduleConfig.workdayEndHour),
        timezone: payload.scheduleConfig.timezone
      });
    }
  }, []);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (appliedFilters.status) params.set("status", appliedFilters.status);
      if (appliedFilters.publicId) params.set("publicId", appliedFilters.publicId);
      if (appliedFilters.dateFrom) params.set("dateFrom", new Date(appliedFilters.dateFrom).toISOString());
      if (appliedFilters.dateTo) params.set("dateTo", new Date(appliedFilters.dateTo).toISOString());
      if (appliedFilters.scheduledFrom) params.set("scheduledFrom", new Date(appliedFilters.scheduledFrom).toISOString());
      if (appliedFilters.scheduledTo) params.set("scheduledTo", new Date(appliedFilters.scheduledTo).toISOString());
      if (appliedFilters.unassignedOnly) params.set("unassignedOnly", "true");
      if (appliedFilters.missingPodOnly) params.set("missingPodOnly", "true");

      const response = await fetch(`/api/admin/bookings?${params.toString()}`);
      const payload = (await response.json()) as {
        data?: Booking[];
        error?: string;
        total?: number;
        page?: number;
        pageSize?: number;
      };
      if (!response.ok || !payload.data) {
        throw new Error(payload.error || "Failed to fetch bookings");
      }
      const bookingRows = payload.data;
      setBookings(bookingRows);
      setTotal(typeof payload.total === "number" ? payload.total : 0);
      setPage(typeof payload.page === "number" ? payload.page : page);
      setPageSize(typeof payload.pageSize === "number" ? payload.pageSize : pageSize);
      setStatusDrafts((current) => {
        const next = { ...current };
        bookingRows.forEach((booking) => {
          if (!next[booking.id]) next[booking.id] = booking.status;
        });
        return next;
      });
      setScheduleStartDrafts((current) => {
        const next = { ...current };
        bookingRows.forEach((booking) => {
          if (next[booking.id] == null) next[booking.id] = booking.scheduledWindowStart?.slice(0, 16) || "";
        });
        return next;
      });
      setScheduleEndDrafts((current) => {
        const next = { ...current };
        bookingRows.forEach((booking) => {
          if (next[booking.id] == null) next[booking.id] = booking.scheduledWindowEnd?.slice(0, 16) || "";
        });
        return next;
      });
      setQuoteDrafts((current) => {
        const next = { ...current };
        bookingRows.forEach((booking) => {
          if (next[booking.id] == null) next[booking.id] = booking.quoteAmountCents == null ? "" : String(booking.quoteAmountCents);
        });
        return next;
      });
      setFinalDrafts((current) => {
        const next = { ...current };
        bookingRows.forEach((booking) => {
          if (next[booking.id] == null) next[booking.id] = booking.finalAmountCents == null ? "" : String(booking.finalAmountCents);
        });
        return next;
      });
      setNoteDrafts((current) => {
        const next = { ...current };
        bookingRows.forEach((booking) => {
          if (next[booking.id] == null) next[booking.id] = booking.notes || "";
        });
        return next;
      });
      await loadStats();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [
    appliedFilters.dateFrom,
    appliedFilters.dateTo,
    appliedFilters.missingPodOnly,
    appliedFilters.publicId,
    appliedFilters.scheduledFrom,
    appliedFilters.scheduledTo,
    appliedFilters.status,
    appliedFilters.unassignedOnly,
    loadStats,
    page,
    pageSize
  ]);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  const rows = useMemo(() => {
    if (filterEstimateDelta === "all") return bookings;
    return bookings.filter((booking) => {
      const delta = getEstimateDelta(booking);
      if (!delta) return false;
      if (filterEstimateDelta === "over") return delta.roundedPct > 0;
      if (filterEstimateDelta === "under") return delta.roundedPct < 0;
      return delta.roundedPct === 0;
    });
  }, [bookings, filterEstimateDelta]);

  const pricingInsights = useMemo(() => {
    const deltas = bookings
      .map((booking) => getEstimateDelta(booking))
      .filter((delta): delta is NonNullable<ReturnType<typeof getEstimateDelta>> => delta != null);
    if (deltas.length === 0) {
      return {
        sampleSize: 0,
        onTargetPct: 0,
        averageDeltaPct: 0,
        overCount: 0,
        underCount: 0
      };
    }
    const onTargetCount = deltas.filter((d) => d.roundedPct === 0).length;
    const overCount = deltas.filter((d) => d.roundedPct > 0).length;
    const underCount = deltas.filter((d) => d.roundedPct < 0).length;
    const averageDeltaPct = Math.round(deltas.reduce((acc, d) => acc + d.roundedPct, 0) / deltas.length);
    const onTargetPct = Math.round((onTargetCount / deltas.length) * 100);
    return {
      sampleSize: deltas.length,
      onTargetPct,
      averageDeltaPct,
      overCount,
      underCount
    };
  }, [bookings]);

  async function updateStatus(booking: Booking) {
    const status = statusDrafts[booking.id] || booking.status;
    setUpdatingId(booking.id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/bookings/${booking.id}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status, idempotencyKey: newKey() })
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Status update failed");
      await loadBookings();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUpdatingId(null);
    }
  }

  async function assignDriver(bookingId: string) {
    const driverId = (driverDrafts[bookingId] || "").trim();
    if (!driverId) {
      setError("Driver ID is required for assignment.");
      return;
    }
    setUpdatingId(bookingId);
    setError(null);
    try {
      const response = await fetch(`/api/admin/bookings/${bookingId}/assign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ driverId })
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Assignment failed");
      await loadBookings();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUpdatingId(null);
    }
  }

  async function saveScheduleSettings() {
    setSavingSettings(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotCapacity: Number(scheduleSettings.slotCapacity),
          workdayStartHour: Number(scheduleSettings.workdayStartHour),
          workdayEndHour: Number(scheduleSettings.workdayEndHour),
          timezone: scheduleSettings.timezone.trim()
        })
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Failed to save schedule settings");
      await loadStats();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingSettings(false);
    }
  }

  async function saveBookingDetails(bookingId: string) {
    setUpdatingId(bookingId);
    setError(null);
    try {
      const startIso = localDateTimeToIso(scheduleStartDrafts[bookingId] || "");
      const endIso = localDateTimeToIso(scheduleEndDrafts[bookingId] || "");
      if (startIso && endIso) {
        const checkParams = new URLSearchParams({
          start: startIso,
          end: endIso,
          excludeBookingId: bookingId
        });
        const checkResponse = await fetch(`/api/admin/schedule/check?${checkParams.toString()}`);
        const checkPayload = (await checkResponse.json()) as { ok?: boolean; reason?: string; error?: string };
        if (!checkResponse.ok) throw new Error(checkPayload.error || "Failed to validate schedule window");
        if (!checkPayload.ok) {
          const reason = checkPayload.reason || "Schedule conflict";
          setScheduleValidationByBooking((current) => ({ ...current, [bookingId]: reason }));
          throw new Error(reason);
        }
        setScheduleValidationByBooking((current) => ({ ...current, [bookingId]: "" }));
      }

      const response = await fetch(`/api/admin/bookings/${bookingId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          scheduledWindowStart: startIso,
          scheduledWindowEnd: endIso,
          quoteAmountCents: quoteDrafts[bookingId] === "" ? null : Number(quoteDrafts[bookingId]),
          finalAmountCents: finalDrafts[bookingId] === "" ? null : Number(finalDrafts[bookingId]),
          notes: noteDrafts[bookingId] || null
        })
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Booking update failed");
      await loadBookings();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUpdatingId(null);
    }
  }

  async function resendTicketLink(bookingId: string) {
    setUpdatingId(bookingId);
    setError(null);
    try {
      const response = await fetch(`/api/admin/bookings/${bookingId}/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "booking_received" })
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Failed to resend ticket link");
      await loadBookings();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUpdatingId(null);
    }
  }

  async function toggleEvents(bookingId: string) {
    if (eventsByBooking[bookingId]) {
      setEventsByBooking((current) => {
        const next = { ...current };
        delete next[bookingId];
        return next;
      });
      return;
    }

    setEventsLoadingId(bookingId);
    setError(null);
    try {
      const response = await fetch(`/api/admin/bookings/${bookingId}/events?limit=30`);
      const payload = (await response.json()) as { data?: BookingEvent[]; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "Failed to load events");
      setEventsByBooking((current) => ({ ...current, [bookingId]: payload.data || [] }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEventsLoadingId(null);
    }
  }

  function applyAlertDrilldown(type: "overdue_requests" | "unassigned_today" | "starting_soon" | "missing_pod") {
    const now = new Date();
    const toLocalInput = (date: Date) => {
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
        date.getMinutes()
      )}`;
    };

    if (type === "overdue_requests") {
      const cutoff = new Date(now.getTime() - 30 * 60 * 1000);
      setFilterStatus("requested");
      setFilterDateFrom("");
      setFilterDateTo(toLocalInput(cutoff));
      setFilterScheduledFrom("");
      setFilterScheduledTo("");
      setFilterUnassignedOnly(false);
      setFilterMissingPodOnly(false);
      setFilterEstimateDelta("all");
      setAppliedFilters({
        status: "requested",
        publicId: filterPublicId.trim(),
        dateFrom: "",
        dateTo: toLocalInput(cutoff),
        scheduledFrom: "",
        scheduledTo: "",
        unassignedOnly: false,
        missingPodOnly: false
      });
      setAlertHint("Showing requested bookings older than ~30 minutes.");
      setPage(1);
      return;
    }

    if (type === "unassigned_today") {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      setFilterStatus("");
      setFilterDateFrom("");
      setFilterDateTo("");
      setFilterScheduledFrom(toLocalInput(startOfDay));
      setFilterScheduledTo(toLocalInput(endOfDay));
      setFilterUnassignedOnly(true);
      setFilterMissingPodOnly(false);
      setFilterEstimateDelta("all");
      setAppliedFilters({
        status: "",
        publicId: filterPublicId.trim(),
        dateFrom: "",
        dateTo: "",
        scheduledFrom: toLocalInput(startOfDay),
        scheduledTo: toLocalInput(endOfDay),
        unassignedOnly: true,
        missingPodOnly: false
      });
      setAlertHint("Showing unassigned bookings scheduled for today.");
      setPage(1);
      return;
    }

    if (type === "starting_soon") {
      const soon = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      setFilterStatus("scheduled");
      setFilterDateFrom("");
      setFilterDateTo("");
      setFilterScheduledFrom(toLocalInput(now));
      setFilterScheduledTo(toLocalInput(soon));
      setFilterUnassignedOnly(false);
      setFilterMissingPodOnly(false);
      setFilterEstimateDelta("all");
      setAppliedFilters({
        status: "scheduled",
        publicId: filterPublicId.trim(),
        dateFrom: "",
        dateTo: "",
        scheduledFrom: toLocalInput(now),
        scheduledTo: toLocalInput(soon),
        unassignedOnly: false,
        missingPodOnly: false
      });
      setAlertHint("Showing bookings scheduled to start in the next 2 hours.");
      setPage(1);
      return;
    }

    // missing_pod
    setFilterStatus("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterScheduledFrom("");
    setFilterScheduledTo("");
    setFilterUnassignedOnly(false);
    setFilterMissingPodOnly(true);
    setFilterEstimateDelta("all");
    setAppliedFilters({
      status: "",
      publicId: filterPublicId.trim(),
      dateFrom: "",
      dateTo: "",
      scheduledFrom: "",
      scheduledTo: "",
      unassignedOnly: false,
      missingPodOnly: true
    });
    setAlertHint("Showing bookings missing proof-of-delivery.");
    setPage(1);
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h2>Bookings</h2>
        <button onClick={() => void loadBookings()} disabled={loading}>
          Refresh
        </button>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", marginTop: 12 }}>
        <div className="card">
          <p className="small">Today bookings</p>
          <p>{stats.todayBookings}</p>
        </div>
        <div className="card">
          <p className="small">Pending confirmations</p>
          <p>{stats.pendingConfirmations}</p>
        </div>
        <div className="card">
          <p className="small">In progress</p>
          <p>{stats.inProgress}</p>
        </div>
        <div className="card">
          <p className="small">Completed today</p>
          <p>{stats.completedToday}</p>
        </div>
        <div className="card">
          <p className="small">On-target pricing</p>
          <p>
            {pricingInsights.onTargetPct}% ({pricingInsights.sampleSize} compared)
          </p>
        </div>
        <div className="card">
          <p className="small">Average delta</p>
          <p>
            {pricingInsights.averageDeltaPct > 0 ? "+" : ""}
            {pricingInsights.averageDeltaPct}%
          </p>
        </div>
        <div className="card">
          <p className="small">Over / Under count</p>
          <p>
            {pricingInsights.overCount} / {pricingInsights.underCount}
          </p>
        </div>
      </div>
      <div className="card">
        <p className="small">Action Needed</p>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          <div>
            <p className="small">Overdue requests (&gt;30m)</p>
            <button onClick={() => applyAlertDrilldown("overdue_requests")}>{stats.alerts?.overdueRequests ?? 0}</button>
          </div>
          <div>
            <p className="small">Unassigned today</p>
            <button onClick={() => applyAlertDrilldown("unassigned_today")}>{stats.alerts?.unassignedToday ?? 0}</button>
          </div>
          <div>
            <p className="small">Starting in next 2h</p>
            <button onClick={() => applyAlertDrilldown("starting_soon")}>{stats.alerts?.startingSoon ?? 0}</button>
          </div>
          <div>
            <p className="small">Delivered/completed missing POD</p>
            <button onClick={() => applyAlertDrilldown("missing_pod")}>{stats.alerts?.missingPodCompleted ?? 0}</button>
          </div>
        </div>
        {alertHint ? <p className="small">{alertHint}</p> : null}
      </div>
      <div className="card">
        <p className="small">Scheduling Settings</p>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
          <label className="small">
            Slot capacity
            <input
              type="number"
              min={1}
              value={scheduleSettings.slotCapacity}
              onChange={(e) => setScheduleSettings((v) => ({ ...v, slotCapacity: e.target.value }))}
            />
          </label>
          <label className="small">
            Workday start hour
            <input
              type="number"
              min={0}
              max={23}
              value={scheduleSettings.workdayStartHour}
              onChange={(e) => setScheduleSettings((v) => ({ ...v, workdayStartHour: e.target.value }))}
            />
          </label>
          <label className="small">
            Workday end hour
            <input
              type="number"
              min={1}
              max={24}
              value={scheduleSettings.workdayEndHour}
              onChange={(e) => setScheduleSettings((v) => ({ ...v, workdayEndHour: e.target.value }))}
            />
          </label>
          <label className="small">
            Timezone
            <input
              value={scheduleSettings.timezone}
              onChange={(e) => setScheduleSettings((v) => ({ ...v, timezone: e.target.value }))}
            />
          </label>
        </div>
        <button onClick={() => void saveScheduleSettings()} disabled={savingSettings}>
          {savingSettings ? "Saving settings..." : "Save scheduling settings"}
        </button>
      </div>
      <div className="card">
        <p className="small">Today Board (by hour)</p>
        {stats.todayBoard && stats.todayBoard.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th align="left">Hour</th>
                  <th align="left">Total</th>
                  <th align="left">Unassigned</th>
                  <th align="left">Starting soon</th>
                </tr>
              </thead>
              <tbody>
                {stats.todayBoard.map((slot) => (
                  <tr key={slot.hour}>
                    <td>{slot.hour}</td>
                    <td>{slot.total}</td>
                    <td style={{ color: slot.unassigned > 0 ? "#b91c1c" : undefined }}>{slot.unassigned}</td>
                    <td>{slot.startingSoon}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="small">No scheduled bookings on board yet.</p>
        )}
      </div>
      <div className="card">
        <p className="small">Pricing Accuracy Trend (Last 7 Days)</p>
        {stats.pricingTrend && stats.pricingTrend.length > 0 ? (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${stats.pricingTrend.length}, 1fr)`, gap: 6, alignItems: "end", height: 80 }}>
              {stats.pricingTrend.map((item) => {
                const height = Math.max(6, Math.min(100, item.onTargetPct));
                const color = item.onTargetPct >= 70 ? "#166534" : item.onTargetPct >= 40 ? "#92400e" : "#b91c1c";
                return (
                  <div key={`bar-${item.day}`} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div title={`${item.day}: ${item.onTargetPct}% on-target`} style={{ width: "100%", height: `${height}%`, minHeight: 6, borderRadius: 4, background: color }} />
                    <span className="small">{item.day.slice(5)}</span>
                  </div>
                );
              })}
            </div>
            <p className="small">Sparkline shows daily on-target percentage.</p>
          </div>
        ) : null}
        {stats.pricingTrend && stats.pricingTrend.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th align="left">Day</th>
                  <th align="left">Samples</th>
                  <th align="left">On-target</th>
                  <th align="left">Avg delta</th>
                </tr>
              </thead>
              <tbody>
                {stats.pricingTrend.map((item) => (
                  <tr key={item.day}>
                    <td>{item.day}</td>
                    <td>{item.samples}</td>
                    <td>{item.onTargetPct}%</td>
                    <td>
                      {item.averageDeltaPct > 0 ? "+" : ""}
                      {item.averageDeltaPct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="small">No pricing trend data yet.</p>
        )}
      </div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginTop: 12 }}>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All statuses</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <input
          value={filterPublicId}
          onChange={(e) => setFilterPublicId(e.target.value)}
          placeholder="Public ID contains..."
        />
        <input type="datetime-local" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
        <input type="datetime-local" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
        <input
          type="datetime-local"
          value={filterScheduledFrom}
          onChange={(e) => setFilterScheduledFrom(e.target.value)}
          title="Scheduled start from"
        />
        <input
          type="datetime-local"
          value={filterScheduledTo}
          onChange={(e) => setFilterScheduledTo(e.target.value)}
          title="Scheduled start to"
        />
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            checked={filterUnassignedOnly}
            onChange={(e) => setFilterUnassignedOnly(e.target.checked)}
          />
          Unassigned only
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            checked={filterMissingPodOnly}
            onChange={(e) => setFilterMissingPodOnly(e.target.checked)}
          />
          Missing POD only
        </label>
        <select value={filterEstimateDelta} onChange={(e) => setFilterEstimateDelta(e.target.value as EstimateDeltaFilter)}>
          <option value="all">All pricing deltas</option>
          <option value="over">Over-estimate</option>
          <option value="under">Under-estimate</option>
          <option value="on_target">On-target</option>
        </select>
        <button
          onClick={() => {
            setPage(1);
            setAppliedFilters({
              status: filterStatus,
              publicId: filterPublicId.trim(),
              dateFrom: filterDateFrom,
              dateTo: filterDateTo,
              scheduledFrom: filterScheduledFrom,
              scheduledTo: filterScheduledTo,
              unassignedOnly: filterUnassignedOnly,
              missingPodOnly: filterMissingPodOnly
            });
          }}
          disabled={loading}
        >
          Apply filters
        </button>
        <button
          onClick={() => {
            setFilterStatus("");
            setFilterPublicId("");
            setFilterDateFrom("");
            setFilterDateTo("");
            setFilterScheduledFrom("");
            setFilterScheduledTo("");
            setFilterUnassignedOnly(false);
            setFilterMissingPodOnly(false);
            setFilterEstimateDelta("all");
            setPage(1);
            setAppliedFilters({
              status: "",
              publicId: "",
              dateFrom: "",
              dateTo: "",
              scheduledFrom: "",
              scheduledTo: "",
              unassignedOnly: false,
              missingPodOnly: false
            });
          }}
          disabled={loading}
        >
          Reset filters
        </button>
        <button
          onClick={() => {
            const params = new URLSearchParams();
            if (appliedFilters.status) params.set("status", appliedFilters.status);
            if (appliedFilters.publicId) params.set("publicId", appliedFilters.publicId);
            if (appliedFilters.dateFrom) params.set("dateFrom", new Date(appliedFilters.dateFrom).toISOString());
            if (appliedFilters.dateTo) params.set("dateTo", new Date(appliedFilters.dateTo).toISOString());
            if (appliedFilters.scheduledFrom) params.set("scheduledFrom", new Date(appliedFilters.scheduledFrom).toISOString());
            if (appliedFilters.scheduledTo) params.set("scheduledTo", new Date(appliedFilters.scheduledTo).toISOString());
            if (appliedFilters.unassignedOnly) params.set("unassignedOnly", "true");
            if (appliedFilters.missingPodOnly) params.set("missingPodOnly", "true");
            if (filterEstimateDelta !== "all") params.set("estimateDelta", filterEstimateDelta);
            window.location.href = `/api/admin/bookings/export?${params.toString()}`;
          }}
          disabled={loading}
        >
          Export CSV
        </button>
        <select
          value={String(pageSize)}
          onChange={(e) => {
            setPage(1);
            setPageSize(Number(e.target.value));
          }}
          disabled={loading}
        >
          <option value="20">20 / page</option>
          <option value="50">50 / page</option>
          <option value="100">100 / page</option>
        </select>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={loading || page <= 1}>
          Prev
        </button>
        <span>
          Page {page} / {Math.max(1, Math.ceil(total / pageSize))} ({total} total)
        </span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={loading || page >= Math.max(1, Math.ceil(total / pageSize))}
        >
          Next
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {loading ? <p>Loading...</p> : null}
      {!loading && rows.length === 0 ? <p>No bookings yet.</p> : null}
      {!loading && rows.length > 0 ? (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th align="left">Public ID</th>
                <th align="left">Status</th>
                <th align="left">Pickup</th>
                <th align="left">Dropoff</th>
                <th align="left">Contact</th>
                <th align="left">Created</th>
                <th align="left">Schedule / Price / Notes</th>
                <th align="left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((booking) => (
                <tr key={booking.id}>
                  <td>{booking.publicId}</td>
                  <td>{booking.status}</td>
                  <td>{booking.pickupText}</td>
                  <td>{booking.dropoffText}</td>
                  <td>{booking.contactEmail || "-"}</td>
                  <td>{new Date(booking.createdAt).toLocaleString()}</td>
                  <td>
                    <div className="grid">
                      <input
                        type="datetime-local"
                        value={scheduleStartDrafts[booking.id] || ""}
                        onChange={(e) =>
                          setScheduleStartDrafts((current) => ({ ...current, [booking.id]: e.target.value }))
                        }
                        placeholder="Scheduled start"
                      />
                      <input
                        type="datetime-local"
                        value={scheduleEndDrafts[booking.id] || ""}
                        onChange={(e) =>
                          setScheduleEndDrafts((current) => ({ ...current, [booking.id]: e.target.value }))
                        }
                        placeholder="Scheduled end"
                      />
                      {scheduleValidationByBooking[booking.id] ? (
                        <p className="error">{scheduleValidationByBooking[booking.id]}</p>
                      ) : null}
                      <input
                        type="number"
                        value={quoteDrafts[booking.id] || ""}
                        onChange={(e) => setQuoteDrafts((current) => ({ ...current, [booking.id]: e.target.value }))}
                        placeholder="Quote cents"
                      />
                      <input
                        type="number"
                        value={finalDrafts[booking.id] || ""}
                        onChange={(e) => setFinalDrafts((current) => ({ ...current, [booking.id]: e.target.value }))}
                        placeholder="Final cents"
                      />
                      <input
                        value={noteDrafts[booking.id] || ""}
                        onChange={(e) => setNoteDrafts((current) => ({ ...current, [booking.id]: e.target.value }))}
                        placeholder="Internal notes"
                      />
                      <button onClick={() => void saveBookingDetails(booking.id)} disabled={updatingId === booking.id}>
                        {updatingId === booking.id ? "Saving..." : "Save details"}
                      </button>
                      {estimateDeltaBadge(booking)}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 8 }}>
                      <select
                        value={statusDrafts[booking.id] || booking.status}
                        onChange={(e) =>
                          setStatusDrafts((current) => ({
                            ...current,
                            [booking.id]: e.target.value as BookingStatus
                          }))
                        }
                      >
                        {statuses.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                      <button onClick={() => void updateStatus(booking)} disabled={updatingId === booking.id}>
                        {updatingId === booking.id ? "Updating..." : "Update"}
                      </button>
                      <button onClick={() => void resendTicketLink(booking.id)} disabled={updatingId === booking.id}>
                        {updatingId === booking.id ? "Sending..." : "Resend ticket link"}
                      </button>
                    </div>
                    {booking.notificationFailed ? (
                      <p className="error">
                        Notification failed{booking.notificationFailureReason ? ` (${booking.notificationFailureReason})` : ""}.
                      </p>
                    ) : null}
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <input
                        placeholder="Driver ID"
                        value={driverDrafts[booking.id] || ""}
                        onChange={(e) => setDriverDrafts((current) => ({ ...current, [booking.id]: e.target.value }))}
                      />
                      <button onClick={() => void assignDriver(booking.id)} disabled={updatingId === booking.id}>
                        {updatingId === booking.id ? "Assigning..." : "Assign"}
                      </button>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      {booking.latestPodPhotoUrl ? (
                        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={booking.latestPodPhotoUrl}
                            alt="POD thumbnail"
                            style={{
                              width: 56,
                              height: 56,
                              objectFit: "cover",
                              borderRadius: 8,
                              border: "1px solid #d1d5db",
                              cursor: "pointer"
                            }}
                            onClick={() => setPodPreviewUrl(booking.latestPodPhotoUrl || null)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                setPodPreviewUrl(booking.latestPodPhotoUrl || null);
                              }
                            }}
                            role="button"
                            tabIndex={0}
                          />
                          <button onClick={() => setPodPreviewUrl(booking.latestPodPhotoUrl || null)}>Preview POD</button>
                          <a href={booking.latestPodPhotoUrl} target="_blank" rel="noreferrer">
                            Open original
                          </a>
                        </div>
                      ) : null}
                      <button onClick={() => void toggleEvents(booking.id)} disabled={eventsLoadingId === booking.id}>
                        {eventsLoadingId === booking.id
                          ? "Loading events..."
                          : eventsByBooking[booking.id]
                            ? "Hide events"
                            : "View events"}
                      </button>
                      {eventsByBooking[booking.id] ? (
                        <ul style={{ marginTop: 8, maxHeight: 180, overflowY: "auto" }}>
                          {eventsByBooking[booking.id].map((event) => (
                            <li key={event.id}>
                              {event.eventType} {summarizeEvent(event)} ({new Date(event.createdAt).toLocaleString()})
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {podPreviewUrl ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(17,24,39,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 80
          }}
        >
          <div className="card" style={{ maxWidth: 840, width: "100%", maxHeight: "90vh", overflow: "auto" }}>
            <h3>POD Preview</h3>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={podPreviewUrl}
              alt="Proof of delivery full preview"
              style={{ width: "100%", maxHeight: "72vh", objectFit: "contain", borderRadius: 10, border: "1px solid #d1d5db" }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <a href={podPreviewUrl} target="_blank" rel="noreferrer">
                Open in new tab
              </a>
              <button onClick={() => setPodPreviewUrl(null)}>Close</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
