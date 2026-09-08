import DiaryStamp from "@/components/stamps/DiaryStamp";
import HankoStamp from "@/components/stamps/HankoStamp";
import type { DiaryEntry } from "@/types/diary";

/** A diary entry's stamp, with the 添削-complete hanko overlaid once reviewed. */
export default function StampedDay({
  entry,
  photoUrl,
  className,
}: {
  entry: Pick<DiaryEntry, "stamp_kind" | "stamp_key" | "status">;
  photoUrl?: string | null;
  className?: string;
}) {
  return (
    <div className={`relative ${className ?? ""}`}>
      <DiaryStamp
        stampKind={entry.stamp_kind}
        stampKey={entry.stamp_key as never}
        photoUrl={photoUrl}
        className="w-full h-full drop-shadow-md"
      />
      {entry.status === "reviewed" && (
        // 80% of the previous 52% — the calendar grid is small enough that
        // the hanko at full size read as crowding out the stamp artwork
        // itself.
        <HankoStamp className="absolute -bottom-[10%] -right-[14%] w-[42%] h-[42%] drop-shadow-md" />
      )}
    </div>
  );
}
