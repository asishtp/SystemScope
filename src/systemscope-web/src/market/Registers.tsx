import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../landscape/api';
import { formatDate, readinessLabel, type AssessmentRow, type MasterRow, type SearchHit } from './types';
import './market.css';

export function SystemsView({ onOpen }: { onOpen: (key: string) => void }) {
  const [rows, setRows] = useState<MasterRow[]>([]);
  const [q, setQ] = useState('');
  useEffect(() => { api<MasterRow[]>('/scan/systems').then(setRows); }, []);
  const shown = rows.filter(r => `${r.name} ${r.acronym} ${r.tags}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <section className="panel">
      <div className="panel-title"><div><h2>Systems register</h2><p>One reusable record per system. A system can belong to multiple assessment projects.</p></div></div>
      <div className="filters"><input placeholder="Search systems, technologies, tags…" value={q} onChange={e => setQ(e.target.value)} /></div>
      {shown.map(r => (
        <button className="system-row" key={r.id} onClick={() => onOpen(r.catalogKey || r.acronym.toLowerCase())}>
          <span className="system-icon">▣</span>
          <span><b>{r.name} {r.acronym && `(${r.acronym})`}</b><small>{r.description || 'No description'} · {r.technicalOwner || 'No technical owner'}</small></span>
          <span>{r.lifecycle}</span>
          <span>{r.informationCompleteness}% complete</span>
        </button>
      ))}
      {!shown.length && <div className="empty"><p>No systems in the register yet.</p></div>}
    </section>
  );
}

export function AssessmentsView({ onOpen }: { onOpen: (key: string, systemId: string) => void }) {
  const [rows, setRows] = useState<AssessmentRow[]>([]);
  useEffect(() => { api<AssessmentRow[]>('/scan/assessments').then(setRows); }, []);
  return (
    <section className="panel">
      <div className="panel-title"><div><h2>Assessments</h2><p>Six-domain market-scan workspace with completeness, validation and document readiness.</p></div></div>
      {rows.map(r => (
        <button className="project-row" key={r.id} onClick={() => onOpen(r.catalogKey || r.assessedSystemId, r.assessedSystemId)}>
          <span className="project-badge">{(r.acronym || r.systemName || 'SY').slice(0, 2).toUpperCase()}</span>
          <span><b>{r.systemName}</b><small>{r.projectName} · {r.technicalOwner || 'Unassigned'} · {r.openGaps} open gaps</small></span>
          <span className="status">{r.informationCompleteness}% · {readinessLabel(r.documentReadiness)}</span>
          <span>›</span>
        </button>
      ))}
      {!rows.length && <div className="empty"><p>No assessments yet. Add systems to a market-scan project.</p></div>}
    </section>
  );
}

export function IntegrationsView() {
  const [rows, setRows] = useState<{ id: string; name: string; systemName: string; sourceSystem: string; target: string; method: string; state: string; validation: string; owner: string; criticality: string }[]>([]);
  const [q, setQ] = useState('');
  useEffect(() => { api<typeof rows>('/scan/integrations').then(setRows); }, []);
  const shown = rows.filter(r => `${r.name} ${r.systemName} ${r.target} ${r.method}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <section className="panel">
      <div className="panel-title"><div><h2>Integration catalogue</h2><p>Current-state, future-state, suspected and retired interfaces. Future-state records are never presented as current facts.</p></div></div>
      <div className="filters"><input placeholder="Filter by system, target or method…" value={q} onChange={e => setQ(e.target.value)} /></div>
      {shown.map(r => (
        <div className="register-row" key={r.id}>
          <span><b>{r.name}</b></span>
          <span>{r.systemName}</span>
          <span>{r.sourceSystem} → {r.target}</span>
          <span>{r.method}</span>
          <span>{r.state}</span>
          <span>{r.validation}</span>
        </div>
      ))}
      {!shown.length && <div className="empty"><p>No integrations recorded.</p></div>}
    </section>
  );
}

export function DocumentsView() {
  const [rows, setRows] = useState<{ id: string; title: string; audience: string; assessmentVersion: string; status: string; createdAt: string; generatedBy: string; warnings: string }[]>([]);
  useEffect(() => { api<typeof rows>('/documents').then(setRows); }, []);
  return (
    <section className="panel">
      <div className="panel-title"><div><h2>Generated documents</h2><p>Immutable snapshots. Regeneration is allowed after approved information changes.</p></div></div>
      {rows.map(r => (
        <div className="register-row" key={r.id}>
          <span><b>{r.title}</b></span>
          <span>{r.audience}</span>
          <span>{r.assessmentVersion}</span>
          <span>{formatDate(r.createdAt)}</span>
          <span>{r.status}</span>
          <span><a href={`/api/documents/${r.id}/file`}>Download</a></span>
        </div>
      ))}
      {!rows.length && <div className="empty"><p>No documents generated yet. Open an assessment and choose Generate document.</p></div>}
    </section>
  );
}

export function SearchOverlay({ onClose, onOpenSystem, onOpenDocument }: { onClose: () => void; onOpenSystem: (key: string) => void; onOpenDocument?: (key: string) => void }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    const handle = window.setTimeout(() => {
      api<SearchHit[]>(`/search?q=${encodeURIComponent(q)}`).then(setHits).catch(() => setHits([]));
    }, 200);
    return () => window.clearTimeout(handle);
  }, [q]);
  return (
    <div className="overlay" onMouseDown={onClose}>
      <dialog className="search-dialog" open onMouseDown={e => e.stopPropagation()}>
        <form onSubmit={(e: FormEvent) => e.preventDefault()}>
          <h2>Search records</h2>
          <p>Systems, technologies, integrations, findings, gaps, published documents and evidence-backed facts.</p>
          <input autoFocus placeholder="Which systems use Oracle Forms?" value={q} onChange={e => setQ(e.target.value)} />
        </form>
        {hits.map(h => (
          <button className="search-hit" key={`${h.type}-${h.id}`} onClick={() => { if (h.type === 'Document' && onOpenDocument) onOpenDocument(h.system); else if (h.type === 'System') onOpenSystem(h.title); onClose(); }}>
            <span className="pill">{h.type}</span>
            <span><b>{h.title}</b><small>{h.system} · {h.status}{h.evidence ? ` · ${h.evidence}` : ''}</small></span>
          </button>
        ))}
        {q.length >= 2 && !hits.length && <p className="pad">No matching records.</p>}
      </dialog>
    </div>
  );
}
