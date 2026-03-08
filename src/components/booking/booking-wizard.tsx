"use client";

import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, ClipboardCopy } from "lucide-react";
import type { RouteEstimate } from "@/app/(public)/route-preview";
import { BookingSummarySidebar } from "./booking-summary-sidebar";
import { StepContactTime } from "./step-contact-time";
import { StepRoute } from "./step-route";
import { StepStaffNotes } from "./step-staff-notes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { BookingWizardValues, SlotAvailability } from "./types";

type CreateBookingResponse = {
  id: string;
  publicId: string;
  token: string;
};

type SubmittedSummary = {
  publicId: string;
  contactEmail: string;
  requestedWindowStart: string;
  requestedWindowEnd: string;
  pickupText: string;
  dropoffText: string;
  staffRequired: number;
  notes: string;
  estimateText: string;
};

const wizardSchema = z.object({
  contactEmail: z.string().email("Enter a valid email"),
  requestedWindowStart: z.string().min(1, "Select a move start time"),
  pickupText: z.string().min(5, "Pickup address is too short"),
  dropoffText: z.string().min(5, "Dropoff address is too short"),
  staffRequired: z.number().int().min(1, "At least 1 staff").max(8, "Maximum 8 staff"),
  notes: z.string().max(1000, "Notes must be 1000 characters or less")
});

const DRAFT_KEY = "booking_wizard_draft_v1";
const RECENT_ADDRESSES_KEY = "booking_recent_addresses_v1";

function newKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
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

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function BookingWizard() {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<CreateBookingResponse | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => newKey());
  const [routeEstimate, setRouteEstimate] = useState<RouteEstimate | null>(null);
  const [suggestedWindowMinutes, setSuggestedWindowMinutes] = useState<number | null>(null);
  const [slotStatus, setSlotStatus] = useState<"idle" | "checking" | "available" | "busy" | "error">("idle");
  const [slotAvailability, setSlotAvailability] = useState<SlotAvailability | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string>("");
  const [recentAddresses, setRecentAddresses] = useState<string[]>([]);
  const [submittedSummary, setSubmittedSummary] = useState<SubmittedSummary | null>(null);

  const form = useForm<BookingWizardValues>({
    resolver: zodResolver(wizardSchema),
    mode: "onChange",
    defaultValues: {
      contactEmail: "",
      requestedWindowStart: "",
      pickupText: "",
      dropoffText: "",
      staffRequired: 2,
      notes: ""
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Partial<BookingWizardValues>;
      form.reset({
        contactEmail: parsed.contactEmail || "",
        requestedWindowStart: parsed.requestedWindowStart || "",
        pickupText: parsed.pickupText || "",
        dropoffText: parsed.dropoffText || "",
        staffRequired: Number(parsed.staffRequired) || 2,
        notes: parsed.notes || ""
      });
    } catch {
      window.sessionStorage.removeItem(DRAFT_KEY);
    }
  }, [form]);

  useEffect(() => {
    const subscription = form.watch((values) => {
      if (typeof window === "undefined") return;
      window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(values));
      setLastSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    });
    return () => subscription.unsubscribe();
  }, [form]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(RECENT_ADDRESSES_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        setRecentAddresses(parsed.filter((v): v is string => typeof v === "string").slice(0, 8));
      }
    } catch {
      window.localStorage.removeItem(RECENT_ADDRESSES_KEY);
    }
  }, []);

  const values = form.watch();
  const plannedMinutes = getPlannedMinutes(routeEstimate, suggestedWindowMinutes);
  const plannedEnd = values.requestedWindowStart ? applyDurationToLocalDateTime(values.requestedWindowStart, plannedMinutes) : "";
  const trackingUrl = successResult ? `/portal/${successResult.publicId}?token=${successResult.token}` : null;

  useEffect(() => {
    if (!values.requestedWindowStart) {
      setSlotStatus("idle");
      setSlotAvailability(null);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setSlotStatus("checking");
        const startIso = toIsoFromLocal(values.requestedWindowStart);
        const response = await fetch(`/api/public/availability?start=${encodeURIComponent(startIso)}&duration=120`, {
          signal: controller.signal
        });
        const payload = (await response.json()) as SlotAvailability & { error?: string };
        if (!response.ok) {
          setSlotStatus("error");
          setSlotAvailability(null);
          return;
        }
        setSlotAvailability(payload);
        setSlotStatus(payload.available ? "available" : "busy");
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setSlotStatus("error");
      }
    }, 500);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [values.requestedWindowStart]);

  const progressValue = useMemo(() => (currentStep / 3) * 100, [currentStep]);
  const canContinueStep1 =
    Boolean(values.contactEmail) &&
    Boolean(values.requestedWindowStart) &&
    !form.formState.errors.contactEmail &&
    !form.formState.errors.requestedWindowStart &&
    slotStatus === "available";
  const stepDone = {
    1: canContinueStep1,
    2:
      Boolean(values.pickupText) &&
      Boolean(values.dropoffText) &&
      !form.formState.errors.pickupText &&
      !form.formState.errors.dropoffText &&
      Boolean(routeEstimate),
    3: Boolean(values.staffRequired && values.staffRequired >= 1) && !form.formState.errors.staffRequired && !form.formState.errors.notes
  } as const;

  async function continueFromStep1() {
    setGlobalError(null);
    const valid = await form.trigger(["contactEmail", "requestedWindowStart"]);
    if (!valid) return;
    if (slotStatus !== "available") {
      setGlobalError("Please choose an available start slot to continue.");
      return;
    }
    setCurrentStep(2);
  }

  async function continueFromStep2() {
    setGlobalError(null);
    const valid = await form.trigger(["pickupText", "dropoffText"]);
    if (!valid) return;
    if (!routeEstimate) {
      setGlobalError("Please wait for route estimate before continuing.");
      return;
    }
    setCurrentStep(3);
  }

  async function submitBooking() {
    setGlobalError(null);
    const valid = await form.trigger();
    if (!valid) return;
    try {
      const formValues = form.getValues();
      const formData = new FormData();
      formData.set("idempotencyKey", idempotencyKey);
      formData.set("contactEmail", formValues.contactEmail.trim());
      formData.set("requestedWindowStart", toIsoFromLocal(formValues.requestedWindowStart));
      formData.set("requestedWindowEnd", toIsoFromLocal(plannedEnd));
      formData.set("pickupText", formValues.pickupText.trim());
      formData.set("dropoffText", formValues.dropoffText.trim());
      formData.set("staffRequired", String(formValues.staffRequired));
      if (formValues.notes.trim()) formData.set("notes", formValues.notes.trim());

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
        setGlobalError(body?.error || "Booking request failed.");
        return;
      }

      const payload = (await response.json()) as CreateBookingResponse;
      const newRecent = Array.from(
        new Set([formValues.pickupText.trim(), formValues.dropoffText.trim(), ...recentAddresses].filter(Boolean))
      ).slice(0, 8);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(RECENT_ADDRESSES_KEY, JSON.stringify(newRecent));
      }
      setRecentAddresses(newRecent);
      setSuccessResult(payload);
      setSubmittedSummary({
        publicId: payload.publicId,
        contactEmail: formValues.contactEmail.trim(),
        requestedWindowStart: toIsoFromLocal(formValues.requestedWindowStart),
        requestedWindowEnd: toIsoFromLocal(plannedEnd),
        pickupText: formValues.pickupText.trim(),
        dropoffText: formValues.dropoffText.trim(),
        staffRequired: formValues.staffRequired,
        notes: formValues.notes.trim(),
        estimateText: routeEstimate
          ? `EUR ${routeEstimate.lowEur} - EUR ${routeEstimate.highEur}, ${routeEstimate.distanceKm.toFixed(1)} km, ETA ${routeEstimate.etaMinutes} min`
          : "Estimate not available"
      });
      setIdempotencyKey(newKey());
      form.reset({
        contactEmail: "",
        requestedWindowStart: "",
        pickupText: "",
        dropoffText: "",
        staffRequired: 2,
        notes: ""
      });
      if (typeof window !== "undefined") window.sessionStorage.removeItem(DRAFT_KEY);
      setRouteEstimate(null);
      setSuggestedWindowMinutes(null);
      setSlotStatus("idle");
      setSlotAvailability(null);
      setCurrentStep(1);
    } catch {
      setGlobalError("Network error while sending your request. Please retry.");
    }
  }

  function printSummary() {
    if (!submittedSummary) return;
    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Booking Summary ${escapeHtml(submittedSummary.publicId)}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
            h1 { margin: 0 0 8px 0; }
            p { margin: 6px 0; }
            .box { border: 1px solid #cbd5e1; border-radius: 12px; padding: 14px; margin-top: 12px; }
          </style>
        </head>
        <body>
          <h1>Booking Request Summary</h1>
          <p><strong>Booking ID:</strong> ${escapeHtml(submittedSummary.publicId)}</p>
          <div class="box">
            <p><strong>Email:</strong> ${escapeHtml(submittedSummary.contactEmail)}</p>
            <p><strong>Requested start:</strong> ${escapeHtml(new Date(submittedSummary.requestedWindowStart).toLocaleString())}</p>
            <p><strong>Planned end (estimate):</strong> ${escapeHtml(new Date(submittedSummary.requestedWindowEnd).toLocaleString())}</p>
            <p><strong>Pickup:</strong> ${escapeHtml(submittedSummary.pickupText)}</p>
            <p><strong>Dropoff:</strong> ${escapeHtml(submittedSummary.dropoffText)}</p>
            <p><strong>Staff:</strong> ${escapeHtml(String(submittedSummary.staffRequired))}</p>
            <p><strong>Route estimate:</strong> ${escapeHtml(submittedSummary.estimateText)}</p>
            <p><strong>Notes:</strong> ${escapeHtml(submittedSummary.notes || "No notes")}</p>
          </div>
        </body>
      </html>
    `;
    const popup = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
    if (!popup) return;
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    popup.print();
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="border-slate-200/80">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Customer booking request</CardTitle>
              <CardDescription>Step {currentStep} of 3. Complete all steps to submit your request.</CardDescription>
              <p className="mt-1 text-xs text-slate-500">Draft autosaved{lastSavedAt ? ` at ${lastSavedAt}` : ""}.</p>
            </div>
            <Badge className="border-slate-200 bg-slate-100 text-slate-700">What happens next: review to confirm to schedule</Badge>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {["Contact & time", "Route check", "Staff & notes"].map((label, index) => {
              const step = index + 1;
              const active = currentStep >= step;
              const done = stepDone[step as 1 | 2 | 3];
              return (
                <p
                  key={label}
                  className={`inline-flex items-center justify-center gap-1 rounded-full border px-2 py-1 text-center ${
                    active ? "border-sky-200 bg-sky-50 text-sky-800" : "border-slate-200 bg-white text-slate-500"
                  }`}
                >
                  {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                  {step}. {label}
                </p>
              );
            })}
          </div>
          <Progress value={progressValue} />
          <Alert>
            <AlertTitle>Estimated only</AlertTitle>
            <AlertDescription>Admin confirms final quote and schedule after reviewing your request details.</AlertDescription>
          </Alert>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentStep === 1 ? (
            <StepContactTime
              register={form.register}
              errors={form.formState.errors}
              canContinue={canContinueStep1}
              onNext={() => void continueFromStep1()}
              slotStatus={slotStatus}
              slotAvailability={slotAvailability}
            />
          ) : null}
          {currentStep === 2 ? (
            <StepRoute
              register={form.register}
              errors={form.formState.errors}
              staffRequired={values.staffRequired || 2}
              pickupText={values.pickupText || ""}
              dropoffText={values.dropoffText || ""}
              onBack={() => setCurrentStep(1)}
              onNext={() => void continueFromStep2()}
              canContinue={Boolean(routeEstimate)}
              onEstimateChange={setRouteEstimate}
              onSuggestedWindowMinutes={setSuggestedWindowMinutes}
              recentAddresses={recentAddresses}
            />
          ) : null}
          {currentStep === 3 ? (
            <StepStaffNotes
              register={form.register}
              errors={form.formState.errors}
              onBack={() => setCurrentStep(2)}
              isSubmitting={form.formState.isSubmitting}
              onSubmit={() => void form.handleSubmit(submitBooking)()}
              plannedEndLabel={plannedEnd ? new Date(plannedEnd).toLocaleString() : "-"}
            />
          ) : null}
          <div className="flex min-h-5 items-center justify-between gap-2">
            <p className="text-sm text-rose-700" aria-live="polite">
              {globalError || ""}
            </p>
            {globalError && currentStep === 3 ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={form.formState.isSubmitting}
                onClick={() => void form.handleSubmit(submitBooking)()}
              >
                Retry submit
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <BookingSummarySidebar
        values={values}
        routeEstimate={routeEstimate}
        plannedEnd={plannedEnd}
        onEditStep={(step) => setCurrentStep(step)}
      />

      {successResult && trackingUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
          <Card className="w-full max-w-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Request sent successfully
              </CardTitle>
              <CardDescription>
                Save your ticket link now. We also sent the same link to your email for easy access.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="break-all rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
                <a href={trackingUrl}>{trackingUrl}</a>
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="secondary" onClick={printSummary}>
                  Print summary
                </Button>
                <Button type="button" onClick={() => (window.location.href = trackingUrl)}>
                  Open tracking page
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={async () => {
                    await navigator.clipboard.writeText(`${window.location.origin}${trackingUrl}`);
                  }}
                >
                  <ClipboardCopy className="mr-1.5 h-4 w-4" /> Copy link
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setSuccessResult(null);
                    setSubmittedSummary(null);
                  }}
                >
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
