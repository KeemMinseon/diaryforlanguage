import type { Metadata } from "next";
import { Noto_Sans_KR, Noto_Serif_JP } from "next/font/google";
import "./globals.css";
import ToastProvider from "@/components/toast/ToastProvider";

const bodyFont = Noto_Sans_KR({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const headingFont = Noto_Sans_KR({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["700"],
});

const diaryFont = Noto_Serif_JP({
  variable: "--font-diary",
  subsets: ["latin"],
  weight: ["300", "500"],
});

export const metadata: Metadata = {
  title: "우표일기",
  description: "일본어로 하루를 적으면, 우표가 찍히고 添削이 도착하는 학습 일기",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${bodyFont.variable} ${headingFont.variable} ${diaryFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
