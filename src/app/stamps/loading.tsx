// Shaped like StampCollectionView itself (header, ranking board grid,
// photo gallery grid) — see words/loading.tsx for why this route needs
// its own instead of falling back to the root calendar skeleton.
export default function StampsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 animate-pulse flex-col gap-8 px-4 py-6">
      <div className="flex items-center justify-between">
        <div className="h-4 w-16 rounded-full bg-[var(--paper-line)]" />
        <div className="h-5 w-16 rounded-full bg-[var(--paper-line)]" />
        <div className="h-4 w-[52px] rounded-full bg-transparent" />
      </div>

      <div className="flex flex-col gap-3">
        <div className="h-4 w-32 rounded-full bg-[var(--paper-line)]" />
        <div className="grid grid-cols-4 gap-x-5 gap-y-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <div className="aspect-[499.78/671.48] w-full rounded-2xl bg-[var(--paper-raised)]" />
              <div className="h-3 w-10 rounded-full bg-[var(--paper-line)]" />
              <div className="h-3 w-6 rounded-full bg-[var(--paper-line)]" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="h-4 w-20 rounded-full bg-[var(--paper-line)]" />
        <div className="grid grid-cols-4 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-[499.78/671.48] w-full rounded-2xl bg-[var(--paper-raised)]" />
          ))}
        </div>
      </div>
    </div>
  );
}
