import { prisma } from "@/lib/db";
import { safeLog } from "@/lib/logging";

type NotificationKind = "booking_received" | "booking_confirmed" | "booking_completed";

interface NotificationInput {
  kind: NotificationKind;
  bookingId: string;
  publicId: string;
  token: string;
  contactEmail: string | null | undefined;
  actorUserId?: string;
  correlationId?: string;
  baseUrl: string;
}

function subjectFor(kind: NotificationKind, publicId: string) {
  if (kind === "booking_received") return `Booking received: ${publicId}`;
  if (kind === "booking_confirmed") return `Booking confirmed: ${publicId}`;
  return `Booking completed: ${publicId}`;
}

function bodyFor(
  kind: NotificationKind,
  trackingUrl: string,
  details?: { pickupText?: string; dropoffText?: string; requestedWindowStart?: Date | null }
) {
  const routeLine =
    details?.pickupText && details?.dropoffText ? `Route: ${details.pickupText} -> ${details.dropoffText}\n` : "";
  const startLine = details?.requestedWindowStart
    ? `Requested start: ${details.requestedWindowStart.toLocaleString()}\n`
    : "";
  if (kind === "booking_received") {
    return `Your booking request was received.\n${startLine}${routeLine}Track updates: ${trackingUrl}`;
  }
  if (kind === "booking_confirmed") {
    return `Your booking is confirmed.\n${startLine}${routeLine}Track updates: ${trackingUrl}`;
  }
  return `Your delivery is completed.\n${routeLine}View details: ${trackingUrl}`;
}

async function sendViaSendGrid(to: string, subject: string, text: string) {
  const key = process.env.SENDGRID_API_KEY;
  const from = process.env.SENDGRID_FROM_EMAIL;
  if (!key || !from) {
    return { attempted: false, sent: false, provider: "sendgrid", reason: "sendgrid_not_configured" };
  }

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from },
      subject,
      content: [{ type: "text/plain", value: text }]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    return {
      attempted: true,
      sent: false,
      provider: "sendgrid",
      reason: `sendgrid_${response.status}`,
      error: errText.slice(0, 500)
    };
  }

  return {
    attempted: true,
    sent: true,
    provider: "sendgrid",
    messageId: response.headers.get("x-message-id") || undefined
  };
}

export async function notifyBooking(input: NotificationInput) {
  if (!input.contactEmail) {
    safeLog("booking_notification_skipped", {
      correlationId: input.correlationId,
      bookingId: input.bookingId,
      kind: input.kind,
      reason: "missing_contact_email"
    });
    return;
  }

  const details = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    select: { pickupText: true, dropoffText: true, requestedWindowStart: true }
  });
  const trackingUrl = `${input.baseUrl}/portal/${input.publicId}?token=${input.token}`;
  const subject = subjectFor(input.kind, input.publicId);
  const text = bodyFor(input.kind, trackingUrl, details || undefined);
  let result: { attempted: boolean; sent: boolean; provider: string; reason?: string; messageId?: string; error?: string } = {
    attempted: false,
    sent: false,
    provider: "sendgrid",
    reason: "unknown"
  };
  try {
    result = await sendViaSendGrid(input.contactEmail, subject, text);
  } catch (error) {
    result = {
      attempted: true,
      sent: false,
      provider: "sendgrid",
      reason: "sendgrid_exception",
      error: (error as Error).message
    };
  }

  try {
    await prisma.bookingEvent.create({
      data: {
        bookingId: input.bookingId,
        actorUserId: input.actorUserId,
        eventType: "message_sent",
        payloadJson: JSON.stringify({
          kind: input.kind,
          provider: result.provider,
          attempted: result.attempted,
          sent: result.sent,
          messageId: result.messageId,
          reason: result.reason,
          correlationId: input.correlationId
        })
      }
    });
  } catch (error) {
    safeLog("booking_notification_event_write_failed", {
      correlationId: input.correlationId,
      bookingId: input.bookingId,
      kind: input.kind,
      error: (error as Error).message
    });
  }

  safeLog("booking_notification", {
    correlationId: input.correlationId,
    bookingId: input.bookingId,
    kind: input.kind,
    sent: result.sent,
    reason: result.reason
  });
}
