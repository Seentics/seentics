import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is required");
}

/** Shared client: Drizzle + raw tagged-template SQL */
export const sql = postgres(url, { max: 12 });
export const db = drizzle(sql, { schema });
export * from "./schema";
