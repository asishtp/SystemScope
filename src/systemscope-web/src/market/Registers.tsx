import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../landscape/api';
import { formatDate, readinessLabel, type AssessmentRow, type MasterRow, type SearchHit } from './types';
import './market.css';

const SYSTEM_TECH: Record<string, string[]> = {
  aquis: ['Oracle Forms'],
  bls: ['SIR', 'OGIA', 'Groundwater DB', 'Spatial'],
  gwdb: ['Oracle Forms', 'GWPlot', 'Drill Log'],
  wasp: ['Power BI', 'Hydstra', 'DES Storage'],
  gauges: ['Time-series Network'],
  wfieldapp: ['Mobile App'],
  hydstra: ['Hydstra', 'Hydrotel', 'Time-series DB'],
};

const SYSTEM_ICON: Record<string, string> = {
  aquis: '☰',
  bls: '📍',
  gwdb: '〰',
  wasp: '⚗',
  gauges: '◎',
  wfieldapp: '📱',
  hydstra: '📈',
};

function systemKey(row: MasterRow) {
  return (row.catalogKey || row.acronym || '').toLowerCase();
}

function technologies(row: MasterRow) {
  const fromTags = (row.tags || '').split(/[,;|]/).map(s => s.trim()).filter(Boolean);
  const designed = fromTags.some(t => t.includes(' ') || /[A-Z]/.test(t));
  if (designed && fromTags.length) return fromTags;
  return SYSTEM_TECH[systemKey(row)] ?? (fromTags.length ? fromTags : row.product ? [row.product] : []);
}

function blurb(text?: string) {
  if (!text) return 'No description';
  const sentence = text.split(/(?<=\.)\s/)[0];
  return sentence.length <= 140 ? sentence : `${text.slice(0, 110).trim()}…`;
}

function isLegacy(lifecycle: string) {
  return /legacy|maintain/i.test(lifecycle);
}

