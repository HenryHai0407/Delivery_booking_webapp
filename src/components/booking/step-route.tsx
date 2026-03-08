import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { MapPinned } from "lucide-react";
import { RoutePreview, type RouteEstimate } from "@/app/(public)/route-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BookingWizardValues } from "./types";

type Props = {
  register: UseFormRegister<BookingWizardValues>;
  errors: FieldErrors<BookingWizardValues>;
  staffRequired: number;
  onBack: () => void;
  onNext: () => void;
  canContinue: boolean;
  pickupText: string;
  dropoffText: string;
  onEstimateChange: (estimate: RouteEstimate | null) => void;
  onSuggestedWindowMinutes: (minutes: number | null) => void;
  recentAddresses: string[];
};

export function StepRoute({
  register,
  errors,
  staffRequired,
  onBack,
  onNext,
  canContinue,
  pickupText,
  dropoffText,
  onEstimateChange,
  onSuggestedWindowMinutes,
  recentAddresses
}: Props) {
  return (
    <section aria-labelledby="step-route-title" className="space-y-5">
      <div>
        <h3 id="step-route-title" className="text-xl font-semibold text-slate-900">
          Step 2: Route check
        </h3>
        <p className="mt-1 text-sm text-slate-600">Enter addresses to preview route, ETA, and estimate range.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="pickupText" className="flex items-center gap-1.5">
          <MapPinned className="h-4 w-4 text-slate-500" /> Pickup address
        </Label>
        <Input
          id="pickupText"
          placeholder="Street, city, postal code"
          list="recent-addresses"
          aria-invalid={Boolean(errors.pickupText)}
          aria-describedby="pickupError"
          {...register("pickupText")}
        />
        <p id="pickupError" className="min-h-5 text-xs text-rose-600">
          {errors.pickupText?.message || ""}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="dropoffText" className="flex items-center gap-1.5">
          <MapPinned className="h-4 w-4 text-slate-500" /> Dropoff address
        </Label>
        <Input
          id="dropoffText"
          placeholder="Street, city, postal code"
          list="recent-addresses"
          aria-invalid={Boolean(errors.dropoffText)}
          aria-describedby="dropoffError"
          {...register("dropoffText")}
        />
        <p id="dropoffError" className="min-h-5 text-xs text-rose-600">
          {errors.dropoffText?.message || ""}
        </p>
      </div>

      <RoutePreview
        pickupText={pickupText}
        dropoffText={dropoffText}
        staffRequired={staffRequired}
        onEstimateChange={onEstimateChange}
        onSuggestedWindowMinutes={onSuggestedWindowMinutes}
      />
      {recentAddresses.length > 0 ? (
        <datalist id="recent-addresses">
          {recentAddresses.map((address) => (
            <option key={address} value={address} />
          ))}
        </datalist>
      ) : null}

      <div className="flex justify-between gap-3">
        <Button type="button" variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button type="button" onClick={onNext} disabled={!canContinue} aria-disabled={!canContinue}>
          Continue
        </Button>
      </div>
    </section>
  );
}
