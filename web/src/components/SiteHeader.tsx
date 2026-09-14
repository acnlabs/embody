"use client";

import Link from "next/link";
import { useAuth0 } from "@auth0/auth0-react";
import { AUTH0_CLIENT_ID } from "@/lib/auth0";
import { useI18n, type Locale } from "@/lib/i18n";

function LangSwitch() {
  const { locale, setLocale, t } = useI18n();
  const pick = (next: Locale) => {
    setLocale(next);
  };
  return (
    <div className="lang-switch" role="group" aria-label={t("lang.label")}>
      <button
        type="button"
        className={locale === "en" ? "lang-btn on" : "lang-btn"}
        aria-pressed={locale === "en"}
        onClick={() => pick("en")}
      >
        {t("lang.en")}
      </button>
      <button
        type="button"
        className={locale === "zh" ? "lang-btn on" : "lang-btn"}
        aria-pressed={locale === "zh"}
        onClick={() => pick("zh")}
      >
        {t("lang.zh")}
      </button>
    </div>
  );
}

function AuthedActions() {
  const auth = useAuth0();
  const { t } = useI18n();
  if (!auth.isAuthenticated) return null;
  return (
    <>
      <span className="user">{auth.user?.email || auth.user?.name || t("nav.you")}</span>
      <button
        type="button"
        onClick={() => auth.logout({ logoutParams: { returnTo: window.location.origin } })}
      >
        {t("nav.signOut")}
      </button>
    </>
  );
}

export default function SiteHeader() {
  const { t } = useI18n();
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand">
          <Link href="/">EMBODY</Link>
        </div>
        <nav className="menu" aria-label="Embody">
          <span className="menu-item active" aria-current="page">
            {t("nav.bodies")}
          </span>
        </nav>
        <div className="topbar-right">
          <LangSwitch />
          {AUTH0_CLIENT_ID ? <AuthedActions /> : null}
        </div>
      </div>
    </header>
  );
}
