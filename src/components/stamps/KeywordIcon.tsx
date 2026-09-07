"use client";

import StampIcon from "@/components/stamps/StampIcon";
import { useStorageImageOverride } from "@/lib/icons/useStorageImageOverride";
import type { StampId } from "@/lib/stamps/keywordMap";

/**
 * Renders a custom-uploaded icon for this keyword if one exists in the
 * public `stamp-icons` Storage bucket (named "<id>.png" etc. — see
 * useStorageImageOverride), falling back to the built-in hand-drawn SVG
 * icon otherwise. A raster override doesn't get the SVG's engraved-
 * shadow depth treatment — it just fills the window as-is, the same way
 * an attached photo stamp does.
 */
export default function KeywordIcon({
  id,
  className,
}: {
  id: StampId;
  className?: string;
}) {
  const resolvedUrl = useStorageImageOverride("stamp-icons", id);

  if (!resolvedUrl) {
    return <StampIcon id={id} className={className} />;
  }

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
