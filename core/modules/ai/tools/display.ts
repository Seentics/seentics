/**
 * How a tool's result should be drawn.
 *
 * The tool decides, not the model. That is the whole design:
 *
 * - A tool knows the shape of what it returns — `get_traffic_summary` always produces
 *   comparable metrics, `get_top_pages` always produces a ranked table — so the choice
 *   is deterministic and needs no reasoning.
 * - A model choosing markup is a model *writing* markup, and the schema here still has a
 *   `component_code` column from an earlier design that did exactly that. Rendering
 *   model-authored code in a dashboard is arbitrary script execution wearing a chart's
 *   clothes, and the data feeding these answers is attacker-controlled.
 * - The frontend keeps one prebuilt component per `kind`. Adding a visualisation is a
 *   component and a case, not a prompt change, and an unknown `kind` falls back to a
 *   table rather than rendering nothing.
 *
 * The model still writes the prose around the block. It just does not choose the block.
 */
export type DisplayBlock =
  /** Comparable figures with optional period-over-period deltas. */
  | {
      kind: "metrics";
      items: Array<{
        label: string;
        value: number | string;
        /** Fractional change against the previous period; omitted when unknown. */
        delta?: number | null;
        format?: "number" | "percent" | "duration" | "currency";
      }>;
    }
  /** A ranked list — top pages, sources, errors. */
  | {
      kind: "table";
      columns: Array<{ key: string; label: string; format?: "number" | "percent" | "duration" | "currency" }>;
      rows: Array<Record<string, unknown>>;
    }
  /** A series over time. */
  | {
      kind: "timeseries";
      xKey: string;
      series: Array<{ key: string; label: string }>;
      rows: Array<Record<string, unknown>>;
    }
  /** Funnel steps with their drop-off. */
  | {
      kind: "funnel";
      steps: Array<{ label: string; value: number; conversionRate?: number }>;
    }
  /** Things to click through to — sessions, automations, errors. */
  | {
      kind: "links";
      items: Array<{ label: string; sublabel?: string; href: string }>;
    };

/** A tool's payload: the data the model reasons over, plus how to draw it. */
export type ToolPayload = {
  data: unknown;
  display?: DisplayBlock;
};

const MAX_TABLE_ROWS = 25;

/** Ranked rows as a table, columns derived from the first row when not given. */
export function asTable(
  rows: Array<Record<string, unknown>>,
  columns?: Array<{ key: string; label: string }>,
): DisplayBlock {
  const trimmed = rows.slice(0, MAX_TABLE_ROWS);
  return {
    kind: "table",
    columns:
      columns ??
      Object.keys(trimmed[0] ?? {}).map((key) => ({
        key,
        label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      })),
    rows: trimmed,
  };
}

export function asMetrics(items: Extract<DisplayBlock, { kind: "metrics" }>["items"]): DisplayBlock {
  return { kind: "metrics", items };
}

export function asLinks(items: Extract<DisplayBlock, { kind: "links" }>["items"]): DisplayBlock {
  return { kind: "links", items: items.slice(0, MAX_TABLE_ROWS) };
}
