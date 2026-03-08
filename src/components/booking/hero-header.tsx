import { ShieldCheck, Sparkles, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export function HeroHeader() {
  return (
    <Card className="border-sky-100 bg-gradient-to-br from-white via-sky-50 to-blue-50 p-6 md:p-7">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">Delivery Booking Platform</p>
      <h1 className="mt-2 text-3xl font-bold leading-tight text-slate-900 md:text-4xl">Plan your move in under 2 minutes</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-600 md:text-base">
        Guided booking with route insight, clear pricing estimate, and a ticket link for live status tracking.
      </p>
      <div className="mt-4 flex flex-wrap gap-2.5">
        <Badge className="gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-800">
          <Timer className="h-3.5 w-3.5" /> Fast confirmation
        </Badge>
        <Badge className="gap-1.5 border-blue-200 bg-blue-50 text-blue-800">
          <ShieldCheck className="h-3.5 w-3.5" /> Insured movers
        </Badge>
        <Badge className="gap-1.5 border-violet-200 bg-violet-50 text-violet-800">
          <Sparkles className="h-3.5 w-3.5" /> Transparent pricing
        </Badge>
      </div>
      <a href="/login" className="mt-4 inline-block text-sm text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline">
        Staff sign-in /login
      </a>
    </Card>
  );
}
