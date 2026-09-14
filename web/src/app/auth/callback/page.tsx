"use client";

import { useAuth0 } from "@auth0/auth0-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AUTH0_CLIENT_ID } from "@/lib/auth0";
import { ownerError } from "@/lib/copy";
import { useI18n } from "@/lib/i18n";

function CallbackWait() {
  const router = useRouter();
  const { isLoading, isAuthenticated, error } = useAuth0();
  const { t } = useI18n();

  useEffect(() => {
    if (error || isAuthenticated) return;
    const timer = setTimeout(() => {
      if (!isLoading) router.replace("/");
    }, 4000);
    return () => clearTimeout(timer);
  }, [isLoading, isAuthenticated, error, router]);

  if (error) {
    return (
      <main className="meta" style={{ padding: "2rem" }}>
        <h3>{t("auth.fail")}</h3>
        <p>{ownerError(error.message, t)}</p>
        <p>
          <a href="/">{t("auth.home")}</a>
        </p>
      </main>
    );
  }

  return <main className="meta">{t("auth.signingIn")}</main>;
}

export default function AuthCallbackPage() {
  const { t } = useI18n();
  if (!AUTH0_CLIENT_ID) {
    return <main className="meta">{t("home.setupHint")}</main>;
  }
  return <CallbackWait />;
}
