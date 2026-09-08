"use client";

import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useStorageImageOverride } from "@/lib/icons/useStorageImageOverride";

/** Extracts just the `<svg>...</svg>` markup, strips anything that could
 * execute (script tags, inline event handlers — this is the user's own
 * upload to their own bucket, but still not worth trusting blindly), and
 * swaps explicit fill/stroke colors for `currentColor` so the icon
 * inherits whatever ink tone its surrounding button/link already
 * declares (including a hover color change) instead of a fixed color
 * baked into the file. Returns null if it doesn't look like an SVG. */
function sanitizeAndRecolorSvg(raw: string): string | null {
  const match = raw.match(/<svg[\s\S]*<\/svg>/i);
  if (!match) return null;
  let svg = match[0];

  svg = svg.replace(/<script[\s\S]*?<\/script>/gi, "");
  svg = svg.replace(/\son\w+="[^"]*"/gi, "");

  svg = svg.replace(/(fill|stroke)="(?!none")[^"]*"/gi, '$1="currentColor"');
  svg = svg.replace(/(fill|stroke):\s*(?!none)[^;"']+/gi, "$1:currentColor");

  // Let the wrapping element's className size it, not the file's own
  // width/height attributes.
  svg = svg.replace(/(<svg\b[^>]*?)\swidth="[^"]*"/i, "$1");
  svg = svg.replace(/(<svg\b[^>]*?)\sheight="[^"]*"/i, "$1");
  svg = svg.replace(/<svg\b/i, '<svg width="100%" height="100%"');

  return svg;
}

/** In-memory, for the life of the tab — keyed by the resolved Storage URL
 * (not the icon name), since that's what actually identifies the file
 * content. Without this, every remount (any client-side navigation) redid
 * the fetch-and-recolor pass and showed the built-in fallback icon again
 * while it did, even though `useStorageImageOverride` itself already knew
 * the URL instantly from its own cache. */
const svgMarkupCache = new Map<string, string | null>();

const SVG_STORAGE_PREFIX = "ui-icon-svg:";

function readPersistedSvg(url: string): string | null {
  try {
    return localStorage.getItem(SVG_STORAGE_PREFIX + url);
  } catch {
    return null;
  }
}

function writePersistedSvg(url: string, svg: string) {
  try {
    localStorage.setItem(SVG_STORAGE_PREFIX + url, svg);
  } catch {
    // Private browsing / storage disabled — the in-memory cache still
    // covers the rest of this tab's life.
  }
}

/**
 * Renders a custom-uploaded icon for `name` if one exists in the public
 * `ui-icons` Storage bucket (named "<name>.png"/".svg" etc.), falling
 * back to `children` — the app's existing built-in icon or emoji for
 * that slot — otherwise. Same upload-to-override mechanism as the stamp
 * keyword icons (KeywordIcon), generalized to any icon in the app's UI
 * chrome.
 *
 * An SVG override is fetched and inlined rather than rendered as a plain
 * `<img>`, specifically so its colors can be swapped for `currentColor`
 * (see sanitizeAndRecolorSvg) — that's what lets one uploaded icon
 * automatically match the app's ink/ink-soft tone (and hover states)
 * wherever it's used, rather than showing whatever fixed color the file
 * happened to have. A raster override (png/jpg/webp) can't do this —
 * it renders as-is.
 */
export default function UiIcon({
  name,
  className,
  alt = "",
  flip = false,
  children,
}: {
  /** Icon slot name — also the filename (minus extension) to upload as. */
  name: string;
  className?: string;
  alt?: string;
  /** Mirrors the icon horizontally — for a single directional upload
   * (e.g. one "bracket" pointing back/left) reused for the opposite
   * direction instead of needing a second file. */
  flip?: boolean;
  children: ReactNode;
}) {
  const resolvedUrl = useStorageImageOverride("ui-icons", name);
  const isSvg = resolvedUrl?.toLowerCase().endsWith(".svg") ?? false;
  const [svgMarkup, setSvgMarkup] = useState<string | null>(() =>
    resolvedUrl ? (svgMarkupCache.get(resolvedUrl) ?? null) : null
  );

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!isSvg || !resolvedUrl) {
        setSvgMarkup(null);
        return;
      }

      const known = svgMarkupCache.get(resolvedUrl) ?? readPersistedSvg(resolvedUrl);
      if (known) {
        svgMarkupCache.set(resolvedUrl, known);
        if (!cancelled) setSvgMarkup(known);
        return;
      }

      try {
        const res = await fetch(resolvedUrl);
        if (!res.ok) throw new Error("fetch failed");
        const text = await res.text();
        const sanitized = sanitizeAndRecolorSvg(text);
        if (sanitized) {
          svgMarkupCache.set(resolvedUrl, sanitized);
          writePersistedSvg(resolvedUrl, sanitized);
        }
        if (!cancelled) setSvgMarkup(sanitized);
      } catch {
        if (!cancelled) setSvgMarkup(null);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [isSvg, resolvedUrl]);

  const flipStyle: CSSProperties | undefined = flip ? { transform: "scaleX(-1)" } : undefined;
  const a11yProps = alt ? { role: "img" as const, "aria-label": alt } : { "aria-hidden": true as const };

  if (!resolvedUrl || (isSvg && !svgMarkup)) {
    // No override, or an SVG override still being fetched/recolored —
    // show the fallback rather than a gap while that's in flight.
    return (
      <span className="inline-flex items-center justify-center" style={flipStyle}>
        {children}
      </span>
    );
  }

  if (isSvg && svgMarkup) {
    return (
      <span
        className={className}
        style={flipStyle}
        {...a11yProps}
        dangerouslySetInnerHTML={{ __html: svgMarkup }}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, dimensions unknown ahead of time
    <img
      src={resolvedUrl}
      alt={alt}
      className={className}
      style={{ objectFit: "contain", ...flipStyle }}
    />
  );
}
