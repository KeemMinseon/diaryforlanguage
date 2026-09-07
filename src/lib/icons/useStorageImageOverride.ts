"use client";

import { useEffect, useState } from "react";

// Tried in order — whichever one actually exists wins.
const EXTENSIONS = ["png", "jpg", "jpeg", "webp", "svg"];

/**
 * Resolves to the URL of a custom-uploaded override for `name` in the
 * given public Storage bucket (e.g. "<name>.png"), or null if none exists
 * — shared by KeywordIcon (bucket "stamp-icons") and UiIcon (bucket
 * "ui-icons") so both can be swapped just by uploading a file, no code
 * change or deploy needed.
 *
 * The existence check runs off-DOM via `new Image()` rather than
 * rendering a real `<img src=...>` and reacting to its `onError`: this
 * markup is server-rendered, so the browser starts fetching a real
 * `<img>` as soon as the HTML parses — before hydration has attached any
 * listener. A fast 404 can finish loading (and failing) before React
 * ever gets to hear about it, so an onError-based fallback would
 * silently never fire. Probing off-DOM first and only rendering the real
 * `<img>` once a URL is confirmed to exist avoids that race entirely.
 */
export function useStorageImageOverride(bucket: string, name: string): string | null {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;

    async function probe() {
      setResolvedUrl(null);
      if (!base) return;
      for (const ext of EXTENSIONS) {
        const url = `${base}/storage/v1/object/public/${bucket}/${name}.${ext}`;
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
  }, [bucket, name]);

  return resolvedUrl;
}
