"use client";

import { useAuth0 } from "@auth0/auth0-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AUTH0_CLIENT_ID } from "@/lib/auth0";

function CallbackWait() {
  const router = useRouter();
  const { isLoading, error } = useAuth0();

  useEffect(() => {
    if (error) router.replace("/");
    const timer = setTimeout(() => {
      if (!isLoading) router.replace("/");
    }, 4000);
    return () => clearTimeout(timer);
  }, [isLoading, error, router]);

  return <main className="meta">正在登录…</main>;
}

export default function AuthCallbackPage() {
  if (!AUTH0_CLIENT_ID) {
    return <main className="meta">Auth0 未配置。</main>;
  }
  return <CallbackWait />;
}
