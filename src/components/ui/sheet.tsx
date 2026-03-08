import * as React from "react";
import { cn } from "@/lib/utils";

type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
};

export function Sheet({ open, onOpenChange, children }: SheetProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <button
        aria-label="Close drawer overlay"
        className="absolute inset-0 bg-slate-950/35"
        onClick={() => onOpenChange(false)}
      />
      {children}
    </div>
  );
}

export function SheetContent({
  side = "right",
  className,
  children
}: {
  side?: "right" | "bottom" | "responsive";
  className?: string;
  children: React.ReactNode;
}) {
  const sideClasses =
    side === "bottom"
      ? "left-0 right-0 bottom-0 max-h-[88vh] w-full rounded-t-3xl border-t border-l-0"
      : side === "responsive"
        ? "left-0 right-0 bottom-0 max-h-[88vh] w-full rounded-t-3xl border-t border-l-0 md:bottom-auto md:left-auto md:right-0 md:top-0 md:h-full md:max-h-none md:max-w-xl md:rounded-none md:border-l md:border-t-0"
        : "right-0 top-0 h-full w-full max-w-xl border-l";
  return (
    <div
      role="dialog"
      aria-modal="true"
      className={cn(
        "absolute overflow-y-auto border-slate-200 bg-white p-6 shadow-2xl",
        sideClasses,
        className
      )}
    >
      {children}
    </div>
  );
}

export function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4 space-y-1", className)} {...props} />;
}

export function SheetTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-xl font-semibold text-slate-900", className)} {...props} />;
}

export function SheetDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-slate-600", className)} {...props} />;
}
