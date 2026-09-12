export function acnBaseUrl(): string {
  return (process.env.ACN_BASE_URL || "https://api.acnlabs.dev").replace(/\/+$/, "");
}

export async function fetchAgentId(bearer: string): Promise<string | null> {
  const token = bearer.trim();
  if (!token) return null;
  try {
    const res = await fetch(`${acnBaseUrl()}/api/v1/agents/me`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { agent_id?: unknown; id?: unknown };
    const id = String(data.agent_id ?? data.id ?? "").trim();
    return id || null;
  } catch {
    return null;
  }
}
