"use client";

import Link from "next/link";
import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";
import { AUTH0_AUDIENCE, AUTH0_CLIENT_ID } from "@/lib/auth0";
import type { BodyShow } from "@/lib/types";

type Payload = {
  show?: BodyShow[];
  agents?: { id: string; name: string }[];
  error?: string;
};

function keyNumber(body: BodyShow): string | null {
  const state = body.numbers?.body_state as { tilt_deg?: number } | undefined;
  if (typeof state?.tilt_deg === "number") return `tilt ${state.tilt_deg.toFixed(1)}°`;
  return null;
}

export function BodyCard({ body }: { body: BodyShow }) {
  const key = keyNumber(body);
  return (
    <article className="body-card">
      <Link href={`/b/${body.id}`}>
        <div className="body-cover">
          <span className="badge">{body.kind}</span>
          <span className={`status${body.session_running ? " on" : ""}`}>
            {body.session_running ? "会话中" : "待机"}
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
          {body.origin} · agent {body.bound_agent_id.slice(0, 8)}… · {body.cards?.length || 0} 张卡
        </p>
      </div>
    </article>
  );
}

function SetupHint() {
  return (
    <div className="empty">
      <h3>缺少 Auth0 client</h3>
      <p>
        和 ComicLaw 同租户；v0 默认用 ComicLaw 的公开 SPA。也可在 <code>web/.env.local</code> 写{" "}
        <code>NEXT_PUBLIC_AUTH0_CLIENT_ID</code>，回调 <code>/auth/callback</code>。
      </p>
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
          if (!res.ok) setErr(json.error || res.statusText);
          else setData(json);
        }
      } catch (exc) {
        if (!cancel) setErr(exc instanceof Error ? exc.message : "load failed");
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
        <h3>给 agent 的 owner 看</h3>
        <p>agent 开车，协作在 ACN。这里不搜 Hub、不拉工单、不发关节。</p>
        <p style={{ marginTop: "1.2rem" }}>
          <button type="button" className="primary" onClick={() => auth.loginWithRedirect()}>
            用 Auth0 登录
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
          <h3>还没有身体推上来</h3>
          <p>
            本机 <code>bind</code> 的必须是你的 agent，再 <code>embody push</code>（
            <code>EMBODY_STUDIO_URL</code> 指向这里）。
          </p>
          <pre>
            <code>{`python3 -m embody bind --body duck-1
python3 -m embody push --body duck-1`}</code>
          </pre>
          {data?.agents?.length ? (
            <>
              <p className="meta">你的 agent</p>
              <ul>
                {data.agents.map((agent) => (
                  <li key={agent.id}>
                    {agent.name} · <code>{agent.id}</code>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
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
