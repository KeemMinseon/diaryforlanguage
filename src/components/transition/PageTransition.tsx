"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

/** How many levels "deep" a route sits in this app's own navigation
 * hierarchy — not the URL's own segment count, since /settings and
 * /entry/[date] are both one level below the calendar despite one of
 * them having a shorter path. Used only to pick a slide direction. */
function depthOf(pathname: string): number {
  return pathname === "/" ? 0 : 1;
}

/**
 * Gives page navigations a sense of motion instead of an abrupt swap —
 * the incoming screen slides in from the right when going deeper
 * (calendar → a day, or → settings) and from the left when coming back,
 * matching the everyday left-to-right "forward" convention.
 *
 * This only animates the *entering* page, not a true synced enter/exit
 * pair — that needs React's <ViewTransition>, which isn't in any stable
 * React release yet (canary-only). Pinning this app's production
 * dependency to a canary build just for a nicer transition felt like
 * the wrong trade, so this sticks to a plain CSS entrance animation on
 * stable React instead.
 *
 * Direction is derived by comparing this navigation's depth against the
 * previous one, using React's own sanctioned "adjust state during
 * render when a prop changes" pattern (conditionally calling setState
 * mid-render, which restarts this render pass with the new state
 * already applied before anything commits) — not a ref, which this
 * project's lint rules disallow touching during render.
 */
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [prevPathname, setPrevPathname] = useState(pathname);
  const [prevDepth, setPrevDepth] = useState(() => depthOf(pathname));
  const [direction, setDirection] = useState<"forward" | "back" | "none">("none");

  if (pathname !== prevPathname) {
    const depth = depthOf(pathname);
    setDirection(depth > prevDepth ? "forward" : depth < prevDepth ? "back" : "none");
    setPrevDepth(depth);
    setPrevPathname(pathname);
  }

  return (
    // flex/flex-1/min-h-0 so this wrapper passes body's flex-col sizing
    // straight through to the actual page underneath — every page's own
    // root div already assumes it's a direct flex child of <body> (for
    // its own flex-1 to fill the remaining viewport height), which this
    // wrapper would otherwise quietly break just by sitting in between.
    <div key={pathname} className={`flex min-h-0 flex-1 flex-col page-slide-${direction}`}>
      {children}
    </div>
  );
}
