import type { Metadata } from "next";
import { headers } from "next/headers";
import AuthProvider from "@/components/AuthProvider";
import { LocaleProvider } from "@/lib/i18n";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import "./globals.css";

export const metadata: Metadata = {
  title: "Embody",
  description: "Watch your bodies. Drive them when they're on.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const hostFrame = (await headers()).get("x-embody-host") === "1";
  if (hostFrame) {
    return (
      <html lang="en" className="embody-host">
        <body>
          <LocaleProvider>{children}</LocaleProvider>
        </body>
      </html>
    );
  }
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
