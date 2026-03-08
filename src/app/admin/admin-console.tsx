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
  } catch {
    return "";
  }
  return "";
}

export function AdminConsole() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stats, setStats] = useState<AdminStats>({
    todayBookings: 0,
    pendingConfirmations: 0,
    inProgress: 0,
    completedToday: 0
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterPublicId, setFilterPublicId] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({
    status: "",
    publicId: "",
    dateFrom: "",
    dateTo: ""
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

  const loadStats = useCallback(async () => {
    const response = await fetch("/api/admin/stats");
    const payload = (await response.json()) as AdminStats & { error?: string };
    if (!response.ok) throw new Error(payload.error || "Failed to load stats");
    setStats({
      todayBookings: payload.todayBookings,
      pendingConfirmations: payload.pendingConfirmations,
      inProgress: payload.inProgress,
      completedToday: payload.completedToday
    });
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
      setBookings(payload.data);
      setTotal(typeof payload.total === "number" ? payload.total : 0);
      setPage(typeof payload.page === "number" ? payload.page : page);
      setPageSize(typeof payload.pageSize === "number" ? payload.pageSize : pageSize);
      setStatusDrafts((current) => {
        const next = { ...current };
        payload.data.forEach((booking) => {
          if (!next[booking.id]) next[booking.id] = booking.status;
        });
        return next;
      });
      setScheduleStartDrafts((current) => {
        const next = { ...current };
        payload.data.forEach((booking) => {
          if (next[booking.id] == null) next[booking.id] = booking.scheduledWindowStart?.slice(0, 16) || "";
        });
        return next;
      });
      setScheduleEndDrafts((current) => {
        const next = { ...current };
        payload.data.forEach((booking) => {
          if (next[booking.id] == null) next[booking.id] = booking.scheduledWindowEnd?.slice(0, 16) || "";
        });
        return next;
      });
      setQuoteDrafts((current) => {
        const next = { ...current };
        payload.data.forEach((booking) => {
          if (next[booking.id] == null) next[booking.id] = booking.quoteAmountCents == null ? "" : String(booking.quoteAmountCents);
        });
        return next;
      });
      setFinalDrafts((current) => {
        const next = { ...current };
        payload.data.forEach((booking) => {
          if (next[booking.id] == null) next[booking.id] = booking.finalAmountCents == null ? "" : String(booking.finalAmountCents);
        });
        return next;
      });
      setNoteDrafts((current) => {
        const next = { ...current };
        payload.data.forEach((booking) => {
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
  }, [appliedFilters.dateFrom, appliedFilters.dateTo, appliedFilters.publicId, appliedFilters.status, loadStats, page, pageSize]);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  const rows = useMemo(() => bookings, [bookings]);

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

  async function saveBookingDetails(bookingId: string) {
    setUpdatingId(bookingId);
    setError(null);
    try {
      const response = await fetch(`/api/admin/bookings/${bookingId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          scheduledWindowStart: localDateTimeToIso(scheduleStartDrafts[bookingId] || ""),
          scheduledWindowEnd: localDateTimeToIso(scheduleEndDrafts[bookingId] || ""),
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
        <button
          onClick={() => {
            setPage(1);
            setAppliedFilters({
              status: filterStatus,
              publicId: filterPublicId.trim(),
              dateFrom: filterDateFrom,
              dateTo: filterDateTo
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
            setPage(1);
            setAppliedFilters({ status: "", publicId: "", dateFrom: "", dateTo: "" });
          }}
          disabled={loading}
        >
          Reset filters
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
                    </div>
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
    </div>
  );
}
