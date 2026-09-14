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
 * Rendered plain — no postage-stamp mask/tint wrapper any more (see
 * DiaryStamp): the prepared image set already reads as its own finished
 * stamp graphic, so the scalloped frame used to be doubled framing on top
 * of framing. Only an actual user-taken photo still goes through
 * StampFrame's mask/tint treatment.
 *
 * While a keyword has no image uploaded yet, this renders nothing — there
 * is no fallback background here any more, so an unresolved keyword shows
 * as a plain empty box until its image is uploaded.
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
