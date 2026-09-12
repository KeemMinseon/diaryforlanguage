"use client";

import { useId } from "react";
import { STAMP_MASK_HEIGHT, STAMP_MASK_PATH, STAMP_MASK_WIDTH } from "@/components/stamps/stampMask";

/**
 * The "postage stamp" frame every diary day wears: the cropped photo or
 * auto-picked keyword icon, clipped to the stamp's own scalloped outline
 * (see stampMask.ts) with a flat tint behind it — no border rule, no
 * shading, nothing else layered on top of the shape itself.
 *
 * A photo is drawn with SVG's own native <image> element, not an HTML
 * <img> inside a <foreignObject> — that HTML-in-SVG path (tried with
 * next/image's fill mode, then a plain <img> at width/height:100%, then
 * again at explicit pixel dimensions) kept blowing photos up to their
 * natural size on real iPhone/Safari no matter how it was arranged;
 * Safari's foreignObject-descendant sizing has just never been reliable
 * for a replaced element like <img>. A native <image> is positioned and
 * sized entirely in SVG's own coordinate system (x/y/width/height,
 * preserveAspectRatio) — no CSS box resolution involved at all, so that
 * whole bug class doesn't apply to it. The keyword icon still goes
 * through <foreignObject> (as `children`) since it's plain inline SVG
 * markup either way, not a replaced HTML element — that path has never
 * shown this bug.
 */
export default function StampFrame({
  children,
  tint = "#eeeeee",
  className,
  photoUrl,
  photoLoaded = true,
  onPhotoLoad,
  tiltDeg,
}: {
  /** Keyword-icon content, rendered via foreignObject. Ignored when `photoUrl` is set. */
  children?: React.ReactNode;
  tint?: string;
  /** Background tint behind the artwork, e.g. a pale color per stamp id. */
  className?: string;
  /** When set, draws this photo (native SVG <image>) instead of `children`. */
  photoUrl?: string;
  /** Shows a pulse placeholder over the photo while false. */
  photoLoaded?: boolean;
  onPhotoLoad?: () => void;
  /** A small fixed rotation (degrees) applied directly to this root <svg>
   * via CSS `transform` — a transform doesn't participate in box sizing
   * at all, so it can't disturb whatever's already resolving this
   * element's width/height (see DiaryStamp's note on why this rides on
   * the svg itself rather than a wrapping <div>). */
  tiltDeg?: number;
}) {
  const clipId = `stamp-mask-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <svg
      viewBox={`0 0 ${STAMP_MASK_WIDTH} ${STAMP_MASK_HEIGHT}`}
      className={className}
      role="img"
      style={tiltDeg ? { transform: `rotate(${tiltDeg}deg)` } : undefined}
    >
      <defs>
        <clipPath id={clipId}>
          <path d={STAMP_MASK_PATH} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect x={0} y={0} width={STAMP_MASK_WIDTH} height={STAMP_MASK_HEIGHT} fill={tint} />
        {photoUrl ? (
          <>
            <image
              href={photoUrl}
              x={0}
              y={0}
              width={STAMP_MASK_WIDTH}
              height={STAMP_MASK_HEIGHT}
              preserveAspectRatio="xMidYMid slice"
              onLoad={onPhotoLoad}
              style={{ opacity: photoLoaded ? 1 : 0, transition: "opacity 0.2s ease-out" }}
            />
            {!photoLoaded && (
              <rect
                aria-hidden="true"
                className="animate-pulse"
                x={0}
                y={0}
                width={STAMP_MASK_WIDTH}
                height={STAMP_MASK_HEIGHT}
                fill="var(--paper-line)"
              />
            )}
          </>
        ) : (
          <foreignObject x={0} y={0} width={STAMP_MASK_WIDTH} height={STAMP_MASK_HEIGHT}>
            <div style={{ width: STAMP_MASK_WIDTH, height: STAMP_MASK_HEIGHT }}>{children}</div>
          </foreignObject>
        )}
      </g>
    </svg>
  );
}
