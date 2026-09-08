"use client";

import { useEffect, useState } from "react";

type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "theme-preference";

const LIGHT_STATUS_COLOR = "#f2f2f3";
const DARK_STATUS_COLOR = "#1c1c1e";

/** Mirrors what the inline anti-flash script in layout.tsx already did to
 * <html> before this component ever mounts — "system" just means "no
 * explicit override", letting the `prefers-color-scheme` media query in
 * globals.css decide.
 *
 * Also force-syncs the OS status bar color the same way that script does,
 * by upserting the same `#theme-color-override` tag rather than mutating
 * Next's own two `media`-scoped theme-color tags directly — see the long
 * comment on THEME_INIT_SCRIPT in layout.tsx for why: React's hydration
 * reconciles those two and silently undoes a direct mutation of their
 * `content` the moment it runs. This tag has no `media` condition (always
 * matches) and isn't part of Next's metadata tree, so nothing reconciles
 * it away, and a browser resolving multiple matching theme-color tags
 * takes the last one in document order — this one, appended after. */
function syncStatusBarMeta(pref: ThemePreference) {
  const isDark =
    pref === "dark" ||
    (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const color = isDark ? DARK_STATUS_COLOR : LIGHT_STATUS_COLOR;
  let tag = document.getElementById("theme-color-override") as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement("meta");
    tag.id = "theme-color-override";
    tag.setAttribute("name", "theme-color");
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", color);
}

function applyTheme(pref: ThemePreference) {
  if (pref === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", pref);
  }
  syncStatusBarMeta(pref);
}

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "시스템" },
  { value: "light", label: "라이트" },
  { value: "dark", label: "다크" },
];

export default function ThemeToggle() {
  // Starts "system" during the server-rendered HTML and the first client
  // render (there's no way to read localStorage on the server, and this
  // has to match that first render exactly or React complains about a
  // hydration mismatch) — corrected right after mount in the effect
  // below. <html>'s own data-theme attribute is already correct by then
  // (set by the inline script in layout.tsx, before first paint), so nothing
  // on screen actually flashes — only this control's own selected pill
  // catches up, for one frame, to what the page already looks like.
  const [pref, setPref] = useState<ThemePreference>("system");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      // This has to run once, right after mount, specifically to correct
      // the "system" placeholder above to whatever's actually stored —
      // localStorage isn't readable during the server-rendered/first-client
      // render (needed to match and avoid a hydration mismatch), so there's
      // no way to have the right value from the very first render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored === "light" || stored === "dark") setPref(stored);
    } catch {
      // Private browsing / storage disabled — stays "system" for this visit.
    }
  }, []);

  function choose(next: ThemePreference) {
    setPref(next);
    applyTheme(next);
    try {
      if (next === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Applies for this load either way — it just won't be remembered
      // next visit.
    }
  }

  return (
    <div className="flex items-center justify-between px-5 py-4">
      <span className="text-sm text-[var(--ink)]">테마</span>
      <div className="flex gap-1 rounded-full bg-[var(--paper)] p-0.5">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => choose(o.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              pref === o.value
                ? "bg-[var(--paper-raised)] text-[var(--ink)]"
                : "text-[var(--ink-soft)]"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
