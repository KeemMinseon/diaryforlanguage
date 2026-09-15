// Shaped like MonthCalendar itself — icon + 3-icon row header, counter +
// month-nav row, the plain 6-column sequential day grid (no weekday row;
// see daysInMonth's own doc comment for why this isn't a 7-column
// calendar), and the TODAY card — rather than a generic spinner, so
// arriving back at "/" doesn't flash an unrelated placeholder, or a
// differently-shaped one, before the real calendar takes over.
export default function HomeLoading() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 animate-pulse flex-col gap-6 px-4 py-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-8 rounded-lg bg-[var(--paper-line)]" />
        <div className="flex items-center gap-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-8 w-8 rounded-full bg-[var(--paper-line)]" />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        {/* "N/N" 채운 날 카운터 자리 — 큰 숫자 + 작은 총 일수 */}
        <div className="flex items-end gap-1">
          <div className="h-9 w-8 rounded-full bg-[var(--paper-line)]" />
          <div className="h-4 w-8 rounded-full bg-[var(--paper-line)]" />
        </div>
        {/* "‹ 08 09 10 ›" 월 이동 스트립 자리 */}
        <div className="flex items-center gap-1.5">
          <div className="h-4 w-4 rounded-full bg-[var(--paper-line)]" />
          <div className="h-4 w-6 rounded-full bg-[var(--paper-line)]" />
          <div className="h-5 w-6 rounded-full bg-[var(--paper-line)]" />
          <div className="h-4 w-6 rounded-full bg-[var(--paper-line)]" />
          <div className="h-4 w-4 rounded-full bg-[var(--paper-line)]" />
        </div>
      </div>

      <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
        {Array.from({ length: 30 }).map((_, i) => (
          <div key={i} className="aspect-[4/5] bg-[var(--paper-line)]" />
        ))}
      </div>

      {/* TODAY 카드 — 오늘 날짜/일기 내용 미리보기 자리 */}
      <div className="flex flex-col gap-2 rounded-2xl bg-[var(--paper-raised)] px-5 py-4">
        <div className="h-3 w-24 rounded-full bg-[var(--paper-line)]" />
        <div className="h-4 w-full rounded-full bg-[var(--paper-line)]" />
      </div>
    </div>
  );
}
