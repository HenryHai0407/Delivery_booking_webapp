import type { RefObject } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { BookingStatus } from "./types";

type FiltersState = {
  from: string;
  to: string;
  status: string;
  q: string;
  driverId: string;
  includeCancelled: boolean;
  unassignedOnly: boolean;
  missingPodOnly: boolean;
};

export function FiltersBar({
  value,
  statuses,
  drivers,
  searchInputRef,
  onPreset,
  onChange,
  onApply,
  onReset
}: {
  value: FiltersState;
  statuses: BookingStatus[];
  drivers: Array<{ id: string; email: string }>;
  searchInputRef?: RefObject<HTMLInputElement | null>;
  onPreset: (preset: "today" | "needs_assignment" | "at_risk") => void;
  onChange: (next: FiltersState) => void;
  onApply: () => void;
  onReset: () => void;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <Input
          type="date"
          aria-label="From date"
          value={value.from}
          onChange={(e) => onChange({ ...value, from: e.target.value })}
        />
        <Input type="date" aria-label="To date" value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })} />
        <Select value={value.status} onChange={(e) => onChange({ ...value, status: e.target.value })} aria-label="Status filter">
          <option value="">All statuses</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status.replaceAll("_", " ")}
            </option>
          ))}
        </Select>
        <Select value={value.driverId} onChange={(e) => onChange({ ...value, driverId: e.target.value })} aria-label="Driver filter">
          <option value="">All drivers</option>
          {drivers.map((driver) => (
            <option key={driver.id} value={driver.id}>
              {driver.email}
            </option>
          ))}
        </Select>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
          <Input
            ref={searchInputRef}
            className="pl-9"
            placeholder="Search id/email/route"
            value={value.q}
            onChange={(e) => onChange({ ...value, q: e.target.value })}
            aria-label="Search filter"
          />
        </div>
        <label className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={value.includeCancelled}
            onChange={(e) => onChange({ ...value, includeCancelled: e.target.checked })}
          />
          Show cancelled
        </label>
      </div>
      <div className="mt-3 flex gap-2">
        <Button onClick={onApply}>Apply</Button>
        <Button variant="secondary" onClick={onReset}>
          Reset
        </Button>
        <Button type="button" variant="secondary" onClick={() => onPreset("today")}>
          Today
        </Button>
        <Button type="button" variant="secondary" onClick={() => onPreset("needs_assignment")}>
          Needs assignment
        </Button>
        <Button type="button" variant="secondary" onClick={() => onPreset("at_risk")}>
          At risk
        </Button>
        <p className="ml-auto self-center text-xs text-slate-500">Shortcuts: `/` search, `j/k` navigate, `e` open</p>
      </div>
    </div>
  );
}
