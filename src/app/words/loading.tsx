// Shaped like WordListView itself (header, filter row, word cards)
// rather than falling back to the root calendar skeleton (Next's App
// Router uses the nearest ancestor loading.tsx when a route has none of
// its own — this route had none, so arriving here briefly flashed the
// home page's calendar-grid placeholder instead of anything resembling
// a word list).
export default function WordsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 animate-pulse flex-col gap-5 px-4 py-6">
      <div className="flex items-center justify-between">
        <div className="h-4 w-16 rounded-full bg-[var(--paper-line)]" />
        <div className="h-5 w-14 rounded-full bg-[var(--paper-line)]" />
        <div className="h-4 w-[52px] rounded-full bg-transparent" />
      </div>

      <div className="flex items-center justify-between">
        <div className="h-3 w-28 rounded-full bg-[var(--paper-line)]" />
        <div className="h-7 w-40 rounded-full bg-[var(--paper-line)]" />
      </div>

      {/* "단어 테스트" entry card — see WordListView/WordQuiz. */}
      <div className="h-16 w-full rounded-2xl bg-[var(--paper-raised)]" />

      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 w-full rounded-xl bg-[var(--paper-raised)]" />
        ))}
      </div>
    </div>
  );
}
