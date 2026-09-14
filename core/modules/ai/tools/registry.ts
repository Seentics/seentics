import { z } from "zod";
import type { AiTool, ToolContext, ToolResult } from "./tool.types";

/** The JSON Schema shape providers expect alongside a tool name. */
export type ToolSchema = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

/**
 * The tools available to the agent, and the only way to invoke one.
 *
 * Dispatch goes through `run`, which is where the two invariants are enforced: arguments
 * are validated against the tool's schema before the handler sees them, and the context
 * is supplied by the caller rather than merged from the model's arguments. A tool
 * handler therefore never has to defend itself against a hostile `websiteId` — it cannot
 * receive one.
 */
export class ToolRegistry {
  private readonly tools = new Map<string, AiTool<any>>();

  constructor(tools: AiTool<any>[] = []) {
    for (const t of tools) this.register(t);
  }

  register(tool: AiTool<any>): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Duplicate AI tool: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): AiTool<any> | undefined {
    return this.tools.get(name);
  }

  list(): AiTool<any>[] {
    return [...this.tools.values()];
  }

  /** JSON Schemas for the provider, in the order the tools were registered. */
  schemas(): ToolSchema[] {
    return this.list().map((t) => ({
      name: t.name,
      description: t.description,
      parameters: toJsonSchema(t.schema),
    }));
  }

  /**
   * Run one tool call.
   *
   * Every failure is returned rather than thrown. A model that asks for a tool that does
   * not exist, or passes the wrong arguments, should be told so and given the chance to
   * correct itself — an exception here would end the turn and lose the conversation for
   * what is usually a recoverable mistake.
   */
  async run(name: string, rawArgs: unknown, ctx: ToolContext): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) return { ok: false, error: `Unknown tool: ${name}` };

    const parsed = tool.schema.safeParse(rawArgs ?? {});
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; ");
      return { ok: false, error: `Invalid arguments for ${name}: ${detail}` };
    }

    try {
      return await tool.handler(parsed.data, ctx);
    } catch (err) {
      // The message reaches the model, so it must not carry internals. The full error is
      // logged by the caller against the query record.
      return {
        ok: false,
        error: err instanceof Error ? err.message.slice(0, 200) : "Tool failed",
      };
    }
  }
}

/**
 * Minimal Zod → JSON Schema conversion, covering the shapes the tools actually use.
 *
 * Written rather than pulled in: the tool arguments here are flat objects of strings,
 * numbers, enums and small arrays, and a dependency that converts arbitrary Zod is a
 * large surface for a job this narrow. Anything it cannot express degrades to an
 * unconstrained value, which the Zod parse in `run` still rejects — the JSON Schema
 * guides the model, it is not the validation.
 */
export function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const def: any = (schema as any)._def;
  const typeName: string = def?.typeName ?? "";

  switch (typeName) {
    case "ZodObject": {
      const shape = def.shape();
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const [key, value] of Object.entries(shape)) {
        properties[key] = toJsonSchema(value as z.ZodType);
        if (!(value as any).isOptional?.()) required.push(key);
      }
      return { type: "object", properties, required, additionalProperties: false };
    }
    case "ZodString":
      return { type: "string", ...(def.description ? { description: def.description } : {}) };
    case "ZodNumber":
      return { type: "number" };
    case "ZodBoolean":
      return { type: "boolean" };
    case "ZodEnum":
      return { type: "string", enum: def.values };
    case "ZodArray":
      return { type: "array", items: toJsonSchema(def.type) };
    case "ZodOptional":
    case "ZodDefault":
      return toJsonSchema(def.innerType);
    case "ZodNullable":
      return toJsonSchema(def.innerType);
    default:
      return {};
  }
}
