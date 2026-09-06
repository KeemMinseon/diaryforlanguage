import type { Metadata } from "next";
import { Gowun_Batang, Shippori_Mincho } from "next/font/google";
import "./globals.css";
import SketchDefs from "@/components/stamps/SketchDefs";
import ToastProvider from "@/components/toast/ToastProvider";

const bodyFont = Gowun_Batang({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const headingFont = Gowun_Batang({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["700"],
});

const diaryFont = Shippori_Mincho({
  variable: "--font-diary",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "言の葉日記 | 언어일기",
  description: "일본어로 하루를 적으면, 우표가 찍히고 添削이 도착하는 학습 일기",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${bodyFont.variable} ${headingFont.variable} ${diaryFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SketchDefs />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
