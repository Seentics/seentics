/**
 * The Model Context Protocol, as much of it as a read-only tool server needs.
 *
 * JSON-RPC 2.0 over MCP's Streamable HTTP transport, stateless: every POST carries whole
 * messages and is answered with JSON, never an event stream, and no session is kept — the
 * account key on each request is the whole identity. That is what the spec allows a server
 * with nothing to push, and it lets any Core replica answer any request.
 *
 * Written rather than pulled in, like `toJsonSchema` in the AI registry: the methods a tool
 * server answers are five, and the SDK's transports carry sessions, streams and resumption
 * this server has no use for.
 */

/** Newest first. A client asking for one of these gets it; anything else gets the first. */
export const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"] as const;

export type McpToolContent = { type: "text"; text: string };

/** What a tool's handler hands back: data to serialise, or a refusal the model should read. */
export type McpToolOutcome = { ok: true; data: unknown } | { ok: false; error: string };

export type McpTool<Caller> = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /** Every tool here reads; the hints let a client skip asking before each call. */
  annotations?: { readOnlyHint?: boolean; openWorldHint?: boolean };
  call(args: Record<string, unknown>, caller: Caller): Promise<McpToolOutcome>;
};

export type McpServer<Caller> = {
  info: { name: string; title: string; version: string };
  instructions: string;
  /** The tools this caller may use; `tools/list` and `tools/call` see the same list. */
  tools(caller: Caller): McpTool<Caller>[];
};

type JsonRpcId = string | number;
type JsonRpcError = { code: number; message: string; data?: unknown };
export type JsonRpcResponse =
  | { jsonrpc: "2.0"; id: JsonRpcId | null; result: unknown }
  | { jsonrpc: "2.0"; id: JsonRpcId | null; error: JsonRpcError };

export const PARSE_ERROR = -32700;
export const INVALID_REQUEST = -32600;
export const METHOD_NOT_FOUND = -32601;
export const INVALID_PARAMS = -32602;
export const INTERNAL_ERROR = -32603;

const isId = (v: unknown): v is JsonRpcId => typeof v === "string" || (typeof v === "number" && Number.isFinite(v));
const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);

const fail = (id: JsonRpcId | null, code: number, message: string): JsonRpcResponse => ({ jsonrpc: "2.0", id, error: { code, message } });

/**
 * Answer one JSON-RPC message, or `null` when nothing is owed: a notification, or a response
 * from the client (this server never asks the client anything, so there is none to match).
 */
export async function handleMessage<Caller>(server: McpServer<Caller>, caller: Caller, msg: unknown): Promise<JsonRpcResponse | null> {
  if (!isObject(msg) || msg.jsonrpc !== "2.0") return fail(null, INVALID_REQUEST, "Not a JSON-RPC 2.0 message");
  if (!("method" in msg)) return null;
  const method = msg.method;
  const hasId = "id" in msg;
  if (hasId && !isId(msg.id)) return fail(null, INVALID_REQUEST, "id must be a string or a number");
  if (!hasId) return null;
  const id = msg.id as JsonRpcId;
  if (typeof method !== "string") return fail(id, INVALID_REQUEST, "method must be a string");
  const params = isObject(msg.params) ? msg.params : {};

  switch (method) {
    case "initialize": {
      const asked = params.protocolVersion;
      const version = PROTOCOL_VERSIONS.find((v) => v === asked) ?? PROTOCOL_VERSIONS[0];
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: version,
          capabilities: { tools: { listChanged: false } },
          serverInfo: server.info,
          instructions: server.instructions,
        },
      };
    }
    case "ping":
      return { jsonrpc: "2.0", id, result: {} };
    case "tools/list":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: server.tools(caller).map((t) => ({
            name: t.name,
            title: t.title,
            description: t.description,
            inputSchema: t.inputSchema,
            ...(t.annotations ? { annotations: t.annotations } : {}),
          })),
        },
      };
    case "tools/call": {
      const name = params.name;
      if (typeof name !== "string") return fail(id, INVALID_PARAMS, "params.name must be a string");
      const tool = server.tools(caller).find((t) => t.name === name);
      if (!tool) return fail(id, INVALID_PARAMS, `Unknown tool: ${name}`);
      const args = isObject(params.arguments) ? params.arguments : {};
      let outcome: McpToolOutcome;
      try {
        outcome = await tool.call(args, caller);
      } catch {
        // Internals stay in the logs; the model is told the read failed and may retry.
        outcome = { ok: false, error: "The read failed. Try again in a moment." };
      }
      return { jsonrpc: "2.0", id, result: toolResult(outcome) };
    }
    // Asked for by some clients whether or not they were offered; empty is the honest answer.
    case "resources/list":
      return { jsonrpc: "2.0", id, result: { resources: [] } };
    case "prompts/list":
      return { jsonrpc: "2.0", id, result: { prompts: [] } };
    default:
      return fail(id, METHOD_NOT_FOUND, `Method not found: ${method}`);
  }
}

/** A tool's outcome as MCP's `CallToolResult`: JSON text, or the refusal with `isError`. */
export function toolResult(outcome: McpToolOutcome): { content: McpToolContent[]; isError?: true } {
  if (!outcome.ok) return { content: [{ type: "text", text: outcome.error }], isError: true };
  return { content: [{ type: "text", text: JSON.stringify(outcome.data ?? null) }] };
}

/**
 * One POST body: a message, or (2025-03-26 and earlier) a batch of them. `null` when nothing
 * is owed, which the transport answers 202 with no body.
 */
export async function handleBody<Caller>(server: McpServer<Caller>, caller: Caller, body: unknown): Promise<JsonRpcResponse | JsonRpcResponse[] | null> {
  if (Array.isArray(body)) {
    if (body.length === 0) return fail(null, INVALID_REQUEST, "Empty batch");
    const out: JsonRpcResponse[] = [];
    for (const msg of body) {
      const res = await handleMessage(server, caller, msg);
      if (res) out.push(res);
    }
    return out.length > 0 ? out : null;
  }
  return handleMessage(server, caller, body);
}
