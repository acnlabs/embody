import type { BodyShow } from "@/lib/types";

function chatApiOrigin(): string {
  return (
    process.env.AGENTPLANET_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_AGENTPLANET_API_URL?.trim() ||
    "https://api.agentplanet.org"
  ).replace(/\/+$/, "");
}

export type MyAgent = { id: string; name: string };

const myAgentsCache = new Map<string, { agents: MyAgent[]; exp: number }>();

export function withBoundAgent(body: BodyShow, agents: MyAgent[]): BodyShow {
  const hit = agents.find((row) => row.id === body.bound_agent_id);
  const name = hit?.name?.trim();
  return {
    ...body,
    bound_agent_name: hit && name && name !== hit.id ? name : undefined,
  };
}

/** Identity only: which agents this Auth0 human owns. Not a body ledger. */
export async function fetchMyAgents(bearer: string): Promise<MyAgent[] | null> {
  const token = bearer.trim();
  if (!token) return null;
  const cached = myAgentsCache.get(token);
  if (cached && cached.exp > Date.now()) return cached.agents;
  try {
    const res = await fetch(`${chatApiOrigin()}/api/chat/my-agents?limit=50`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { agents?: unknown };
    const rows = Array.isArray(data.agents) ? data.agents : [];
    const agents = rows
      .map((raw) => {
        const row = raw as { agent_id?: unknown; id?: unknown; name?: unknown };
        const id = String(row.agent_id ?? row.id ?? "").replace(/^acn:/, "");
        if (!id) return null;
        return { id, name: String(row.name ?? "").trim() || id };
      })
      .filter((row): row is MyAgent => row != null);
    myAgentsCache.set(token, { agents, exp: Date.now() + 30_000 });
    return agents;
  } catch {
    return null;
  }
}
