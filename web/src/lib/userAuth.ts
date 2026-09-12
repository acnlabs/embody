import { createRemoteJWKSet, jwtVerify } from "jose";
import { AUTH0_AUDIENCE, AUTH0_DOMAIN } from "@/lib/auth0";

const jwks = createRemoteJWKSet(
  new URL(`https://${AUTH0_DOMAIN}/.well-known/jwks.json`),
);

export function extractBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  return token || null;
}

export async function verifyUserToken(req: Request): Promise<string | null> {
  const token = extractBearerToken(req);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: `https://${AUTH0_DOMAIN}/`,
      audience: AUTH0_AUDIENCE,
    });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
