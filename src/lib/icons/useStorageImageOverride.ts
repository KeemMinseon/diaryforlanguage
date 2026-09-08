"use client";

import { useEffect, useState } from "react";

// Tried in order — whichever one actually exists wins. SVG first: every
// override uploaded so far is an SVG, and probing it last meant paying
// for four guaranteed-404 round trips (one per other extension) before
// ever reaching the one that actually resolves — that's the delay that
// showed the built-in fallback icon on screen while it worked through
// them.
const EXTENSIONS = ["svg", "png", "jpg", "jpeg", "webp"];

/** In-memory, for the life of the tab — a client-side navigation between
 * routes remounts these icon components, and without this they'd redo
 * the whole probe (and flash the fallback again) on every single one,
 * even though the answer can't have changed since the last mount. */
const sessionCache = new Map<string, string | null>();

function cacheKey(bucket: string, name: string): string {
  return `${bucket}/${name}`;
}

const STORAGE_PREFIX = "ui-icon-resolved:";

/** Survives a full reload (a fresh tab has no in-memory cache to read).
 * Only ever stores a hit — a miss is cheap to re-check next time and
 * shouldn't stick around blocking a since-added upload from ever being
 * found on a returning visit. */
function readPersisted(key: string): string | null {
  try {
    return localStorage.getItem(STORAGE_PREFIX + key);
  } catch {
    return null;
  }
}

function writePersisted(key: string, url: string) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, url);
  } catch {
    // Private browsing / storage disabled — the in-memory cache still
    // helps for the rest of this tab's life either way.
  }
}

/**
 * Resolves to the URL of a custom-uploaded override for `name` in the
 * given public Storage bucket (e.g. "<name>.svg"), or null if none exists
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
 *
 * A resolved URL is cached (in memory, and in localStorage across
 * reloads) so a name that's already been found doesn't re-probe from
 * scratch — otherwise every remount (any client-side navigation) would
 * show the built-in fallback again while it re-ran the whole check.
 */
export function useStorageImageOverride(bucket: string, name: string): string | null {
  const key = cacheKey(bucket, name);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(() => sessionCache.get(key) ?? null);

  useEffect(() => {
    let cancelled = false;
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;

    async function probe() {
      if (!base) return;

      const known = sessionCache.get(key) ?? readPersisted(key);
      if (known) {
        sessionCache.set(key, known);
        if (!cancelled) setResolvedUrl(known);
        return;
      }

      setResolvedUrl(null);
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
          sessionCache.set(key, url);
          writePersisted(key, url);
          setResolvedUrl(url);
          return;
        }
      }
      // Remembered for this tab only — not persisted, so a since-added
      // upload is still found the next time the page is actually reloaded.
      sessionCache.set(key, null);
    }

    probe();
    return () => {
      cancelled = true;
    };
  }, [bucket, name, key]);

  return resolvedUrl;
}
