"use client";

import Link from "next/link";
import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";
import { AUTH0_AUDIENCE, AUTH0_CLIENT_ID } from "@/lib/auth0";
import type { BodyShow, Card } from "@/lib/types";

function fmtAgo(iso?: string): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return iso;
  const min = Math.floor(ms / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} 小时前`;
  return `${Math.floor(h / 24)} 天前`;
}

function num(v: unknown, digits: number): string {
  return typeof v === "number" && Number.isFinite(v) ? v.toFixed(digits) : "—";
}

function Foot({ side, contact }: { side: string; contact?: boolean }) {
  return (
    <span className={`foot${contact ? " contact" : ""}`}>
      {side} {contact ? "接触" : "离地"}
    </span>
  );
}

function Telemetry({ body }: { body: BodyShow }) {
  const n = body.numbers || {};
  const state = (n.body_state || {}) as {
    tilt_deg?: number;
    trunk_z_m?: number;
    feet?: Record<string, { contact?: boolean }>;
  };
  const feet = state.feet || {};
  if (body.numbers_error) {
    return (
      <div className="telemetry">
        <div className="stat">
          <div className="label">遥测</div>
          <p className="warn">数字读不到：{body.numbers_error}</p>
        </div>
      </div>
    );
  }
  if (!body.numbers) {
    return (
      <div className="telemetry">
        <div className="stat">
          <div className="label">遥测</div>
          <p className="sub" style={{ marginTop: "0.4rem" }}>
            还没有实时数字。开车是 agent 的事，这里只在 push 时读一次快照。
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="telemetry">
      <div className="stat">
        <div className="label">policy</div>
        <div className="value" style={{ fontSize: "1.05rem" }}>
          {String(n.policy || "—")}
        </div>
        {typeof n.behavior === "string" ? <div className="sub">正在 {n.behavior}</div> : null}
      </div>
      <div className="stat">
        <div className="label">tilt_deg</div>
        <div className="value">
          {num(state.tilt_deg, 2)}
          <span className="unit">°</span>
        </div>
      </div>
      <div className="stat">
        <div className="label">trunk_z</div>
        <div className="value">
          {num(state.trunk_z_m, 3)}
          <span className="unit">m</span>
        </div>
      </div>
      <div className="stat">
        <div className="label">脚接触</div>
        <div className="feet">
          <Foot side="L" contact={feet.left?.contact} />
          <Foot side="R" contact={feet.right?.contact} />
        </div>
        <div className="sub">只报数字，不评 fallen</div>
      </div>
    </div>
  );
}

function MainStage({ body }: { body: BodyShow }) {
  return (
    <div className="preview">
      <div className="hint">
        <p className="hint-title">
          {body.session_running ? "本机仿真窗正在动" : "这具身体在本机"}
        </p>
        <p>
          Viser 仿真窗在本机；网页不嵌实时流、不嵌遥控，这里读的是 push 快照。
          <br />
          本机调试 Show 用 <code>python3 -m embody studio</code>。招式预览在下面的卡上。
        </p>
      </div>
    </div>
  );
}

function SkillCard({ card }: { card: Card }) {
  return (
    <article className="skill-card">
      <div className="skill-preview">
        {card.preview ? (
          <video src={card.preview} controls playsInline preload="metadata" />
        ) : (
          <div className="no-preview">无预览</div>
        )}
      </div>
      <div className="skill-body">
        <div className="alias-row">
          <span className="alias">{card.alias}</span>
          {card.mode ? <span className="badge">{card.mode}</span> : null}
        </div>
        <div className="hub">
          <a href={`https://huggingface.co/${card.hub}`}>{card.hub}</a>
        </div>
      </div>
    </article>
  );
}

export function RoomView({ body }: { body: BodyShow }) {
  const cards = body.cards || [];
  return (
    <>
      <header className="room-head">
        <div className="title-row">
          <h2>{body.name || body.id}</h2>
          <span className="badge">{body.kind}</span>
          <span className="badge">{body.origin}</span>
          <span className={`status${body.session_running ? " on" : ""}`}>
            {body.session_running ? "会话进行中" : "无会话"}
          </span>
        </div>
        <div className="sub">
          <span>
            agent <code>{body.bound_agent_id}</code>
          </span>
          <span>push {fmtAgo(body.pushed_at)}</span>
          {body.next ? <span>下一步 {body.next}</span> : null}
        </div>
      </header>

      <div className="stage">
        <MainStage body={body} />
        <Telemetry body={body} />
      </div>

      <h3 className="cards-head">招式卡 · {cards.length}</h3>
      {cards.length ? (
        <div className="skill-grid">
          {cards.map((card) => (
            <SkillCard card={card} key={card.alias} />
          ))}
        </div>
      ) : (
        <p className="meta">还没有卡。agent 在本机 attach 技能后再 push。</p>
      )}
      {body.note ? <p className="meta">{body.note}</p> : null}
    </>
  );
}

function SignedRoom({ bodyId }: { bodyId: string }) {
  const auth = useAuth0();
  const [body, setBody] = useState<BodyShow | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!auth.isAuthenticated) return;
    let cancel = false;
    const tick = async () => {
      try {
        const token = await auth.getAccessTokenSilently({
          authorizationParams: { audience: AUTH0_AUDIENCE },
        });
        const res = await fetch(`/api/show/${encodeURIComponent(bodyId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = (await res.json()) as { show?: BodyShow; error?: string };
        if (cancel) return;
        if (!res.ok) setErr(json.error || res.statusText);
        else {
          setErr("");
          setBody(json.show || null);
        }
      } catch (exc) {
        if (!cancel) setErr(exc instanceof Error ? exc.message : "load failed");
      }
    };
    void tick();
    const timer = setInterval(() => void tick(), 4000);
    return () => {
      cancel = true;
      clearInterval(timer);
    };
  }, [auth.isAuthenticated, auth.getAccessTokenSilently, bodyId]);

  if (auth.isLoading) return <p className="meta">登录状态读取中…</p>;
  if (!auth.isAuthenticated) {
    return (
      <div className="empty">
        <h3>这间房只给 owner 看</h3>
        <p>登录后确认这具身体属于你的 agent。</p>
        <p style={{ marginTop: "1.2rem" }}>
          <button
            type="button"
            className="primary"
            onClick={() => auth.loginWithRedirect({ appState: { returnTo: `/b/${bodyId}` } })}
          >
            用 Auth0 登录
          </button>
        </p>
      </div>
    );
  }
  if (err) {
    return (
      <div className="empty">
        <h3>打不开这间房</h3>
        <p className="warn">{err}</p>
        <p className="meta">
          <Link href="/">回到全部身体</Link>
        </p>
      </div>
    );
  }
  if (!body) return <p className="meta">读取身体…</p>;
  return <RoomView body={body} />;
}

export default function BodyRoom({ bodyId }: { bodyId: string }) {
  if (!AUTH0_CLIENT_ID) {
    return <div className="empty">先配置 Auth0 SPA，才能打开这间房。</div>;
  }
  return <SignedRoom bodyId={bodyId} />;
}
