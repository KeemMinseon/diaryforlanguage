// Shaped like MonthCalendar itself (header, month nav, weekday row, day
// grid) rather than a generic spinner, so arriving back at "/" doesn't
// flash an unrelated placeholder before the real calendar takes over.
export default function HomeLoading() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 animate-pulse flex-col gap-6 px-4 py-6">
      <div className="flex items-center justify-between">
        <div className="h-6 w-24 rounded-full bg-[var(--paper-line)]" />
        <div className="h-8 w-8 rounded-full bg-[var(--paper-line)]" />
      </div>

      <div className="flex items-center justify-between">
        <div className="h-4 w-4 rounded-full bg-[var(--paper-line)]" />
        <div className="h-5 w-20 rounded-full bg-[var(--paper-line)]" />
        <div className="h-4 w-4 rounded-full bg-[var(--paper-line)]" />
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-3 rounded-full bg-[var(--paper-line)]" />
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {Array.from({ length: 42 }).map((_, i) => (
          <div key={i} className="aspect-[1/1.25] rounded-xl bg-[var(--paper-line)]" />
        ))}
      </div>
    </div>
  );
}
