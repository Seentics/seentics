import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Play, Monitor, Clock, Globe, Zap, ChevronRight } from 'lucide-react';
import { useSeentics } from '../context';
import { Skeleton, Card, Empty } from '../lib/ui';
import { fmt, t } from '../lib/utils';
import type { ReplaySession, RRWebEvent } from '../lib/types';

export interface SessionReplayPlayerProps {
  siteId:     string;
  sessionId?: string; // if omitted, shows session list
  className?: string;
  style?:     React.CSSProperties;
}

// Session list view
function SessionList({ siteId, onSelect }: { siteId: string; onSelect: (id: string) => void }) {
  const { client } = useSeentics();

  const { data, isLoading } = useQuery({
    queryKey: ['snc-replays', siteId],
    queryFn:  () => client.getReplays(siteId, 20, 0),
    enabled:  !!siteId,
  });

  const sessions = data?.sessions ?? [];

  if (isLoading) {
    return (
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} style={{ height: 56, borderRadius: 8 }} />)}
      </div>
    );
  }

  if (sessions.length === 0) {
    return <Empty icon={<Play size={32} />} message="No session recordings yet" sub="Recordings will appear once visitors browse your site" />;
  }

  return (
    <div className="snc-scrollbar" style={{ maxHeight: 440, overflowY: 'auto' }}>
      {sessions.map(session => (
        <button key={session.sessionId} onClick={() => onSelect(session.sessionId)} style={{
          display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left',
          padding: '10px 16px', background: 'transparent', border: 'none',
          borderBottom: `1px solid ${t.border}`, cursor: 'pointer',
          gap: 12, transition: 'background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.02)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <div style={{ width: 36, height: 36, borderRadius: 8, background: `${t.primary}10`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Play size={14} color={t.primary} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: '#111827' }}>{session.browser} · {session.os}</span>
              {session.hasRageClicks && (
                <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 3, background: `${t.rose}15`, color: t.rose }}>Rage clicks</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, fontSize: 11, color: t.muted }}>
              <span>{session.country || 'Unknown'}</span>
              <span>·</span>
              <span>{fmt.duration(session.durationSeconds)}</span>
              <span>·</span>
              <span>{session.pagesViewed} page{session.pagesViewed !== 1 ? 's' : ''}</span>
            </div>
          </div>
          <div style={{ fontSize: 11, color: t.muted, flexShrink: 0 }}>
            {new Date(session.startedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <ChevronRight size={14} color={t.muted} />
        </button>
      ))}
    </div>
  );
}

// Player view — renders rrweb events using rrweb-player
function Player({ siteId, sessionId, onBack }: { siteId: string; sessionId: string; onBack: () => void }) {
  const { client } = useSeentics();
  const playerRef  = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['snc-replay', siteId, sessionId],
    queryFn:  () => client.getReplay(siteId, sessionId),
    enabled:  !!siteId && !!sessionId,
  });

  // Flatten chunks into rrweb event stream
  const events: RRWebEvent[] = (data?.chunks ?? []).flatMap((c: any) => {
    if (!Array.isArray(c.data)) return [];
    return c.data.map((item: any) => {
      if (item?.type === 'rrweb' && item.data) {
        const inner = item.data;
        return { ...inner, type: +inner.type, timestamp: +inner.timestamp } as RRWebEvent;
      }
      const type = +item?.type, ts = +(item?.timestamp || item?.ts);
      if (!isNaN(type) && !isNaN(ts)) return { ...item, type, timestamp: ts } as RRWebEvent;
      return null;
    }).filter(Boolean);
  }).sort((a: RRWebEvent, b: RRWebEvent) => a.timestamp - b.timestamp);

  // Mount rrweb-player once events are ready
  useEffect(() => {
    if (!playerRef.current || !events.length) return;
    let player: any;
    import('rrweb-player').then(({ default: RRWebPlayer }) => {
      if (!playerRef.current) return;
      playerRef.current.innerHTML = '';
      player = new RRWebPlayer({
        target: playerRef.current,
        props: {
          events,
          width:  playerRef.current.clientWidth || 800,
          height: 480,
          autoPlay: false,
        },
      });
    }).catch(() => {
      if (playerRef.current) {
        playerRef.current.innerHTML = '<p style="padding:24px;color:#6b7280;font-size:13px">rrweb-player not installed. Run: npm install rrweb-player</p>';
      }
    });
    return () => { try { player?.$destroy(); } catch { /* ignore */ } };
  }, [events.length]);

  const meta = data?.meta as ReplaySession | undefined;

  return (
    <div>
      {/* Back + meta bar */}
      <div style={{ padding: '10px 16px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button onClick={onBack} style={{ background: 'none', border: `1px solid ${t.border}`, borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: '#111827' }}>
          ← Back
        </button>
        {meta && (
          <>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: t.muted }}><Monitor size={12} /> {meta.browser} · {meta.device}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: t.muted }}><Globe size={12} /> {meta.country || 'Unknown'}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: t.muted }}><Clock size={12} /> {fmt.duration(meta.durationSeconds)}</span>
            {meta.hasRageClicks && (
              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: `${t.rose}15`, color: t.rose, display: 'flex', alignItems: 'center', gap: 3 }}>
                <Zap size={10} /> Rage clicks
              </span>
            )}
          </>
        )}
      </div>

      {/* Player mount point */}
      <div style={{ background: '#1a1a1a', minHeight: 480, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {isLoading
          ? <Skeleton style={{ width: '100%', height: 480, borderRadius: 0, background: '#2a2a2a' }} />
          : events.length === 0
            ? <span style={{ color: '#666', fontSize: 13 }}>No recording events found</span>
            : <div ref={playerRef} style={{ width: '100%' }} />
        }
      </div>
    </div>
  );
}

export function SessionReplayPlayer({ siteId, sessionId: initialSession, className, style }: SessionReplayPlayerProps) {
  const [selected, setSelected] = useState<string | undefined>(initialSession);

  return (
    <Card className={className} style={style}>
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Play size={15} color={t.muted} />
        <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Session Replays</span>
      </div>

      {selected
        ? <Player siteId={siteId} sessionId={selected} onBack={() => setSelected(undefined)} />
        : <SessionList siteId={siteId} onSelect={setSelected} />
      }
    </Card>
  );
}
