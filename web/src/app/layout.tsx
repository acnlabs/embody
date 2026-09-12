import type { Metadata } from "next";
import AuthProvider from "@/components/AuthProvider";
import SiteHeader from "@/components/SiteHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: "Embody · studio",
  description: "Hosted owner studio. The agent drives. This page only observes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <AuthProvider>
          <SiteHeader />
          {children}
          <footer>本机 agent 开车 · 这里只看 push 上来的快照 · 不评 fallen</footer>
        </AuthProvider>
      </body>
    </html>
  );
}
