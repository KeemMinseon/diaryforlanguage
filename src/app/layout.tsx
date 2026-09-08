import type { Metadata } from "next";
import "./globals.css";
import ToastProvider from "@/components/toast/ToastProvider";

export const metadata: Metadata = {
  title: "우표일기",
  description: "일본어로 하루를 적으면, 우표가 찍히고 添削이 도착하는 학습 일기",
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
