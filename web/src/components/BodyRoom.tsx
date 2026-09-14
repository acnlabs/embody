"use client";

import Link from "next/link";
import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";
import { AUTH0_AUDIENCE, AUTH0_CLIENT_ID } from "@/lib/auth0";
import DuckSnapshot from "@/components/DuckSnapshot";
import DrivePad, { type DriveRequest } from "@/components/DrivePad";
import { poseFromNumbers } from "@/lib/duckPose";
import {
  buildKeyLabel,
  cardModeLabel,
  originLabel,
  ownerError,
  sessionLabel,
  agentLabel,
  bodyIsLive,
} from "@/lib/copy";
import { formatAgo, useI18n, type Translate } from "@/lib/i18n";
import type { BodyShow, Card } from "@/lib/types";

function num(v: unknown, digits: number): string {
  return typeof v === "number" && Number.isFinite(v) ? v.toFixed(digits) : "—";
}

function shortNumbersError(raw: string, t: Translate): string {
  if (/Traceback|Connection refused|Errno 61|not listening|8765|session start/i.test(raw)) {
    return t("status.down");
  }
  return raw.length > 240 ? `${raw.slice(0, 240)}…` : raw;
}

function Foot({ side, contact }: { side: string; contact?: boolean }) {
  const { t } = useI18n();
  return (
    <span className={`foot${contact ? " contact" : ""}`}>
      {side} {contact ? t("status.contact") : t("status.up")}
    </span>
  );
}

function Telemetry({ body }: { body: BodyShow }) {
  const { t } = useI18n();
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
          <div className="label">{t("status.label")}</div>
          <p className="warn">{shortNumbersError(body.numbers_error, t)}</p>
        </div>
      </div>
    );
  }
  if (!body.numbers) {
    return (
      <div className="telemetry">
        <div className="stat">
          <div className="label">{t("status.label")}</div>
          <p className="sub" style={{ marginTop: "0.4rem" }}>
            {t("status.noNumbers")}
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="telemetry">
      <div className="stat">
        <div className="label">{t("status.gait")}</div>
        <div className="value" style={{ fontSize: "1.05rem" }}>
          {String(n.policy || "—")}
        </div>
        {typeof n.behavior === "string" ? (
          <div className="sub">{t("status.doing", { name: n.behavior })}</div>
        ) : null}
      </div>
      <div className="stat">
        <div className="label">{t("status.tilt")}</div>
        <div className="value">
          {num(state.tilt_deg, 2)}
          <span className="unit">°</span>
        </div>
      </div>
      <div className="stat">
        <div className="label">{t("status.height")}</div>
        <div className="value">
          {num(state.trunk_z_m, 3)}
          <span className="unit">m</span>
        </div>
      </div>
      <div className="stat">
        <div className="label">{t("status.feet")}</div>
        <div className="feet">
          <Foot side="L" contact={feet.left?.contact} />
          <Foot side="R" contact={feet.right?.contact} />
        </div>
        <div className="sub">{t("status.footHint")}</div>
      </div>
    </div>
  );
}

function buildVal(v: unknown, t: Translate): string {
  if (typeof v === "boolean") return v ? t("build.yes") : t("build.no");
  if (v == null) return "—";
  return String(v);
}

function BuildValue({ value }: { value: unknown }) {
  const { t } = useI18n();
  if (Array.isArray(value)) {
    return (
      <span className="build-val">
        {value.length ? value.map((item) => buildVal(item, t)).join(", ") : "—"}
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
            <span className="build-key">{buildKeyLabel(key, t)}</span>
            <BuildValue value={nested} />
          </div>
        ))}
      </div>
    );
  }
  return <span className="build-val">{buildVal(value, t)}</span>;
}

function BuildSection({ build }: { build: Record<string, unknown> }) {
  const { t } = useI18n();
  const modules =
    build.modules && typeof build.modules === "object" && !Array.isArray(build.modules)
      ? (build.modules as Record<string, unknown>)
      : {};
  const extras = Object.entries(build).filter(([k]) => k !== "modules");
  const moduleEntries = Object.entries(modules);
  return (
    <>
      <h3 className="cards-head">{t("build.heading")}</h3>
      <div className="build-panel">
        {extras.map(([key, value]) => (
          <div className="build-row" key={key}>
            <span className="build-key">{buildKeyLabel(key, t)}</span>
            <BuildValue value={value} />
          </div>
        ))}
        {moduleEntries.length ? (
          <div className="build-row">
            <span className="build-key">{buildKeyLabel("modules", t)}</span>
            <span className="module-list">
              {moduleEntries.map(([name, value]) => (
                <span
                  key={name}
                  className={`badge module${value === false || value == null ? " off" : ""}`}
                >
                  {name}
                  {typeof value === "boolean"
                    ? value
                      ? ""
                      : ` ${t("build.no")}`
                    : `: ${buildVal(value, t)}`}
                </span>
              ))}
            </span>
          </div>
        ) : null}
      </div>
    </>
  );
}

