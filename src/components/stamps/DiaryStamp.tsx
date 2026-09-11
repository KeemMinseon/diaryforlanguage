"use client";

import { useEffect, useRef, useState } from "react";
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

  // A keyword stamp is just inline SVG — instant, nothing to wait on. A
  // photo stamp is a real network image (Supabase Storage), so on a slow
  // connection (or a calendar full of them) there's a real gap between
  // the cell appearing and the photo actually painting in. Track it per
  // stamp so that gap gets a pulse placeholder instead of sitting blank.
  const imgRef = useRef<HTMLImageElement | null>(null);
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
    // Guards against the SSR/hydration race: the <img> can start loading
    // (and finish) from its server-rendered `src` before this effect ever
    // attaches an onLoad handler, in which case onLoad never fires again
    // and the pulse would otherwise sit there forever hiding a photo
    // that's already there.
    if (imgRef.current?.complete) setLoaded(true);
  }, [photoUrl]);

  return (
    <StampFrame tint={stampKind === "photo" ? "#f7f7f7" : style.tint} className={className}>
      {stampKind === "photo" && photoUrl ? (
        <>
          {!loaded && (
            // Anchored to StampFrame's own box (see its `position:
            // relative`), not a wrapper div introduced here — an extra
            // 100%-height div in this chain is exactly what broke photo
            // stamps in Safari before (see the comment on the <img>
            // below); `absolute inset-0` against an ancestor that
            // already resolves correctly costs nothing further.
            <div
              aria-hidden="true"
              className="animate-pulse"
              style={{ position: "absolute", inset: 0, background: "var(--paper-line)" }}
            />
          )}
          {/* Plain <img>, not next/image — this renders inside an SVG
              <foreignObject> (see StampFrame), and next/image's `fill` mode
              (position:absolute + percentage width/height) depends on that
              percentage height actually resolving against a definite
              ancestor size. That broke on an actual iPhone/Safari in
              production (never caught by this project's Chromium-only QA
              screenshots): the photo lost its size constraint entirely and
              rendered at its natural size, spilling out past the stamp
              frame, the calendar cell, and the screen edge. Reverted to a
              plain <img> with an explicit inline width/height:100% (sized in
              normal flow, not via absolute positioning) — this is what
              rendered correctly before the next/image change, on every
              device this app has actually been used on. Sized in normal
              flow here too (not wrapped in its own positioned box) for
              the exact same reason — see the loading-skeleton regression
              this fixed, above. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- see above; next/image broke this in production */}
          <img
            ref={imgRef}
            src={photoUrl}
            alt=""
            onLoad={() => setLoaded(true)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
              opacity: loaded ? 1 : 0,
              transition: "opacity 0.2s ease-out",
            }}
          />
        </>
      ) : (
        <div style={{ width: "100%", height: "100%", color: style.ink }}>
          <KeywordIcon id={id} className="h-full w-full" />
        </div>
      )}
    </StampFrame>
  );
}
