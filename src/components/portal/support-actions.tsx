"use client";

import { Mail, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SupportActions({ bookingId }: { bookingId: string }) {
  const subject = encodeURIComponent(`Support request for booking ${bookingId}`);
  const body = encodeURIComponent(
    `Hello support,\n\nI need help with booking ${bookingId}.\n\nPlease advise.\n`
  );
  const mailto = `mailto:support@example.com?subject=${subject}&body=${body}`;

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="secondary"
        onClick={async () => {
          await navigator.clipboard.writeText(bookingId);
        }}
      >
        <Copy className="mr-1.5 h-4 w-4" /> Copy booking ID
      </Button>
      <Button type="button" variant="secondary" onClick={() => (window.location.href = mailto)}>
        <Mail className="mr-1.5 h-4 w-4" /> Email support
      </Button>
    </div>
  );
}

