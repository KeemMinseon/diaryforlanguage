"use client";

import { useEffect, useState } from "react";
import StampFrame from "@/components/stamps/StampFrame";
import KeywordIcon from "@/components/stamps/KeywordIcon";
import type { StampId } from "@/lib/stamps/keywordMap";

interface DiaryStampProps {
  stampKind: "photo" | "keyword";
  stampKey: StampId | null;
  /** Which uploaded variant of `stampKey` to show — see KeywordIcon. */
  stampVariant?: number | null;
  photoUrl?: string | null;
  className?: string;
}

/** Renders the day's stamp: a cropped photo, or the auto-picked keyword
 * image. Only the photo goes through StampFrame's postage-stamp mask/tint
 * treatment — the prepared keyword artwork already reads as its own
 * finished stamp graphic, so wrapping it in that same scalloped frame
 * would double up on framing. */
export default function DiaryStamp({
  stampKind,
  stampKey,
  stampVariant,
  photoUrl,
  className,
}: DiaryStampProps) {
  const id = (stampKey ?? "default") as StampId;

  // A keyword stamp is a small Storage image, resolved once and cached —
  // essentially instant. A photo stamp is a real network image on every
  // fresh load, so on a slow connection (or a calendar full of them)
  // there's a real gap between the cell appearing and the photo actually
  // painting in. Track it per stamp so that gap gets a pulse placeholder
  // instead of sitting blank.
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
      />
    );
  }

  return <KeywordIcon id={id} variant={stampVariant} className={className} />;
}
