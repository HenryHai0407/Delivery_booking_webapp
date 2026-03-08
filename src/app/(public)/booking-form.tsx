"use client";

import { useEffect, useMemo, useState } from "react";
import { RoutePreview, type RouteEstimate } from "./route-preview";

type CreateBookingResponse = {
  id: string;
  publicId: string;
  token: string;
};

type SlotAvailability = {
  available: boolean;
  message: string;
  overlapCount: number;
  capacity: number;
};

function newKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toIsoFromLocal(value: string) {
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

function getPlannedMinutes(routeEstimate: RouteEstimate | null, suggestedWindowMinutes: number | null) {
  if (suggestedWindowMinutes && suggestedWindowMinutes > 0) return suggestedWindowMinutes;
  const trafficMinutes = routeEstimate?.trafficEtaMinutes ?? null;
  const baseMinutes = trafficMinutes ?? routeEstimate?.etaMinutes ?? 90;
  return Math.max(60, baseMinutes + 45);
}

function isValidEmail(input: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.trim());
}

export function BookingForm() {
  const [step, setStep] = useState(1);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateBookingResponse | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => newKey());

  const [contactEmail, setContactEmail] = useState("");
  const [requestedWindowStart, setRequestedWindowStart] = useState("");
  const [pickupText, setPickupText] = useState("");
  const [dropoffText, setDropoffText] = useState("");
  const [staffRequired, setStaffRequired] = useState("2");
  const [notes, setNotes] = useState("");

  const [suggestedWindowMinutes, setSuggestedWindowMinutes] = useState<number | null>(null);
  const [routeEstimate, setRouteEstimate] = useState<RouteEstimate | null>(null);
  const [slotStatus, setSlotStatus] = useState<"idle" | "checking" | "available" | "busy" | "error">("idle");
  const [slotAvailability, setSlotAvailability] = useState<SlotAvailability | null>(null);

  useEffect(() => {
    if (!requestedWindowStart) {
      setSlotStatus("idle");
      setSlotAvailability(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setSlotStatus("checking");
        const startIso = toIsoFromLocal(requestedWindowStart);
        const response = await fetch(`/api/public/availability?start=${encodeURIComponent(startIso)}&duration=120`, {
          signal: controller.signal
        });
        const payload = (await response.json()) as SlotAvailability & { error?: string };
        if (!response.ok) {
          setSlotStatus("error");
          setSlotAvailability(null);
          setError(payload.error || "Could not verify schedule availability.");
          return;
        }
        setError(null);
        setSlotAvailability(payload);
        setSlotStatus(payload.available ? "available" : "busy");
      } catch (availabilityError) {
        if ((availabilityError as Error).name === "AbortError") return;
        setSlotStatus("error");
        setSlotAvailability(null);
      }
    }, 450);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [requestedWindowStart]);

  const trackingUrl = useMemo(() => {
    if (!result) return null;
    return `/portal/${result.publicId}?token=${result.token}`;
  }, [result]);

  const plannedMinutes = getPlannedMinutes(routeEstimate, suggestedWindowMinutes);
  const plannedEnd = requestedWindowStart ? applyDurationToLocalDateTime(requestedWindowStart, plannedMinutes) : "";

  const canMoveToStep2 = isValidEmail(contactEmail) && requestedWindowStart.length > 0 && slotStatus === "available";
  const canMoveToStep3 = pickupText.trim().length >= 5 && dropoffText.trim().length >= 5 && routeEstimate != null;

  async function submitBooking() {
    setStatus("submitting");
    setError(null);
    const formData = new FormData();
    formData.set("idempotencyKey", idempotencyKey);
    formData.set("contactEmail", contactEmail.trim());
    formData.set("requestedWindowStart", toIsoFromLocal(requestedWindowStart));
    formData.set("requestedWindowEnd", toIsoFromLocal(plannedEnd));
    formData.set("pickupText", pickupText.trim());
    formData.set("dropoffText", dropoffText.trim());
    formData.set("staffRequired", staffRequired);
    if (notes.trim()) formData.set("notes", notes.trim());

    if (routeEstimate) {
      formData.set("estimateLowEur", String(routeEstimate.lowEur));
      formData.set("estimateHighEur", String(routeEstimate.highEur));
      formData.set("estimateBilledHours", String(routeEstimate.billedHours));
      formData.set("estimateDistanceKm", String(routeEstimate.distanceKm));
      formData.set("estimateEtaMinutes", String(routeEstimate.etaMinutes));
      if (routeEstimate.trafficEtaMinutes != null) {
        formData.set("estimateTrafficEtaMinutes", String(routeEstimate.trafficEtaMinutes));
      }
      formData.set("estimateTrafficLevel", routeEstimate.trafficLevel);
      formData.set("estimateProvider", routeEstimate.provider);
      formData.set("estimateUpdatedAt", routeEstimate.updatedAt);
    }

    const response = await fetch("/api/bookings", { method: "POST", body: formData });
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
    setStep(1);
    setContactEmail("");
    setRequestedWindowStart("");
    setPickupText("");
    setDropoffText("");
    setStaffRequired("2");
    setNotes("");
    setSuggestedWindowMinutes(null);
    setRouteEstimate(null);
    setSlotStatus("idle");
    setSlotAvailability(null);
  }

  return (
    <div className="booking-layout">
      <div className="wizard-card">
        <div className="wizard-progress">
          <span className={step >= 1 ? "active" : ""}>1. Contact & time</span>
          <span className={step >= 2 ? "active" : ""}>2. Route check</span>
          <span className={step >= 3 ? "active" : ""}>3. Staff & notes</span>
        </div>

        {step === 1 ? (
          <div className="grid">
            <h3>Step 1: Contact and move time</h3>
            <div className="field">
              <label htmlFor="contactEmail">Email for updates and ticket link</label>
              <input
                id="contactEmail"
                type="email"
                placeholder="you@example.com"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="requestedWindowStart">Move start time</label>
              <input
                id="requestedWindowStart"
                type="datetime-local"
                value={requestedWindowStart}
                onChange={(e) => setRequestedWindowStart(e.target.value)}
              />
            </div>
            {slotStatus === "checking" ? <p className="small">Checking availability against current schedule...</p> : null}
            {slotAvailability ? (
              <p className={slotAvailability.available ? "success" : "error"}>
                {slotAvailability.message} ({slotAvailability.overlapCount}/{slotAvailability.capacity} slots used)
              </p>
            ) : null}
            {slotStatus === "error" ? <p className="error">Could not validate slot. Please try again.</p> : null}
            <div className="wizard-actions">
              <button type="button" disabled={!canMoveToStep2} onClick={() => setStep(2)}>
                Continue to route
              </button>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid">
            <h3>Step 2: Pickup, dropoff, and route review</h3>
            <input
              placeholder="Pickup address"
              minLength={5}
              value={pickupText}
              onChange={(e) => setPickupText(e.target.value)}
            />
            <input
              placeholder="Dropoff address"
              minLength={5}
              value={dropoffText}
              onChange={(e) => setDropoffText(e.target.value)}
            />
            {plannedEnd ? (
              <p className="small">
                Planned end estimate: {new Date(plannedEnd).toLocaleString()} ({plannedMinutes} min window)
              </p>
            ) : null}
            <div className="wizard-actions">
              <button type="button" className="secondary-btn" onClick={() => setStep(1)}>
                Back
              </button>
              <button type="button" disabled={!canMoveToStep3} onClick={() => setStep(3)}>
                Continue to details
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="grid">
            <h3>Step 3: Staff and final notes</h3>
            <div className="field">
              <label htmlFor="staffRequired">How many staff do you need?</label>
              <select id="staffRequired" value={staffRequired} onChange={(e) => setStaffRequired(e.target.value)}>
                <option value="1">1 staff</option>
                <option value="2">2 staff</option>
                <option value="3">3 staff</option>
                <option value="4">4 staff</option>
                <option value="5">5 staff</option>
                <option value="6">6 staff</option>
              </select>
            </div>
            <textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <div className="booking-summary">
              <p>
                <strong>Email:</strong> {contactEmail}
              </p>
              <p>
                <strong>Start:</strong> {requestedWindowStart ? new Date(requestedWindowStart).toLocaleString() : "-"}
              </p>
              <p>
                <strong>Pickup:</strong> {pickupText}
              </p>
              <p>
                <strong>Dropoff:</strong> {dropoffText}
              </p>
            </div>
            <div className="wizard-actions">
              <button type="button" className="secondary-btn" onClick={() => setStep(2)}>
                Back
              </button>
              <button type="button" disabled={status === "submitting"} onClick={() => void submitBooking()}>
                {status === "submitting" ? "Submitting..." : "Submit booking request"}
              </button>
            </div>
          </div>
        ) : null}

        {error ? <p className="error">{error}</p> : null}
      </div>

      {step >= 2 ? (
        <RoutePreview
          pickupText={pickupText}
          dropoffText={dropoffText}
          staffRequired={Number(staffRequired)}
          onSuggestedWindowMinutes={setSuggestedWindowMinutes}
          onEstimateChange={setRouteEstimate}
        />
      ) : (
        <div className="route-panel">
          <h3>Step 2 preview</h3>
          <p className="small">Next, you will fill pickup/dropoff and see route, ETA, traffic status, and estimate.</p>
        </div>
      )}

      {status === "success" && trackingUrl ? (
        <div className="ticket-modal">
          <div className="ticket-modal-content">
            <h3>Request sent successfully</h3>
            <p>Please save your ticket link now. We also sent this link to your email.</p>
            <p className="ticket-link">
              <a href={trackingUrl}>{trackingUrl}</a>
            </p>
            <div className="wizard-actions">
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(`${window.location.origin}${trackingUrl}`);
                }}
              >
                Copy ticket link
              </button>
              <button type="button" className="secondary-btn" onClick={() => setStatus("idle")}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
