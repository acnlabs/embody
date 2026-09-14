"use client";

import Link from "next/link";
import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";
import { AUTH0_AUDIENCE, AUTH0_CLIENT_ID } from "@/lib/auth0";
import { originLabel, ownerError, sessionLabel } from "@/lib/copy";
import type { BodyShow } from "@/lib/types";

type Payload = {
  show?: BodyShow[];
  agents?: { id: string; name: string }[];
  error?: string;
};

function keyNumber(body: BodyShow): string | null {
  const state = body.numbers?.body_state as { tilt_deg?: number } | undefined;
  if (typeof state?.tilt_deg === "number") return `倾斜 ${state.tilt_deg.toFixed(1)}°`;
  return null;
}

function ModuleChips({ body }: { body: BodyShow }) {
  const raw = body.build?.modules;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const entries = Object.entries(raw as Record<string, unknown>);
  if (!entries.length) return null;
  return (
    <p className="module-list home-modules">
      {entries.map(([name, value]) => (
        <span key={name} className={`badge module${value === false || value == null ? " off" : ""}`}>
          {name}
          {typeof value === "boolean" ? (value ? "" : " 无") : ""}
        </span>
      ))}
    </p>
  );
}

export function BodyCard({ body }: { body: BodyShow }) {
  const key = keyNumber(body);
  const tricks = body.cards?.length || 0;
  return (
    <article className="body-card">
      <Link href={`/b/${body.id}`}>
        <div className="body-cover">
          <span className="badge">{body.kind}</span>
          <span className={`status${body.session_running ? " on" : ""}`}>
            {sessionLabel(body.session_running)}
          </span>
          <span className="title">{body.name || body.id}</span>
          {key ? <span className="keynum">{key}</span> : null}
        </div>
      </Link>
      <div className="body-meta">
        <h3>
          <Link href={`/b/${body.id}`}>{body.name || body.id}</Link>
        </h3>
        <p className="meta">
          {originLabel(body.origin)}
          {tricks ? ` · ${tricks} 个招式` : ""}
        </p>
        <ModuleChips body={body} />
      </div>
    </article>
  );
}

function SetupHint() {
  return (
    <div className="empty">
      <h3>还不能登录</h3>
      <p>这间房暂时打不开。</p>
    </div>
  );
}

function SignedHome() {
  const auth = useAuth0();
  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!auth.isAuthenticated) return;
    let cancel = false;
    setLoading(true);
    (async () => {
      try {
        const token = await auth.getAccessTokenSilently({
          authorizationParams: { audience: AUTH0_AUDIENCE },
        });
        const res = await fetch("/api/show", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = (await res.json()) as Payload;
        if (!cancel) {
          if (!res.ok) setErr(ownerError(json.error || res.statusText));
          else setData(json);
        }
      } catch (exc) {
        if (!cancel) setErr(exc instanceof Error ? ownerError(exc.message) : "加载失败。");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [auth.isAuthenticated, auth.getAccessTokenSilently]);

  if (auth.isLoading) {
    return <p className="meta">登录状态读取中…</p>;
  }

  if (!auth.isAuthenticated) {
    return (
      <div className="empty">
        <h3>看你的身体</h3>
        <p>登录后可以看，开着的时候你也能开。</p>
        <p style={{ marginTop: "1.2rem" }}>
          <button type="button" className="primary" onClick={() => auth.loginWithRedirect()}>
            登录
          </button>
        </p>
      </div>
    );
  }

  const rows = data?.show || [];
  return (
    <>
      {loading ? <p className="meta">读取身体…</p> : null}
      {err ? <p className="warn">{err}</p> : null}
      {!loading && !err && !rows.length ? (
        <div className="empty">
          <h3>还没有身体</h3>
          <p>身体出现在这里之后，你就能看、也能开。</p>
        </div>
      ) : null}
      {rows.length ? (
        <div className="grid">
          {rows.map((body) => (
            <BodyCard body={body} key={body.id} />
          ))}
        </div>
      ) : null}
    </>
  );
}

export default function OwnerHome() {
  if (!AUTH0_CLIENT_ID) return <SetupHint />;
  return <SignedHome />;
}
