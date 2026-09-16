import { OWNER_ERR } from "@/lib/copy";
import { isDriveListening } from "@/lib/drive";
import { getBody } from "@/lib/ledger";
import { fetchMyAgents, withBoundAgent, bareAgentId, type MyAgent } from "@/lib/myAgents";
import { resolveOwner, type OwnerActor } from "@/lib/hostToken";
import type { BodyShow } from "@/lib/types";

export type OwnedBody =
  | { actor: OwnerActor; body: BodyShow; mine: MyAgent[] }
  | { error: string; status: number };

export async function assertOwnedBody(req: Request, bodyId: string): Promise<OwnedBody> {
  const actor = await resolveOwner(req);
  if (!actor) {
    return { error: OWNER_ERR.login, status: 401 };
  }
  if (actor.host && actor.host.bodyId !== bodyId) {
    return { error: OWNER_ERR.forbidden, status: 403 };
  }
  const body = await getBody(bodyId);
  if (!body) {
    return { error: OWNER_ERR.missing, status: 404 };
  }
  const mine = await fetchMyAgents(actor.bearer);
  if (mine == null) {
    return { error: OWNER_ERR.down, status: 502 };
  }
  if (!mine.some((row) => row.id === bareAgentId(body.bound_agent_id))) {
    return { error: OWNER_ERR.forbidden, status: 403 };
  }
  if (actor.host && actor.host.agentId !== bareAgentId(body.bound_agent_id)) {
    return { error: OWNER_ERR.forbidden, status: 403 };
  }
  return { actor, body, mine };
}

export async function loadOwnedShow(
  req: Request,
  bodyId: string,
): Promise<{ show: BodyShow } | { error: string; status: number }> {
  const owned = await assertOwnedBody(req, bodyId);
  if ("error" in owned) return owned;
  return {
    show: {
      ...withBoundAgent(owned.body, owned.mine),
      drive_listening: isDriveListening(owned.body.drive_listen_at),
    },
  };
}
