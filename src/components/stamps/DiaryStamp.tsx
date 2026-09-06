import StampFrame from "@/components/stamps/StampFrame";
import StampIcon from "@/components/stamps/StampIcon";
import { STAMP_STYLE } from "@/lib/stamps/stampStyle";
import type { StampId } from "@/lib/stamps/keywordMap";

interface DiaryStampProps {
  stampKind: "photo" | "keyword";
  stampKey: StampId | null;
  photoUrl?: string | null;
  className?: string;
}

/** Renders the day's stamp: a cropped photo, or the auto-picked hand-drawn icon. */
export default function DiaryStamp({ stampKind, stampKey, photoUrl, className }: DiaryStampProps) {
  const id = (stampKey ?? "default") as StampId;
  const style = STAMP_STYLE[id] ?? STAMP_STYLE.default;

  return (
    <StampFrame tint={stampKind === "photo" ? "#fffdf8" : style.tint} className={className}>
      {stampKind === "photo" && photoUrl ? (
        <img
          src={photoUrl}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: style.ink,
          }}
        >
          <StampIcon id={id} className="w-4/5 h-4/5" />
        </div>
      )}
    </StampFrame>
  );
}
