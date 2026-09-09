import type { Metadata, Viewport } from "next";
import "./globals.css";
import PageTransition from "@/components/transition/PageTransition";
import ToastProvider from "@/components/toast/ToastProvider";

export const metadata: Metadata = {
  title: "우표일기",
  description: "일본어로 하루를 적으면, 우표가 찍히고 添削이 도착하는 학습 일기",
  // No `appleWebApp` here on purpose — `capable: true` makes iOS launch
  // the home-screen icon in its own storage container, isolated from
  // Safari's cookies. This app's login is a magic-link email, which
  // always opens in regular Safari — so a session started there could
  // never reach that separate standalone container, making login look
  // broken every time the icon was tapped. apple-icon.png alone is
  // enough for the home-screen icon to show correctly without that
  // isolation; Android's manifest-driven standalone mode isn't affected
  // by this and still works normally.
};

export const viewport: Viewport = {
  // Matches --paper in each mode (the app's own background), not --ink —
  // this colors the OS status bar on an installed Android PWA, and
  // painting it the dark ink color left a stark black band sitting on top
  // of every screen's light background instead of blending into it. These
  // two tags only respond to the OS's own light/dark setting (`media` is a
  // real CSS media query) — the inline script below forces both to the
  // same color, overriding whichever one the OS would've picked, whenever
  // an explicit in-app choice (ThemeToggle.tsx) disagrees with the OS.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f3" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1c1e" },
  ],
  // Without this, iOS Safari's default on focusing a text input is to pan
  // the whole visual viewport up and over the keyboard rather than
  // shrinking it — ChatEditor's `h-dvh` split-screen layout (feed on top,
  // input pinned at the bottom) is built assuming the viewport itself
  // shrinks to fit above the keyboard, so under that default it instead
  // felt like the entire screen was dragged upward along with it.
  // "resizes-content" (Chrome, and Safari 16.4+) makes the visual
  // viewport actually shrink — and `dvh` update to match — when the
  // keyboard opens, so the layout just reflows into the smaller space
  // like it would for any other viewport resize, instead of scrolling.
  interactiveWidget: "resizes-content",
};

// Sets <html data-theme> from the learner's saved preference (see
// ThemeToggle.tsx) before the browser paints anything, so an explicit
// light/dark choice never flashes the *other* mode first — a plain
// useEffect in a React component runs too late (after first paint) for
// that. Deliberately not `next/script` (which defers past first paint) —
// this needs to be a plain synchronous inline script, run in document
// order before <body>. "system" is stored as no entry at all, so a
// missing/invalid value here just leaves <html> without the attribute,
// falling through to the plain `prefers-color-scheme` media query in
// globals.css exactly as if nothing had ever been chosen.
//
// Also force-syncs the OS status bar color — the two `<meta
// name="theme-color" media="...">` tags above only ever follow the OS's
// own light/dark setting on their own, so picking "다크" while the OS
// itself is set to light (or vice versa) left the status bar on the
// wrong entry. This resolves the right color in JS instead of trusting
// that `media` matching.
//
// It does *not* just mutate those two tags' `content` in place, though —
// they're part of Next's own managed metadata output, and React
// reconciles them on hydration. Directly overwriting their `content`
// first made hydration detect a mismatch against what it expected to
// render and patch a *third* tag back in with the original, unmutated
// color, undoing the fix the moment hydration finished (verified via a
// post-hydration DOM dump turning up three theme-color tags instead of
// two). Appending one extra tag of our own instead — never touched by
// Next's metadata tree, so nothing reconciles it away — sidesteps that:
// it carries no `media` condition (always matches), and a browser
// resolving multiple matching theme-color tags takes the *last* one in
// document order, so this one wins over Next's pair without needing to
// touch them at all.
//
// The change listener keeps this correct if the OS's own light/dark
// setting flips while the page is already open and no explicit choice
// is active — otherwise only the *next* full reload would pick it up.
// This script tag is part of the root layout's persistent <head>, so
// (unlike a component's effect) it isn't torn down by client-side
// navigation and only needs to attach this listener once.
// ThemeToggle.tsx repeats the same resolve-and-write logic for a change
// made after this initial load.
const THEME_INIT_SCRIPT = `
try {
  var LIGHT = "#f2f2f3", DARK = "#1c1c1e";
  var media = window.matchMedia("(prefers-color-scheme: dark)");
  function syncStatusBar() {
    var t = localStorage.getItem("theme-preference");
    var isDark = t === "dark" || (t !== "light" && media.matches);
    var color = isDark ? DARK : LIGHT;
    var tag = document.getElementById("theme-color-override");
    if (!tag) {
      tag = document.createElement("meta");
      tag.id = "theme-color-override";
      tag.setAttribute("name", "theme-color");
      document.head.appendChild(tag);
    }
    tag.setAttribute("content", color);
  }
  var t = localStorage.getItem("theme-preference");
  if (t === "light" || t === "dark") {
    document.documentElement.setAttribute("data-theme", t);
  }
  syncStatusBar();
  media.addEventListener("change", syncStatusBar);
} catch (e) {}
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ToastProvider>
          <PageTransition>{children}</PageTransition>
        </ToastProvider>
      </body>
    </html>
  );
}
