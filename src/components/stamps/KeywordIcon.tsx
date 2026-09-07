"use client";

import { useEffect, useState } from "react";
import StampIcon from "@/components/stamps/StampIcon";
import type { StampId } from "@/lib/stamps/keywordMap";

// Tried in order — whichever one actually exists wins. Upload a file to
// Supabase Storage's `stamp-icons` bucket named "<id>.<ext>" (e.g.
// "rain.png") and it replaces that keyword's built-in line-art icon
// automatically, no code change or deploy needed.
const EXTENSIONS = ["png", "jpg", "jpeg", "webp"];

function candidateUrls(id: StampId): string[] {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return [];
  return EXTENSIONS.map((ext) => `${base}/storage/v1/object/public/stamp-icons/${id}.${ext}`);
}

/**
 * Renders a custom-uploaded icon for this keyword if one exists in the
 * public `stamp-icons` Storage bucket, falling back to the built-in
 * hand-drawn SVG icon otherwise. A raster override doesn't get the SVG's
 * engraved-shadow depth treatment — it just fills the window as-is, the
 * same way an attached photo stamp does.
 *
 * The existence check runs off-DOM via `new Image()` rather than rendering
 * a real `<img src=...>` and reacting to its `onError`: this markup is
 * server-rendered, so the browser starts fetching a real `<img>` as soon
 * as the HTML parses — before hydration has attached any listener. A fast
 * 404 can finish loading (and failing) before React ever gets to hear
 * about it, so the SVG fallback would silently never appear. Probing
 * off-DOM first and only rendering the real `<img>` once a URL is
 * confirmed to exist avoids that race entirely.
 */
export default function KeywordIcon({
  id,
  className,
}: {
  id: StampId;
  className?: string;
}) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function probe() {
      setResolvedUrl(null);
      for (const url of candidateUrls(id)) {
        const found = await new Promise<boolean>((resolve) => {
          const img = new Image();
          img.onload = () => resolve(true);
          img.onerror = () => resolve(false);
          img.src = url;
        });
        if (cancelled) return;
        if (found) {
          setResolvedUrl(url);
          return;
        }
      }
    }

    probe();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // `className` is expected to be the full slot the caller gives us (e.g.
  // "h-full w-full") — the two modes then size themselves within it
  // differently: the SVG line art wants its own centered breathing room,
  // while an uploaded photo/icon should fill the whole window edge to
  // edge (like the attached-photo stamp) rather than float tiny in the
  // middle of it if the source image carries its own internal padding.
  if (!resolvedUrl) {
    return (
      <div className={`flex items-center justify-center ${className ?? ""}`}>
        <StampIcon id={id} className="h-4/5 w-4/5" />
      </div>
    );
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
