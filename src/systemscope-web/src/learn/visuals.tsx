import type { ReactNode } from 'react';

export type GwdbIllustration = 'bore' | 'pipes' | 'casing' | 'strata' | 'pump' | 'samples';

export function GeneratedArt({ kind, label }: { kind: GwdbIllustration; label: string }) {
  return <div className={`lv-generated-art ${kind}`} role="img" aria-label={label} />;
}

export function Info({ children }: { children: ReactNode }) {
  return <div className="lv-info"><span>ℹ</span><p>{children}</p></div>;
}

export function Warn({ children }: { children: ReactNode }) {
  return <div className="lv-warn"><span>⚠</span><p>{children}</p></div>;
}

export function Section({ n, title, children }: { n?: number; title: string; children: ReactNode }) {
  return (
    <section className="lv-section" id={n ? `toc-${n}` : undefined}>
      <h3>{n ? <span className="lv-n">{n}</span> : null}{title}</h3>
      {children}
    </section>
  );
}

export function Table({ headers, rows, accent }: { headers: string[]; rows: (string | ReactNode)[][]; accent?: number }) {
  return (
    <div className="lv-table">
      <table>
        <thead><tr>{headers.map(h => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={accent === i ? 'accent' : undefined}>
              {row.map((cell, j) => <td key={j}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PillRow({ items }: { items: string[] }) {
  return <div className="lv-pills">{items.map(i => <span key={i}>{i}</span>)}</div>;
}

export function BoreArt({ className, water = 58, pipes = 1, pump = false }: { className?: string; water?: number; pipes?: number; pump?: boolean }) {
  const xs = pipes === 1 ? [50] : pipes === 3 ? [28, 50, 72] : [40, 60];
  return (
    <svg className={className} viewBox="0 0 160 180" aria-hidden="true">
      <rect x="0" y="28" width="160" height="12" fill="#7cb342" />
      <rect x="0" y="36" width="160" height="28" fill="#d7b899" />
      <rect x="0" y="64" width="160" height="36" fill="#c4a574" />
      <rect x="0" y="100" width="160" height="80" fill="#a9845b" />
      <rect x="0" y={water} width="160" height={180 - water} fill="#5ba3d9" opacity="0.85" />
      <path d="M0 28c8-6 16-4 24-6s16-8 32-4 20 2 28-2 20 4 32 2 24-4 44 8v6H0z" fill="#8bc34a" />
      {xs.map((x, i) => (
        <g key={i}>
          <rect x={x - 7} y="18" width="14" height={water - 10} fill="#cfd8dc" stroke="#607d8b" strokeWidth="1.5" />
          <rect x={x - 7} y={water - 2} width="14" height={170 - water} fill="#90caf9" stroke="#1565c0" strokeWidth="1.2" />
          <rect x={x - 9} y="14" width="18" height="8" rx="1" fill="#455a64" />
        </g>
      ))}
      {pump && (
        <g>
          <rect x="78" y="8" width="28" height="14" rx="3" fill="#90a4ae" />
          <circle cx="106" cy="15" r="8" fill="#78909c" stroke="#455a64" />
          <path d="M114 15h18" stroke="#1565c0" strokeWidth="2" markerEnd="url(#arr)" />
        </g>
      )}
    </svg>
  );
}

export function CasingArt() {
  return (
    <svg viewBox="0 0 70 200" aria-hidden="true" className="lv-casing-art">
      <rect x="0" y="16" width="70" height="10" fill="#7cb342" />
      <rect x="0" y="26" width="70" height="174" fill="#e0c09a" />
      <rect x="24" y="8" width="22" height="52" fill="#1565c0" stroke="#0d47a1" />
      <rect x="24" y="60" width="22" height="52" fill="#eceff1" stroke="#90a4ae" />
      <rect x="24" y="112" width="22" height="70" fill="#b0bec5" stroke="#607d8b" />
      <line x1="28" y1="118" x2="42" y2="118" stroke="#455a64" strokeWidth="1" />
      <line x1="28" y1="128" x2="42" y2="128" stroke="#455a64" strokeWidth="1" />
      <line x1="28" y1="138" x2="42" y2="138" stroke="#455a64" strokeWidth="1" />
      <line x1="28" y1="148" x2="42" y2="148" stroke="#455a64" strokeWidth="1" />
      <rect x="22" y="4" width="26" height="8" fill="#37474f" />
    </svg>
  );
}

export function StrataArt() {
  return (
    <svg viewBox="0 0 90 200" aria-hidden="true" className="lv-strata-art">
      <rect x="0" y="8" width="90" height="8" fill="#7cb342" />
      <rect x="0" y="16" width="90" height="28" fill="#e8d5b5" />
      <rect x="0" y="44" width="90" height="52" fill="#d2b48c" />
      <rect x="0" y="96" width="90" height="44" fill="#5c9fd6" />
      <rect x="0" y="140" width="90" height="52" fill="#5d5d5d" />
      <rect x="38" y="4" width="14" height="188" fill="#cfd8dc" stroke="#607d8b" />
      <rect x="36" y="0" width="18" height="6" fill="#37474f" />
    </svg>
  );
}

export function BottleArt() {
  return (
    <svg viewBox="0 0 64 80" aria-hidden="true"><rect x="24" y="4" width="16" height="10" rx="2" fill="#90caf9" /><rect x="16" y="14" width="32" height="58" rx="8" fill="#bbdefb" stroke="#1565c0" /><rect x="18" y="36" width="28" height="32" rx="6" fill="#64b5f6" opacity="0.8" /></svg>
  );
}

export function FlaskArt() {
  return (
    <svg viewBox="0 0 64 80" aria-hidden="true"><path d="M24 8h16v18l14 42a10 10 0 01-9 14H19a10 10 0 01-9-14l14-42z" fill="#e3f2fd" stroke="#1565c0" /><path d="M20 52h24l4 12H16z" fill="#42a5f5" /></svg>
  );
}

export function ReportArt() {
  return (
    <svg viewBox="0 0 64 80" aria-hidden="true"><rect x="12" y="6" width="40" height="68" rx="3" fill="#fff" stroke="#90a4ae" /><path d="M20 20h24M20 28h24M20 36h16" stroke="#90a4ae" /><rect x="20" y="46" width="8" height="16" fill="#42a5f5" /><rect x="30" y="52" width="8" height="10" fill="#1e88e5" /><rect x="40" y="42" width="8" height="20" fill="#1565c0" /></svg>
  );
}
