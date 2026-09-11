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
          {/* Explicit pixel dimensions (matching this foreignObject's own
              coordinate box exactly), not width/height:100% — Safari has
              a long-standing bug resolving *percentage* sizes for
              foreignObject descendants (worst for replaced elements like
              <img>), which is exactly what kept blowing photo stamps up
              to their natural size there no matter how the percentage
              chain above them was arranged. A literal pixel size sidesteps
              the resolution step entirely instead of trying to get it
              right. `position: relative` so a child that needs to overlay
              the whole frame (a loading placeholder) can do it with
              `absolute inset-0` anchored right here. */}
          <div
            style={{ width: STAMP_MASK_WIDTH, height: STAMP_MASK_HEIGHT, position: "relative" }}
          >
            {children}
          </div>
        </foreignObject>
      </g>
    </svg>
  );
}
