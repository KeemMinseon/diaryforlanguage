"use client";

import { useStorageImageOverride } from "@/lib/icons/useStorageImageOverride";
import type { StampId } from "@/lib/stamps/keywordMap";

/**
 * Renders this keyword's stamp image from the public `stamp-icons` Storage
 * bucket — there's no built-in hand-drawn fallback any more (every keyword
 * stamp is an uploaded image now, see schema.sql's bucket comment). Every
 * keyword is looked up as "<id>-<variant>" (0-indexed, e.g. "cat-3") —
 * even a keyword with just one prepared image is still named "<id>-0",
 * matching how the real asset set is uploaded (see
 * lib/stamps/stampVariants.ts's STAMP_VARIANT_COUNT). `variant` defaults
 * to 0 when omitted.
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
  /** Which uploaded variant to show, 0-indexed — omit for variant 0. */
  variant?: number | null;
  className?: string;
}) {
  const name = `${id}-${variant ?? 0}`;
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
