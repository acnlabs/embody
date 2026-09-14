import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import type { DriveCmd } from "@/lib/drive";
import { isDriveFresh } from "@/lib/drive";
import type { BodyPose, BodyShow } from "@/lib/types";

type Ledger = {
  bodies: Record<string, BodyShow>;
  inboxes?: Record<string, DriveCmd>;
  poses?: Record<string, BodyPose>;
};

const KV_KEY = "embody:bodies";
const INBOX_KEY = "embody:inbox";
const POSE_KEY = "embody:pose";

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

function persistShow(show: BodyShow): BodyShow {
  const stored = { ...show };
  delete stored.drive_listening;
  delete stored.bound_agent_name;
  return stored;
}

/** Registry write: a body joins and gets its id recorded. null = id already taken. */
export async function registerBody(row: BodyShow): Promise<BodyShow | null> {
  const ledger = await readLedger();
  if (ledger.bodies[row.id]) return null;
  const stored: BodyShow = persistShow({ ...row, joined_at: new Date().toISOString() });
  if (useKv()) {
    const client = await kv();
    await client.hset(KV_KEY, { [stored.id]: stored });
    return stored;
  }
  ledger.bodies[stored.id] = stored;
  writeFile(ledger);
  return stored;
}

export async function upsertBody(
  show: BodyShow,
  opts?: { listen?: boolean },
): Promise<BodyShow> {
  const existing = (await readLedger()).bodies[show.id];
  const now = new Date().toISOString();
  const stored: BodyShow = persistShow({
    ...show,
    joined_at: existing?.joined_at,
    pushed_at: now,
    build: show.build ?? existing?.build,
    drive_listen_at: opts?.listen ? now : existing?.drive_listen_at,
  });
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

export async function touchDriveListen(id: string): Promise<void> {
  const existing = await getBody(id);
  if (!existing) return;
  const stored: BodyShow = persistShow({
    ...existing,
    drive_listen_at: new Date().toISOString(),
  });
  if (useKv()) {
    const client = await kv();
    await client.hset(KV_KEY, { [stored.id]: stored });
    return;
  }
  const ledger = readFile();
  ledger.bodies[stored.id] = stored;
  writeFile(ledger);
}

export async function putDrive(id: string, cmd: DriveCmd): Promise<void> {
  if (useKv()) {
    const client = await kv();
    await client.hset(INBOX_KEY, { [id]: cmd });
    return;
  }
  const ledger = readFile();
  ledger.inboxes = { ...ledger.inboxes, [id]: cmd };
  writeFile(ledger);
}

export async function putPose(id: string, pose: BodyPose): Promise<void> {
  if (useKv()) {
    const client = await kv();
    await client.hset(POSE_KEY, { [id]: pose });
    return;
  }
  const ledger = readFile();
  ledger.poses = { ...ledger.poses, [id]: pose };
  writeFile(ledger);
}

export async function getPose(id: string): Promise<BodyPose | null> {
  if (useKv()) {
    const client = await kv();
    return (await client.hget<BodyPose>(POSE_KEY, id)) ?? null;
  }
  return readFile().poses?.[id] ?? null;
}

export async function takeDrive(id: string): Promise<DriveCmd | null> {
  if (useKv()) {
    const client = await kv();
    const cmd = await client.hget<DriveCmd>(INBOX_KEY, id);
    if (!cmd) return null;
    await client.hdel(INBOX_KEY, id);
    return isDriveFresh(cmd) ? cmd : null;
  }
  const ledger = readFile();
  const cmd = ledger.inboxes?.[id] ?? null;
  if (cmd && ledger.inboxes) {
    delete ledger.inboxes[id];
    writeFile(ledger);
  }
  return cmd && isDriveFresh(cmd) ? cmd : null;
}

export async function getBody(id: string): Promise<BodyShow | null> {
  return (await readLedger()).bodies[id] ?? null;
}

export async function listBodiesForAgents(agentIds: string[]): Promise<BodyShow[]> {
  const allow = new Set(agentIds);
  return Object.values((await readLedger()).bodies).filter((row) => allow.has(row.bound_agent_id));
}

export async function deleteBody(id: string): Promise<BodyShow | null> {
  const existing = await getBody(id);
  if (!existing) return null;
  if (useKv()) {
    const client = await kv();
    await client.hdel(KV_KEY, id);
    await client.hdel(INBOX_KEY, id);
    await client.hdel(POSE_KEY, id);
    return existing;
  }
  const ledger = readFile();
  delete ledger.bodies[id];
  if (ledger.inboxes) delete ledger.inboxes[id];
  if (ledger.poses) delete ledger.poses[id];
  writeFile(ledger);
  return existing;
}
