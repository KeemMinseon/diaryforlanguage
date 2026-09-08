import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "우표일기",
    short_name: "우표일기",
    description: "일본어로 하루를 적으면, 우표가 찍히고 添削이 도착하는 학습 일기",
    start_url: "/",
    display: "standalone",
    background_color: "#e8e8e8",
    // Matches background_color/--paper, not --ink — this colors the OS
    // status bar on an installed Android PWA; painting it the dark ink
    // color left a stark black band that didn't blend with any screen's
    // actual (light) background.
    theme_color: "#e8e8e8",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
