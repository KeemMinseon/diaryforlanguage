"use client";

import type { ReactNode } from "react";
import { useStorageImageOverride } from "@/lib/icons/useStorageImageOverride";

/**
 * Renders a custom-uploaded icon for `name` if one exists in the public
 * `ui-icons` Storage bucket (named "<name>.png" etc.), falling back to
 * `children` — the app's existing built-in icon or emoji for that slot —
 * otherwise. Same upload-to-override mechanism as the stamp keyword
 * icons (KeywordIcon), generalized to any icon in the app's UI chrome.
 */
export default function UiIcon({
  name,
  className,
  alt = "",
  children,
}: {
  /** Icon slot name — also the filename (minus extension) to upload as. */
  name: string;
  className?: string;
  alt?: string;
  children: ReactNode;
}) {
  const resolvedUrl = useStorageImageOverride("ui-icons", name);

  if (!resolvedUrl) {
    // A bare fragment wouldn't be a real box — flex `gap` on a parent row
    // (e.g. an icon next to a text label) has nothing to apply to between
    // two raw text nodes, so the space next to the label silently
    // disappears. Wrapping in an inline-flex span fixes that without
    // constraining the fallback glyph's own natural size.
    return <span className="inline-flex items-center justify-center">{children}</span>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, dimensions unknown ahead of time
    <img src={resolvedUrl} alt={alt} className={className} style={{ objectFit: "contain" }} />
  );
}
