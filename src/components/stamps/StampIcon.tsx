import type { StampId } from "@/lib/stamps/keywordMap";

const common = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 4.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Icon({ id }: { id: StampId }) {
  switch (id) {
    case "rain":
      return (
        <g {...common}>
          <path d="M28 46a16 16 0 0 1 3-31 20 20 0 0 1 38-4 15 15 0 0 1-2 35H28z" />
          <line x1="34" y1="58" x2="30" y2="70" />
          <line x1="50" y1="58" x2="46" y2="72" />
          <line x1="66" y1="58" x2="62" y2="70" />
        </g>
      );
    case "snow":
      return (
        <g {...common}>
          <line x1="50" y1="18" x2="50" y2="82" />
          <line x1="18" y1="50" x2="82" y2="50" />
          <line x1="27" y1="27" x2="73" y2="73" />
          <line x1="73" y1="27" x2="27" y2="73" />
          <path d="M50 18l-6 8m6-8l6 8" />
          <path d="M50 82l-6-8m6 8l6-8" />
        </g>
      );
    case "sun":
      return (
        <g {...common}>
          <circle cx="50" cy="50" r="18" />
          {Array.from({ length: 8 }).map((_, i) => {
            const a = (i * Math.PI) / 4;
            const x1 = 50 + Math.cos(a) * 28;
            const y1 = 50 + Math.sin(a) * 28;
            const x2 = 50 + Math.cos(a) * 40;
            const y2 = 50 + Math.sin(a) * 40;
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
          })}
        </g>
      );
    case "coffee":
      return (
        <g {...common}>
          <path d="M24 42h40v18a14 14 0 0 1-14 14H38a14 14 0 0 1-14-14V42z" />
          <path d="M64 46h6a9 9 0 0 1 0 18h-6" />
          <path d="M34 34c1-4-2-5-1-9" />
          <path d="M46 34c1-4-2-5-1-9" />
        </g>
      );
    case "food":
      return (
        <g {...common}>
          <path d="M20 48a30 10 0 0 0 60 0" />
          <path d="M20 48a30 10 0 0 1 60 0" />
          <path d="M22 48c0 14 12 26 28 26s28-12 28-26" />
          <path d="M38 28c0-4 2-6 2-10M50 26c0-4 2-6 2-10M62 28c0-4 2-6 2-10" />
        </g>
      );
    case "travel":
      return (
        <g {...common}>
          <path d="M14 58l72-30-26 26" />
          <path d="M50 42l-8 26-8-10-14-4z" />
        </g>
      );
    case "study":
      return (
        <g {...common}>
          <path d="M50 30c-8-6-20-8-30-4v42c10-4 22-2 30 4 8-6 20-8 30-4V26c-10-4-22-2-30 4z" />
          <line x1="50" y1="30" x2="50" y2="72" />
        </g>
      );
    case "sleep":
      return (
        <g {...common}>
          <path d="M62 22a28 28 0 1 0 20 46 22 22 0 0 1-20-46z" />
          <path d="M62 26h14l-14 14h14" strokeWidth={3.5} />
        </g>
      );
    case "exercise":
      return (
        <g {...common}>
          <line x1="26" y1="50" x2="74" y2="50" />
          <circle cx="22" cy="50" r="10" />
          <circle cx="78" cy="50" r="10" />
          <line x1="38" y1="38" x2="38" y2="62" />
          <line x1="62" y1="38" x2="62" y2="62" />
        </g>
      );
    case "music":
      return (
        <g {...common}>
          <circle cx="32" cy="68" r="10" />
          <circle cx="64" cy="62" r="10" />
          <line x1="42" y1="68" x2="42" y2="24" />
          <line x1="74" y1="62" x2="74" y2="18" />
          <path d="M42 24l32-6v18l-32 6" />
        </g>
      );
    case "book":
      return (
        <g {...common}>
          <path d="M22 26h34a6 6 0 0 1 6 6v42H28a6 6 0 0 1-6-6V26z" />
          <path d="M62 26h16v48l-16-8" />
          <line x1="32" y1="38" x2="52" y2="38" />
          <line x1="32" y1="48" x2="52" y2="48" />
        </g>
      );
    case "joy":
      return (
        <g {...common}>
          <path d="M50 76C28 60 16 48 16 34a16 16 0 0 1 30-8 16 16 0 0 1 30 8c0 14-12 26-26 42z" />
        </g>
      );
    case "sad":
      return (
        <g {...common}>
          <path d="M50 20c14 16 20 28 20 38a20 20 0 0 1-40 0c0-10 6-22 20-38z" />
          <path d="M40 76q10-6 20 0" />
        </g>
      );
    case "work":
      return (
        <g {...common}>
          <rect x="18" y="38" width="64" height="38" rx="6" />
          <path d="M38 38v-8a6 6 0 0 1 6-6h12a6 6 0 0 1 6 6v8" />
          <line x1="18" y1="56" x2="82" y2="56" />
        </g>
      );
    case "cat":
      return (
        <g {...common}>
          <path d="M30 40 22 20l14 8" />
          <path d="M70 40 78 20l-14 8" />
          <circle cx="50" cy="52" r="28" />
          <line x1="18" y1="52" x2="34" y2="54" />
          <line x1="18" y1="60" x2="34" y2="60" />
          <line x1="82" y1="52" x2="66" y2="54" />
          <line x1="82" y1="60" x2="66" y2="60" />
          <path d="M46 62q4 4 8 0" />
        </g>
      );
    case "flower":
      return (
        <g {...common}>
          <line x1="50" y1="58" x2="50" y2="86" />
          <path d="M50 58c-6-4-8-10-4-14" />
          {Array.from({ length: 5 }).map((_, i) => {
            const a = (i * 2 * Math.PI) / 5 - Math.PI / 2;
            const cx = 50 + Math.cos(a) * 14;
            const cy = 36 + Math.sin(a) * 14;
            return <circle key={i} cx={cx} cy={cy} r="10" />;
          })}
          <circle cx="50" cy="36" r="6" fill="currentColor" stroke="none" />
        </g>
      );
    case "celebration":
      return (
        <g {...common}>
          <rect x="24" y="42" width="52" height="38" rx="4" />
          <line x1="24" y1="58" x2="76" y2="58" />
          <line x1="50" y1="42" x2="50" y2="80" />
          <path d="M50 42c-6-10-20-10-20 0 6 4 14 2 20 0z" />
          <path d="M50 42c6-10 20-10 20 0-6 4-14 2-20 0z" />
        </g>
      );
    case "shopping":
      return (
        <g {...common}>
          <path d="M32 36a18 14 0 0 1 36 0" />
          <path d="M24 36h52l-6 44H30z" />
        </g>
      );
    case "movie":
      return (
        <g {...common}>
          <path d="M20 40l4-16 56 10-2 16z" />
          <rect x="20" y="40" width="58" height="40" rx="4" />
          <line x1="34" y1="26" x2="38" y2="40" />
          <line x1="50" y1="28" x2="54" y2="40" />
          <line x1="66" y1="30" x2="70" y2="40" />
        </g>
      );
    case "phone":
      return (
        <g {...common}>
          <path d="M34 22a8 8 0 0 1 11 3l5 9a8 8 0 0 1-2 10l-5 4c5 12 14 21 26 26l4-5a8 8 0 0 1 10-2l9 5a8 8 0 0 1 3 11c-3 7-11 11-19 9-27-6-49-28-55-55-2-8 2-16 9-19z" />
        </g>
      );
    case "rest":
      return (
        <g {...common}>
          <path d="M22 58v-14a10 10 0 0 1 10-10h36a10 10 0 0 1 10 10v14" />
          <path d="M18 58h64v14a6 6 0 0 1-6 6H24a6 6 0 0 1-6-6z" />
          <line x1="26" y1="58" x2="26" y2="44" />
          <line x1="74" y1="58" x2="74" y2="44" />
        </g>
      );
    case "cook":
      // A chef's hat, not a pot — a pot rim + steam at this stroke weight
      // read as antennae rather than cookware once actually drawn.
      return (
        <g {...common}>
          <path d="M34 40a14 14 0 0 1 28 0c8 0 12 8 8 16H26c-4-8 0-16 8-16z" />
          <path d="M28 56h44v12a4 4 0 0 1-4 4H32a4 4 0 0 1-4-4z" />
        </g>
      );
    case "dog":
      return (
        <g {...common}>
          <path d="M20 30q-4 16 8 26" />
          <path d="M80 30q4 16-8 26" />
          <circle cx="50" cy="54" r="26" />
          <path d="M42 64q8 6 16 0" />
          <line x1="50" y1="64" x2="50" y2="70" />
        </g>
      );
    case "cloud":
      return (
        <g {...common}>
          <path d="M28 46a16 16 0 0 1 3-31 20 20 0 0 1 38-4 15 15 0 0 1-2 35H28z" />
        </g>
      );
    case "bread":
      return (
        <g {...common}>
          <path d="M20 54a30 24 0 0 1 60 0v10a6 6 0 0 1-6 6H26a6 6 0 0 1-6-6z" />
          <path d="M34 46q6-8 0-16M50 46q6-10 0-18M66 46q6-8 0-16" />
        </g>
      );
    case "calendar":
      return (
        <g {...common}>
          <rect x="20" y="26" width="60" height="54" rx="6" />
          <line x1="20" y1="42" x2="80" y2="42" />
          <line x1="34" y1="18" x2="34" y2="30" />
          <line x1="66" y1="18" x2="66" y2="30" />
          <line x1="32" y1="54" x2="40" y2="54" />
          <line x1="48" y1="54" x2="56" y2="54" />
          <line x1="64" y1="54" x2="72" y2="54" />
          <line x1="32" y1="66" x2="40" y2="66" />
          <line x1="48" y1="66" x2="56" y2="66" />
        </g>
      );
    case "chat":
      return (
        <g {...common}>
          <path d="M22 30h56a6 6 0 0 1 6 6v28a6 6 0 0 1-6 6H46l-14 12v-12h-10a6 6 0 0 1-6-6V36a6 6 0 0 1 6-6z" />
          <line x1="34" y1="46" x2="66" y2="46" />
          <line x1="34" y1="58" x2="54" y2="58" />
        </g>
      );
    case "heart":
      return (
        <g {...common}>
          <path d="M50 76C28 60 16 48 16 34a16 16 0 0 1 30-8 16 16 0 0 1 30 8c0 14-12 26-26 42z" />
          <line x1="18" y1="20" x2="82" y2="52" />
          <path d="M74 46l8 6-2-10z" />
        </g>
      );
    case "mountain":
      return (
        <g {...common}>
          <path d="M12 78 40 30l16 24 8-12 24 36z" />
          <path d="M34 40l6 8 6-8" />
        </g>
      );
    case "ocean":
      return (
        <g {...common}>
          <path d="M14 40q9-8 18 0t18 0 18 0 18 0 18 0" />
          <path d="M14 58q9-8 18 0t18 0 18 0 18 0 18 0" />
          <path d="M14 76q9-8 18 0t18 0 18 0 18 0 18 0" />
        </g>
      );
    case "rainbow":
      return (
        <g {...common}>
          <path d="M14 78a36 36 0 0 1 72 0" />
          <path d="M26 78a24 24 0 0 1 48 0" />
          <path d="M38 78a12 12 0 0 1 24 0" />
        </g>
      );
    case "tomato":
      return (
        <g {...common}>
          <circle cx="50" cy="58" r="24" />
          <path d="M50 34v-10M42 36l-6-8M58 36l6-8" />
        </g>
      );
    case "gimbap":
      return (
        <g {...common}>
          <circle cx="50" cy="50" r="30" />
          <circle cx="50" cy="50" r="18" />
          <circle cx="50" cy="50" r="7" />
        </g>
      );
    case "sushi":
      // A dome of rice topped with a draped slice — all curves, on
      // purpose: straight sides here read as a card/wallet rather than
      // a rounded piece of nigiri.
      return (
        <g {...common}>
          <path d="M20 62a30 16 0 0 1 60 0v4a12 12 0 0 1-12 12H32a12 12 0 0 1-12-12z" />
          <path d="M28 56a22 10 0 0 1 44 0" />
        </g>
      );
    case "bibimbap":
      return (
        <g {...common}>
          <path d="M16 52a34 24 0 0 0 68 0z" />
          <path d="M16 52a34 8 0 0 1 68 0" />
          <circle cx="50" cy="52" r="9" />
        </g>
      );
    case "burger":
      return (
        <g {...common}>
          <path d="M18 44a32 14 0 0 1 64 0z" />
          <line x1="18" y1="52" x2="82" y2="52" />
          <line x1="18" y1="60" x2="82" y2="60" />
          <path d="M18 68h64v6a8 8 0 0 1-8 8H26a8 8 0 0 1-8-8z" />
        </g>
      );
    case "pizza":
      return (
        <g {...common}>
          <path d="M50 20l34 60H16z" />
          <path d="M28 68a30 6 0 0 0 44 0" />
          <circle cx="46" cy="52" r="4" fill="currentColor" stroke="none" />
          <circle cx="58" cy="60" r="4" fill="currentColor" stroke="none" />
        </g>
      );
    case "salad":
      return (
        <g {...common}>
          <path d="M18 54a32 20 0 0 0 64 0z" />
          <path d="M30 54q4-16 10-20M46 54q2-18 6-22M62 54q-2-16 6-20" />
        </g>
      );
    case "default":
    default:
      return (
        <g {...common}>
          <path d="M24 26h38a6 6 0 0 1 6 6v42H30a6 6 0 0 1-6-6V26z" />
          <line x1="34" y1="40" x2="56" y2="40" />
          <line x1="34" y1="50" x2="56" y2="50" />
          <line x1="34" y1="60" x2="48" y2="60" />
          <path d="M60 66l16-16 6 6-16 16-8 2z" />
        </g>
      );
  }
}

export default function StampIcon({
  id,
  className,
}: {
  id: StampId;
  className?: string;
}) {
  // Note: this used to run through an SVG feTurbulence/feDisplacementMap
  // filter for a hand-drawn wobble. Safari (including in-app WebViews)
  // frequently fails to render that filter chain at all, leaving the icon
  // blank — so no <filter> primitives here, ever. The subtle depth below is
  // just a second, offset copy of the same paths in a faint dark tone
  // (plain geometry, not a filter) — a cheap stand-in for an engraved/
  // printed look instead of the previously perfectly flat line art.
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <g transform="translate(1.4, 2)" opacity={0.18} color="#000000">
        <Icon id={id} />
      </g>
      <Icon id={id} />
    </svg>
  );
}
