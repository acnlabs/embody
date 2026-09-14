import type { Metadata } from "next";
import AuthProvider from "@/components/AuthProvider";
import { LocaleProvider } from "@/lib/i18n";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import "./globals.css";

export const metadata: Metadata = {
  title: "Embody",
  description: "Watch your bodies. Drive them when they're on.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <LocaleProvider>
            <SiteHeader />
            {children}
            <SiteFooter />
          </LocaleProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
