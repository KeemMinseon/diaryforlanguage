"use client";

import { useStorageImageOverride } from "@/lib/icons/useStorageImageOverride";
import type { StampId } from "@/lib/stamps/keywordMap";

/**
 * Renders this keyword's stamp image from the public `stamp-icons` Storage
 * bucket — there's no built-in hand-drawn fallback any more (every keyword
 * stamp is an uploaded image now, see schema.sql's bucket comment). A
 * keyword with several random variants (STAMP_VARIANT_COUNT in
 * lib/stamps/stampVariants.ts) is looked up as "<id>-<variant>", e.g.
 * "cat-3"; a keyword with just one look (the common case) is looked up as
 * plain "<id>", exactly like before variants existed.
 *
 * While a keyword has no image uploaded yet, this renders nothing — the
 * caller's own tinted stamp background (StampFrame) still shows, just
 * without any artwork on top, rather than a broken image or a stand-in
 * icon.
 */
export default function KeywordIcon({
  id,
  variant,
  className,
}: {
  id: StampId;
  /** Which uploaded variant to show, 1-indexed — omit or 1 for a keyword
   * with only one image. */
  variant?: number | null;
  className?: string;
}) {
  const name = variant && variant > 1 ? `${id}-${variant}` : id;
  const resolvedUrl = useStorageImageOverride("stamp-icons", name);

  if (!resolvedUrl) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, dimensions unknown ahead of time
    <img
      src={resolvedUrl}
      alt=""
      className={className}
      style={{ objectFit: "cover", display: "block" }}
    />
  );
}
