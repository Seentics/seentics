import { describe, expect, it } from "bun:test";
import { addableColumns, columnName } from "./ensure-schema";

/**
 * Columns added to a table that already exists (`users`, shared with the gateway):
 * never a second primary key, and never NOT NULL without a default for existing rows.
 */
describe("addableColumns", () => {
  const createUsers = `CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"github_id" text,
	CONSTRAINT "users_email_unique" UNIQUE("email")
)`;

  it("keeps each column's definition, minus what an existing table cannot take", () => {
    expect(addableColumns(createUsers)).toEqual([
      '"id" uuid DEFAULT gen_random_uuid() NOT NULL',
      '"email" varchar(255)',
      '"is_active" boolean DEFAULT true NOT NULL',
      '"github_id" text',
    ]);
  });

  it("skips table constraints", () => {
    expect(addableColumns(createUsers).some((column) => column.includes("CONSTRAINT"))).toBe(false);
  });

  // A column the table already has is skipped by name, not left to IF NOT EXISTS, which a
  // compressed TimescaleDB hypertable refuses for a non-constant default.
  it("names each column, so the ones a table already has are skipped", () => {
    expect(addableColumns(createUsers).map(columnName)).toEqual(["id", "email", "is_active", "github_id"]);
  });
});
