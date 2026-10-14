/**
 * Just enough of the recorded DOM to name what a visitor clicked.
 *
 * rrweb identifies a click's target by node id only. The id resolves through the full
 * snapshot (`type: 2`) and the mutations after it (`source: 0`), so this keeps a small
 * mirror — tag, a handful of attributes, text, parent and children — and nothing else.
 * A checkpoint snapshot renumbers the tree, so each one resets the mirror.
 *
 * What is never kept: `value` of anything a visitor types into, and text beyond a short
 * cap. A label is built from what the site wrote (a button's text, an `aria-label`, a
 * placeholder), masked again by the caller before it is stored.
 */

type Attrs = Record<string, string>;

type MirrorNode = {
  tag?: string;
  text?: string;
  attrs?: Attrs;
  parent?: number;
  children?: number[];
};

/** Attributes worth reading for a label or a role. `value` is filtered further below. */
const KEPT_ATTRS = new Set(["id", "role", "type", "aria-label", "title", "alt", "placeholder", "name", "value"]);
/** Only on these does `value` hold site copy (the button's caption) rather than input. */
const CAPTION_INPUT_TYPES = new Set(["submit", "button", "reset"]);
const SKIP_TEXT_TAGS = new Set(["script", "style", "noscript", "template", "svg"]);
const BUTTON_ROLES = new Set(["button", "menuitem", "tab", "switch", "option"]);

const MAX_LABEL_TEXT = 60;
/** Longest text quoted in a label; longer is cut with an ellipsis. */
const MAX_QUOTED = 40;
const MAX_TEXT_DEPTH = 6;
const MAX_ANCESTOR_HOPS = 5;
const MAX_FORM_HOPS = 25;

export type TargetKind = "link" | "button" | "field" | "other";

export type ClickTarget = {
  kind: TargetKind;
  /** Unmasked, short: `button "Apply coupon"`. The caller masks it. */
  label: string;
  /** Node id of the enclosing `<form>`, when there is one. */
  formId?: number;
  /** Input type for fields (`text`, `email`, `checkbox`…), lowercased. */
  inputType?: string;
  /** For fields: whether it looks like a search box (excluded from form abandonment). */
  isSearch?: boolean;
};

function attrsOf(raw: unknown, tag: string | undefined): Attrs | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Attrs = {};
  const src = raw as Record<string, unknown>;
  for (const key of Object.keys(src)) {
    if (!KEPT_ATTRS.has(key)) continue;
    const v = src[key];
    if (v == null || v === false) continue;
    out[key] = String(v).slice(0, 120);
  }
  if ("value" in out) {
    const type = (out.type ?? "").toLowerCase();
    if (!(tag === "input" && CAPTION_INPUT_TYPES.has(type))) delete out.value;
  }
  return Object.keys(out).length ? out : undefined;
}

export class ReplayNodeMirror {
  private nodes = new Map<number, MirrorNode>();

  get size(): number {
    return this.nodes.size;
  }

  reset(): void {
    this.nodes.clear();
  }

  /** Load a full snapshot's serialized tree. */
  loadSnapshot(root: unknown): void {
    this.reset();
    this.addSerialized(root, undefined);
  }

  /** Add a serialized node (and its subtree) under `parentId`. */
  addSerialized(root: unknown, parentId: number | undefined): void {
    // Iterative: a deep DOM must not overflow the stack.
    const stack: Array<{ node: unknown; parent: number | undefined }> = [{ node: root, parent: parentId }];
    while (stack.length) {
      const { node, parent } = stack.pop()!;
      if (!node || typeof node !== "object") continue;
      const n = node as Record<string, unknown>;
      const id = Number(n.id);
      if (!Number.isFinite(id)) continue;
      const type = Number(n.type);
      const entry: MirrorNode = { parent };
      if (type === 2) {
        const tag = typeof n.tagName === "string" ? n.tagName.toLowerCase() : undefined;
        entry.tag = tag;
        entry.attrs = attrsOf(n.attributes, tag);
      } else if (type === 3) {
        entry.text = typeof n.textContent === "string" ? n.textContent.slice(0, 200) : "";
      }
      this.nodes.set(id, entry);
      if (parent !== undefined) this.attach(parent, id);
      const kids = Array.isArray(n.childNodes) ? n.childNodes : [];
      // Reverse so children are visited, and attached, in document order.
      for (let i = kids.length - 1; i >= 0; i--) stack.push({ node: kids[i], parent: id });
    }
  }

  private attach(parent: number, child: number): void {
    const p = this.nodes.get(parent);
    if (!p) return;
    (p.children ??= []).push(child);
  }

