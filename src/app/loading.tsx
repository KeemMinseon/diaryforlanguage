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
          <div key={i} className="aspect-[1/1.44] rounded-xl bg-[var(--paper-line)]" />
        ))}
      </div>

      {/* "이번 달" vocab list below the grid — each day is a label plus a
          horizontally-scrolling row of word chips (see MonthCalendar). */}
      <div className="flex flex-col gap-4">
        <div className="h-4 w-16 rounded-full bg-[var(--paper-line)]" />
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="h-3 w-16 rounded-full bg-[var(--paper-line)]" />
            <div className="flex flex-row gap-2">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="h-14 w-20 shrink-0 rounded-[10px] bg-[var(--paper-raised)]" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
