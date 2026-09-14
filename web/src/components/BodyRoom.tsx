"use client";

import Link from "next/link";
import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";
import { AUTH0_AUDIENCE, AUTH0_CLIENT_ID } from "@/lib/auth0";
import DuckSnapshot from "@/components/DuckSnapshot";
import DrivePad, { type DriveRequest } from "@/components/DrivePad";
import { poseFromNumbers } from "@/lib/duckPose";
import { buildKeyLabel, cardModeLabel, originLabel, ownerError, sessionLabel, agentLabel } from "@/lib/copy";
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

function shortNumbersError(raw: string): string {
  if (/Traceback|Connection refused|Errno 61|not listening|8765|session start/i.test(raw)) {
    return "身体连不上了。";
  }
  return raw.length > 240 ? `${raw.slice(0, 240)}…` : raw;
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
          <div className="label">状态</div>
          <p className="warn">{shortNumbersError(body.numbers_error)}</p>
        </div>
      </div>
    );
  }
  if (!body.numbers) {
    return (
      <div className="telemetry">
        <div className="stat">
          <div className="label">状态</div>
          <p className="sub" style={{ marginTop: "0.4rem" }}>
            还没有实时数字。
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="telemetry">
      <div className="stat">
        <div className="label">步态</div>
        <div className="value" style={{ fontSize: "1.05rem" }}>
          {String(n.policy || "—")}
        </div>
        {typeof n.behavior === "string" ? <div className="sub">正在 {n.behavior}</div> : null}
      </div>
      <div className="stat">
        <div className="label">倾斜</div>
        <div className="value">
          {num(state.tilt_deg, 2)}
          <span className="unit">°</span>
        </div>
      </div>
      <div className="stat">
        <div className="label">高度</div>
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
        <div className="sub">左右脚有没有着地</div>
      </div>
    </div>
  );
}

function buildVal(v: unknown): string {
  if (typeof v === "boolean") return v ? "有" : "无";
  if (v == null) return "—";
  return String(v);
}

function BuildValue({ value }: { value: unknown }) {
  if (Array.isArray(value)) {
    return (
      <span className="build-val">
        {value.length ? value.map((item) => buildVal(item)).join(", ") : "—"}
      </span>
    );
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (!entries.length) return <span className="build-val">—</span>;
    return (
      <div className="build-nested">
        {entries.map(([key, nested]) => (
          <div className="build-row" key={key}>
            <span className="build-key">{buildKeyLabel(key)}</span>
            <BuildValue value={nested} />
          </div>
        ))}
      </div>
    );
  }
  return <span className="build-val">{buildVal(value)}</span>;
}

function BuildSection({ build }: { build: Record<string, unknown> }) {
  const modules =
    build.modules && typeof build.modules === "object" && !Array.isArray(build.modules)
      ? (build.modules as Record<string, unknown>)
      : {};
  const extras = Object.entries(build).filter(([k]) => k !== "modules");
  const moduleEntries = Object.entries(modules);
  return (
    <>
      <h3 className="cards-head">这台的配置</h3>
      <div className="build-panel">
        {extras.map(([key, value]) => (
          <div className="build-row" key={key}>
            <span className="build-key">{buildKeyLabel(key)}</span>
            <BuildValue value={value} />
          </div>
        ))}
        {moduleEntries.length ? (
          <div className="build-row">
            <span className="build-key">{buildKeyLabel("modules")}</span>
            <span className="module-list">
              {moduleEntries.map(([name, value]) => (
                <span
                  key={name}
                  className={`badge module${value === false || value == null ? " off" : ""}`}
                >
                  {name}
                  {typeof value === "boolean" ? (value ? "" : " 无") : `: ${buildVal(value)}`}
                </span>
              ))}
            </span>
          </div>
        ) : null}
      </div>
    </>
  );
}

function stageCaption(body: BodyShow, hasJoints: boolean): string {
  if (body.numbers_error) return "还没跟上";
  if (!hasJoints) return body.session_running ? "还没动起来" : "还没开始";
  if (body.drive_listening) return "WASD 开车 · 拖动转视角";
  return "拖动转视角";
}

function MainStage({ body }: { body: BodyShow }) {
  const pose = poseFromNumbers(body.numbers ?? null);
  const isMicroduck = body.kind === "microduck";
  return (
    <div className="preview">
      {isMicroduck ? (
        <DuckSnapshot pose={pose} />
      ) : (
        <p className="stage-empty">还没有这只身体的外形。</p>
      )}
      <p className="stage-caption">
        {isMicroduck ? stageCaption(body, pose.hasJoints) : "还没有外形"}
      </p>
    </div>
  );
}

function SkillCard({ card }: { card: Card }) {
  const mode = cardModeLabel(card.mode);
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
          {mode ? <span className="badge">{mode}</span> : null}
        </div>
      </div>
    </article>
  );
}

