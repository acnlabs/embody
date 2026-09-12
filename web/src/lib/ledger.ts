import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import type { BodyShow } from "@/lib/types";

type Ledger = { bodies: Record<string, BodyShow> };

const KV_KEY = "embody:bodies";

function useKv(): boolean {
  return Boolean(process.env.KV_REST_API_URL?.trim() && process.env.KV_REST_API_TOKEN?.trim());
}

async function kv() {
  const mod = await import("@vercel/kv");
  return mod.kv;
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

export async function upsertBody(show: BodyShow): Promise<BodyShow> {
  const stored: BodyShow = { ...show, pushed_at: new Date().toISOString() };
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
