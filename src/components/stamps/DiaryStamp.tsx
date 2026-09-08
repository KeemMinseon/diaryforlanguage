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
        // Plain <img>, not next/image — this renders inside an SVG
        // <foreignObject> (see StampFrame), and next/image's `fill` mode
        // (position:absolute + percentage width/height) depends on that
        // percentage height actually resolving against a definite
        // ancestor size. That broke on an actual iPhone/Safari in
        // production (never caught by this project's Chromium-only QA
        // screenshots): the photo lost its size constraint entirely and
        // rendered at its natural size, spilling out past the stamp
        // frame, the calendar cell, and the screen edge. Reverted to a
        // plain <img> with an explicit inline width/height:100% (sized in
        // normal flow, not via absolute positioning) — this is what
        // rendered correctly before the next/image change, on every
        // device this app has actually been used on.
        // eslint-disable-next-line @next/next/no-img-element -- see above; next/image broke this in production
        <img
          src={photoUrl}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <div style={{ width: "100%", height: "100%", color: style.ink }}>
          <KeywordIcon id={id} className="h-full w-full" />
        </div>
      )}
    </StampFrame>
  );
}
