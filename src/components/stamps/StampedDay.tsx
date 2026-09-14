import DiaryStamp from "@/components/stamps/DiaryStamp";
import HankoStamp from "@/components/stamps/HankoStamp";
import type { DiaryEntry } from "@/types/diary";

/** A diary entry's stamp, with the 添削-complete hanko overlaid once
 * reviewed. When the day has more than one writing session (see
 * `SessionStamp`), this still only ever shows the front one — see
 * ReviewView for the actual full stack. */
export default function StampedDay({
  entry,
  photoUrl,
  justStamped = false,
  className,
}: {
  entry: Pick<DiaryEntry, "stamp_kind" | "stamp_key" | "stamp_variant" | "status">;
  photoUrl?: string | null;
  /** True for the few seconds right after this day's entry just got its
   * final reviewed stamp — plays the hanko's entrance animation instead
   * of it just being there already, the way it normally renders once
   * `status === "reviewed"`. See lib/events/diaryStamped.ts. */
  justStamped?: boolean;
  className?: string;
}) {
  return (
    <div className={`relative ${className ?? ""}`}>
      <DiaryStamp
        stampKind={entry.stamp_kind}
        stampKey={entry.stamp_key as never}
        stampVariant={entry.stamp_variant}
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
        <HankoStamp
          className={`absolute bottom-[4%] right-[6%] w-[42%] h-[42%] drop-shadow-md ${
            justStamped ? "stamp-pop" : ""
          }`}
        />
      )}
    </div>
  );
}
