import type { Metadata } from "next";
import AuthProvider from "@/components/AuthProvider";
import SiteHeader from "@/components/SiteHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: "Embody",
  description: "看你的身体，也能开。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <AuthProvider>
          <SiteHeader />
          {children}
          <footer>看 · 也能开</footer>
        </AuthProvider>
      </body>
    </html>
  );
}
