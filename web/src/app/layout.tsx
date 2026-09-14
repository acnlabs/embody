import type { Metadata } from "next";
import AuthProvider from "@/components/AuthProvider";
import SiteHeader from "@/components/SiteHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: "Embody · studio",
  description: "Hosted owner studio. The agent starts a session; you can drive too.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <AuthProvider>
          <SiteHeader />
          {children}
          <footer>人开 · agent 也能开 · 开一场就接通 · 不评 fallen</footer>
        </AuthProvider>
      </body>
    </html>
  );
}
