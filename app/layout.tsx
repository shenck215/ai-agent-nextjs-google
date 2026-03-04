import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import { UserMenu } from "./components/user-menu";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "噜噜 · 我的 AI 小助手",
  description: "水豚噜噜 - 活泼可爱的 AI 智能体，随时准备帮助你！",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={`${nunito.variable} antialiased`} style={{ fontFamily: "var(--font-nunito), 'PingFang SC', sans-serif" }}>
        <UserMenu />
        {children}
      </body>
    </html>
  );
}