export function RoomView({
  body,
  send,
}: {
  body: BodyShow;
  send?: (cmd: DriveRequest) => Promise<string | null>;
}) {
  const cards = body.cards || [];
  return (
    <>
      <header className="room-head">
        <div className="title-row">
          <h2>{body.name || body.id}</h2>
          <span className="badge">{body.kind}</span>
          <span className="badge">{originLabel(body.origin)}</span>
          <span className={`status${body.session_running ? " on" : ""}`}>
            {sessionLabel(body.session_running)}
          </span>
        </div>
        <div className="sub">
          <span title={body.bound_agent_id}>所属 {agentLabel(body)}</span>
          <span>更新于 {fmtAgo(body.pushed_at)}</span>
        </div>
      </header>

      <div className="stage">
        <MainStage body={body} />
        <div className="stage-rail">
          <Telemetry body={body} />
          {send ? <DrivePad body={body} send={send} /> : null}
        </div>
      </div>

      {body.build && Object.keys(body.build).length ? <BuildSection build={body.build} /> : null}

      <h3 className="cards-head">招式 · {cards.length}</h3>
      {cards.length ? (
        <div className="skill-grid">
          {cards.map((card) => (
            <SkillCard card={card} key={card.alias} />
          ))}
        </div>
      ) : (
        <p className="meta">还没有招式。</p>
      )}
    </>
  );
}

function SignedRoom({ bodyId }: { bodyId: string }) {
  const auth = useAuth0();
  const [body, setBody] = useState<BodyShow | null>(null);
  const [poseLive, setPoseLive] = useState<{
    numbers: Record<string, unknown> | null;
    numbers_error?: string;
  } | null>(null);
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
        if (!res.ok) setErr(ownerError(json.error || res.statusText));
        else {
          setErr("");
          setBody(json.show || null);
        }
      } catch (exc) {
        if (!cancel) setErr(exc instanceof Error ? ownerError(exc.message) : "加载失败。");
      }
    };
    void tick();
    const timer = setInterval(() => void tick(), 4000);
    return () => {
      cancel = true;
      clearInterval(timer);
    };
  }, [auth.isAuthenticated, auth.getAccessTokenSilently, bodyId]);

  useEffect(() => {
    if (!auth.isAuthenticated || !body?.session_running) {
      setPoseLive(null);
      return;
    }
    let cancel = false;
    const tick = async () => {
      try {
        const token = await auth.getAccessTokenSilently({
          authorizationParams: { audience: AUTH0_AUDIENCE },
        });
        const res = await fetch(`/api/show/${encodeURIComponent(bodyId)}/pose`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = (await res.json()) as {
          numbers?: Record<string, unknown> | null;
          numbers_error?: string;
        };
        if (cancel || !res.ok) return;
        setPoseLive({ numbers: json.numbers ?? null, numbers_error: json.numbers_error });
      } catch {
        /* keep last frame */
      }
    };
    void tick();
    const timer = setInterval(() => void tick(), 200);
    return () => {
      cancel = true;
      clearInterval(timer);
    };
  }, [auth.isAuthenticated, auth.getAccessTokenSilently, bodyId, body?.session_running]);

  if (auth.isLoading) return <p className="meta">登录状态读取中…</p>;
  if (!auth.isAuthenticated) {
    return (
      <div className="empty">
        <h3>登录后才能看</h3>
        <p>这间房里的身体只给你看。</p>
        <p style={{ marginTop: "1.2rem" }}>
          <button
            type="button"
            className="primary"
            onClick={() => auth.loginWithRedirect({ appState: { returnTo: `/b/${bodyId}` } })}
          >
            登录
          </button>
        </p>
      </div>
    );
  }
  if (err) {
    return (
      <div className="empty">
        <h3>打不开这间房</h3>
        <p className="warn">{ownerError(err)}</p>
        <p className="meta">
          <Link href="/">回到全部身体</Link>
        </p>
      </div>
    );
  }
  if (!body) return <p className="meta">读取身体…</p>;
  const view: BodyShow = poseLive
    ? { ...body, numbers: poseLive.numbers, numbers_error: poseLive.numbers_error }
    : body;
  const send = async (cmd: DriveRequest): Promise<string | null> => {
    try {
      const token = await auth.getAccessTokenSilently({
        authorizationParams: { audience: AUTH0_AUDIENCE },
      });
      const res = await fetch(`/api/show/${encodeURIComponent(bodyId)}/drive`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(cmd),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) return ownerError(json.error || res.statusText);
      return null;
    } catch (exc) {
      return exc instanceof Error ? ownerError(exc.message) : "现在开不了。";
    }
  };
  return <RoomView body={view} send={send} />;
}

export default function BodyRoom({ bodyId }: { bodyId: string }) {
  if (!AUTH0_CLIENT_ID) {
    return <div className="empty">还不能打开这间房。</div>;
  }
  return <SignedRoom bodyId={bodyId} />;
}
