import { OWNER_ERR } from "@/lib/copy";
import { listBodiesForAgents } from "@/lib/ledger";
import { fetchMyAgents, withBoundAgent } from "@/lib/myAgents";
import { extractBearerToken, verifyUserToken } from "@/lib/userAuth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const sub = await verifyUserToken(req);
  if (!sub) {
    return Response.json({ ok: false, error: OWNER_ERR.login }, { status: 401 });
  }
  const bearer = extractBearerToken(req);
  const mine = bearer ? await fetchMyAgents(bearer) : null;
  if (mine == null) {
    return Response.json({ ok: false, error: OWNER_ERR.down }, { status: 502 });
  }
  const show = (await listBodiesForAgents(mine.map((row) => row.id))).map((row) =>
    withBoundAgent(row, mine),
  );
  return Response.json({
    ok: true,
    audience: "owner",
    workplace: "studio",
    owner: sub,
    agents: mine,
    show,
    note: "Owner rooms.",
  });
}

export function POST() {
  return Response.json(
    { ok: false, error: "drive a body at POST /api/show/[id]/drive" },
    { status: 405 },
  );
}
