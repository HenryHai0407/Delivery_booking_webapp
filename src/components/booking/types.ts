import type { RouteEstimate } from "@/app/(public)/route-preview";

export type BookingWizardValues = {
  contactEmail: string;
  requestedWindowStart: string;
  pickupText: string;
  dropoffText: string;
  staffRequired: number;
  notes: string;
};

export type SlotAvailability = {
  available: boolean;
  message: string;
  overlapCount: number;
  capacity: number;
};

export type StepProps = {
  onNext: () => void;
  onBack?: () => void;
  canContinue: boolean;
  isSubmitting: boolean;
};

export type SummaryProps = {
  values: BookingWizardValues;
  routeEstimate: RouteEstimate | null;
  plannedEnd: string;
  onEditStep?: (step: 1 | 2 | 3) => void;
};
