import { CalendarDays, CircleDot, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

function todayLabel() {
  return new Intl.DateTimeFormat("en-FI", { weekday: "short", month: "short", day: "numeric" }).format(new Date());
}

export function DriverHeader({
  online,
  onRefresh,
  refreshing
}: {
  online: boolean;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <header className="rounded-3xl border border-slate-200/70 bg-gradient-to-r from-slate-950 via-sky-900 to-indigo-900 p-4 text-white shadow-[0_16px_40px_rgba(15,23,42,0.35)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-sky-200">Driver</p>
          <h1 className="text-2xl font-semibold leading-tight">Command Center</h1>
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-sky-100">
            <CalendarDays className="h-4 w-4" /> {todayLabel()}
          </p>
        </div>
        <div className="text-right">
          <p
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
              online ? "border-emerald-300/60 bg-emerald-400/15 text-emerald-100" : "border-rose-300/60 bg-rose-400/20 text-rose-100"
            }`}
          >
            <CircleDot className="h-3.5 w-3.5" />
            {online ? "Online" : "Offline"}
          </p>
          <div className="mt-2">
            <Button size="sm" variant="secondary" className="h-8 rounded-xl" onClick={onRefresh} disabled={refreshing}>
              <RefreshCcw className="mr-1 h-3.5 w-3.5" />
              {refreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

