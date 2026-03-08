import { HeroHeader } from "@/components/booking/hero-header";
import { BookingWizard } from "@/components/booking/booking-wizard";
import { ShieldCheck, Timer, Undo2 } from "lucide-react";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <HeroHeader />
      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white/80 p-3 text-sm text-slate-700">
          <p className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
            <Timer className="h-4 w-4 text-sky-700" /> Response SLA
          </p>
          <p className="mt-1 text-xs text-slate-600">Typical admin response within 30-90 minutes during business hours.</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white/80 p-3 text-sm text-slate-700">
          <p className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
            <ShieldCheck className="h-4 w-4 text-sky-700" /> Service area
          </p>
          <p className="mt-1 text-xs text-slate-600">Local and regional moving requests. Route is reviewed before confirmation.</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white/80 p-3 text-sm text-slate-700">
          <p className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
            <Undo2 className="h-4 w-4 text-sky-700" /> Change policy
          </p>
          <p className="mt-1 text-xs text-slate-600">Need to change details? Use your ticket link and contact support before dispatch.</p>
        </article>
      </section>
      <BookingWizard />
      <p className="text-xs text-slate-500">MVP: request booking first, then track status via your magic link.</p>
    </main>
  );
}