function stageCaption(body: BodyShow, hasJoints: boolean, t: Translate): string {
  if (body.numbers_error) return t("room.captionLag");
  if (!hasJoints) return bodyIsLive(body) ? t("room.captionStill") : t("room.captionOff");
  if (bodyIsLive(body)) return t("room.captionDrive");
  return t("room.captionOrbit");
}

function MainStage({ body }: { body: BodyShow }) {
  const { t } = useI18n();
  const pose = poseFromNumbers(body.numbers ?? null);
  const isMicroduck = body.kind === "microduck";
  return (
    <div className="preview">
      {isMicroduck ? (
        <DuckSnapshot pose={pose} ariaLabel={t("room.canvas")} />
      ) : (
        <p className="stage-empty">{t("room.noMesh")}</p>
      )}
      <p className="stage-caption">
        {isMicroduck ? stageCaption(body, pose.hasJoints, t) : t("room.noFigure")}
      </p>
    </div>
  );
}

function SkillCard({ card }: { card: Card }) {
  const { t } = useI18n();
  const mode = cardModeLabel(card.mode, t);
  return (
    <article className="skill-card">
      <div className="skill-preview">
        {card.preview ? (
          <video src={card.preview} controls playsInline preload="metadata" />
        ) : (
          <div className="no-preview">{t("cards.noPreview")}</div>
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
  const { t } = useI18n();
  const cards = body.cards || [];
  return (
    <>
      <header className="room-head">
        <div className="title-row">
          <h2>{body.name || body.id}</h2>
          <span className="badge">{body.kind}</span>
          <span className="badge">{originLabel(body.origin, t)}</span>
          <span className={`status${bodyIsLive(body) ? " on" : ""}`}>
            {sessionLabel(bodyIsLive(body), t)}
          </span>
        </div>
        <div className="sub">
          <span title={body.bound_agent_id}>{t("room.bound", { agent: agentLabel(body) })}</span>
          <span>{t("room.updated", { ago: formatAgo(body.pushed_at, t) })}</span>
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

      <h3 className="cards-head">{t("cards.heading", { n: cards.length })}</h3>
      {cards.length ? (
        <div className="skill-grid">
          {cards.map((card) => (
            <SkillCard card={card} key={card.alias} />
          ))}
        </div>
      ) : (
        <p className="meta">{t("cards.empty")}</p>
      )}
    </>
  );
}

function SignedRoom({ bodyId }: { bodyId: string }) {
  const auth = useAuth0();
  const { t } = useI18n();
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
        if (!res.ok) setErr(ownerError(json.error || res.statusText, t));
        else {
          setErr("");
          setBody(json.show || null);
        }
      } catch (exc) {
        if (!cancel) setErr(exc instanceof Error ? ownerError(exc.message, t) : t("error.load"));
      }
    };
    void tick();
    const timer = setInterval(() => void tick(), 4000);
    return () => {
      cancel = true;
      clearInterval(timer);
    };
  }, [auth.isAuthenticated, auth.getAccessTokenSilently, bodyId, t]);

  useEffect(() => {
    if (!auth.isAuthenticated || !body || !bodyIsLive(body)) {
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
  }, [auth.isAuthenticated, auth.getAccessTokenSilently, bodyId, body?.session_running, body?.drive_listening]);

  if (auth.isLoading) return <p className="meta">{t("home.loadingAuth")}</p>;
  if (!auth.isAuthenticated) {
    return (
      <div className="empty">
        <h3>{t("room.signInTitle")}</h3>
        <p>{t("room.signInHint")}</p>
        <p style={{ marginTop: "1.2rem" }}>
          <button
            type="button"
            className="primary"
            onClick={() => auth.loginWithRedirect({ appState: { returnTo: `/b/${bodyId}` } })}
          >
            {t("nav.signIn")}
          </button>
        </p>
      </div>
    );
  }
  if (err) {
    return (
      <div className="empty">
        <h3>{t("room.closedTitle")}</h3>
        <p className="warn">{ownerError(err, t)}</p>
        <p className="meta">
          <Link href="/">{t("room.back")}</Link>
        </p>
      </div>
    );
  }
  if (!body) return <p className="meta">{t("room.loading")}</p>;
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
      if (!res.ok) return ownerError(json.error || res.statusText, t);
      return null;
    } catch (exc) {
      return exc instanceof Error ? ownerError(exc.message, t) : t("error.drive");
    }
  };
  return <RoomView body={view} send={send} />;
}

export default function BodyRoom({ bodyId }: { bodyId: string }) {
  const { t } = useI18n();
  if (!AUTH0_CLIENT_ID) {
    return (
      <>
        <p className="meta">
          <Link href="/">← {t("room.back")}</Link>
        </p>
        <div className="empty">{t("room.cantOpen")}</div>
      </>
    );
  }
  return (
    <>
      <p className="meta">
        <Link href="/">← {t("room.back")}</Link>
      </p>
      <SignedRoom bodyId={bodyId} />
    </>
  );
}
