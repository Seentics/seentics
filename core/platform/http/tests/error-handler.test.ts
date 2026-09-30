import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { handleAppError } from "../error-handler";

function appThrowing(err: Error) {
  const app = new Hono();
  app.onError(handleAppError);
  app.get("/x", () => { throw err; });
  return app;
}

describe("handleAppError", () => {
  it("answers a malformed id reaching Postgres with 404, not 500", async () => {
    const pgError = Object.assign(new Error('invalid input syntax for type uuid: "w-leaf"'), { code: "22P02" });
    const res = await appThrowing(pgError).request("/x");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not found" });
  });

  it("keeps the status of a deliberate HTTP error", async () => {
    const res = await appThrowing(new HTTPException(403, { message: "forbidden" })).request("/x");
    expect(res.status).toBe(403);
  });

  it("answers anything else with a JSON 500", async () => {
    const res = await appThrowing(new Error("boom")).request("/x");
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "internal server error" });
  });
});
