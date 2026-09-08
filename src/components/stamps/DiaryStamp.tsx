import Image from "next/image";
import StampFrame from "@/components/stamps/StampFrame";
import KeywordIcon from "@/components/stamps/KeywordIcon";
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
    <StampFrame tint={stampKind === "photo" ? "#f7f7f7" : style.tint} className={className}>
      {stampKind === "photo" && photoUrl ? (
        // `fill` needs a positioned ancestor to size against — the
        // foreignObject wrapper StampFrame renders this into already sets
        // width/height:100% but not `position`, so that's set here rather
        // than relying on the parent.
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
          <Image
            src={photoUrl}
            alt=""
            fill
            sizes="200px"
            style={{ objectFit: "cover" }}
          />
        </div>
      ) : (
        <div style={{ width: "100%", height: "100%", color: style.ink }}>
          <KeywordIcon id={id} className="h-full w-full" />
        </div>
      )}
    </StampFrame>
  );
}
