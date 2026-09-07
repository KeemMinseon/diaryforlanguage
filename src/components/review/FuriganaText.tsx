import { buildReadingSegments } from "@/lib/review/furigana";
import type { Reading } from "@/types/diary";

/**
 * Renders Japanese text with reading hints: kanji compounds get their
 * hiragana furigana, katakana words get a romanized reading — both as
 * <ruby> annotations so they sit right above the word they belong to.
 */
export default function FuriganaText({
  text,
  readings,
}: {
  text: string;
  readings: Reading[];
}) {
  if (!readings || readings.length === 0) return <>{text}</>;

  const segments = buildReadingSegments(text, readings);

  return (
    <>
      {segments.map((seg, i) =>
        seg.reading ? (
          <ruby key={i}>
            {seg.text}
            <rp>(</rp>
            <rt className="text-[0.55em] font-[family-name:var(--font-body)] text-[var(--ink-soft)]">
              {seg.reading.reading}
            </rt>
            <rp>)</rp>
          </ruby>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </>
  );
}
