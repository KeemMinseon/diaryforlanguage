/** The OS status bar (clock/battery row) is native chrome painted by the
 * `theme-color` meta tag — it sits above the webview entirely, so no
 * in-page overlay (like a lightbox's `bg-black/70` backdrop) can ever dim
 * it just by covering the viewport. To make it visually match a dimmed
 * screen, the tag itself has to be swapped to a pre-blended dark color
 * while the overlay is open, then swapped back on close.
 *
 * A single instant swap (the first version of this) landed the status
 * bar's new color the moment the lightbox started opening, while the
 * backdrop underneath was still mid-fade (180ms in / 160ms out, see
 * lightbox-backdrop-in/out in globals.css) — the status bar looked like
 * it "jumped ahead" of the page, reading as a flicker at the seam between
 * the two. Animating the tag's color over that exact same duration
 * (instead of snapping it) keeps both in step.
 *
 * Reuses the `#theme-color-override` tag layout.tsx's own init script
 * writes (and keeps updated for light/dark preference) — this only ever
 * flips *that* tag's color, never fights it, so restoring just re-derives
 * the same light/dark color that script would currently want.
 *
 * iOS Safari confirmed this rAF fade actively hurts there: darkening
 * roughly matched, but brightening back visibly lagged — the toolbar was
 * still catching up *after* the page had already finished closing.
 * WebKit already runs its own cross-fade whenever a theme-color changes;
 * every one of our own step writes below restarts that fade mid-flight,
 * and restarting it ~10 times over 160ms compounds into exactly that kind
 * of lag. Chrome/Android has no such built-in animation at all — an
 * instant single write there is a hard flicker, which is what the rAF
 * fade exists for. So iOS Safari gets a single clean write instead (let
 * WebKit's own transition run once, uninterrupted); every other browser
 * keeps the manual fade. */

const NORMAL = { light: "#fdfcfc", dark: "#1c1c1e" } as const;
// Each color above blended with 70% black (matching the lightbox
// backdrop's own `bg-black/70`), precomputed rather than done in CSS since
// a meta tag's `content` can't reference a color-mix.
const DIMMED = { light: "#4c4b4a", dark: "#080809" } as const;

// Must match lightbox-backdrop-in/out's own animation-duration in
// globals.css, so the status bar and the backdrop finish fading together.
const FADE_IN_MS = 180;
const FADE_OUT_MS = 160;

function isIOSSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // Excludes other iOS browsers (Chrome/Firefox/Edge on iOS), which are
  // still WebKit under the hood but don't necessarily share Safari's own
  // toolbar-tint behavior.
  return /iP(hone|od|ad)/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

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

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(rgb: [number, number, number]): string {
  return (
    "#" +
    rgb
      .map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0"))
      .join("")
  );
}

function lerpRgb(from: [number, number, number], to: [number, number, number], t: number) {
  return [
    from[0] + (to[0] - from[0]) * t,
    from[1] + (to[1] - from[1]) * t,
    from[2] + (to[2] - from[2]) * t,
  ] as [number, number, number];
}

let rafId: number | null = null;

/** Fades the `#theme-color-override` tag's own color from whatever it
 * currently is to `toHex` over `durationMs`, one requestAnimationFrame
 * step at a time — cancels any fade already in flight first, so rapidly
 * re-opening/closing the lightbox never leaves two fades racing each
 * other and settles on the very last call's target. */
function fadeTo(tag: Element, toHex: string, durationMs: number) {
  if (rafId !== null) cancelAnimationFrame(rafId);
  const fromHex = tag.getAttribute("content") || toHex;
  const from = hexToRgb(fromHex);
  const to = hexToRgb(toHex);
  const start = performance.now();
  function step(now: number) {
    const t = Math.min(1, (now - start) / durationMs);
    tag.setAttribute("content", rgbToHex(lerpRgb(from, to, t)));
    rafId = t < 1 ? requestAnimationFrame(step) : null;
  }
  rafId = requestAnimationFrame(step);
}

export function setStatusBarDimmed(dimmed: boolean) {
  try {
    const tag = document.getElementById("theme-color-override");
    if (!tag) return;
    const isDark = isDarkPreferred();
    const palette = dimmed ? DIMMED : NORMAL;
    const target = isDark ? palette.dark : palette.light;
    if (isIOSSafari()) {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      tag.setAttribute("content", target);
      return;
    }
    fadeTo(tag, target, dimmed ? FADE_IN_MS : FADE_OUT_MS);
  } catch {
    // Best-effort cosmetic touch — never worth surfacing an error for.
  }
}
