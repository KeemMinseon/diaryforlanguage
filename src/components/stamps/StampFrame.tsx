"use client";

import { useId } from "react";
import { STAMP_MASK_HEIGHT, STAMP_MASK_PATH, STAMP_MASK_WIDTH } from "@/components/stamps/stampMask";

/**
 * The "postage stamp" frame every diary day wears: the cropped photo or
 * auto-picked keyword icon, clipped to the stamp's own scalloped outline
 * (see stampMask.ts) with a flat tint behind it — no border rule, no
 * shading, nothing else layered on top of the shape itself.
 */
export default function StampFrame({
  children,
  tint = "#eeeeee",
  className,
}: {
  children: React.ReactNode;
  tint?: string;
  /** Background tint behind the artwork, e.g. a pale color per stamp id. */
  className?: string;
}) {
  const clipId = `stamp-mask-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <svg viewBox={`0 0 ${STAMP_MASK_WIDTH} ${STAMP_MASK_HEIGHT}`} className={className} role="img">
      <defs>
        <clipPath id={clipId}>
          <path d={STAMP_MASK_PATH} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect x={0} y={0} width={STAMP_MASK_WIDTH} height={STAMP_MASK_HEIGHT} fill={tint} />
        <foreignObject x={0} y={0} width={STAMP_MASK_WIDTH} height={STAMP_MASK_HEIGHT}>
          {/* `position: relative` so a child that needs to overlay the
              whole frame (a loading placeholder, say) can do it with
              `absolute inset-0` anchored right here — that's one step
              cheaper, percentage-height-resolution-wise, than a child
              introducing its own nested 100%-height wrapper div to hang
              an overlay off of. This foreignObject's own 100% has to
              resolve correctly regardless (every photo stamp depends on
              it), so anything anchored to *this* box inherits that once,
              instead of re-deriving it. */}
          <div style={{ width: "100%", height: "100%", position: "relative" }}>{children}</div>
        </foreignObject>
      </g>
    </svg>
  );
}
