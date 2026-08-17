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

export async function signRefreshToken(userId: string): Promise<string> {
  return new jose.SignJWT({ user_id: userId, typ: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
}

export async function verifyAccessToken(token: string): Promise<{ userId: string }> {
  const { payload } = await jose.jwtVerify(token, secret(), { algorithms: ["HS256"] });
  if (payload.typ === "refresh") throw new Error("wrong token type");
  const uid = payload.user_id;
  const userId = typeof uid === "string" ? uid : typeof uid === "number" ? String(Math.floor(uid)) : "";
  if (!userId) throw new Error("invalid token");
  return { userId };
}

export async function verifyRefreshToken(token: string): Promise<{ userId: string }> {
  const { payload } = await jose.jwtVerify(token, secret(), { algorithms: ["HS256"] });
  if (payload.typ !== "refresh") throw new Error("not a refresh token");
  const uid = payload.user_id;
  const userId = typeof uid === "string" ? uid : "";
  if (!userId) throw new Error("invalid token");
  return { userId };
}
