"use client";

import { FormEvent, useMemo, useState } from "react";
import { RoutePreview } from "./route-preview";

type CreateBookingResponse = {
  id: string;
  publicId: string;
  token: string;
};

function newKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function localDateTimeToIso(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function toDatetimeLocalValue(date: Date) {
  const pad = (num: number) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
}

function applyDurationToLocalDateTime(startLocal: string, minutes: number) {
  if (!startLocal) return "";
  const start = new Date(startLocal);
  if (Number.isNaN(start.getTime())) return "";
  const end = new Date(start.getTime() + minutes * 60 * 1000);
  return toDatetimeLocalValue(end);
}

export function BookingForm() {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateBookingResponse | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => newKey());
  const [pickupText, setPickupText] = useState("");
  const [dropoffText, setDropoffText] = useState("");
  const [requestedWindowStart, setRequestedWindowStart] = useState("");
  const [requestedWindowEnd, setRequestedWindowEnd] = useState("");
  const [suggestedWindowMinutes, setSuggestedWindowMinutes] = useState<number | null>(null);
  const [endManuallyEdited, setEndManuallyEdited] = useState(false);

  const trackingUrl = useMemo(() => {
    if (!result) return null;
    return `/portal/${result.publicId}?token=${result.token}`;
  }, [result]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("idempotencyKey", idempotencyKey);
    formData.set("requestedWindowStart", localDateTimeToIso(formData.get("requestedWindowStart")));
    formData.set("requestedWindowEnd", localDateTimeToIso(formData.get("requestedWindowEnd")));

    const response = await fetch("/api/bookings", {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setStatus("error");
      setError(body?.error || "Booking request failed.");
      return;
    }

    const payload = (await response.json()) as CreateBookingResponse;
    setResult(payload);
    setStatus("success");
    setIdempotencyKey(newKey());
    setPickupText("");
    setDropoffText("");
    setRequestedWindowStart("");
    setRequestedWindowEnd("");
    setSuggestedWindowMinutes(null);
    setEndManuallyEdited(false);
    form.reset();
  }

  return (
    <div className="booking-layout">
      <div>
        <form onSubmit={onSubmit} className="grid">
          <input name="contactEmail" type="email" placeholder="Email for updates" required />
          <input
            name="pickupText"
            placeholder="Pickup address"
            required
            minLength={5}
            value={pickupText}
            onChange={(e) => setPickupText(e.target.value)}
          />
          <input
            name="dropoffText"
            placeholder="Dropoff address"
            required
            minLength={5}
            value={dropoffText}
            onChange={(e) => setDropoffText(e.target.value)}
          />
          <input
            name="requestedWindowStart"
            type="datetime-local"
            required
            value={requestedWindowStart}
            onChange={(e) => {
              const nextStart = e.target.value;
              setRequestedWindowStart(nextStart);
              if (suggestedWindowMinutes && (!requestedWindowEnd || !endManuallyEdited)) {
                setRequestedWindowEnd(applyDurationToLocalDateTime(nextStart, suggestedWindowMinutes));
              }
            }}
          />
          <input
            name="requestedWindowEnd"
            type="datetime-local"
            required
            value={requestedWindowEnd}
            onChange={(e) => {
              setRequestedWindowEnd(e.target.value);
              setEndManuallyEdited(true);
            }}
          />
          {suggestedWindowMinutes ? (
            <p className="small">
              Suggested duration from route: {suggestedWindowMinutes} minutes
              {!endManuallyEdited ? " (auto-applied)" : " (you can keep your custom end time)"}
            </p>
          ) : null}
          <textarea name="notes" placeholder="Notes (optional)" />
          <button type="submit" disabled={status === "submitting"}>
            {status === "submitting" ? "Submitting..." : "Submit booking request"}
          </button>
        </form>
        {status === "error" ? <p className="error">{error}</p> : null}
        {status === "success" && trackingUrl ? (
          <p className="success">
            Booking created. Track status here: <a href={trackingUrl}>{trackingUrl}</a>
          </p>
        ) : null}
      </div>
      <RoutePreview
        pickupText={pickupText}
        dropoffText={dropoffText}
        onSuggestedWindowMinutes={(minutes) => {
          setSuggestedWindowMinutes(minutes);
          if (minutes && requestedWindowStart && (!requestedWindowEnd || !endManuallyEdited)) {
            setRequestedWindowEnd(applyDurationToLocalDateTime(requestedWindowStart, minutes));
          }
        }}
      />
    </div>
  );
}
