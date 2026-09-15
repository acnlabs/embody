import { fetchAgentId } from "@/lib/acn";
import { asBuild } from "@/lib/build";
import { parseControlEvent } from "@/lib/control";
import { getBody, upsertBody } from "@/lib/ledger";
import { extractBearerToken } from "@/lib/userAuth";
import type { BodyShow, Card, Training } from "@/lib/types";

export const runtime = "nodejs";

function watchUrl(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  try {
    const url = new URL(raw.trim());
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:") return undefined;
    if (
      host !== "huggingface.co" &&
      host !== "www.huggingface.co" &&
      host !== "wandb.ai" &&
      host !== "www.wandb.ai"
    ) {
      return undefined;
    }
    return url.toString().split("?")[0].slice(0, 240);
  } catch {
    return undefined;
  }
}

function parseTraining(raw: unknown): Training | null | undefined {
  if (raw == null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const row = raw as Record<string, unknown>;
  const alias = String(row.alias ?? "").trim().slice(0, 64);
  if (!alias) return undefined;
  const next: Training = { alias };
  if (typeof row.started_at === "string" && row.started_at.trim()) {
    next.started_at = row.started_at.trim();
  }
  const url = watchUrl(row.url);
  if (url) next.url = url;
  return next;
}

function asShow(raw: unknown): { show: BodyShow; control?: ReturnType<typeof parseControlEvent> } | { error: string } {
  if (!raw || typeof raw !== "object") {
    return { error: "show needs id, kind, origin, bound_agent_id" };
  }
  const row = raw as Record<string, unknown>;
  const id = String(row.id ?? "").trim();
  const kind = String(row.kind ?? "").trim();
  const origin = String(row.origin ?? "").trim();
  const bound = String(row.bound_agent_id ?? "").trim();
  if (!id || !kind || !origin || !bound) {
    return { error: "show needs id, kind, origin, bound_agent_id" };
  }
  let build: Record<string, unknown> | undefined;
  if ("build" in row) {
    const parsed = asBuild(row.build);
    if (!parsed.ok) return { error: parsed.error };
    build = parsed.build;
  }
  const cards = Array.isArray(row.cards)
    ? row.cards
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const card = item as Record<string, unknown>;
          const alias = String(card.alias ?? "").trim();
          const hub = String(card.hub ?? "").trim();
          if (!alias || !hub) return null;
          const next: Card = { alias, hub };
          if (typeof card.mode === "string") next.mode = card.mode;
          if (typeof card.preview === "string") next.preview = card.preview;
          if (typeof card.onnx === "string") next.onnx = card.onnx;
          if (typeof card.card === "string" && card.card.startsWith("https://huggingface.co/")) {
            next.card = card.card;
          }
          if (typeof card.curves === "string" && card.curves.startsWith("https://wandb.ai/")) {
            next.curves = card.curves;
          }
          return next;
        })
        .filter((card): card is Card => card != null)
    : [];
  const show: BodyShow = {
    id,
    name: typeof row.name === "string" ? row.name : id,
    kind,
    origin,
    bound_agent_id: bound,
    session_running: Boolean(row.session_running),
    build,
    cards,
    numbers:
      row.numbers && typeof row.numbers === "object"
        ? (row.numbers as Record<string, unknown>)
        : null,
    numbers_error:
      typeof row.numbers_error === "string" ? row.numbers_error.slice(0, 240) : undefined,
    next: typeof row.next === "string" ? row.next : undefined,
    note: typeof row.note === "string" ? row.note : undefined,
  };
  if ("training" in row) {
    const training = parseTraining(row.training);
    if (row.training != null && training === undefined) {
      return { error: "training needs alias" };
    }
    show.training = training ?? null;
  }
  return {
    show,
    control: parseControlEvent(row.control),
  };
}

export async function POST(req: Request) {
  const bearer = extractBearerToken(req);
  if (!bearer) {
    return Response.json({ ok: false, error: "ACN bearer required" }, { status: 401 });
  }
  const agentId = await fetchAgentId(bearer);
  if (!agentId) {
    return Response.json({ ok: false, error: "ACN /agents/me rejected this key" }, { status: 401 });
  }
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ ok: false, error: "JSON body required" }, { status: 400 });
  }
  const row = payload as { show?: unknown };
  const parsed = asShow(row.show);
  if ("error" in parsed) {
    return Response.json({ ok: false, error: parsed.error }, { status: 400 });
  }
  const show = parsed.show;
  if (show.bound_agent_id !== agentId) {
    return Response.json({ ok: false, error: "bound_agent_id does not match this ACN key" }, { status: 403 });
  }
  if (!(await getBody(show.id))) {
    return Response.json(
      { ok: false, error: "unknown body id — join first: POST /api/agent/bodies" },
      { status: 404 },
    );
  }
  const listen = Boolean((payload as { listen?: unknown }).listen);
  const stored = await upsertBody(show, { listen, control: parsed.control });
  return Response.json({
    ok: true,
    room: `/b/${stored.id}`,
    show: stored,
    note: "Stored on Embody web. Not posted to AgentPlanet.",
  });
}

export function GET() {
  return Response.json({ ok: false, error: "owner reads /api/show; agents POST here" }, { status: 405 });
}
