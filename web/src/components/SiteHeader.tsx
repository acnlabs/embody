"use client";

import Link from "next/link";
import { useAuth0 } from "@auth0/auth0-react";
import { AUTH0_CLIENT_ID } from "@/lib/auth0";

function AuthedActions() {
  const auth = useAuth0();
  if (!auth.isAuthenticated) return null;
  return (
    <div className="topbar-right">
      <span className="user">{auth.user?.email || auth.user?.name || "owner"}</span>
      <button
        type="button"
        onClick={() => auth.logout({ logoutParams: { returnTo: window.location.origin } })}
      >
        退出
      </button>
    </div>
  );
}

export default function SiteHeader() {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand">
          <Link href="/">EMBODY</Link>
        </div>
        <nav className="menu" aria-label="Embody">
          <span className="menu-item active" aria-current="page">
            studio
          </span>
        </nav>
        {AUTH0_CLIENT_ID ? <AuthedActions /> : null}
      </div>
    </header>
  );
}
