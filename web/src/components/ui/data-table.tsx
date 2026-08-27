'use client';

import * as React from 'react';
import {
  ColumnDef,
  ColumnFiltersState,
  PaginationState,
  Row,
  RowSelectionState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

// ─── Re-export ColumnDef so consumers only import from here ──────────────────
export type { ColumnDef, Row } from '@tanstack/react-table';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DataTableProps<TData> {
  /** Column definitions built with columnHelper or ColumnDef */
  columns: ColumnDef<TData, any>[];
  /** Row data */
  data: TData[];

  // ── Toolbar / selection ────
  /** Content rendered in the top-left of the toolbar (title, description…) */
  toolbarLeft?: React.ReactNode;
  /** Content rendered in the top-right of the toolbar (search, sort buttons…) */
  toolbarRight?: React.ReactNode;
  /**
   * Render function called with currently selected rows.
   * Shown only when at least one row is selected, replacing toolbarLeft.
   */
  selectionActions?: (selectedRows: TData[]) => React.ReactNode;

  // ── Features ──────────────
  enableRowSelection?: boolean;
  /** Called whenever selected rows change */
  onRowSelectionChange?: (selectedRows: TData[]) => void;
  /** Called when a row body is clicked */
  onRowClick?: (row: TData) => void;
  /** Extra class applied to each TR when row-click is enabled */
  rowClassName?: (row: TData) => string | undefined;

  // ── Pagination ────────────
  /**
   * Controls pagination mode:
   * - `client` (default): DataTable handles pagination internally.
   * - `server`: parent controls pageIndex/pageSize; DataTable calls onPaginationChange.
   */
  paginationMode?: 'client' | 'server';
  pageSize?: number;
  /** Used only with server pagination */
  pageIndex?: number;
  /** Total page count; required for server pagination */
  pageCount?: number;
  /** Called with new { pageIndex, pageSize } when page changes */
  onPaginationChange?: (state: PaginationState) => void;
  /** Items per page options shown in the rows-per-page select */
  pageSizeOptions?: number[];
  /** Override total row count shown in pagination footer (useful for server mode) */
  totalRowCount?: number;

  // ── Loading / empty ───────
  isLoading?: boolean;
  /** Number of skeleton rows shown while loading */
  loadingRows?: number;
  emptyIcon?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;

  className?: string;
}

// ─── Sortable column header helper ───────────────────────────────────────────

export function SortableHeader({
  column,
  children,
}: {
  column: any;
  children: React.ReactNode;
}) {
  const sorted = column.getIsSorted();
  return (
    <button
      className="flex items-center gap-1.5 group select-none hover:text-foreground transition-colors whitespace-nowrap"
      onClick={() => column.toggleSorting(sorted === 'asc')}
    >
      {children}
      {sorted === 'asc' ? (
        <ArrowUp className="h-3 w-3 text-primary" />
      ) : sorted === 'desc' ? (
        <ArrowDown className="h-3 w-3 text-primary" />
      ) : (
        <ArrowUpDown className="h-3 w-3 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
      )}
    </button>
  );
}

// ─── Selection column factory ─────────────────────────────────────────────────

export function selectionColumn<TData>(): ColumnDef<TData, unknown> {
  return {
    id: '__select__',
    size: 40,
    enableSorting: false,
    enableHiding: false,
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected()
            ? true
            : table.getIsSomePageRowsSelected()
            ? 'indeterminate'
            : false
        }
        onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <div onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label="Select row"
        />
      </div>
    ),
  };
}

// ─── Pagination sub-component ─────────────────────────────────────────────────

