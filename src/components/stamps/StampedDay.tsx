import DiaryStamp from "@/components/stamps/DiaryStamp";
import HankoStamp from "@/components/stamps/HankoStamp";
import StampFrame from "@/components/stamps/StampFrame";
import type { DiaryEntry } from "@/types/diary";

/** A diary entry's stamp, with the 添削-complete hanko overlaid once reviewed.
 * When the day has more than one writing session (see `SessionStamp`), a
 * second plain stamp-shaped layer peeks out from behind — just a hint
 * that there's more here, not one layer per session (see ReviewView for
 * the actual full stack). */
export default function StampedDay({
  entry,
  photoUrl,
  stampCount = 1,
  className,
}: {
  entry: Pick<DiaryEntry, "stamp_kind" | "stamp_key" | "status">;
  photoUrl?: string | null;
  stampCount?: number;
  className?: string;
}) {
  return (
    <div className={`relative ${className ?? ""}`}>
      {stampCount > 1 && (
        <div
          className="absolute inset-0 origin-center -rotate-6 translate-x-[6%] translate-y-[3%]"
          aria-hidden="true"
        >
          <StampFrame tint="#e2e2e2" className="h-full w-full">
            {null}
          </StampFrame>
        </div>
      )}
      <DiaryStamp
        stampKind={entry.stamp_kind}
        stampKey={entry.stamp_key as never}
        photoUrl={photoUrl}
        className="w-full h-full drop-shadow-md"
      />
      {entry.status === "reviewed" && (
        // 80% of the previous 52% — the calendar grid is small enough that
        // the hanko at full size read as crowding out the stamp artwork
        // itself. Positive insets (not overflowing past the stamp's own
        // edges) so a small margin shows on its right and bottom too,
        // matching the stamp's own outer margins instead of the hanko
        // bleeding into the cell's corner.
        <HankoStamp className="absolute bottom-[4%] right-[6%] w-[42%] h-[42%] drop-shadow-md" />
      )}
    </div>
  );
}
