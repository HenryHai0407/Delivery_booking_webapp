import { ArrowRightCircle, Copy, MapPin, Navigation, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DriverStatus } from "./types";

function nextStatus(current: DriverStatus): DriverStatus | null {
  if (current === "assigned") return "driver_en_route";
  if (current === "driver_en_route") return "picked_up";
  if (current === "picked_up") return "delivered";
  if (current === "delivered") return "completed";
  return null;
}

function nextLabel(current: DriverStatus) {
  if (current === "assigned") return "Start En Route";
  if (current === "driver_en_route") return "Mark Picked Up";
  if (current === "picked_up") return "Mark Delivered";
  if (current === "delivered") return "Complete Job";
  return "No Next Status";
}

export function StatusActionBar({
  status,
  loading,
  onNextStatus,
  onNavigatePickup,
  onNavigateDropoff,
  onCall,
  onCopy
}: {
  status: DriverStatus;
  loading: boolean;
  onNextStatus: (to: DriverStatus) => void;
  onNavigatePickup: () => void;
  onNavigateDropoff: () => void;
  onCall: () => void;
  onCopy: () => void;
}) {
  const next = nextStatus(status);
  return (
    <div className="sticky bottom-0 -mx-4 mt-4 border-t border-slate-200 bg-white/95 px-4 pb-4 pt-3 backdrop-blur supports-[backdrop-filter]:bg-white/80 md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:pb-0">
      <Button className="h-12 w-full rounded-2xl text-base" disabled={!next || loading} onClick={() => next && onNextStatus(next)}>
        <ArrowRightCircle className="mr-2 h-5 w-5" />
        {loading ? "Updating..." : nextLabel(status)}
      </Button>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button variant="secondary" className="h-11 rounded-xl" onClick={onNavigatePickup}>
          <Navigation className="mr-1 h-4 w-4" /> Pickup
        </Button>
        <Button variant="secondary" className="h-11 rounded-xl" onClick={onNavigateDropoff}>
          <MapPin className="mr-1 h-4 w-4" /> Dropoff
        </Button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button variant="secondary" className="h-11 rounded-xl" onClick={onCall}>
          <PhoneCall className="mr-1 h-4 w-4" /> Call
        </Button>
        <Button variant="secondary" className="h-11 rounded-xl" onClick={onCopy}>
          <Copy className="mr-1 h-4 w-4" /> Copy
        </Button>
      </div>
    </div>
  );
}
