import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { Users, StickyNote, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { BookingWizardValues } from "./types";

type Props = {
  register: UseFormRegister<BookingWizardValues>;
  errors: FieldErrors<BookingWizardValues>;
  onBack: () => void;
  isSubmitting: boolean;
  onSubmit: () => void;
  plannedEndLabel: string;
};

export function StepStaffNotes({ register, errors, onBack, isSubmitting, onSubmit, plannedEndLabel }: Props) {
  return (
    <section aria-labelledby="step-staff-title" className="space-y-4">
      <div>
        <h3 id="step-staff-title" className="text-xl font-semibold text-slate-900">
          Step 3: Staff and final notes
        </h3>
        <p className="mt-1 text-sm text-slate-600">Tell us staffing needs and any details to speed up confirmation.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="staffRequired" className="flex items-center gap-1.5">
          <Users className="h-4 w-4 text-slate-500" /> Staff needed
        </Label>
        <Input
          id="staffRequired"
          type="number"
          min={1}
          max={8}
          aria-invalid={Boolean(errors.staffRequired)}
          aria-describedby="staffHelp staffError"
          {...register("staffRequired", { valueAsNumber: true })}
        />
        <p id="staffHelp" className="text-xs text-slate-500">
          Each extra staff adds a fixed hourly price increment.
        </p>
        <p id="staffError" className="min-h-5 text-xs text-rose-600">
          {errors.staffRequired?.message || ""}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes" className="flex items-center gap-1.5">
          <StickyNote className="h-4 w-4 text-slate-500" /> Notes (optional)
        </Label>
        <Textarea id="notes" maxLength={1000} placeholder="Parking info, stairs, bulky items, special instructions..." {...register("notes")} />
        <p className="min-h-5 text-xs text-rose-600">{errors.notes?.message || ""}</p>
      </div>

      <p className="inline-flex items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
        <Clock3 className="h-4 w-4 text-slate-500" /> Planned end estimate: {plannedEndLabel}
      </p>

      <div className="flex justify-between gap-3">
        <Button type="button" variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button type="button" onClick={onSubmit} disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Submit booking request"}
        </Button>
      </div>
    </section>
  );
}
