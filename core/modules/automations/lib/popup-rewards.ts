import type { PopupRewards, WheelSegment } from "../interfaces";

type Action = Record<string, unknown>;

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/**
 * The prizes a popup action can pay out, or `null` when it has none.
 *
 * Layout-gated: a `wheel` left over from an earlier layout in the builder pays nothing,
 * exactly as the tracker ignores it. A coupon is a reward only when it sits behind an
 * email form — without one the code is shown straight away and there is nothing to guard.
 */
export function extractRewards(action: Action): PopupRewards | null {
  if (action.type !== "show_modal" && action.type !== "show_banner") return null;

  let wheel: WheelSegment[] | null = null;
  if (action.type === "show_modal" && action.layout === "spin_wheel" && isObject(action.wheel) && Array.isArray(action.wheel.segments)) {
    wheel = action.wheel.segments.filter(isObject).map((s) => ({
      label: String(s.label ?? ""),
      weight: Number.isFinite(Number(s.weight)) ? Math.max(0, Math.trunc(Number(s.weight))) : 0,
      coupon_code: String(s.coupon_code ?? ""),
    }));
  }

  let coupon: PopupRewards["coupon"] = null;
  if (!wheel && isObject(action.form) && isObject(action.coupon) && typeof action.coupon.code === "string" && action.coupon.code) {
    coupon = { code: action.coupon.code, description: String(action.coupon.description ?? "") };
  }

  return wheel || coupon ? { wheel, coupon } : null;
}

/**
 * Every client action in a stored definition, across the whole graph.
 *
 * A definition's actions live on `graph.nodes[*].action`; an A/B test branches to several.
 */
export function clientActionsOf(definition: Record<string, unknown>): Action[] {
  if (!isObject(definition)) return [];
  const graph = definition.graph;
  if (!isObject(graph) || !Array.isArray(graph.nodes)) return [];
  const out: Action[] = [];
  for (const node of graph.nodes) {
    if (isObject(node) && node.kind === "action" && isObject(node.action)) out.push(node.action);
  }
  return out;
}

/** The first popup in the definition that pays something out. */
export function rewardsOfDefinition(definition: Record<string, unknown>): PopupRewards | null {
  for (const action of clientActionsOf(definition)) {
    const rewards = extractRewards(action);
    if (rewards) return rewards;
  }
  return null;
}

/**
 * The action as the browser may see it: coupon codes removed.
 *
 * The prize is chosen server-side when the lead is stored, and the code is returned with
 * it. A code left in the definition would be readable by anyone who opens the page's
 * network tab, which would make both the wheel and the email gate decoration. Labels,
 * weights and colours stay: the wheel has to be drawn.
 */
export function redactRewards<T extends Action>(action: T): T {
  if (!extractRewards(action)) return action;
  const out: Action = { ...action };
  if (isObject(action.wheel) && Array.isArray(action.wheel.segments)) {
    out.wheel = {
      ...action.wheel,
      segments: action.wheel.segments.map((s) => (isObject(s) ? { ...s, coupon_code: "" } : s)),
    };
  }
  if (isObject(action.coupon) && isObject(action.form)) {
    out.coupon = { ...action.coupon, code: "" };
  }
  return out as T;
}

/** A definition with every action redacted, for the tracker's `/init` payload. */
export function redactDefinition(definition: Record<string, unknown>): Record<string, unknown> {
  // Rows come from JSON: a definition that is not an object has nothing to redact.
  if (!isObject(definition)) return definition;
  const graph = definition.graph;
  if (!isObject(graph) || !Array.isArray(graph.nodes)) return definition;
  return {
    ...definition,
    graph: {
      ...graph,
      nodes: graph.nodes.map((node) =>
        isObject(node) && node.kind === "action" && isObject(node.action)
          ? { ...node, action: redactRewards(node.action) }
          : node,
      ),
    },
  };
}
