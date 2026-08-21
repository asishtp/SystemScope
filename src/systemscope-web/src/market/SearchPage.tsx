import { useEffect, useMemo, useState } from 'react';
import { api } from '../landscape/api';
import { formatDate, pillClass } from './types';
import './market.css';

type Hit = {
  id: string;
  projectId: string;
  type: string;
  title: string;
  detail: string;
  system: string;
  status: string;
  evidence: string;
  catalogKey: string;
  badges: string[];
  completeness?: number;
  updatedAt?: string;
};

type Page = {
  query: string;
  total: number;
  tookMs: number;
  facets: { systems: number; assessments: number; findings: number; evidence: number; documents: number; integrations: number };
  insights: { systems: number; names: string[]; summary: string; architecture: number; evidence: number; documents: number; integrations: number };
  related: string[];
  saved: string[];
  results: Hit[];
};

function highlight(text: string, q: string) {
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return text;
  return <>{text.slice(0, idx)}<mark>{text.slice(idx, idx + q.length)}</mark>{text.slice(idx + q.length)}</>;
}

export function SearchPage({
  initialQuery,
  onQuery,
  onOpenSystem,
  onOpenAssessment,
  onOpenDocument,
  onOpenPublished,
}: {
  initialQuery?: string;
  onQuery: (q: string) => void;
  onOpenSystem: (key: string) => void;
  onOpenAssessment: (key: string, tab?: string) => void;
  onOpenDocument: (key: string) => void;
  onOpenPublished: (recordId: string) => void;
}) {
  const [q, setQ] = useState(initialQuery || 'oracle forms');
  const [page, setPage] = useState<Page>();
  const [tab, setTab] = useState('All');
  const [inferred, setInferred] = useState(true);
  const [transcript, setTranscript] = useState(true);
  useEffect(() => { setQ(initialQuery || q); }, [initialQuery]);
  useEffect(() => {
    if (q.trim().length < 2) { setPage(undefined); return; }
    const handle = window.setTimeout(() => {
      api<Page>(`/search/page?q=${encodeURIComponent(q)}`).then(setPage).catch(() => setPage(undefined));
    }, 180);
    return () => window.clearTimeout(handle);
  }, [q]);
  const facets = page?.facets;
  const results = useMemo(() => {
    const rows = page?.results ?? [];
    if (tab === 'All') return rows;
    const map: Record<string, string> = { Systems: 'System', Assessments: 'Assessment', Findings: 'Finding', Evidence: 'Evidence', Documents: 'Document', Integrations: 'Integration' };
    return rows.filter(r => r.type === map[tab]);
  }, [page, tab]);

  const open = (hit: Hit) => {
    if (hit.type === 'Document') {
      if (hit.status === 'Published' && hit.evidence) onOpenPublished(hit.evidence);
      else onOpenDocument(hit.catalogKey || hit.system);
    } else if (hit.type === 'Assessment') onOpenAssessment(hit.catalogKey || hit.system.toLowerCase());
    else onOpenSystem(hit.catalogKey || hit.system.toLowerCase() || hit.title.toLowerCase());
  };

  const run = (next: string) => { setQ(next); onQuery(next); };

  return (
    <div className="scan search-page">
      <header className="scan-head">
        <div>
          <small>TECHNICAL LANDSCAPE · SEARCH</small>
          <h1>Search SystemScope</h1>
          <p>Find systems, validated facts, evidence, findings, integrations and published assessment documents.</p>
        </div>
        <div className="scan-head-actions">
          <button className="ghost">Saved searches</button>
          <button className="ghost">Search help</button>
        </div>
      </header>
      <form className="search-box" onSubmit={e => { e.preventDefault(); run(q); }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Which systems use Oracle Forms?" />
        <button className="primary" type="submit">Search</button>
      </form>
      <p className="hint try-row">Try: <button className="linkish" onClick={() => run('database version')}>database version</button> · <button className="linkish" onClick={() => run('hosting location')}>hosting location</button> · <button className="linkish" onClick={() => run('WMIP integration')}>WMIP integration</button> · <button className="linkish" onClick={() => run('security controls')}>security controls</button></p>
      {page && <p className="hint">{page.total} results · searched in {(page.tookMs / 1000).toFixed(2)} seconds</p>}

      <div className="search-layout">
        <aside className="search-filters panel">
          <div className="pad-form">
            <h3>Filters</h3>
            <label>Scope<select><option>All projects</option></select></label>
            <label>System<select><option>AQUIS, Groundwater</option></select></label>
            <label>Business area<select><option>Water Monitoring Systems</option></select></label>
            <p className="hint">Content type</p>
            {['Systems', 'Assessments', 'Findings', 'Evidence', 'Documents', 'Integrations'].map(x => (
              <label className="check" key={x}><input type="checkbox" defaultChecked /> {x}</label>
            ))}
            <p className="hint">Validation status</p>
            <label className="check"><input type="checkbox" defaultChecked /> Confirmed</label>
            <label className="check"><input type="checkbox" defaultChecked /> Inferred</label>
            <label className="check"><input type="checkbox" /> Information gap</label>
            <button className="ghost" type="button">Clear filters</button>
          </div>
          <div className="pad-form">
            <h3>Saved searches</h3>
            {(page?.saved ?? []).map(s => <button className="side-row" key={s} onClick={() => run(s)}>{s}</button>)}
            <button className="ghost compact">Save current search</button>
          </div>
        </aside>
        <section>
          <div className="scan-tabs">
            {[['All', page?.total], ['Systems', facets?.systems], ['Assessments', facets?.assessments], ['Findings', facets?.findings], ['Evidence', facets?.evidence], ['Documents', facets?.documents], ['Integrations', facets?.integrations]].map(([label, n]) => (
              <button key={String(label)} className={tab === label ? 'active' : ''} onClick={() => setTab(String(label))}>{label} {n ?? 0}</button>
            ))}
          </div>
          <div className="panel-title"><div><h2>Search results</h2></div><span className="hint">Relevance</span></div>
          {results.map(hit => (
            <button className="search-result" key={`${hit.type}-${hit.id}`} onClick={() => open(hit)}>
              <small>{hit.type.toUpperCase()}</small>
              <b>{highlight(hit.title, q)}</b>
              <p>{highlight(hit.detail || '', q)}</p>
              <div className="scan-pills">
                {hit.badges?.slice(0, 3).map(b => <span className="pill mute" key={b}>{b}</span>)}
                <span className={pillClass(hit.status)}>{hit.status}</span>
                {hit.completeness != null && <span className="pill">{hit.completeness}% complete</span>}
              </div>
              <small>{hit.system} {hit.updatedAt ? `· Updated ${formatDate(hit.updatedAt)}` : ''}</small>
            </button>
          ))}
          {!results.length && <div className="empty"><p>No matching records. Try Oracle Forms, AQUIS or hosting location.</p></div>}
        </section>
        <aside className="scan-side">
          <section className="panel pad-form">
            <h3>Search insights</h3>
            <strong>{page?.insights.systems ?? 0} systems</strong>
            <p>{page?.insights.summary}</p>
            <div className="insight-bars">
              <p>Architecture <span className="mini-bar"><i style={{ width: '80%' }} /></span></p>
              <p>Database <span className="mini-bar"><i style={{ width: '40%' }} /></span></p>
              <p>Evidence <span className="mini-bar"><i style={{ width: `${Math.min(100, (page?.insights.evidence ?? 0) * 20)}%` }} /></span></p>
              <p>Documents <span className="mini-bar"><i style={{ width: `${Math.min(100, (page?.insights.documents ?? 0) * 25)}%` }} /></span></p>
              <p>Integrations <span className="mini-bar"><i style={{ width: `${Math.min(100, (page?.insights.integrations ?? 0) * 40)}%` }} /></span></p>
            </div>
          </section>
          <section className="panel pad-form">
            <h3>Knowledge summary</h3>
            <p>{page?.insights.summary || 'Run a search to summarise matching systems.'}</p>
            <p className="hint">Generated summary — verify against sources.</p>
          </section>
          <section className="panel">
            <div className="panel-title"><div><h2>Related searches</h2></div></div>
            {(page?.related ?? []).map(r => <button className="side-row" key={r} onClick={() => run(r)}>⌕ {r}</button>)}
          </section>
          <section className="panel pad-form">
            <h3>Search controls</h3>
            <label className="check"><input type="checkbox" checked={inferred} onChange={e => setInferred(e.target.checked)} /> Include inferred content</label>
            <label className="check"><input type="checkbox" checked={transcript} onChange={e => setTranscript(e.target.checked)} /> Include transcript evidence</label>
            <label className="check"><input type="checkbox" /> Search restricted metadata</label>
            <p className="hint">Results respect your record-level access.</p>
          </section>
        </aside>
      </div>
      <footer className="docs-foot">
        <span>{page?.total ?? 0} results for ‘{q}’</span>
        <span className="hint">Validation status is shown for every result.</span>
        <button className="ghost">Export results</button>
        <button className="primary">Save search</button>
      </footer>
    </div>
  );
}
