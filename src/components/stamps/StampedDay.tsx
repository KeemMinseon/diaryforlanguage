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
        className="w-full h-full"
      />
      {entry.status === "reviewed" && (
        <HankoStamp className="absolute -bottom-[10%] -right-[14%] w-[52%] h-[52%]" />
      )}
    </div>
  );
}
