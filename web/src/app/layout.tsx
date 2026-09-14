import type { Metadata } from "next";
import AuthProvider from "@/components/AuthProvider";
import SiteHeader from "@/components/SiteHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: "Embody · studio",
  description: "Hosted owner studio. Watch the body; drive when push --watch is listening.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <AuthProvider>
          <SiteHeader />
          {children}
          <footer>人开 · agent 也能开 · 本机 push --watch 执行 · 不评 fallen</footer>
        </AuthProvider>
      </body>
    </html>
  );
}