  remove(id: number): void {
    const node = this.nodes.get(id);
    if (!node) return;
    if (node.parent !== undefined) {
      const siblings = this.nodes.get(node.parent)?.children;
      if (siblings) {
        const at = siblings.indexOf(id);
        if (at >= 0) siblings.splice(at, 1);
      }
    }
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop()!;
      const n = this.nodes.get(cur);
      if (!n) continue;
      if (n.children) stack.push(...n.children);
      this.nodes.delete(cur);
    }
  }

  setText(id: number, value: unknown): void {
    const n = this.nodes.get(id);
    if (n) n.text = typeof value === "string" ? value.slice(0, 200) : "";
  }

  setAttributes(id: number, attributes: unknown): void {
    const n = this.nodes.get(id);
    if (!n || !attributes || typeof attributes !== "object") return;
    const next = attrsOf({ ...(n.attrs ?? {}), ...(attributes as Record<string, unknown>) }, n.tag);
    n.attrs = next;
  }

  /** Apply one rrweb mutation payload (`source: 0`). */
  applyMutation(data: Record<string, unknown>): void {
    const removes = Array.isArray(data.removes) ? data.removes : [];
    for (const r of removes) this.remove(Number((r as { id?: unknown }).id));
    const adds = Array.isArray(data.adds) ? data.adds : [];
    for (const a of adds) {
      const add = a as { parentId?: unknown; node?: unknown };
      this.addSerialized(add.node, Number.isFinite(Number(add.parentId)) ? Number(add.parentId) : undefined);
    }
    const texts = Array.isArray(data.texts) ? data.texts : [];
    for (const t of texts) this.setText(Number((t as { id?: unknown }).id), (t as { value?: unknown }).value);
    const attributes = Array.isArray(data.attributes) ? data.attributes : [];
    for (const a of attributes) {
      const m = a as { id?: unknown; attributes?: unknown };
      this.setAttributes(Number(m.id), m.attributes);
    }
  }

  /** Visible text under a node, collapsed and capped. */
  private textUnder(id: number): string {
    let out = "";
    const stack: Array<{ id: number; depth: number }> = [{ id, depth: 0 }];
    while (stack.length && out.length < MAX_LABEL_TEXT) {
      const { id: cur, depth } = stack.pop()!;
      const n = this.nodes.get(cur);
      if (!n) continue;
      if (n.tag && SKIP_TEXT_TAGS.has(n.tag)) continue;
      if (n.text !== undefined) {
        const t = n.text.replace(/\s+/g, " ").trim();
        if (t) out += (out ? " " : "") + t;
        continue;
      }
      if (depth >= MAX_TEXT_DEPTH || !n.children) continue;
      for (let i = n.children.length - 1; i >= 0; i--) stack.push({ id: n.children[i]!, depth: depth + 1 });
    }
    return out.slice(0, MAX_LABEL_TEXT).trim();
  }

  private kindOf(n: MirrorNode): TargetKind | null {
    const tag = n.tag;
    if (!tag) return null;
    const role = (n.attrs?.role ?? "").toLowerCase();
    if (tag === "a" || role === "link") return "link";
    if (tag === "button" || tag === "summary" || BUTTON_ROLES.has(role)) return "button";
    if (tag === "input") {
      const type = (n.attrs?.type ?? "text").toLowerCase();
      return CAPTION_INPUT_TYPES.has(type) || type === "image" ? "button" : "field";
    }
    if (tag === "select" || tag === "textarea" || tag === "label") return "field";
    return null;
  }

  private formOf(id: number): number | undefined {
    let cur: number | undefined = id;
    for (let hops = 0; cur !== undefined && hops < MAX_FORM_HOPS; hops++) {
      const n = this.nodes.get(cur);
      if (!n) return undefined;
      if (n.tag === "form") return cur;
      cur = n.parent;
    }
    return undefined;
  }

  /**
   * What was clicked: the nearest interactive ancestor (a link, button or field) within a
   * few hops, or the node itself. `null` when the id is not in the mirror — a click on a
   * node this stream never described.
   */
  describe(id: number): ClickTarget | null {
    const start = this.nodes.get(id);
    if (!start) return null;
    let targetId = id;
    let target = start;
    let kind: TargetKind = "other";
    let cur: number | undefined = start.text !== undefined ? start.parent : id;
    for (let hops = 0; cur !== undefined && hops <= MAX_ANCESTOR_HOPS; hops++) {
      const n = this.nodes.get(cur);
      if (!n) break;
      const k = this.kindOf(n);
      if (k) {
        targetId = cur;
        target = n;
        kind = k;
        break;
      }
      cur = n.parent;
    }
    if (kind === "other" && start.text !== undefined && start.parent !== undefined) {
      const parent = this.nodes.get(start.parent);
      if (parent) {
        targetId = start.parent;
        target = parent;
      }
    }

    const a = target.attrs ?? {};
    const text =
      a["aria-label"] || a.title || a.alt || (kind === "button" && a.value) || this.textUnder(targetId) ||
      (kind === "field" ? a.placeholder || a.name : "") || "";
    const collapsed = text.replace(/\s+/g, " ").trim();
    const cleaned = collapsed.length > MAX_QUOTED ? `${collapsed.slice(0, MAX_QUOTED - 1).trimEnd()}…` : collapsed;
    const noun = kind === "other" ? target.tag ?? "element" : kind;
    // rrweb masks text as asterisks when the site asked for it; say so rather than quote them.
    const label = !cleaned ? noun : /^[*\s]+$/.test(cleaned) ? `${noun} (masked)` : `${noun} "${cleaned}"`;
    const inputType = target.tag === "input" ? (a.type ?? "text").toLowerCase() : target.tag === "textarea" ? "textarea" : undefined;
    const searchy = /search|query|^q$/i;
    return {
      kind,
      label,
      formId: this.formOf(targetId),
      ...(inputType ? { inputType } : {}),
      ...(kind === "field"
        ? { isSearch: inputType === "search" || searchy.test(a.name ?? "") || searchy.test(a.placeholder ?? "") || searchy.test(a.role ?? "") }
        : {}),
    };
  }
}
