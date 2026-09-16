import { createHash } from "crypto";
import { EncryptJWT, jwtDecrypt } from "jose";
import { extractBearerToken, verifyUserToken } from "@/lib/userAuth";
import { HOST_TOKEN_TTL_SEC, HOST_TOKEN_TYP } from "@/lib/hostFrame";

export type HostClaims = {
  sub: string;
  bodyId: string;
  agentId: string;
  gat: string;
};

export function hostTokenKey(secret: string): Uint8Array {
  return new Uint8Array(createHash("sha256").update(`embody-host:${secret}`).digest());
}

export function hostTokenSecretFromEnv(): string {
  return process.env.HOST_TOKEN_SECRET?.trim() || "";
}

function asClaim(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function signHostToken(args: {
  sub: string;
  bodyId: string;
  agentId: string;
  gat: string;
  secret: string;
  expiresIn?: number;
  now?: Date;
}): Promise<{ token: string; expiresIn: number } | null> {
  const secret = args.secret.trim();
  const gat = args.gat.trim();
  const sub = args.sub.trim();
  const bodyId = args.bodyId.trim();
  const agentId = args.agentId.trim();
  if (!secret || !gat || !sub || !bodyId || !agentId) return null;
  const expiresIn = args.expiresIn ?? HOST_TOKEN_TTL_SEC;
  const issued = args.now ?? new Date();
  const exp = Math.floor(issued.getTime() / 1000) + Math.max(1, expiresIn);
  const token = await new EncryptJWT({
    typ: HOST_TOKEN_TYP,
    sub,
    bodyId,
    agentId,
    gat,
  })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt(issued)
    .setExpirationTime(exp)
    .encrypt(hostTokenKey(secret));
  return { token, expiresIn };
}

export async function verifyHostToken(token: string, secret: string): Promise<HostClaims | null> {
  const raw = token.trim();
  const key = secret.trim();
  if (!raw || !key || raw.split(".").length !== 5) return null;
  try {
    const { payload } = await jwtDecrypt(raw, hostTokenKey(key));
    if (asClaim(payload.typ) !== HOST_TOKEN_TYP) return null;
    const claims: HostClaims = {
      sub: asClaim(payload.sub),
      bodyId: asClaim(payload.bodyId),
      agentId: asClaim(payload.agentId),
      gat: asClaim(payload.gat),
    };
    if (!claims.sub || !claims.bodyId || !claims.agentId || !claims.gat) return null;
    return claims;
  } catch {
    return null;
  }
}

export type OwnerActor = {
  sub: string;
  bearer: string;
  host: HostClaims | null;
};

export async function resolveOwner(req: Request): Promise<OwnerActor | null> {
  const raw = extractBearerToken(req);
  if (!raw) return null;
  const host = await verifyHostToken(raw, hostTokenSecretFromEnv());
  if (host) {
    return { sub: host.sub, bearer: host.gat, host };
  }
  const sub = await verifyUserToken(req);
  if (!sub) return null;
  return { sub, bearer: raw, host: null };
}

export async function mintHostToken(args: {
  sub: string;
  bodyId: string;
  agentId: string;
  gat: string;
}): Promise<{ hostToken: string; hostExpiresIn: number } | null> {
  const signed = await signHostToken({
    ...args,
    secret: hostTokenSecretFromEnv(),
  });
  return signed ? { hostToken: signed.token, hostExpiresIn: signed.expiresIn } : null;
}
