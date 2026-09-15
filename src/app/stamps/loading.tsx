// Shaped like StampCollectionView itself (back link, big count + stats,
// tab bar, month-grouped stamp grid) — see words/loading.tsx for why this
// route needs its own instead of falling back to the root calendar
// skeleton.
export default function StampsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 animate-pulse flex-col gap-6 px-4 py-6">
      <div className="h-4 w-16 rounded-full bg-[var(--paper-line)]" />

      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <div className="h-10 w-16 rounded-full bg-[var(--paper-line)]" />
          <div className="h-3 w-14 rounded-full bg-[var(--paper-line)]" />
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="h-3 w-20 rounded-full bg-[var(--paper-line)]" />
          <div className="h-3 w-20 rounded-full bg-[var(--paper-line)]" />
        </div>
      </div>

      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-9 w-20 rounded-full bg-[var(--paper-line)]" />
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <div className="h-4 w-24 rounded-full bg-[var(--paper-line)]" />
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="aspect-[499.78/671.48] w-full bg-[var(--paper-raised)]" />
              <div className="h-3 w-8 rounded-full bg-[var(--paper-line)]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
