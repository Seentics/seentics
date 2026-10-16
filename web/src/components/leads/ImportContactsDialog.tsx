'use client';

import { useMemo, useRef, useState } from 'react';
import { FileUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useImportContacts } from '@/features/leads/mutations';
import type { ImportResult } from '@/features/leads/types';
import { guessMapping, IMPORT_FIELDS, parseCsv, prepareImport, type ColumnMapping, type ImportField } from '@/lib/leads-csv';

const NONE = '-1';
const FIELD_LABEL: Record<ImportField, string> = { email: 'Email', name: 'Name', phone: 'Phone', status: 'Status', tags: 'Tags', notes: 'Notes' };
/** Larger files are better split, and the browser stays responsive while parsing. */
const MAX_BYTES = 10 * 1024 * 1024;

type Parsed = { file: string; headers: string[]; rows: string[][] };

/**
 * Importing a spreadsheet of contacts: choose a CSV, check which column is which (guessed from
 * the headers), see what will be imported, then send it. Rows without a usable email are listed
 * rather than silently dropped; an email that is already a contact is skipped unless updating
 * is ticked.
 */
export function ImportContactsDialog({ websiteId, open, onOpenChange }: { websiteId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const run = useImportContacts(websiteId);

  const prepared = useMemo(() => (parsed && mapping ? prepareImport(parsed.rows, mapping) : null), [parsed, mapping]);

  const reset = () => { setParsed(null); setMapping(null); setError(null); setResult(null); setUpdateExisting(false); run.reset(); };
  const close = (o: boolean) => { onOpenChange(o); if (!o) reset(); };

  const read = async (file: File) => {
    setError(null);
    if (file.size > MAX_BYTES) { setError('That file is over 10 MB. Split it into smaller files and import each.'); return; }
    const all = parseCsv(await file.text());
    if (all.length < 2) { setError('That file has no rows under its header row.'); return; }
    const [headers, ...rows] = all;
    setParsed({ file: file.name, headers: headers!.map((h) => h.trim()), rows });
    setMapping(guessMapping(headers!, rows.slice(0, 20)));
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import contacts</DialogTitle>
          <DialogDescription>A CSV with one contact per row and a header row. Email is required; name, phone, status, tags and notes are optional.</DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-3 divide-x divide-border rounded-lg border border-border text-center">
              {([['Added', result.created], ['Updated', result.updated], ['Skipped', result.skipped]] as const).map(([label, n]) => (
                <div key={label} className="px-3 py-3"><p className="text-xl font-semibold tabular-nums">{n.toLocaleString()}</p><p className="text-xs text-muted-foreground">{label}</p></div>
              ))}
            </div>
            {result.skipped > 0 && !updateExisting && <p className="text-xs text-muted-foreground">Skipped rows are emails that were already contacts. Import again with “Update existing contacts” to change them.</p>}
            <RowErrors errors={[...(prepared?.invalid ?? []), ...result.errors]} />
            <DialogFooter><Button onClick={() => close(false)}>Done</Button></DialogFooter>
          </div>
        ) : !parsed || !mapping ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-6 py-10 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
            >
              <FileUp className="h-5 w-5" />
              Choose a CSV file
              <span className="text-xs">Exported from a spreadsheet, Mailchimp, HubSpot or another tool</span>
            </button>
            <input ref={input} type="file" accept=".csv,text/csv" className="sr-only" aria-label="CSV file" onChange={(e) => { const f = e.target.files?.[0]; if (f) void read(f); e.target.value = ''; }} />
            {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{parsed.file}</span> · {parsed.rows.length.toLocaleString()} rows.{' '}
              <button type="button" className="underline" onClick={reset}>Choose another file</button>
            </p>

            <div className="grid gap-3 sm:grid-cols-3">
              {IMPORT_FIELDS.map((field) => (
                <div key={field} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{FIELD_LABEL[field]}{field === 'email' ? ' (required)' : ''}</Label>
                  <Select value={String(mapping[field])} onValueChange={(v) => setMapping({ ...mapping, [field]: Number(v) })}>
                    <SelectTrigger className="h-8 text-xs" aria-label={`Column for ${FIELD_LABEL[field]}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE} className="text-xs">Don’t import</SelectItem>
                      {parsed.headers.map((h, i) => <SelectItem key={i} value={String(i)} className="text-xs">{h || `Column ${i + 1}`}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {mapping.email < 0 ? (
              <p className="text-xs text-destructive" role="alert">Pick the column that holds email addresses.</p>
            ) : prepared && (
              <>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full min-w-[520px] text-xs">
                    <thead><tr className="text-left text-muted-foreground">{IMPORT_FIELDS.map((f) => <th key={f} className="px-3 py-2 font-medium">{FIELD_LABEL[f]}</th>)}</tr></thead>
                    <tbody>
                      {prepared.rows.slice(0, 5).map((r) => (
                        <tr key={r.email} className="border-t border-border">
                          <td className="max-w-[180px] truncate px-3 py-2 font-medium">{r.email}</td>
                          <td className="max-w-[120px] truncate px-3 py-2">{r.name ?? ''}</td>
                          <td className="px-3 py-2">{r.phone ?? ''}</td>
                          <td className="px-3 py-2">{r.status ?? ''}</td>
                          <td className="max-w-[120px] truncate px-3 py-2">{r.tags?.join(', ') ?? ''}</td>
                          <td className="max-w-[160px] truncate px-3 py-2">{r.notes ?? ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground">
                  {prepared.rows.length.toLocaleString()} contact{prepared.rows.length === 1 ? '' : 's'} to import
                  {prepared.duplicates ? ` · ${prepared.duplicates} repeated email${prepared.duplicates === 1 ? '' : 's'} left out` : ''}
                  {prepared.invalid.length ? ` · ${prepared.invalid.length} row${prepared.invalid.length === 1 ? '' : 's'} without a usable email` : ''}
                </p>
                <RowErrors errors={prepared.invalid} />
              </>
            )}

            <Label className="flex items-start gap-2.5 text-sm font-normal">
              <Checkbox checked={updateExisting} onCheckedChange={(v) => setUpdateExisting(!!v)} className="mt-0.5" />
              <span>Update existing contacts<span className="block text-xs text-muted-foreground">Fill in their name, phone, status, tags and notes from this file. Otherwise emails that are already contacts are skipped.</span></span>
            </Label>
            {run.isError && <p className="text-xs text-destructive" role="alert">The import stopped part-way. Contacts already sent were saved; import the file again to finish (tick “Update existing contacts”).</p>}

            <DialogFooter>
              <Button variant="outline" onClick={() => close(false)}>Cancel</Button>
              <Button
                disabled={!prepared || prepared.rows.length === 0 || mapping.email < 0 || run.isPending}
                onClick={() => prepared && run.mutate({ rows: prepared.rows, updateExisting }, { onSuccess: setResult })}
              >
                {run.isPending ? 'Importing…' : `Import ${prepared?.rows.length.toLocaleString() ?? ''}`}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RowErrors({ errors }: { errors: { row: number; reason: string }[] }) {
  if (errors.length === 0) return null;
  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-muted-foreground">{errors.length} row{errors.length === 1 ? '' : 's'} not imported</summary>
      <ul className="mt-2 max-h-40 space-y-0.5 overflow-y-auto pl-4 text-muted-foreground">
        {errors.slice(0, 200).map((e) => <li key={`${e.row}-${e.reason}`}>Row {e.row}: {e.reason}</li>)}
      </ul>
    </details>
  );
}
