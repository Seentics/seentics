import React, { useState } from 'react';
import { t } from './utils';

// ─── Skeleton ─────────────────────────────────────────────────────────────────
export function Skeleton({ style }: { style?: React.CSSProperties }) {
  return (
    <div style={{
      borderRadius: 4,
      background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 37%,#f0f0f0 63%)',
      backgroundSize: '400% 100%',
      animation: 'snc-shimmer 1.4s ease infinite',
      minHeight: 12,
      ...style,
    }} />
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
export function Card({ children, style, className }: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) {
  return (
    <div className={className} style={{ ...t.card, ...style }}>
      {children}
    </div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────
export function Empty({ icon, message, sub }: { icon?: React.ReactNode; message: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 16px', color: t.muted }}>
      {icon && <div style={{ marginBottom: 12, opacity: 0.3 }}>{icon}</div>}
      <p style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>{message}</p>
      {sub && <p style={{ fontSize: 12, margin: '4px 0 0', opacity: 0.6 }}>{sub}</p>}
    </div>
  );
}

// ─── Growth badge ─────────────────────────────────────────────────────────────
export function GrowthBadge({ current, previous, inverse = false }: { current: number; previous: number; inverse?: boolean }) {
  if (previous === 0) {
    if (current > 0) return <Badge color={t.emerald} label="New" />;
    return <span style={{ fontSize: 10, color: t.muted, opacity: 0.4 }}>—</span>;
  }
  const pct  = ((current - previous) / previous) * 100;
  const clamped = Math.max(-100, Math.min(999, pct));
  const isGood  = inverse ? pct < 0 : pct > 0;
  const color   = isGood ? t.emerald : t.rose;
  const arrow   = isGood ? '↑' : '↓';
  const label   = `${arrow} ${Math.abs(clamped) >= 999 ? '999+' : Math.abs(clamped).toFixed(1)}%`;
  return <Badge color={color} label={label} />;
}

function Badge({ color, label }: { color: string; label: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 2,
      fontSize: 10, fontWeight: 600, padding: '2px 6px',
      borderRadius: 4, background: color + '1a', color,
    }}>
      {label}
    </span>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
export function Tabs({ tabs, active, onChange }: {
  tabs: string[]; active: string; onChange: (t: string) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '0 16px', borderBottom: `1px solid ${t.border}` }}>
      {tabs.map(tab => (
        <button key={tab} onClick={() => onChange(tab)} style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: '8px 12px',
          fontSize: 12, fontWeight: 500, color: active === tab ? t.primary : t.muted,
          borderBottom: active === tab ? `2px solid ${t.primary}` : '2px solid transparent',
          marginBottom: -1,
        }}>
          {tab}
        </button>
      ))}
    </div>
  );
}

// ─── Bar row ──────────────────────────────────────────────────────────────────
export function BarRow({ label, value, max, right, onClick }: {
  label: React.ReactNode; value: number; max: number;
  right?: React.ReactNode; onClick?: () => void;
}) {
  const [hover, setHover] = useState(false);
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '8px 12px',
        borderBottom: `1px solid ${t.border}`,
        cursor: onClick ? 'pointer' : 'default',
        background: hover ? 'rgba(0,0,0,0.02)' : 'transparent',
        transition: 'background 0.15s',
      }}
    >
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: `${pct}%`, background: `${t.primary}08`,
        borderRadius: '0 4px 4px 0',
      }} />
      <div style={{ position: 'relative', flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        {label}
      </div>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        {right}
      </div>
    </div>
  );
}

// ─── Global keyframes (injected once) ────────────────────────────────────────
let _injected = false;
export function injectStyles() {
  if (_injected || typeof document === 'undefined') return;
  _injected = true;
  const el = document.createElement('style');
  el.textContent = `
    @keyframes snc-shimmer { 0%{background-position:100% 50%} 100%{background-position:0 50%} }
    @keyframes snc-ping { 75%,100%{transform:scale(2);opacity:0} }
    @keyframes snc-pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
    .snc-scrollbar::-webkit-scrollbar { width:4px }
    .snc-scrollbar::-webkit-scrollbar-track { background:transparent }
    .snc-scrollbar::-webkit-scrollbar-thumb { background:rgba(0,0,0,0.1);border-radius:4px }
  `;
  document.head.appendChild(el);
}
