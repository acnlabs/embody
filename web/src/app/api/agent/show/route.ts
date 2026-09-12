import { fetchAgentId } from "@/lib/acn";
import { upsertBody } from "@/lib/ledger";
import { extractBearerToken } from "@/lib/userAuth";
import type { BodyShow, Card } from "@/lib/types";

export const runtime = "nodejs";

function asShow(raw: unknown): BodyShow | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = String(row.id ?? "").trim();
  const kind = String(row.kind ?? "").trim();
  const origin = String(row.origin ?? "").trim();
  const bound = String(row.bound_agent_id ?? "").trim();
  if (!id || !kind || !origin || !bound) return null;
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
          return next;
        })
        .filter((card): card is Card => card != null)
    : [];
  return {
    id,
    name: typeof row.name === "string" ? row.name : id,
    kind,
    origin,
    bound_agent_id: bound,
    session_running: Boolean(row.session_running),
    cards,
    numbers:
      row.numbers && typeof row.numbers === "object"
        ? (row.numbers as Record<string, unknown>)
        : null,
    numbers_error: typeof row.numbers_error === "string" ? row.numbers_error : undefined,
    next: typeof row.next === "string" ? row.next : undefined,
    note: typeof row.note === "string" ? row.note : undefined,
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
  const show = asShow(row.show);
  if (!show) {
    return Response.json({ ok: false, error: "show needs id, kind, origin, bound_agent_id" }, { status: 400 });
  }
  if (show.bound_agent_id !== agentId) {
    return Response.json({ ok: false, error: "bound_agent_id does not match this ACN key" }, { status: 403 });
  }
  const stored = await upsertBody(show);
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
