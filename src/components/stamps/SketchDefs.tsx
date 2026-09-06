/**
 * Shared SVG filter that gives every hand-drawn stamp icon its wobbly,
 * pencil-on-washi-paper look. Rendered once (invisible, 0x0) in the root
 * layout; every <StampIcon> references it via filter="url(#hand-drawn)".
 *
 * The turbulence seed is fixed, so the "hand-drawn" wobble is identical
 * on every render — deterministic, not actually random.
 */
export default function SketchDefs() {
  return (
    <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <filter id="hand-drawn" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.045"
            numOctaves={2}
            seed={7}
            result="noise"
          />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale={3.2} />
        </filter>
        <filter id="ink-grain" x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.85"
            numOctaves={2}
            seed={3}
            result="grain"
          />
          <feColorMatrix
            in="grain"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.6 0.6 0.6 0 -0.15"
            result="grainAlpha"
          />
          <feComposite in="SourceGraphic" in2="grainAlpha" operator="in" />
        </filter>
      </defs>
    </svg>
  );
}
