import { KANBAN_COLUMNS } from "./constants";
import { bookingColumn } from "./helpers";
import { BookingColumn } from "./BookingColumn";
import type { AdminBooking, BookingStatus, KanbanColumnKey } from "./types";

export function BookingsKanban({
  bookings,
  includeCancelled,
  onOpenBooking,
  onMoveBooking
}: {
  bookings: AdminBooking[];
  includeCancelled: boolean;
  onOpenBooking: (booking: AdminBooking) => void;
  onMoveBooking: (booking: AdminBooking, status: BookingStatus) => void;
}) {
  const grouped = bookings.reduce<Record<KanbanColumnKey, AdminBooking[]>>(
    (acc, booking) => {
      const col = bookingColumn(booking);
      acc[col].push(booking);
      return acc;
    },
    {
      new: [],
      needs_review: [],
      confirmed: [],
      scheduled: [],
      assigned: [],
      in_progress: [],
      completed: [],
      cancelled: []
    }
  );

  const columns = KANBAN_COLUMNS.filter((col) => col.showByDefault || includeCancelled);
  const hasAny = columns.some((column) => grouped[column.key].length > 0);

  return (
    <section aria-label="Bookings Kanban board" className="overflow-x-auto rounded-3xl border border-slate-200/80 bg-white/60 p-3">
      <div className="flex min-h-[60vh] gap-3">
        {columns.map((column) => (
          <BookingColumn
            key={column.key}
            title={column.title}
            bookings={grouped[column.key]}
            onOpenBooking={onOpenBooking}
            onMoveBooking={onMoveBooking}
          />
        ))}
      </div>
      {!hasAny ? (
        <div className="flex min-h-24 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/50 p-4 text-sm text-slate-600">
          No bookings in the selected filters.
        </div>
      ) : null}
    </section>
  );
}
