import * as React from "react";
import { cn } from "@/lib/utils";

export function Progress({ value, className }: { value: number; className?: string }) {
  const safeValue = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-slate-200", className)} aria-hidden="true">
      <div
        className="h-full rounded-full bg-gradient-to-r from-sky-500 to-blue-600 transition-all"
        style={{ width: `${safeValue}%` }}
      />
    </div>
  );
}
