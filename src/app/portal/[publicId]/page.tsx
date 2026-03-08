import { prisma } from "@/lib/db";

interface PortalProps {
  params: { publicId: string };
  searchParams: { token?: string };
}

function safeJson(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
  return {};
}

function money(cents: number | null) {
  if (cents == null) return "Pending quote";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export default async function PortalPage({ params, searchParams }: PortalProps) {
  const token = searchParams.token;
  if (!token) {
    return (
      <main>
        <h1>Booking Portal</h1>
        <p className="error">Missing token. Use the full tracking link from your booking confirmation.</p>
      </main>
    );
  }

  const booking = await prisma.booking.findUnique({
    where: { publicId: params.publicId },
    select: {
      publicId: true,
      customerToken: true,
      status: true,
      requestedWindowStart: true,
      requestedWindowEnd: true,
      scheduledWindowStart: true,
      scheduledWindowEnd: true,
      quoteAmountCents: true,
      notes: true,
      updatedAt: true,
      events: {
        where: {
          eventType: {
            in: ["status_change", "message_sent", "pod_uploaded"]
          }
        },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          eventType: true,
          payloadJson: true,
          createdAt: true
        }
      }
    }
  });

  if (!booking || booking.customerToken !== token) {
    return (
      <main>
        <h1>Booking Portal</h1>
        <p className="error">Booking not found. Check the tracking link and try again.</p>
      </main>
    );
  }

  const timeline = booking.events.map((event) => {
    const payload = safeJson(event.payloadJson);
    if (event.eventType === "status_change") {
      const to = typeof payload.to === "string" ? payload.to : "updated";
      const from = typeof payload.from === "string" ? payload.from : null;
      return {
        id: event.id,
        at: event.createdAt,
        text: from ? `Status changed from ${from} to ${to}` : `Status changed to ${to}`
      };
    }
    if (event.eventType === "pod_uploaded") {
      return {
        id: event.id,
        at: event.createdAt,
        text: "Proof of delivery uploaded"
      };
    }
    return {
      id: event.id,
      at: event.createdAt,
      text: "Notification sent"
    };
  });

  return (
    <main>
      <h1>Booking Portal</h1>
      <div className="card grid">
        <p>
          <strong>Booking ID:</strong> {booking.publicId}
        </p>
        <p>
          <strong>Status:</strong> {booking.status}
        </p>
        <p>
          <strong>Requested window:</strong> {booking.requestedWindowStart.toLocaleString()} -{" "}
          {booking.requestedWindowEnd.toLocaleString()}
        </p>
        <p>
          <strong>Scheduled window:</strong>{" "}
          {booking.scheduledWindowStart && booking.scheduledWindowEnd
            ? `${booking.scheduledWindowStart.toLocaleString()} - ${booking.scheduledWindowEnd.toLocaleString()}`
            : "Not scheduled yet"}
        </p>
        <p>
          <strong>Quote:</strong> {money(booking.quoteAmountCents)}
        </p>
        <p>
          <strong>Last updated:</strong> {booking.updatedAt.toLocaleString()}
        </p>
        <p>
          <strong>Notes:</strong> {booking.notes || "No notes"}
        </p>
      </div>
      <div className="card">
        <h2>Timeline</h2>
        {timeline.length === 0 ? <p>No updates yet.</p> : null}
        {timeline.length > 0 ? (
          <ul>
            {timeline.map((item) => (
              <li key={item.id}>
                {item.text} ({item.at.toLocaleString()})
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </main>
  );
}
