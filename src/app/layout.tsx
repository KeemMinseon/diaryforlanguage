import type { Metadata, Viewport } from "next";
import "./globals.css";
import ToastProvider from "@/components/toast/ToastProvider";

export const metadata: Metadata = {
  title: "우표일기",
  description: "일본어로 하루를 적으면, 우표가 찍히고 添削이 도착하는 학습 일기",
  // Without these, "홈 화면에 추가" showed a generic Vercel icon instead
  // of the app's own — manifest.ts covers Android/Chrome, apple-icon.png
  // covers iOS, and appleWebApp here is what makes iOS launch it as a
  // standalone app (no browser chrome) instead of just a bookmark.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "우표일기",
  },
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
