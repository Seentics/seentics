import { count, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, users } from "../db";
import { signAccessToken, signRefreshToken } from "../lib/auth-jwt";
import { toFrontendUser } from "../lib/user-mapper";
import type { LoginUserInput, RegisterUserInput } from "../lib/api-types";

export async function countUsers(): Promise<number> {
  const [r] = await db.select({ c: count() }).from(users);
  return Number(r?.c ?? 0);
}

export async function registerUser(input: RegisterUserInput) {
  const email = input.email.trim().toLowerCase();

  try {
    const row = await db.transaction(async (tx) => {
      const existing = await tx.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      if (existing.length) throw new Error("registration failed");

      const [{ c }] = await tx.select({ c: count() }).from(users);
      const isFirst = Number(c ?? 0) === 0;
      const passwordHash = await bcrypt.hash(input.password, 12);
      const [inserted] = await tx
        .insert(users)
        .values({
          email,
          passwordHash,
          name: input.name.trim() || email.split("@")[0]!,
          role: isFirst ? "admin" : "user",
        })
        .returning();
      return inserted!;
    });

    const access_token = await signAccessToken(row.id);
    const refresh_token = await signRefreshToken(row.id);
    return {
      data: {
        user: toFrontendUser(row),
        tokens: { access_token, refresh_token },
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "registration failed") throw err;
    throw new Error("registration failed");
  }
}

export async function loginUser(input: LoginUserInput) {
  const email = input.email.trim().toLowerCase();
  const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!row?.passwordHash) throw new Error("invalid credentials");
  const ok = await bcrypt.compare(input.password, row.passwordHash);
  if (!ok) throw new Error("invalid credentials");
  if (!row.isActive) throw new Error("account disabled");

  await db
    .update(users)
    .set({
      loginCount: row.loginCount + 1,
      lastLoginAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, row.id));

  const [fresh] = await db.select().from(users).where(eq(users.id, row.id)).limit(1);
  const access_token = await signAccessToken(fresh!.id);
  const refresh_token = await signRefreshToken(fresh!.id);
  return {
    data: {
      user: toFrontendUser(fresh!),
      tokens: { access_token, refresh_token },
    },
  };
}

export async function refreshSession(refreshToken: string) {
  const { verifyRefreshToken } = await import("../lib/auth-jwt");
  const { userId } = await verifyRefreshToken(refreshToken);
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!row?.isActive) throw new Error("account disabled");
  const access_token = await signAccessToken(row.id);
  const refresh_token = await signRefreshToken(row.id);
  return { access_token, refresh_token };
}

export async function getUserById(id: string) {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}
