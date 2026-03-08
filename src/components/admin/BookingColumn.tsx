import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookingCard } from "./BookingCard";
import type { AdminBooking, BookingStatus } from "./types";

const PAGE_SIZE = 20;

export function BookingColumn({
  title,
  bookings,
  onOpenBooking,
  onMoveBooking
}: {
  title: string;
  bookings: AdminBooking[];
  onOpenBooking: (booking: AdminBooking) => void;
  onMoveBooking: (booking: AdminBooking, status: BookingStatus) => void;
}) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const visible = useMemo(() => bookings.slice(0, visibleCount), [bookings, visibleCount]);
  const hasMore = visibleCount < bookings.length;

  return (
    <div className="min-w-[280px] rounded-3xl border border-slate-200/80 bg-gradient-to-b from-white/85 to-slate-50/70 p-3 shadow-sm backdrop-blur">
      <div className="sticky top-0 z-10 mb-3 flex items-center justify-between gap-2 rounded-2xl bg-white/90 px-2 py-1 backdrop-blur">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <Badge className="border-slate-200 bg-white text-slate-700">{bookings.length}</Badge>
      </div>
      <div className="space-y-3">
        {visible.map((booking) => (
          <BookingCard
            key={booking.id}
            booking={booking}
            onOpen={() => onOpenBooking(booking)}
            onMove={(status) => onMoveBooking(booking, status)}
          />
        ))}
      </div>
      {hasMore ? (
        <Button variant="secondary" className="mt-3 w-full" onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}>
          Load more
        </Button>
      ) : null}
    </div>
  );
}
