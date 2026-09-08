import UiIcon from "@/components/icons/UiIcon";

/**
 * The 添削済 hanko: a red ink-seal stamped over the diary's postage stamp
 * once Claude's vocabulary feedback has come back. Absolutely positioned
 * by the parent (which should be `position: relative`).
 *
 * The seal artwork is swappable via the same Storage-upload override
 * mechanism as other UI icons (slot: "verified-badge"). The ink
 * color and rotation stay on this wrapper regardless of which artwork
 * ends up inside it — that's the stamping *effect*, not part of any one
 * icon's own art.
 *
 * No blend mode here — this used to sit under `mixBlendMode: "multiply"`
 * for a paper-ink look, but multiply darkens toward whatever's underneath,
 * so on a dark photo stamp (a night shot, say) the red ink crushed toward
 * black and the seal all but disappeared. Plain opaque color reads clearly
 * over any photo, at the cost of that translucent-ink look on light ones.
 */
export default function HankoStamp({ className }: { className?: string }) {
  return (
    <span
      className={`aspect-square ${className ?? ""}`}
      style={{
        position: "absolute",
        color: "var(--shu, #b8654f)",
        transform: "rotate(-11deg)",
        pointerEvents: "none",
      }}
      aria-hidden="true"
    >
      <UiIcon name="verified-badge" className="h-full w-full" alt="">
        <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
          <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="5" />
          <circle cx="50" cy="50" r="36" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <text
            x="50"
            y="50"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="30"
            fontFamily="var(--font-diary)"
            fill="currentColor"
          >
            済
          </text>
          <text
            x="50"
            y="78"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="9"
            letterSpacing="1"
            fontFamily="var(--font-diary)"
            fill="currentColor"
          >
            添削
          </text>
        </svg>
      </UiIcon>
    </span>
  );
}
