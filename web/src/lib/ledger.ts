import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import type { BodyShow } from "@/lib/types";

type Ledger = { bodies: Record<string, BodyShow> };

const KV_KEY = "embody:bodies";

function kvCreds(): { url: string; token: string } | null {
  const url = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL)?.trim();
  const token = (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN)?.trim();
  return url && token ? { url, token } : null;
}

function useKv(): boolean {
  return kvCreds() !== null;
}

async function kv() {
  const { createClient } = await import("@vercel/kv");
  const creds = kvCreds();
  if (!creds) throw new Error("KV creds missing");
  return createClient(creds);
}

function ledgerPath(): string {
  return process.env.EMBODY_WEB_LEDGER?.trim() || join(process.cwd(), ".data", "ledger.json");
}

function empty(): Ledger {
  return { bodies: {} };
}

function readFile(): Ledger {
  try {
    const raw = readFileSync(ledgerPath(), "utf8");
    const parsed = JSON.parse(raw) as Ledger;
    if (!parsed || typeof parsed !== "object" || !parsed.bodies) return empty();
    return parsed;
  } catch {
    return empty();
  }
}

function writeFile(ledger: Ledger): void {
  const file = ledgerPath();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(ledger, null, 2), "utf8");
}

async function readLedger(): Promise<Ledger> {
  if (!useKv()) return readFile();
  const client = await kv();
  const bodies = (await client.hgetall<Record<string, BodyShow>>(KV_KEY)) ?? {};
  return { bodies };
}

/** Registry write: a body joins and gets its id recorded. null = id already taken. */
export async function registerBody(row: BodyShow): Promise<BodyShow | null> {
  const ledger = await readLedger();
  if (ledger.bodies[row.id]) return null;
  const stored: BodyShow = { ...row, joined_at: new Date().toISOString() };
  if (useKv()) {
    const client = await kv();
    await client.hset(KV_KEY, { [stored.id]: stored });
    return stored;
  }
  ledger.bodies[stored.id] = stored;
  writeFile(ledger);
  return stored;
}

export async function upsertBody(show: BodyShow): Promise<BodyShow> {
  const existing = (await readLedger()).bodies[show.id];
  const stored: BodyShow = {
    ...show,
    joined_at: existing?.joined_at,
    pushed_at: new Date().toISOString(),
  };
  if (useKv()) {
    const client = await kv();
    await client.hset(KV_KEY, { [stored.id]: stored });
    return stored;
  }
  const ledger = readFile();
  ledger.bodies[stored.id] = stored;
  writeFile(ledger);
  return stored;
}

export async function getBody(id: string): Promise<BodyShow | null> {
  return (await readLedger()).bodies[id] ?? null;
}

export async function listBodiesForAgents(agentIds: string[]): Promise<BodyShow[]> {
  const allow = new Set(agentIds);
  return Object.values((await readLedger()).bodies).filter((row) => allow.has(row.bound_agent_id));
}
