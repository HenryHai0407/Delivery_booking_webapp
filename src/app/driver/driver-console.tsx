"use client";

import { ChangeEvent, useCallback, useEffect, useState } from "react";

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

type DriverJob = {
  id: string;
  bookingId: string;
  booking: {
    id: string;
    publicId: string;
    status: BookingStatus;
    pickupText: string;
    dropoffText: string;
    scheduledWindowStart: string | null;
    scheduledWindowEnd: string | null;
    pod?: {
      id: string;
      photos: Array<{ id: string; storageUrl: string; createdAt: string }>;
    } | null;
  };
};

const statusChoices: BookingStatus[] = [
  "assigned",
  "driver_en_route",
  "picked_up",
  "delivered",
  "completed"
];

function newKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function DriverConsole() {
  const [jobs, setJobs] = useState<DriverJob[]>([]);
  const [statusDrafts, setStatusDrafts] = useState<Record<string, BookingStatus>>({});
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File | null>>({});
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const applyOnlineState = () => setIsOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    applyOnlineState();
    window.addEventListener("online", applyOnlineState);
    window.addEventListener("offline", applyOnlineState);
    return () => {
      window.removeEventListener("online", applyOnlineState);
      window.removeEventListener("offline", applyOnlineState);
    };
  }, []);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/driver/jobs?date=today");
      const payload = (await response.json()) as DriverJob[] | { error?: string };
      if (!response.ok || !Array.isArray(payload)) {
        throw new Error((payload as { error?: string }).error || "Failed to load jobs");
      }
      setJobs(payload);
      setStatusDrafts((current) => {
        const next = { ...current };
        payload.forEach((job) => {
          if (!next[job.booking.id]) next[job.booking.id] = job.booking.status;
        });
        return next;
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  async function updateStatus(bookingId: string) {
    const status = statusDrafts[bookingId];
    if (!status) return;
    const job = jobs.find((v) => v.booking.id === bookingId);
    const hasPod = Boolean(job?.booking.pod?.photos?.length);
    if (status === "completed" && !hasPod) {
      setError("POD photo is required before setting status to completed.");
      return;
    }
    setUpdatingId(bookingId);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/driver/jobs/${bookingId}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status,
          idempotencyKey: newKey()
        })
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to update status");
      }
      setMessage(`Updated booking ${bookingId} to ${status}.`);
      await loadJobs();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUpdatingId(null);
    }
  }

  function onSelectFile(bookingId: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    setSelectedFiles((current) => ({ ...current, [bookingId]: file }));
  }

  async function uploadPod(bookingId: string) {
    const file = selectedFiles[bookingId];
    if (!file) {
      setError("Please select a POD photo first.");
      return;
    }
    setUploadingId(bookingId);
    setUploadErrors((current) => ({ ...current, [bookingId]: "" }));
    setError(null);
    setMessage(null);
    try {
      const presignRes = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ bookingId, filename: file.name })
      });
      const presignPayload = (await presignRes.json()) as {
        key?: string;
        uploadUrl?: string;
        storageUrl?: string;
        method?: "PUT";
        error?: string;
      };
      if (!presignRes.ok || !presignPayload.key || !presignPayload.uploadUrl || !presignPayload.storageUrl) {
        throw new Error(presignPayload.error || "Failed to create upload URL");
      }

      const uploadRes = await fetch(presignPayload.uploadUrl, {
        method: presignPayload.method || "PUT",
        headers: {
          "Content-Type": file.type || "application/octet-stream"
        },
        body: file
      });
      if (!uploadRes.ok) {
        throw new Error(`Upload failed (${uploadRes.status})`);
      }

      const persistRes = await fetch(`/api/driver/jobs/${bookingId}/pod`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          objectKey: presignPayload.key,
          storageUrl: presignPayload.storageUrl,
          notes: "POD uploaded by driver"
        })
      });
      const persistPayload = (await persistRes.json()) as { error?: string };
      if (!persistRes.ok) {
        throw new Error(persistPayload.error || "Failed to persist POD record");
      }

      setMessage(`POD recorded for booking ${bookingId}.`);
      setSelectedFiles((current) => ({ ...current, [bookingId]: null }));
      setUploadErrors((current) => ({ ...current, [bookingId]: "" }));
      await loadJobs();
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      setUploadErrors((current) => ({ ...current, [bookingId]: msg }));
    } finally {
      setUploadingId(null);
    }
  }

  return (
    <div className="card grid">
      <h2>Today&apos;s Jobs</h2>
      <button onClick={() => void loadJobs()} disabled={loading}>
        {loading ? "Loading..." : "Load jobs"}
      </button>
      {error ? <p className="error">{error}</p> : null}
      {message ? <p className="success">{message}</p> : null}
      {!isOnline ? <p className="error">You are offline. Upload and status updates are paused until connection returns.</p> : null}
      {jobs.length === 0 && !loading ? <p>No jobs for today.</p> : null}
      {jobs.map((job) => (
        <div key={job.id} className="card">
          <p>
            <strong>{job.booking.publicId}</strong> ({job.booking.status})
          </p>
          <p>
            {job.booking.pickupText}
            {" -> "}
            {job.booking.dropoffText}
          </p>
          <p className="small">
            Scheduled:{" "}
            {job.booking.scheduledWindowStart && job.booking.scheduledWindowEnd
              ? `${new Date(job.booking.scheduledWindowStart).toLocaleString()} - ${new Date(job.booking.scheduledWindowEnd).toLocaleString()}`
              : "Not scheduled"}
          </p>
          <p className="small">
            POD status:{" "}
            {job.booking.pod?.photos?.length
              ? `uploaded (${new Date(job.booking.pod.photos[0].createdAt).toLocaleString()})`
              : "not uploaded"}
          </p>
          {job.booking.pod?.photos?.[0]?.storageUrl ? (
            <p className="small">
              Latest POD:
              <a href={job.booking.pod.photos[0].storageUrl} target="_blank" rel="noreferrer">
                {" view photo"}
              </a>
            </p>
          ) : null}

          <div className="grid">
            <label>
              Update status
              <select
                value={statusDrafts[job.booking.id] || job.booking.status}
                onChange={(e) =>
                  setStatusDrafts((current) => ({
                    ...current,
                    [job.booking.id]: e.target.value as BookingStatus
                  }))
                }
              >
                {statusChoices.map((status) => (
                  <option key={status} value={status} disabled={status === "completed" && !job.booking.pod?.photos?.length}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <button onClick={() => void updateStatus(job.booking.id)} disabled={updatingId === job.booking.id || !isOnline}>
              {updatingId === job.booking.id ? "Updating..." : "Save status"}
            </button>
          </div>

          <div className="grid">
            <label>
              POD photo
              <input type="file" accept="image/*" onChange={(e) => onSelectFile(job.booking.id, e)} />
            </label>
            <button onClick={() => void uploadPod(job.booking.id)} disabled={uploadingId === job.booking.id || !isOnline}>
              {uploadingId === job.booking.id ? "Recording POD..." : "Record POD upload"}
            </button>
            {uploadErrors[job.booking.id] ? (
              <p className="error">
                Upload failed: {uploadErrors[job.booking.id]}{" "}
                <button onClick={() => void uploadPod(job.booking.id)} disabled={uploadingId === job.booking.id || !isOnline}>
                  Retry
                </button>
              </p>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
