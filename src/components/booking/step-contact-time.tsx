import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { Loader2, Mail, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BookingWizardValues, SlotAvailability } from "./types";

type Props = {
  register: UseFormRegister<BookingWizardValues>;
  errors: FieldErrors<BookingWizardValues>;
  canContinue: boolean;
  onNext: () => void;
  slotStatus: "idle" | "checking" | "available" | "busy" | "error";
  slotAvailability: SlotAvailability | null;
};

export function StepContactTime({ register, errors, canContinue, onNext, slotStatus, slotAvailability }: Props) {
  const timezone =
    typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone || "local timezone" : "local timezone";
  return (
    <section aria-labelledby="step-contact-title" className="space-y-4">
      <div>
        <h3 id="step-contact-title" className="text-xl font-semibold text-slate-900">
          Step 1: Contact and move time
        </h3>
        <p className="mt-1 text-sm text-slate-600">We will send your ticket link to this email and check slot availability.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="contactEmail" className="flex items-center gap-1.5">
          <Mail className="h-4 w-4 text-slate-500" /> Email for updates
        </Label>
        <Input
          id="contactEmail"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          aria-invalid={Boolean(errors.contactEmail)}
          aria-describedby="contactEmailHelp contactEmailError"
          {...register("contactEmail")}
        />
        <p id="contactEmailHelp" className="text-xs text-slate-500">
          Used only for booking updates and your tracking ticket link.
        </p>
        <p id="contactEmailError" className="min-h-5 text-xs text-rose-600">
          {errors.contactEmail?.message || ""}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="requestedWindowStart" className="flex items-center gap-1.5">
          <CalendarClock className="h-4 w-4 text-slate-500" /> Move start time
        </Label>
        <Input
          id="requestedWindowStart"
          type="datetime-local"
          aria-invalid={Boolean(errors.requestedWindowStart)}
          aria-describedby="timeHelp timeError"
          {...register("requestedWindowStart")}
        />
        <p id="timeHelp" className="text-xs text-slate-500">
          Times are shown in your local timezone ({timezone}).
        </p>
        <p id="timeError" className="min-h-5 text-xs text-rose-600">
          {errors.requestedWindowStart?.message || ""}
        </p>
      </div>

      <div className="min-h-6 text-sm" aria-live="polite">
        {slotStatus === "checking" ? (
          <p className="inline-flex items-center gap-1.5 text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking availability...
          </p>
        ) : null}
        {slotAvailability ? (
          <p className={slotAvailability.available ? "text-emerald-700" : "text-rose-700"}>
            {slotAvailability.message} ({slotAvailability.overlapCount}/{slotAvailability.capacity} slots used)
          </p>
        ) : null}
        {slotStatus === "error" ? <p className="text-rose-700">Could not verify slot right now. Please retry.</p> : null}
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={onNext} disabled={!canContinue} aria-disabled={!canContinue}>
          Continue
        </Button>
      </div>
    </section>
  );
}
