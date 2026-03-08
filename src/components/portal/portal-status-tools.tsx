"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

function relativeTime(input: string) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "just now";
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
}

export function PortalStatusTools({ updatedAtIso }: { updatedAtIso: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const relative = useMemo(() => {
    void now;
    return relativeTime(updatedAtIso);
  }, [now, updatedAtIso]);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs text-sky-800">Updated {relative}</span>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={isPending}
        onClick={() =>
          startTransition(() => {
            router.refresh();
          })
        }
      >
        <RefreshCcw className="mr-1.5 h-3.5 w-3.5" /> {isPending ? "Refreshing..." : "Refresh status"}
      </Button>
    </div>
  );
}

