// Shaped like the settings page itself (header, one settings row,
// logout button) rather than a generic spinner.
export default function SettingsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 animate-pulse flex-col gap-6 px-4 py-6">
      <div className="flex items-center justify-between">
        <div className="h-4 w-16 rounded-full bg-[var(--paper-line)]" />
        <div className="h-5 w-12 rounded-full bg-[var(--paper-line)]" />
        <div className="h-4 w-16 rounded-full bg-transparent" />
      </div>

      <div className="h-14 w-full rounded-2xl bg-[var(--paper-line)]" />
      <div className="h-14 w-full rounded-2xl bg-[var(--paper-line)]" />
    </div>
  );
}
