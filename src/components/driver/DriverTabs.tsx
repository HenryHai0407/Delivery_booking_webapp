import type { DriverTabKey } from "./types";

const TABS: Array<{ key: DriverTabKey; label: string }> = [
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" }
];

export function DriverTabs({
  value,
  onChange,
  counts
}: {
  value: DriverTabKey;
  onChange: (next: DriverTabKey) => void;
  counts: Record<DriverTabKey, number>;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-1 backdrop-blur">
      <div className="grid grid-cols-3 gap-1">
        {TABS.map((tab) => {
          const active = value === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                active ? "bg-slate-900 text-white shadow-sm" : "text-slate-700 hover:bg-slate-100"
              }`}
              aria-pressed={active}
            >
              {tab.label} <span className="text-xs opacity-80">({counts[tab.key]})</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

