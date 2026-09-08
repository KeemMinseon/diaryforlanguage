import type { Metadata, Viewport } from "next";
import "./globals.css";
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
  themeColor: "#2c2c2c",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