function TablePagination({
  table,
  totalRows,
}: {
  table: ReturnType<typeof useReactTable<any>>;
  totalRows: number;
}) {
  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = table.getPageCount();
  const from = pageIndex * pageSize + 1;
  const to = Math.min((pageIndex + 1) * pageSize, totalRows);

  // Build a compact pagination range
  const range: (number | '…')[] = [];
  if (pageCount <= 7) {
    for (let i = 0; i < pageCount; i++) range.push(i);
  } else {
    range.push(0);
    if (pageIndex > 2) range.push('…');
    for (let i = Math.max(1, pageIndex - 1); i <= Math.min(pageCount - 2, pageIndex + 1); i++) {
      range.push(i);
    }
    if (pageIndex < pageCount - 3) range.push('…');
    range.push(pageCount - 1);
  }

  return (
    <div className="px-4 py-3 border-t border-border bg-muted/5 flex flex-col sm:flex-row items-center justify-between gap-3">
      <p className="text-xs text-muted-foreground">
        {totalRows === 0
          ? 'No results'
          : `${from}–${to} of ${totalRows} rows`}
      </p>

      {pageCount > 1 && (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => table.firstPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>

          {range.map((item, idx) =>
            item === '…' ? (
              <span
                key={`ellipsis-${idx}`}
                className="h-7 w-7 flex items-center justify-center text-xs text-muted-foreground"
              >
                …
              </span>
            ) : (
              <Button
                key={item}
                variant={pageIndex === item ? 'default' : 'ghost'}
                size="icon"
                className={cn(
                  'h-7 w-7 text-xs font-bold',
                  pageIndex === item
                    ? 'bg-primary text-primary-foreground pointer-events-none shadow-sm'
                    : 'text-muted-foreground',
                )}
                onClick={() => table.setPageIndex(item as number)}
              >
                {(item as number) + 1}
              </Button>
            ),
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => table.lastPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Main DataTable ───────────────────────────────────────────────────────────

export function DataTable<TData>({
  columns,
  data,
  toolbarLeft,
  toolbarRight,
  selectionActions,
  enableRowSelection = false,
  onRowSelectionChange,
  onRowClick,
  rowClassName,
  paginationMode = 'client',
  pageSize: initialPageSize = 10,
  pageIndex: externalPageIndex = 0,
  pageCount: externalPageCount,
  onPaginationChange,
  pageSizeOptions = [10, 25, 50],
  totalRowCount,
  isLoading = false,
  loadingRows = 5,
  emptyIcon,
  emptyTitle = 'No results',
  emptyDescription,
  emptyAction,
  className,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: paginationMode === 'server' ? externalPageIndex : 0,
    pageSize: initialPageSize,
  });

  // Sync external page index for server-side mode
  React.useEffect(() => {
    if (paginationMode === 'server') {
      setPagination((p) => ({ ...p, pageIndex: externalPageIndex }));
    }
  }, [externalPageIndex, paginationMode]);

  // Keep a stable ref to the latest callback so it never needs to be a dep
  const onRowSelectionChangeRef = React.useRef(onRowSelectionChange);
  React.useLayoutEffect(() => {
    onRowSelectionChangeRef.current = onRowSelectionChange;
  });

  // Notify parent of selection changes — only when rowSelection state actually changes
  React.useEffect(() => {
    if (!onRowSelectionChangeRef.current) return;
    const selectedRows = Object.keys(rowSelection)
      .filter((k) => rowSelection[k])
      .map((k) => data[Number(k)])
      .filter(Boolean);
    onRowSelectionChangeRef.current(selectedRows);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowSelection]); // intentionally omit `data` and `onRowSelectionChange` to avoid infinite loop

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, rowSelection, pagination },
    manualPagination: paginationMode === 'server',
    pageCount: paginationMode === 'server' ? (externalPageCount ?? -1) : undefined,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: (updater) => {
      const next =
        typeof updater === 'function' ? updater(pagination) : updater;
      setPagination(next);
      if (paginationMode === 'server') onPaginationChange?.(next);
    },
    enableRowSelection,
  });

  const selectedRows = table
    .getSelectedRowModel()
    .rows.map((r) => r.original);
  const hasSelection = selectedRows.length > 0;

  // Total rows for pagination display
  const totalRows =
    totalRowCount ??
    (paginationMode === 'server'
      ? (externalPageCount ?? 0) * pagination.pageSize
      : table.getFilteredRowModel().rows.length);

  return (
    <div className={cn('surface overflow-hidden', className)}>
      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      {(toolbarLeft || toolbarRight || selectionActions) && (
        <div className="px-5 py-4 border-b border-border bg-muted/5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Left slot — replaced by selection actions when rows are selected */}
            <div className="flex items-center gap-4 min-w-0">
              {hasSelection && selectionActions ? (
                <div className="flex items-center gap-2 animate-in slide-in-from-left-2 duration-200">
                  {selectionActions(selectedRows)}
                </div>
              ) : (
                toolbarLeft
              )}
            </div>
            {/* Right slot */}
            {toolbarRight && (
              <div className="flex items-center gap-2 flex-wrap shrink-0">
                {toolbarRight}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────────────── */}
      {isLoading ? (
        /* Loading skeleton */
        <div className="p-4 space-y-2">
          {Array.from({ length: loadingRows }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : table.getRowModel().rows.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-20 text-center px-4">
          {emptyIcon && (
            <div className="h-14 w-14 bg-muted/40 rounded-lg flex items-center justify-center mb-4 text-muted-foreground/40">
              {emptyIcon}
            </div>
          )}
          <h3 className="text-sm font-semibold text-foreground">{emptyTitle}</h3>
          {emptyDescription && (
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">{emptyDescription}</p>
          )}
          {emptyAction && <div className="mt-4">{emptyAction}</div>}
        </div>
      ) : (
        /* Real table */
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="bg-muted/20 hover:bg-muted/20 border-b border-border"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="h-9 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap"
                    style={{
                      ...(header.column.id === '__select__'
                        ? { paddingLeft: '2rem', paddingRight: '0.5rem' }
                        : { paddingLeft: '1rem', paddingRight: '1rem' }),
                      ...(header.column.getSize() !== 150 ? { width: header.column.getSize() } : {}),
                    }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() ? 'selected' : undefined}
                className={cn(
                  'border-b border-border transition-colors',
                  onRowClick && 'cursor-pointer',
                  row.getIsSelected() && 'bg-primary/[0.03]',
                  rowClassName?.(row.original),
                )}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className="py-3 align-middle"
                    style={{
                      ...(cell.column.id === '__select__'
                        ? { paddingLeft: '2rem', paddingRight: '0.5rem' }
                        : { paddingLeft: '1rem', paddingRight: '1rem' }),
                      ...(cell.column.getSize() !== 150 ? { width: cell.column.getSize() } : {}),
                    }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* ── Pagination ───────────────────────────────────────────────── */}
      {!isLoading && table.getRowModel().rows.length > 0 && (
        <TablePagination table={table} totalRows={totalRows} />
      )}
    </div>
  );
}
