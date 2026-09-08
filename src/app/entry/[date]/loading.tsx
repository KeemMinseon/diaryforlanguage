// Navigating here from the calendar involves two real network round
// trips before this route's own content exists (proxy.ts's auth check,
// then the entry lookup) — without this file, the calendar just sat
// there doing nothing for that whole stretch, which read as the tap
// having not registered at all. This automatically wraps the route in a
// Suspense boundary, so it shows immediately while that data loads.
//
// Deliberately NOT shaped like either destination screen: this route
// resolves to ReviewView (a day with an entry) or ChatEditor (a blank
// day) depending on data this file can't see yet — loading.tsx doesn't
// receive params or searchParams (Next's own file convention, not a
// missed prop), so there's no way to know which one is coming. An
// earlier version guessed ReviewView's layout, which looked visibly
// wrong whenever the destination was actually the blank-day writing
// screen. A neutral "preparing" indicator never mismatches either.
export default function EntryLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
      <div className="flex animate-pulse items-center justify-between">
        <div className="h-4 w-16 rounded-full bg-[var(--paper-line)]" />
        <div className="h-4 w-32 rounded-full bg-[var(--paper-line)]" />
        <div className="h-4 w-16 rounded-full bg-[var(--paper-line)]" />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <span className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-full bg-[var(--ink-soft)]"
            style={{ animation: "typing-bounce 1.1s ease-in-out infinite", animationDelay: "0ms" }}
          />
          <span
            className="h-2 w-2 rounded-full bg-[var(--ink-soft)]"
            style={{ animation: "typing-bounce 1.1s ease-in-out infinite", animationDelay: "150ms" }}
          />
          <span
            className="h-2 w-2 rounded-full bg-[var(--ink-soft)]"
            style={{ animation: "typing-bounce 1.1s ease-in-out infinite", animationDelay: "300ms" }}
          />
        </span>
        <p className="text-sm text-[var(--ink-soft)]">불러오는 중…</p>
      </div>
    </div>
  );
}
