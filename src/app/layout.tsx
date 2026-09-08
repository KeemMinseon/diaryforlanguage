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
  // of every screen's light background instead of blending into it. Only
  // follows the OS's own light/dark setting (the `media` condition below
  // is a real CSS media query, so it can't also see the in-app dark-mode
  // override in ThemeToggle.tsx) — a learner who explicitly picks a theme
  // that disagrees with their OS setting gets a status bar matching the
  // OS, not their in-app choice, on that one edge case.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f3" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1c1e" },
  ],
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
const THEME_INIT_SCRIPT = `
try {
  var t = localStorage.getItem("theme-preference");
  if (t === "light" || t === "dark") {
    document.documentElement.setAttribute("data-theme", t);
  }
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
