'use client';

/**
 * Connect a platform (credentials, then which events to send), or change one part of an existing
 * destination: its credentials, or its events.
 *
 * The server checks the credentials with the platform before saving, so a typo is caught here,
 * with the platform's own message, rather than as failed deliveries later.
 */
import Link from 'next/link';
import { SeenticsOnly } from '@/components/seentics-only';
import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConnectError } from '@/features/conversions/api';
import { useConnectDestination, useUpdateDestination } from '@/features/conversions/mutations';
import type { Credentials, Destination, DestinationConfig, Platform } from '@/features/conversions/types';
import { isLinkedinId, isMeasurementId, isPixelId, isTiktokPixel, PLATFORMS } from './conversion-format';
import { cleanConfig, defaultConfig, EventMappingFields } from './EventMappingFields';
import { useT } from '@/lib/i18n';
import { PlatformMark } from './parts';

export type ConnectMode =
  | { kind: 'connect'; platform: Platform }
  | { kind: 'credentials'; destination: Destination }
  | { kind: 'events'; destination: Destination };

type Fields = { a: string; b: string };

function credentialsOf(platform: Platform, f: Fields): Credentials {
  const a = f.a.trim();
  const b = f.b.trim();
  if (platform === 'meta') return { pixel_id: a, access_token: b };
  if (platform === 'ga4') return { measurement_id: a.toUpperCase(), api_secret: b };
  if (platform === 'tiktok') return { pixel_code: a.toUpperCase(), access_token: b };
  return { ad_account_id: a, access_token: b };
}

const ID_VALID: Record<Platform, (v: string) => boolean> = {
  meta: isPixelId, ga4: isMeasurementId, tiktok: isTiktokPixel, linkedin: isLinkedinId,
};

function fieldsValid(platform: Platform, f: Fields): boolean {
  return !!f.b.trim() && ID_VALID[platform](f.a);
}

export function ConnectDialog({
  websiteId, mode, onClose,
}: { websiteId: string; mode: ConnectMode | null; onClose: () => void }) {
  const all = useT();
  const t = all.conversions.connect;
  const connect = useConnectDestination(websiteId);
  const update = useUpdateDestination(websiteId);
  const platform: Platform | null = mode ? (mode.kind === 'connect' ? mode.platform : mode.destination.platform) : null;

  const [step, setStep] = useState<'credentials' | 'events'>('credentials');
  const [fields, setFields] = useState<Fields>({ a: '', b: '' });
  const [config, setConfig] = useState<DestinationConfig | null>(null);
  const [problem, setProblem] = useState<{ reason: ConnectError['reason']; message: string } | null>(null);

  useEffect(() => {
    if (!mode || !platform) return;
    setProblem(null);
    setFields({ a: '', b: '' });
    setStep(mode.kind === 'events' ? 'events' : 'credentials');
    setConfig(mode.kind === 'connect' ? defaultConfig(platform) : { ...mode.destination.config, custom: [...mode.destination.config.custom] });
  }, [mode, platform]);

  if (!mode || !platform || !config) return null;
  const info = PLATFORMS[platform];
  const copy = t.fields[platform];
  const busy = connect.isPending || update.isPending;

  const fail = (err: unknown) => {
    if (err instanceof ConnectError) {
      const message = err.reason === 'exists' ? t.exists : err.reason === 'limit' ? t.limit : err.message;
      setProblem({ reason: err.reason, message });
    } else toast.error(t.saveFailed);
  };

  const save = () => {
    setProblem(null);
    if (mode.kind === 'connect') {
      connect.mutate(
        { platform, credentials: credentialsOf(platform, fields), config: cleanConfig(platform, config) },
        { onSuccess: (d) => { if (d) toast.success(t.connected(info.label)); onClose(); }, onError: (e) => { setStep('credentials'); fail(e); } },
      );
    } else if (mode.kind === 'credentials') {
      update.mutate(
        { id: mode.destination.id, patch: { credentials: credentialsOf(platform, fields) } },
        { onSuccess: (d) => { if (d) toast.success(t.credentialsUpdated); onClose(); }, onError: fail },
      );
    } else {
      update.mutate(
        { id: mode.destination.id, patch: { config: cleanConfig(platform, config) } },
        { onSuccess: (d) => { if (d) toast.success(t.eventsUpdated); onClose(); }, onError: fail },
      );
    }
  };

  const title = mode.kind === 'connect' ? t.connectTitle(info.label) : mode.kind === 'credentials' ? t.credentialsTitle(info.label) : t.eventsTitle(info.label);
  const description = step === 'credentials'
    ? t.credentialsBody(info.label, info.api, copy.secret)
    : platform === 'linkedin' ? t.linkedinBody : t.eventsBody;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <PlatformMark platform={platform} />
            <div className="min-w-0 text-left">
              <DialogTitle>{title}</DialogTitle>
              {mode.kind === 'connect' && <p className="text-xs text-muted-foreground">{t.step(step === 'credentials' ? 1 : 2)}</p>}
            </div>
          </div>
          <DialogDescription className="pt-1">{description}</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (step === 'credentials' && mode.kind === 'connect') { if (fieldsValid(platform, fields)) setStep('events'); return; }
            if (step === 'credentials' && !fieldsValid(platform, fields)) return;
            save();
          }}
        >
          {step === 'credentials' ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="conv-a" className="text-xs text-muted-foreground">{copy.a}</Label>
                <Input
                  id="conv-a"
                  autoFocus
                  value={fields.a}
                  onChange={(e) => { setFields({ ...fields, a: e.target.value }); setProblem(null); }}
                  placeholder={copy.aHint}
                  className="font-mono text-sm"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="conv-b" className="text-xs text-muted-foreground">{copy.b}</Label>
                <Input
                  id="conv-b"
                  type="password"
                  value={fields.b}
                  onChange={(e) => { setFields({ ...fields, b: e.target.value }); setProblem(null); }}
                  placeholder={copy.bHint}
                  className="font-mono text-sm"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground/80">{t.whereToFind}</span> {copy.where}
              </p>
            </div>
          ) : (
            <div className="max-h-[50vh] overflow-y-auto pr-1">
              <EventMappingFields platform={platform} value={config} onChange={setConfig} disabled={busy} />
            </div>
          )}

          {problem && (
            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {problem.message}
              {problem.reason === 'limit' && (
                <SeenticsOnly><> <Link href="/pricing" className="font-medium underline">{t.seePlans}</Link>{t.orDisconnect}</></SeenticsOnly>
              )}
            </p>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            {mode.kind === 'connect' && step === 'events' ? (
              <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={() => setStep('credentials')} disabled={busy}>
                <ArrowLeft className="h-3.5 w-3.5" />{all.actions.back}
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={busy}>{all.actions.cancel}</Button>
              <Button type="submit" size="sm" disabled={busy || (step === 'credentials' && !fieldsValid(platform, fields))}>
                {mode.kind === 'connect' && step === 'credentials' ? all.actions.continue : mode.kind === 'connect' ? (busy ? t.connecting : t.connect) : busy ? all.actions.saving : all.actions.save}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
