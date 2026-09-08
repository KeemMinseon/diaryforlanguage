import UiIcon from "@/components/icons/UiIcon";

/**
 * The 添削済 hanko: a red ink-seal stamped over the diary's postage stamp
 * once Claude's vocabulary feedback has come back. Absolutely positioned
 * by the parent (which should be `position: relative`).
 *
 * The seal artwork is swappable via the same Storage-upload override
 * mechanism as other UI icons (slot: "verified-badge-fill"). The ink
 * color, rotation, and multiply blend stay on this wrapper regardless of
 * which artwork ends up inside it — that's the stamping *effect*, not
 * part of any one icon's own art.
 */
export default function HankoStamp({ className }: { className?: string }) {
  return (
    <span
      className={`aspect-square ${className ?? ""}`}
      style={{
        position: "absolute",
        color: "var(--shu, #b8654f)",
        mixBlendMode: "multiply",
        transform: "rotate(-11deg)",
        pointerEvents: "none",
      }}
      aria-hidden="true"
    >
      <UiIcon name="verified-badge-fill" className="h-full w-full" alt="">
        <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
          <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="5" />
          <circle cx="50" cy="50" r="36" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <text
            x="50"
            y="50"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="30"
            fontFamily="var(--font-diary), serif"
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
            fontFamily="var(--font-diary), serif"
            fill="currentColor"
          >
            添削
          </text>
        </svg>
      </UiIcon>
    </span>
  );
}