export function SystemsView({ onOpen, onOpenAssessment }: { onOpen: (key: string) => void; onOpenAssessment?: (key: string) => void }) {
  const [rows, setRows] = useState<MasterRow[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('All statuses');
  const [sort, setSort] = useState('name-asc');
  const [layout, setLayout] = useState<'list' | 'grid'>('list');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);

  useEffect(() => { api<MasterRow[]>('/scan/systems').then(setRows); }, []);
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menu]);

  const statuses = ['All statuses', ...Array.from(new Set(rows.map(r => r.lifecycle).filter(Boolean)))];
  const shown = rows
    .filter(r => {
      const hay = `${r.name} ${r.acronym} ${r.description} ${r.tags} ${technologies(r).join(' ')}`.toLowerCase();
      if (q && !hay.includes(q.toLowerCase())) return false;
      if (status !== 'All statuses' && r.lifecycle !== status) return false;
      return true;
    })
    .sort((a, b) => {
      if (sort === 'name-desc') return a.name.localeCompare(b.name) * -1;
      if (sort === 'progress') return (b.informationCompleteness || 0) - (a.informationCompleteness || 0);
      if (sort === 'updated') return (b.updatedAt || '').localeCompare(a.updatedAt || '');
      return a.name.localeCompare(b.name);
    });

  const active = rows.filter(r => r.lifecycle === 'Active').length;
  const legacy = rows.filter(r => isLegacy(r.lifecycle)).length;
  const average = rows.length ? Math.round(rows.reduce((n, r) => n + (r.informationCompleteness || 0), 0) / rows.length) : 0;

  const open = (row: MasterRow) => onOpen(systemKey(row));

  return (
    <div className="systems-page">
      <div className="sys-kpis">
        <article><span className="sys-kpi-ico mint">▤</span><div><strong>{rows.length}</strong><small>Total systems</small></div></article>
        <article><span className="sys-kpi-ico mint">✓</span><div><strong>{active}</strong><small>Active</small></div></article>
        <article><span className="sys-kpi-ico peach">🛡</span><div><strong>{legacy}</strong><small>Legacy / Maintain</small></div></article>
        <article><span className="sys-kpi-ico lilac">◔</span><div><strong>{average}%</strong><small>Average completion</small></div></article>
      </div>
      <section className="panel systems-register">
        <div className="panel-title">
          <div>
            <h2>Systems register</h2>
            <p>One reusable record per system. A system can belong to multiple assessment projects.</p>
          </div>
        </div>
        <div className="sys-toolbar">
          <label className="sys-search"><span>⌕</span><input placeholder="Search systems, technologies, tags…" value={q} onChange={e => setQ(e.target.value)} /></label>
          <button className={`ghost${filtersOpen ? ' selected' : ''}`} type="button" onClick={() => setFiltersOpen(o => !o)}>Filters</button>
          <select value={status} onChange={e => setStatus(e.target.value)} aria-label="Filter by status">
            {statuses.map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort systems">
            <option value="name-asc">Sort by: Name (A–Z)</option>
            <option value="name-desc">Sort by: Name (Z–A)</option>
            <option value="progress">Sort by: Assessment progress</option>
            <option value="updated">Sort by: Updated</option>
          </select>
          <div className="sys-view-toggle" role="group" aria-label="Layout">
            <button type="button" className={layout === 'list' ? 'active' : ''} aria-pressed={layout === 'list'} onClick={() => setLayout('list')} title="List view">☰</button>
            <button type="button" className={layout === 'grid' ? 'active' : ''} aria-pressed={layout === 'grid'} onClick={() => setLayout('grid')} title="Grid view">⊞</button>
          </div>
        </div>
        {filtersOpen && (
          <div className="sys-filter-hint">
            <p>Filter by lifecycle status, search across system name, description and technologies, then sort the register.</p>
          </div>
        )}
        {layout === 'list' ? (
          <>
            <div className="sys-head">
              <span>System</span><span>Technology</span><span>Status</span><span>Assessment progress</span><span>Updated</span><span />
            </div>
            {shown.map(row => {
              const key = systemKey(row);
              const techs = technologies(row);
              const extra = Math.max(0, techs.length - 3);
              const visible = extra ? techs.slice(0, 3) : techs;
              const pct = row.informationCompleteness || 0;
              return (
                <div
                  className="sys-row"
                  key={row.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => open(row)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(row); } }}
                >
                  <span className="sys-identity">
                    <span className={`sys-ico sys-key-${key}`}>{SYSTEM_ICON[key] || '▣'}</span>
                    <span><b>{row.name}{row.acronym ? ` (${row.acronym})` : ''}</b><small>{blurb(row.description)}</small></span>
                  </span>
                  <span className="sys-tech">
                    {visible.map(t => <span className="tech-chip" key={t}>{t}</span>)}
                    {extra > 0 && <span className="tech-chip more">+{extra}</span>}
                  </span>
                  <span><span className={`pill${isLegacy(row.lifecycle) ? ' amber' : ''}`}>{row.lifecycle || 'Active'}</span></span>
                  <span className="sys-progress">
                    <span className={`mini-bar${isLegacy(row.lifecycle) ? ' amber' : ''}`}><i style={{ width: `${pct}%` }} /></span>
                    <em>{pct}%</em>
                  </span>
                  <span className="sys-updated">{formatDate(row.updatedAt)}</span>
                  <span className="sys-more">
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label="System actions"
                      onClick={e => { e.stopPropagation(); setMenu(menu === row.id ? null : row.id); }}
                    >⋮</button>
                    {menu === row.id && (
                      <span className="sys-menu" onClick={e => e.stopPropagation()}>
                        <button type="button" onClick={() => open(row)}>Open system</button>
                        {onOpenAssessment && <button type="button" onClick={() => onOpenAssessment(key)}>Open assessment</button>}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </>
        ) : (
          <div className="sys-grid">
            {shown.map(row => {
              const key = systemKey(row);
              const pct = row.informationCompleteness || 0;
              return (
                <button className="sys-card" key={row.id} onClick={() => open(row)}>
                  <span className={`sys-ico sys-key-${key}`}>{SYSTEM_ICON[key] || '▣'}</span>
                  <b>{row.name}{row.acronym ? ` (${row.acronym})` : ''}</b>
                  <small>{blurb(row.description)}</small>
                  <span className={`pill${isLegacy(row.lifecycle) ? ' amber' : ''}`}>{row.lifecycle || 'Active'}</span>
                  <span className="sys-progress"><span className={`mini-bar${isLegacy(row.lifecycle) ? ' amber' : ''}`}><i style={{ width: `${pct}%` }} /></span><em>{pct}%</em></span>
                </button>
              );
            })}
          </div>
        )}
        {!shown.length && <div className="empty"><p>No systems in the register yet.</p></div>}
        {!!shown.length && <div className="sys-foot">Showing {shown.length} system{shown.length === 1 ? '' : 's'}</div>}
      </section>
    </div>
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
  type IntegrationRow = { id: string; projectId: string; name: string; systemName: string; sourceSystem: string; target: string; informationExchanged: string; method: string; integrationType?: string; protocol?: string; dataFormat?: string; catalogId?: string | null; state: string; validation: string; owner: string; criticality: string };
  type LandscapeProject = { id: string; name: string; systems: { id: string; name: string }[] };
  const [rows, setRows] = useState<IntegrationRow[]>([]);
  const [projects, setProjects] = useState<LandscapeProject[]>([]);
  const [projectId, setProjectId] = useState('');
  const [q, setQ] = useState('');
  const [state, setState] = useState('All states');
  type IntegrationColumn = 'name' | 'systemName' | 'target' | 'integrationType' | 'protocol' | 'dataFormat' | 'state' | 'validation';
  const columns: { key: IntegrationColumn; label: string }[] = [{ key: 'name', label: 'Relationship' }, { key: 'systemName', label: 'Source application' }, { key: 'target', label: 'Destination application' }, { key: 'integrationType', label: 'Type' }, { key: 'protocol', label: 'Protocol' }, { key: 'dataFormat', label: 'Format' }, { key: 'state', label: 'State' }, { key: 'validation', label: 'Validation' }];
  const [columnFilters, setColumnFilters] = useState<Record<IntegrationColumn, string>>({ name: '', systemName: '', target: '', integrationType: '', protocol: '', dataFormat: '', state: '', validation: '' });
  const [sort, setSort] = useState<{ key: IntegrationColumn; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });
  useEffect(() => { api<LandscapeProject[]>('/projects').then(items => { setProjects(items); setProjectId(current => current || items[0]?.id || ''); }); }, []);
  useEffect(() => { if (projectId) api<IntegrationRow[]>(`/scan/integrations?projectId=${projectId}`).then(setRows); }, [projectId]);
  const project = projects.find(p => p.id === projectId);
  const valueFor = (r: IntegrationRow, key: IntegrationColumn) => String(r[key] ?? '');
  const shown = rows.filter(r => `${r.name} ${r.systemName} ${r.target} ${r.integrationType} ${r.protocol} ${r.method}`.toLowerCase().includes(q.toLowerCase()) && (state === 'All states' || r.state === state) && columns.every(c => valueFor(r, c.key).toLowerCase().includes(columnFilters[c.key].trim().toLowerCase())))
    .sort((a, b) => valueFor(a, sort.key).localeCompare(valueFor(b, sort.key), undefined, { numeric: true, sensitivity: 'base' }) * (sort.direction === 'asc' ? 1 : -1));
  const changeSort = (key: IntegrationColumn) => setSort(current => current.key === key ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' });
  const connected = new Set(rows.flatMap(r => [r.systemName, r.target]).filter(Boolean));
  return (
    <section className="panel">
      <div className="panel-title"><div><h2>Landscape integration catalogue</h2><p>Relationships recorded against the selected project landscape. Future and suspected records are never presented as confirmed current facts.</p></div><label>Project or landscape<select value={projectId} onChange={e => setProjectId(e.target.value)}>{projects.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label></div>
      <div className="scan-kpis">
        <article><small>Applications in landscape</small><strong>{project?.systems.length ?? 0}</strong></article>
        <article><small>Recorded relationships</small><strong>{rows.length}</strong></article>
        <article><small>Connected applications</small><strong>{connected.size}</strong></article>
        <article><small>Require validation</small><strong>{rows.filter(r => !['Approved', 'SmeValidated', 'TechnicalReviewed'].includes(r.validation)).length}</strong></article>
      </div>
      <div className="filters"><select value={state} onChange={e => setState(e.target.value)}><option>All states</option><option>Current</option><option>Future</option><option>Suspected</option><option>Retired</option></select></div>
      <div className="filters"><input placeholder="Filter by system, target, type or protocol…" value={q} onChange={e => setQ(e.target.value)} /></div>
      <div className="register-row integrations-heading">{columns.map(column => <button type="button" className="integration-sort" key={column.key} onClick={() => changeSort(column.key)}><b>{column.label}</b><span>{sort.key === column.key ? (sort.direction === 'asc' ? '▲' : '▼') : '↕'}</span></button>)}</div>
      <div className="register-row integrations-heading integration-column-filters">{columns.map(column => <input key={column.key} aria-label={`Filter ${column.label}`} placeholder="Filter…" value={columnFilters[column.key]} onChange={e => setColumnFilters(current => ({ ...current, [column.key]: e.target.value }))} />)}</div>
      {shown.map(r => (
        <div className="register-row" key={r.id}>
          <span><b>{r.name}</b></span>
          <span>{r.systemName}</span>
          <span>{r.target || 'Not recorded'}</span>
          <span>{r.integrationType || r.method || '—'}</span>
          <span>{r.protocol || '—'}</span>
          <span>{r.dataFormat || '—'}</span>
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
