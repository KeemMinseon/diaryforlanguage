// Navigating here from the calendar involves two real network round
// trips before this route's own content exists (proxy.ts's auth check,
// then the entry lookup) — without this file, the calendar just sat
// there doing nothing for that whole stretch, which read as the tap
// having not registered at all. This automatically wraps the route in a
// Suspense boundary, so it shows immediately while that data loads.
export default function EntryLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 animate-pulse flex-col gap-6 px-4 py-6">
      <div className="flex items-center justify-between">
        <div className="h-4 w-16 rounded-full bg-[var(--paper-line)]" />
        <div className="h-4 w-32 rounded-full bg-[var(--paper-line)]" />
        <div className="h-4 w-16 rounded-full bg-[var(--paper-line)]" />
      </div>

      <div className="flex flex-col items-center gap-4">
        <div className="aspect-[170/210] w-28 rounded-xl bg-[var(--paper-line)]" />
        <div className="h-40 w-full rounded-2xl bg-[var(--paper-line)]" />
      </div>

      <div className="h-24 w-full rounded-2xl bg-[var(--paper-line)]" />
      <div className="h-16 w-full rounded-2xl bg-[var(--paper-line)]" />
    </div>
  );
}
