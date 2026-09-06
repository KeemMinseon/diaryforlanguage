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
    case "heart":
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
    case "friend":
      return (
        <g {...common}>
          <circle cx="36" cy="38" r="14" />
          <circle cx="66" cy="42" r="11" />
          <path d="M14 78c2-16 14-24 22-24s18 6 22 18" />
          <path d="M58 78c2-12 8-20 18-20 8 0 14 6 16 16" />
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
  sketchy = true,
}: {
  id: StampId;
  className?: string;
  sketchy?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      style={sketchy ? { filter: "url(#hand-drawn)" } : undefined}
      aria-hidden="true"
    >
      <Icon id={id} />
    </svg>
  );
}
