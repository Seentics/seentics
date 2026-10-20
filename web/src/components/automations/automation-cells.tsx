'use client';

import { useConfirm } from '@/components/ui/confirm-dialog';
import { MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDeleteAutomation, type Automation } from '@/lib/automations-api';

/** An automation's overflow menu: edit, and delete after a confirmation. */
export function RowMenu({ automation, websiteId, onEdit }: { automation: Automation; websiteId: string; onEdit: () => void }) {
  const { mutate: remove, isPending: deleting } = useDeleteAutomation();
  const [confirm, confirmDialog] = useConfirm();

  return (
    <>
    {/* The row is clickable, and React bubbles portal clicks through the tree: without
        this, pressing Cancel in the dialog would also open the automation. */}
    <span onClick={e => e.stopPropagation()}>{confirmDialog}</span>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={e => e.stopPropagation()}>
          <MoreVertical className="h-3.5 w-3.5" />
          <span className="sr-only">Options for {automation.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuItem onClick={e => { e.stopPropagation(); onEdit(); }}>
          <Pencil className="mr-2 h-3.5 w-3.5" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={deleting}
          className="text-destructive"
          onClick={async e => {
            e.stopPropagation();
            const ok = await confirm({
              title: `Delete "${automation.name}"?`,
              description: 'The automation stops running and its run history is removed.',
              confirmLabel: 'Delete automation',
              destructive: true,
            });
            if (ok) remove({ websiteId, automationId: automation.id });
          }}
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    </>
  );
}
