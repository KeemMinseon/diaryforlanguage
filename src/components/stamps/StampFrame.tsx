"use client";

import { useId, useMemo } from "react";

const W = 170;
const H = 210;
// Finer, more numerous teeth than a first pass — a real stamp's perforation
// is small and tightly spaced; a few large sparse dots read as a rough
// placeholder rather than an actual stamp edge.
const EDGE = 9; // distance of perforation circles from the outer edge
const STEP = 11.2; // spacing between perforation circles
const PERF_R = 4.3;

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

/** Mixes a hex color toward black by `amount` (0-1) — used for a subtle
 * gradient on the stamp face instead of a flat tint fill. */
function shade(hex: string, amount: number): string {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : clean;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return hex;
  const r = ((num >> 16) & 0xff) * (1 - amount);
  const g = ((num >> 8) & 0xff) * (1 - amount);
  const b = (num & 0xff) * (1 - amount);
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

/**
 * The "postage stamp" frame every diary day wears: a scalloped,
 * perforated-edge rectangle around either the cropped photo or the
 * auto-picked hand-drawn keyword icon.
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
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const maskId = `perf-${rawId}`;
  const gradId = `face-${rawId}`;

  const faceX = EDGE + PERF_R;
  const faceY = EDGE + PERF_R;
  const faceW = W - 2 * (EDGE + PERF_R);
  const faceH = H - 2 * (EDGE + PERF_R);
  const ruleInset = 3.2;

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
      <defs>
        {mask}
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={tint} />
          <stop offset="100%" stopColor={shade(tint, 0.08)} />
        </linearGradient>
      </defs>
      <g mask={`url(#${maskId})`}>
        <rect x={0} y={0} width={W} height={H} fill="#f7f7f7" />
        <rect x={faceX} y={faceY} width={faceW} height={faceH} fill={`url(#${gradId})`} />
        {/* A thin double rule near the edge, like an engraved stamp border,
            instead of a single flat outline. */}
        <rect
          x={faceX + ruleInset}
          y={faceY + ruleInset}
          width={faceW - 2 * ruleInset}
          height={faceH - 2 * ruleInset}
          fill="none"
          stroke="#333333"
          strokeOpacity={0.4}
          strokeWidth={0.7}
        />
        <rect
          x={faceX}
          y={faceY}
          width={faceW}
          height={faceH}
          fill="none"
          stroke="#333333"
          strokeWidth={1.4}
        />
        <foreignObject x={faceX + 6} y={faceY + 6} width={faceW - 12} height={faceH - 12}>
          <div style={{ width: "100%", height: "100%" }}>{children}</div>
        </foreignObject>
      </g>
    </svg>
  );
}
