"use client";

import { useId, useMemo } from "react";

const W = 170;
const H = 210;
const EDGE = 11; // distance of perforation circles from the outer edge
const STEP = 15.5; // spacing between perforation circles
const PERF_R = 6.2;

function buildPerforationPoints() {
  const points: Array<[number, number]> = [];
  for (let x = EDGE; x <= W - EDGE; x += STEP) {
    points.push([x, EDGE]);
    points.push([x, H - EDGE]);
  }
  for (let y = EDGE + STEP / 2; y <= H - EDGE - STEP / 2; y += STEP) {
    points.push([EDGE, y]);
    points.push([W - EDGE, y]);
  }
  return points;
}

const PERFORATION_POINTS = buildPerforationPoints();

/**
 * The "postage stamp" frame every diary day wears: a scalloped,
 * perforated-edge rectangle around either the cropped photo or the
 * auto-picked hand-drawn keyword icon.
 */
export default function StampFrame({
  children,
  tint = "#f4ede0",
  className,
}: {
  children: React.ReactNode;
  tint?: string;
  /** Background tint behind the artwork, e.g. a pale color per stamp id. */
  className?: string;
}) {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const maskId = `perf-${rawId}`;

  const mask = useMemo(
    () => (
      <mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
        <rect x={0} y={0} width={W} height={H} fill="white" />
        {PERFORATION_POINTS.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={PERF_R} fill="black" />
        ))}
      </mask>
    ),
    [maskId]
  );

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      role="img"
    >
      <defs>{mask}</defs>
      <g mask={`url(#${maskId})`}>
        <rect x={0} y={0} width={W} height={H} fill="#fffdf8" />
        <rect
          x={EDGE + PERF_R}
          y={EDGE + PERF_R}
          width={W - 2 * (EDGE + PERF_R)}
          height={H - 2 * (EDGE + PERF_R)}
          fill={tint}
          stroke="#3a332a"
          strokeWidth={1.4}
        />
        <foreignObject
          x={EDGE + PERF_R + 6}
          y={EDGE + PERF_R + 6}
          width={W - 2 * (EDGE + PERF_R) - 12}
          height={H - 2 * (EDGE + PERF_R) - 12}
        >
          <div style={{ width: "100%", height: "100%" }}>{children}</div>
        </foreignObject>
      </g>
    </svg>
  );
}
