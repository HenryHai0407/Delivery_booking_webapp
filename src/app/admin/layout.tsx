export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-[1800px] px-4 py-6 md:px-6">
      <div className="rounded-[28px] border border-slate-200/70 bg-gradient-to-br from-white/90 via-sky-50/60 to-white/90 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur md:p-6">
        {children}
      </div>
    </main>
  );
}
