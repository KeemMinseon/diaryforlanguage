"use client";

import { useStorageImageOverride } from "@/lib/icons/useStorageImageOverride";
import type { StampId } from "@/lib/stamps/keywordMap";

/**
 * Renders this keyword's stamp image from the public `stamp-icons` Storage
 * bucket — there's no built-in hand-drawn fallback any more (every keyword
 * stamp is an uploaded image now, see schema.sql's bucket comment). Every
 * keyword is looked up as "<ID>-<variant>", UPPERCASE (0-indexed, e.g.
 * "CAT-3") — even a keyword with just one prepared image is still named
 * "<ID>-0. `StampId` itself stays lowercase everywhere else (it's a plain
 * string key, stored as-is in stamp_key/DB) — only this Storage lookup
 * uppercases it, to match the real uploaded asset set (Storage object
 * names are case-sensitive, and the prepared images came in as
 * "CAT-0.png" etc., not renamed to lowercase). `variant` defaults to 0
 * when omitted.
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
  const name = `${id.toUpperCase()}-${variant ?? 0}`;
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
