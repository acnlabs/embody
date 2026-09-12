import { listBodiesForAgents } from "@/lib/ledger";
import { fetchMyAgents } from "@/lib/myAgents";
import { extractBearerToken, verifyUserToken } from "@/lib/userAuth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const sub = await verifyUserToken(req);
  if (!sub) {
    return Response.json({ ok: false, error: "owner Auth0 token required" }, { status: 401 });
  }
  const bearer = extractBearerToken(req);
  const mine = bearer ? await fetchMyAgents(bearer) : null;
  if (mine == null) {
    return Response.json({ ok: false, error: "could not read my-agents" }, { status: 502 });
  }
  return Response.json({
    ok: true,
    audience: "owner",
    workplace: "studio",
    owner: sub,
    agents: mine,
    show: listBodiesForAgents(mine.map((row) => row.id)),
    note: "Owner observation. The agent drives. Embody does not store task ids.",
  });
}

export function POST() {
  return Response.json({ ok: false, error: "owner studio does not drive the body" }, { status: 405 });
}
