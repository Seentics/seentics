import * as jose from "jose";
import { env } from "../../config";

function secret(): Uint8Array {
  const s = env().jwtSecret;
  if (!s) throw new Error("JWT_SECRET is required");
  return new TextEncoder().encode(s);
}

export async function signAccessToken(userId: string): Promise<string> {
  return new jose.SignJWT({ user_id: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secret());
}

/**
 * `passwordStamp` ties the token to the password it was issued under (see
 * `credential-authentication.service.ts`): changing the password ends every session that
 * still holds a token from before.
 */
export async function signRefreshToken(userId: string, passwordStamp?: string): Promise<string> {
  const claims: Record<string, string> = { user_id: userId, typ: "refresh" };
  if (passwordStamp !== undefined) claims.pwd = passwordStamp;
  return new jose.SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
}

/**
 * `clientAgency` is set for a client user's token (`kind: "client"`, signed by the gateway's
 * client sign-in): the owner id of the agency they signed in to. A client token without one
 * is refused rather than read as an account's.
 */
export async function verifyAccessToken(token: string): Promise<{ userId: string; clientAgency?: string }> {
  const { payload } = await jose.jwtVerify(token, secret(), { algorithms: ["HS256"] });
  if (payload.typ === "refresh") throw new Error("wrong token type");
  const uid = payload.user_id;
  const userId = typeof uid === "string" ? uid : typeof uid === "number" ? String(Math.floor(uid)) : "";
  if (!userId) throw new Error("invalid token");
  if (payload.kind === "client") {
    const agency = typeof payload.agency === "string" ? payload.agency : "";
    if (!agency) throw new Error("invalid token");
    return { userId, clientAgency: agency };
  }
  return { userId };
}

export async function verifyRefreshToken(token: string): Promise<{ userId: string; passwordStamp?: string }> {
  const { payload } = await jose.jwtVerify(token, secret(), { algorithms: ["HS256"] });
  if (payload.typ !== "refresh") throw new Error("not a refresh token");
  const uid = payload.user_id;
  const userId = typeof uid === "string" ? uid : "";
  if (!userId) throw new Error("invalid token");
  return typeof payload.pwd === "string" ? { userId, passwordStamp: payload.pwd } : { userId };
}
