'use client';

import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { outletLabel, outletsFor, type GraphNode } from '@/lib/automation-graph';

/**
 * The canvas nodes.
 *
 * Every node carries real connection handles — a target on top, one source per outlet
 * along the bottom. That is the difference between a graph you draw and a list you
 * append to: you connect by dragging from the outlet you mean to the node you mean, and
 * a branch node's outlets are visibly separate things rather than a hidden property of
 * whichever edge happens to be added next.
 *
 * Handles are drawn large because they are drag targets, not decoration.
 */

export type NodeVisual = {
  strip: string;
  iconBg: string;
  iconColor: string;
  icon: React.ElementType;
  title: string;
};

export type AutomationNodeData = {
  node: GraphNode;
  visual: NodeVisual;
  summary: string;
  /** True when the validator has something to say about this node. */
  invalid: boolean;
  onDelete: (id: string) => void;
};

const HANDLE = '!h-3 !w-3 !border-2 !border-background transition-colors';

function OutletHandles({ node }: { node: GraphNode }) {
  const outlets = outletsFor(node);

  if (outlets === null) {
    return (
      <Handle
        type="source"
        position={Position.Bottom}
        className={cn(HANDLE, '!bg-primary hover:!bg-primary/70')}
      />
    );
  }

  return (
    <>
      {outlets.map((outlet, i) => {
        // Spread the outlets across the card so two branches leaving one node are
        // distinguishable before either is connected.
        const left = `${((i + 1) / (outlets.length + 1)) * 100}%`;
        return (
          <React.Fragment key={outlet}>
            <Handle
              id={outlet}
              type="source"
              position={Position.Bottom}
              style={{ left }}
              className={cn(HANDLE, '!bg-primary hover:!bg-primary/70')}
            />
            {/* Naming the outlet is what makes dragging from the right one possible. */}
            <span
              className="pointer-events-none absolute -bottom-6 -translate-x-1/2 whitespace-nowrap rounded-full border border-border bg-background px-1.5 py-px text-[9px] font-semibold text-muted-foreground"
              style={{ left }}
            >
              {outletLabel(node, outlet)}
            </span>
          </React.Fragment>
        );
      })}
    </>
  );
}

export const AutomationNode = memo(function AutomationNode({
  data,
  selected,
}: NodeProps<AutomationNodeData>) {
  const { node, visual, summary, invalid, onDelete } = data;
  const Icon = visual.icon;

  return (
    <div
      className={cn(
        'group relative w-[260px] overflow-hidden rounded-lg border bg-card p-4 pl-5 shadow-sm transition-all',
        selected
          ? 'border-primary ring-2 ring-primary/25'
          : invalid
            ? 'border-amber-500/60 ring-2 ring-amber-500/15'
            : 'border-border hover:border-primary/40 hover:shadow-md',
      )}
    >
      <span className={cn('absolute inset-y-0 left-0 w-1.5', visual.strip)} aria-hidden />

      <Handle
        type="target"
        position={Position.Top}
        className={cn(HANDLE, '!bg-muted-foreground hover:!bg-primary')}
      />

      <div className="flex items-start gap-3">
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', visual.iconBg)}>
          <Icon className={cn('h-5 w-5', visual.iconColor)} style={{ width: 20, height: 20 }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {visual.title}
            </span>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onDelete(node.id); }}
              className="nodrag flex h-5 w-5 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-opacity hover:bg-red-500/10 hover:text-red-500 group-hover:opacity-100"
              aria-label={`Remove ${visual.title}`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <p className="mt-0.5 truncate text-[11px] leading-tight text-muted-foreground">{summary}</p>
        </div>
      </div>

      <OutletHandles node={node} />
    </div>
  );
});

export type TriggerNodeData = {
  label: string;
  description: string;
  icon: React.ElementType;
  index: number;
  canDelete: boolean;
  onDelete: (index: number) => void;
};

/**
 * A trigger.
 *
 * Source-only: nothing flows into the thing that starts the automation. The absent
 * target handle says so without needing an error message when someone tries.
 */
export const TriggerNode = memo(function TriggerNode({ data, selected }: NodeProps<TriggerNodeData>) {
  const Icon = data.icon;

  return (
    <div
      className={cn(
        'group relative w-[260px] overflow-hidden rounded-lg border bg-card p-4 pl-5 shadow-sm transition-all',
        selected ? 'border-primary ring-2 ring-primary/25' : 'border-border hover:border-primary/40',
      )}
    >
      <span className="absolute inset-y-0 left-0 w-1.5 bg-emerald-500" aria-hidden />

      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
          <Icon className="h-5 w-5 text-emerald-400" style={{ width: 20, height: 20 }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Trigger
            </span>
            {data.canDelete && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); data.onDelete(data.index); }}
                className="nodrag flex h-5 w-5 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-opacity hover:bg-red-500/10 hover:text-red-500 group-hover:opacity-100"
                aria-label="Remove trigger"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <p className="mt-0.5 truncate text-sm font-semibold leading-tight text-foreground">{data.label}</p>
          <p className="mt-0.5 truncate text-[11px] leading-tight text-muted-foreground">{data.description}</p>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className={cn(HANDLE, '!bg-emerald-500 hover:!bg-emerald-400')}
      />
    </div>
  );
});

export const nodeTypes = { automation: AutomationNode, trigger: TriggerNode };
