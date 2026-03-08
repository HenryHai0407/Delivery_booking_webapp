import { Activity, CalendarClock, CheckCircle2, Inbox } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { AdminStats } from "./types";

export function KpiHeader({ stats }: { stats: AdminStats }) {
  const items = [
    { label: "New today", value: stats.todayBookings, icon: Inbox },
    { label: "Scheduled today", value: stats.pendingConfirmations, icon: CalendarClock },
    { label: "In progress", value: stats.inProgress, icon: Activity },
    { label: "Completed today", value: stats.completedToday, icon: CheckCircle2 }
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} className="bg-white/80 backdrop-blur">
          <CardContent className="flex items-center justify-between pt-5">
            <div>
              <p className="text-xs text-slate-500">{item.label}</p>
              <p className="text-2xl font-semibold text-slate-900">{item.value}</p>
            </div>
            <item.icon className="h-5 w-5 text-sky-600" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
