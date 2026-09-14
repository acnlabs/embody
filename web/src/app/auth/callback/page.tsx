"use client";

import { useAuth0 } from "@auth0/auth0-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AUTH0_CLIENT_ID } from "@/lib/auth0";
import { ownerError } from "@/lib/copy";

function CallbackWait() {
  const router = useRouter();
  const { isLoading, isAuthenticated, error } = useAuth0();

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
        <h3>登录失败</h3>
        <p>{ownerError(error.message)}</p>
        <p>
          <a href="/">返回首页</a>
        </p>
      </main>
    );
  }

  return <main className="meta">正在登录…</main>;
}

export default function AuthCallbackPage() {
  if (!AUTH0_CLIENT_ID) {
    return <main className="meta">还不能登录。</main>;
  }
  return <CallbackWait />;
}
