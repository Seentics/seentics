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
import { guessMapping, IMPORT_FIELDS, parseCsv, prepareImport, type ColumnMapping } from '@/lib/leads-csv';
import { useT } from '@/lib/i18n';

const NONE = '-1';
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
  const all = useT();
  const FIELD_LABEL = all.leads.fields;
  const t = all.leads.import;
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
    if (file.size > MAX_BYTES) { setError(t.tooBig); return; }
    const all = parseCsv(await file.text());
    if (all.length < 2) { setError(t.noRows); return; }
    const [headers, ...rows] = all;
    setParsed({ file: file.name, headers: headers!.map((h) => h.trim()), rows });
    setMapping(guessMapping(headers!, rows.slice(0, 20)));
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-3 divide-x divide-border rounded-lg border border-border text-center">
              {([[t.added, result.created], [t.updated, result.updated], [t.skipped, result.skipped]] as const).map(([label, n]) => (
                <div key={label} className="px-3 py-3"><p className="text-xl font-semibold tabular-nums">{n.toLocaleString()}</p><p className="text-xs text-muted-foreground">{label}</p></div>
              ))}
            </div>
            {result.skipped > 0 && !updateExisting && <p className="text-xs text-muted-foreground">{t.skippedHint}</p>}
            <RowErrors errors={[...(prepared?.invalid ?? []), ...result.errors]} />
            <DialogFooter><Button onClick={() => close(false)}>{all.actions.done}</Button></DialogFooter>
          </div>
        ) : !parsed || !mapping ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-6 py-10 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
            >
              <FileUp className="h-5 w-5" />
              {t.choose}
              <span className="text-xs">{t.chooseHint}</span>
            </button>
            <input ref={input} type="file" accept=".csv,text/csv" className="sr-only" aria-label={t.csvFile} onChange={(e) => { const f = e.target.files?.[0]; if (f) void read(f); e.target.value = ''; }} />
            {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{parsed.file}</span> · {t.rows(parsed.rows.length.toLocaleString())}{' '}
              <button type="button" className="underline" onClick={reset}>{t.chooseAnother}</button>
            </p>

            <div className="grid gap-3 sm:grid-cols-3">
              {IMPORT_FIELDS.map((field) => (
                <div key={field} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{FIELD_LABEL[field]}{field === 'email' ? t.required : ''}</Label>
                  <Select value={String(mapping[field])} onValueChange={(v) => setMapping({ ...mapping, [field]: Number(v) })}>
                    <SelectTrigger className="h-8 text-xs" aria-label={t.columnFor(FIELD_LABEL[field])}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE} className="text-xs">{t.dontImport}</SelectItem>
                      {parsed.headers.map((h, i) => <SelectItem key={i} value={String(i)} className="text-xs">{h || t.column(i + 1)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {mapping.email < 0 ? (
              <p className="text-xs text-destructive" role="alert">{t.pickEmail}</p>
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
                  {t.toImport(prepared.rows.length, prepared.rows.length.toLocaleString())}
                  {prepared.duplicates ? t.repeated(prepared.duplicates) : ''}
                  {prepared.invalid.length ? t.invalid(prepared.invalid.length) : ''}
                </p>
                <RowErrors errors={prepared.invalid} />
              </>
            )}

            <Label className="flex items-start gap-2.5 text-sm font-normal">
              <Checkbox checked={updateExisting} onCheckedChange={(v) => setUpdateExisting(!!v)} className="mt-0.5" />
              <span>{t.updateExisting}<span className="block text-xs text-muted-foreground">{t.updateExistingHint}</span></span>
            </Label>
            {run.isError && <p className="text-xs text-destructive" role="alert">{t.stopped}</p>}

            <DialogFooter>
              <Button variant="outline" onClick={() => close(false)}>{all.actions.cancel}</Button>
              <Button
                disabled={!prepared || prepared.rows.length === 0 || mapping.email < 0 || run.isPending}
                onClick={() => prepared && run.mutate({ rows: prepared.rows, updateExisting }, { onSuccess: setResult })}
              >
                {run.isPending ? t.importing : t.submit(prepared?.rows.length.toLocaleString() ?? '')}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RowErrors({ errors }: { errors: { row: number; reason: string }[] }) {
  const t = useT().leads.import;
  if (errors.length === 0) return null;
  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-muted-foreground">{t.notImported(errors.length)}</summary>
      <ul className="mt-2 max-h-40 space-y-0.5 overflow-y-auto pl-4 text-muted-foreground">
        {errors.slice(0, 200).map((e) => <li key={`${e.row}-${e.reason}`}>{t.row(e.row)}: {e.reason}</li>)}
      </ul>
    </details>
  );
}
