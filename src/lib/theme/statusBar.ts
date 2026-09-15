/** The OS status bar (clock/battery row) is native chrome painted by the
 * `theme-color` meta tag — it sits above the webview entirely, so no
 * in-page overlay (like a lightbox's `bg-black/70` backdrop) can ever dim
 * it just by covering the viewport. To make it visually match a dimmed
 * screen, the tag itself has to be swapped to a pre-blended dark color
 * while the overlay is open, then swapped back on close.
 *
 * Reuses the `#theme-color-override` tag layout.tsx's own init script
 * writes (and keeps updated for light/dark preference) — this only ever
 * flips *that* tag's color, never fights it, so restoring just re-derives
 * the same light/dark color that script would currently want. */

const NORMAL = { light: "#fdfcfc", dark: "#1c1c1e" } as const;
// Each color above blended with 70% black (matching the lightbox
// backdrop's own `bg-black/70`), precomputed rather than done in CSS since
// a meta tag's `content` can't reference a color-mix.
const DIMMED = { light: "#4c4b4a", dark: "#080809" } as const;

function isDarkPreferred(): boolean {
  try {
    const pref = localStorage.getItem("theme-preference");
    if (pref === "dark") return true;
    if (pref === "light") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

export function setStatusBarDimmed(dimmed: boolean) {
  try {
    const tag = document.getElementById("theme-color-override");
    if (!tag) return;
    const isDark = isDarkPreferred();
    const palette = dimmed ? DIMMED : NORMAL;
    tag.setAttribute("content", isDark ? palette.dark : palette.light);
  } catch {
    // Best-effort cosmetic touch — never worth surfacing an error for.
  }
}
