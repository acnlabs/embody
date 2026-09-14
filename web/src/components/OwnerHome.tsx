"use client";

import Link from "next/link";
import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";
import { AUTH0_AUDIENCE, AUTH0_CLIENT_ID } from "@/lib/auth0";
import DuckSnapshot from "@/components/DuckSnapshot";
import { originLabel, ownerError, sessionLabel, agentLabel, bodyIsLive } from "@/lib/copy";
import { poseFromNumbers } from "@/lib/duckPose";
import { useI18n, type Translate } from "@/lib/i18n";
import type { BodyShow } from "@/lib/types";

type Payload = {
  show?: BodyShow[];
  agents?: { id: string; name: string }[];
  error?: string;
};

function keyNumber(
  numbers: Record<string, unknown> | null | undefined,
  t: Translate,
): string | null {
  const state = numbers?.body_state as { tilt_deg?: number } | undefined;
  if (typeof state?.tilt_deg === "number") return t("home.tilt", { n: state.tilt_deg.toFixed(1) });
  return null;
}

function ModuleChips({ body }: { body: BodyShow }) {
  const { t } = useI18n();
  const raw = body.build?.modules;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const entries = Object.entries(raw as Record<string, unknown>);
  if (!entries.length) return null;
  return (
    <p className="module-list home-modules">
      {entries.map(([name, value]) => (
        <span key={name} className={`badge module${value === false || value == null ? " off" : ""}`}>
          {name}
          {typeof value === "boolean" ? (value ? "" : ` ${t("home.moduleOff")}`) : ""}
        </span>
      ))}
    </p>
  );
}

export function BodyCard({ body }: { body: BodyShow }) {
  const auth = useAuth0();
  const { t } = useI18n();
  const [live, setLive] = useState<Record<string, unknown> | null>(null);
  const tricks = body.cards?.length || 0;

  const liveNow = bodyIsLive(body);

  useEffect(() => {
    if (!liveNow || body.kind !== "microduck") {
      setLive(null);
      return;
    }
    let cancel = false;
    const tick = async () => {
      try {
        const token = await auth.getAccessTokenSilently({
          authorizationParams: { audience: AUTH0_AUDIENCE },
        });
        const res = await fetch(`/api/show/${encodeURIComponent(body.id)}/pose`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancel || !res.ok) return;
        const json = (await res.json()) as { numbers?: Record<string, unknown> | null };
        if (!cancel) setLive(json.numbers ?? null);
      } catch {
        /* keep last frame */
      }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 1000);
    return () => {
      cancel = true;
      window.clearInterval(timer);
    };
  }, [auth.getAccessTokenSilently, body.id, body.kind, liveNow]);

  const numbers = live ?? body.numbers ?? null;
  const pose = poseFromNumbers(numbers);
  const key = keyNumber(numbers, t);
  return (
    <article className="body-card">
      <Link href={`/b/${body.id}`}>
        <div className="body-cover">
          {body.kind === "microduck" ? (
            <DuckSnapshot pose={pose} ariaLabel={t("home.figure")} still />
          ) : null}
          <span className="badge">{body.kind}</span>
          <span className={`status${liveNow ? " on" : ""}`}>
            {sessionLabel(liveNow, t)}
          </span>
          {key ? <span className="keynum">{key}</span> : null}
        </div>
      </Link>
      <div className="body-meta">
        <h3>
          <Link href={`/b/${body.id}`}>{body.name || body.id}</Link>
        </h3>
        <p className="meta">
          {originLabel(body.origin, t)} · {t("home.bound", { agent: agentLabel(body) })}
          {tricks ? ` · ${t("home.tricks", { n: tricks })}` : ""}
        </p>
        <ModuleChips body={body} />
      </div>
    </article>
  );
}

function SetupHint() {
  const { t } = useI18n();
  return (
    <div className="empty">
      <h3>{t("home.setupTitle")}</h3>
      <p>{t("home.setupHint")}</p>
    </div>
  );
}

function SignedHome() {
  const auth = useAuth0();
  const { t } = useI18n();
  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!auth.isAuthenticated) return;
    let cancel = false;
    let first = true;
    const tick = async () => {
      if (first) setLoading(true);
      try {
        const token = await auth.getAccessTokenSilently({
          authorizationParams: { audience: AUTH0_AUDIENCE },
        });
        const res = await fetch("/api/show", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = (await res.json()) as Payload;
        if (!cancel) {
          if (!res.ok) {
            if (first) setErr(ownerError(json.error || res.statusText, t));
          } else {
            setErr("");
            setData(json);
          }
        }
      } catch (exc) {
        if (!cancel && first) setErr(exc instanceof Error ? ownerError(exc.message, t) : t("error.load"));
      } finally {
        if (!cancel && first) setLoading(false);
        first = false;
      }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 4000);
    return () => {
      cancel = true;
      window.clearInterval(timer);
    };
  }, [auth.isAuthenticated, auth.getAccessTokenSilently, t]);

  if (auth.isLoading) {
    return <p className="meta">{t("home.loadingAuth")}</p>;
  }

  if (!auth.isAuthenticated) {
    return (
      <div className="empty">
        <h3>{t("home.watchTitle")}</h3>
        <p>{t("home.watchHint")}</p>
        <p style={{ marginTop: "1.2rem" }}>
          <button type="button" className="primary" onClick={() => auth.loginWithRedirect()}>
            {t("nav.signIn")}
          </button>
        </p>
      </div>
    );
  }

  const rows = data?.show || [];
  return (
    <>
      {loading ? <p className="meta">{t("home.loadingBodies")}</p> : null}
      {err ? <p className="warn">{err}</p> : null}
      {!loading && !err && !rows.length ? (
        <div className="empty">
          <h3>{t("home.emptyTitle")}</h3>
          <p>{t("home.emptyHint")}</p>
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
  const { t } = useI18n();
  return (
    <>
      <div className="page-head">
        <h2>{t("home.title")}</h2>
        <p className="meta">{t("home.lead")}</p>
      </div>
      {!AUTH0_CLIENT_ID ? <SetupHint /> : <SignedHome />}
    </>
  );
}
