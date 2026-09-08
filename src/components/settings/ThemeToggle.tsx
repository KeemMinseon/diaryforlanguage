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
 * Also force-syncs the OS status bar color the same way that script does:
 * the two `<meta name="theme-color" media="...">` tags layout.tsx renders
 * only ever follow the OS's own light/dark setting on their own, so
 * picking "다크" while the OS itself is set to light left the status bar
 * on the *light* entry — right page, wrong status bar. Forcing both tags
 * to the same color sidesteps needing to know which one the browser
 * would've actually picked; "system" resets each tag back to its own
 * distinct color so the OS media query decides between them again. */
function applyTheme(pref: ThemePreference) {
  if (pref === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", pref);
  }

  const forced =
    pref === "dark" ? DARK_STATUS_COLOR : pref === "light" ? LIGHT_STATUS_COLOR : null;
  document.querySelectorAll('meta[name="theme-color"]').forEach((tag, i) => {
    tag.setAttribute("content", forced ?? (i === 0 ? LIGHT_STATUS_COLOR : DARK_STATUS_COLOR));
  });
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
                ? "card-elevated bg-[var(--paper-raised)] text-[var(--ink)]"
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
