"use client";

import { useEffect, useState } from "react";
import StampFrame from "@/components/stamps/StampFrame";
import KeywordIcon from "@/components/stamps/KeywordIcon";
import { STAMP_MASK_HEIGHT, STAMP_MASK_WIDTH } from "@/components/stamps/stampMask";
import { STAMP_STYLE } from "@/lib/stamps/stampStyle";
import type { StampId } from "@/lib/stamps/keywordMap";

interface DiaryStampProps {
  stampKind: "photo" | "keyword";
  stampKey: StampId | null;
  photoUrl?: string | null;
  className?: string;
  /** A small fixed rotation (degrees) — see lib/stamps/stampTilt.ts. Passed
   * straight through to StampFrame's own root <svg> rather than wrapped in
   * an extra element: a transform doesn't affect box sizing at all, so it
   * can ride along on the exact element whose width/height resolution
   * (the SVG replaced-element sizing algorithm, given only a definite
   * height from its own ancestors) already works, instead of introducing
   * a new plain <div> that same percentage-sizing chain doesn't apply to. */
  tiltDeg?: number;
}

/** Renders the day's stamp: a cropped photo, or the auto-picked hand-drawn icon. */
export default function DiaryStamp({
  stampKind,
  stampKey,
  photoUrl,
  className,
  tiltDeg,
}: DiaryStampProps) {
  const id = (stampKey ?? "default") as StampId;
  const style = STAMP_STYLE[id] ?? STAMP_STYLE.default;

  // A keyword stamp is just inline SVG — instant, nothing to wait on. A
  // photo stamp is a real network image (Supabase Storage), so on a slow
  // connection (or a calendar full of them) there's a real gap between
  // the cell appearing and the photo actually painting in. Track it per
  // stamp so that gap gets a pulse placeholder instead of sitting blank.
  const [loaded, setLoaded] = useState(false);
  // Resetting `loaded` when `photoUrl` changes (a new photo picked over an
  // already-loaded preview, say) during render rather than in an effect —
  // the "adjust state while rendering" pattern — so it takes effect before
  // this same paint instead of costing an extra one.
  const [trackedUrl, setTrackedUrl] = useState(photoUrl);
  if (photoUrl !== trackedUrl) {
    setTrackedUrl(photoUrl);
    setLoaded(false);
  }

  useEffect(() => {
    if (!photoUrl) return;
    // SVG's <image> has no `.complete` property to check for the
    // SSR/hydration race (unlike HTML's <img>) — a server-rendered page
    // that already embeds the photo URL can have it finish loading before
    // React ever attaches the onLoad handler, so this safety-net timeout
    // clears the pulse regardless if `onLoad` didn't already do it. Long
    // enough to never pre-empt a real load on a normal connection, short
    // enough that the rare miss doesn't leave the pulse showing for long.
    const timer = setTimeout(() => setLoaded(true), 2000);
    return () => clearTimeout(timer);
  }, [photoUrl]);

  if (stampKind === "photo" && photoUrl) {
    return (
      <StampFrame
        tint="#f7f7f7"
        className={className}
        photoUrl={photoUrl}
        photoLoaded={loaded}
        onPhotoLoad={() => setLoaded(true)}
        tiltDeg={tiltDeg}
      />
    );
  }

  return (
    <StampFrame tint={style.tint} className={className} tiltDeg={tiltDeg}>
      <div style={{ width: STAMP_MASK_WIDTH, height: STAMP_MASK_HEIGHT, color: style.ink }}>
        <KeywordIcon id={id} className="h-full w-full" />
      </div>
    </StampFrame>
  );
}
