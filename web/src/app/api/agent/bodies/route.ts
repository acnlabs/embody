import { randomBytes } from "crypto";
import { fetchAgentId } from "@/lib/acn";
import { registerBody } from "@/lib/ledger";
import { extractBearerToken } from "@/lib/userAuth";
import type { BodyShow } from "@/lib/types";

export const runtime = "nodejs";

const ID_PATTERN = /^body_[0-9a-f]{12}$/;

function mintId(): string {
  return `body_${randomBytes(6).toString("hex")}`;
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
  const row = payload as Record<string, unknown>;
  const kind = String(row.kind ?? "").trim();
  const origin = String(row.origin ?? "").trim();
  if (!kind || !origin) {
    return Response.json({ ok: false, error: "join needs kind and origin" }, { status: 400 });
  }
  let id = String(row.id ?? "").trim();
  if (id) {
    if (!ID_PATTERN.test(id)) {
      return Response.json(
        { ok: false, error: "id must look like body_<12 lowercase hex>" },
        { status: 400 },
      );
    }
  } else {
    id = mintId();
  }
  const record: BodyShow = {
    id,
    name: typeof row.name === "string" && row.name.trim() ? row.name.trim() : id,
    kind,
    origin,
    bound_agent_id: agentId,
    session_running: false,
    cards: [],
    numbers: null,
  };
  const stored = await registerBody(record);
  if (!stored) {
    return Response.json({ ok: false, error: `body id ${id} is already registered` }, { status: 409 });
  }
  return Response.json({
    ok: true,
    body: stored,
    asset_ref: `embody:body:${stored.id}`,
    room: `/b/${stored.id}`,
    note: "Body joined Embody. The hosted studio minted this id; push only updates joined bodies.",
  });
}

export function GET() {
  return Response.json({ ok: false, error: "agents POST here to join; owners read /api/show" }, { status: 405 });
}
