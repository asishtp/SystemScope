import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../landscape/api';
import { LessonReader } from './LessonReader';
import { lessonDisplay, screenByKey, screenPackage } from './screenData';
import { evidenceName, progressLabel, type DataTable, type GlossaryTerm, type LearningDashboard, type LearnPage, type Relationship, type SearchHit } from './types';
import './learn.css';

const NAV: { id: string; label: string; icon: ReactNode; action: 'overview' | 'architecture' | 'applications' | 'database' | 'integrations' | 'processes' | 'documentation' | 'learn' }[] = [
  { id: 'overview', label: 'Overview', action: 'overview', icon: <IconHome /> },
  { id: 'architecture', label: 'Architecture', action: 'architecture', icon: <IconLayers /> },
  { id: 'applications', label: 'Applications', action: 'applications', icon: <IconApps /> },
  { id: 'database', label: 'Database', action: 'database', icon: <IconDb /> },
  { id: 'integrations', label: 'Integrations', action: 'integrations', icon: <IconLink /> },
  { id: 'processes', label: 'Processes', action: 'processes', icon: <IconGear /> },
  { id: 'documentation', label: 'Documentation', action: 'documentation', icon: <IconDoc /> },
  { id: 'learn', label: 'Learn GWDB', action: 'learn', icon: <IconGrad /> },
];

export function LearnGwdbPage({
  catalogKey,
  page,
  lessonKey,
  userName,
  onNavigate,
  onOpenSystem,
  onOpenAssessment,
  onOpenDocuments,
}: {
  catalogKey: string;
  page?: string;
  lessonKey?: string;
  userName: string;
  onNavigate: (page?: string, lessonKey?: string) => void;
  onOpenSystem: (key: string) => void;
  onOpenAssessment: (key: string, tab?: string) => void;
  onOpenDocuments: (key: string) => void;
}) {
  const [data, setData] = useState<LearningDashboard>();
  const [error, setError] = useState('');
  const [navOpen, setNavOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const current: LearnPage = lessonKey ? 'lessons' : ((page as LearnPage) || 'dashboard');

  const load = () => api<LearningDashboard>(`/systems/${encodeURIComponent(catalogKey)}/learning-dashboard`)
    .then(setData)
    .catch(e => setError(e.message));

  useEffect(() => { load().catch(e => setError(e.message)); }, [catalogKey]);
  useEffect(() => {
    if (query.trim().length < 2) { setHits([]); return; }
    const handle = window.setTimeout(() => {
      api<SearchHit[]>(`/systems/${encodeURIComponent(catalogKey)}/learning-search?q=${encodeURIComponent(query)}`)
        .then(setHits)
        .catch(() => setHits([]));
    }, 180);
    return () => window.clearTimeout(handle);
  }, [query, catalogKey]);

  const openHit = (hit: SearchHit) => {
    setQuery('');
    setHits([]);
    if (hit.type === 'Lesson') onNavigate('lessons', hit.key);
    else if (hit.type === 'Glossary') onNavigate('glossary');
    else onNavigate('tables');
  };

  const goNav = (action: typeof NAV[number]['action']) => {
    setNavOpen(false);
    if (action === 'learn') onNavigate();
    else if (action === 'overview') onOpenSystem(catalogKey);
    else if (action === 'documentation') onOpenDocuments(catalogKey);
    else if (action === 'architecture') onOpenAssessment(catalogKey, 'architecture');
    else if (action === 'applications') onOpenAssessment(catalogKey);
    else if (action === 'database') onOpenAssessment(catalogKey, 'database');
    else if (action === 'integrations') onOpenAssessment(catalogKey, 'integrations');
    else if (action === 'processes') onOpenAssessment(catalogKey, 'operations');
  };

  const initials = userName.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase() || 'U';

  return (
    <div className="learn-shell">
      <div className="learn-topbar">
        <div className="learn-topbar-left">
          <button className="learn-menu" type="button" aria-label="Open system navigation" onClick={() => setNavOpen(o => !o)}><IconMenu /></button>
          <div className="learn-crumb" aria-label="Breadcrumb">
            <button type="button" onClick={() => onOpenSystem(catalogKey)}>Water Monitoring Systems</button>
            <span>/</span>
            <button type="button" className="current" onClick={() => onOpenSystem(catalogKey)}>{data?.system.name || 'Groundwater Database'}</button>
            {lessonKey && <><span>/</span><button type="button" className="current" onClick={() => onNavigate()}>Learn GWDB</button></>}
          </div>
        </div>
        <div className="learn-topbar-title" aria-hidden="true" />
        <div className="learn-topbar-right">
          <div className="learn-search">
            <span className="learn-search-icon"><IconSearch /></span>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search lessons, tables and terms…" aria-label="Search lessons, tables and terms" />
            {hits.length > 0 && (
              <div className="learn-search-results" role="listbox">
                {hits.map(h => (
                  <button key={`${h.type}-${h.id}`} type="button" onClick={() => openHit(h)}>
                    <b>{h.title}</b>
                    <small>{h.type}{h.detail ? ` · ${h.detail}` : ''}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="learn-user"><span className="learn-avatar" aria-hidden="true">{initials}</span></div>
        </div>
      </div>
      <div className="learn-body">
        <div className={`learn-sidenav${navOpen ? ' open' : ''}`}>
          {NAV.map(item => (
            <button key={item.id} type="button" className={item.action === 'learn' ? 'active' : ''} onClick={() => goNav(item.action)}>
              {item.icon}{item.label}
            </button>
          ))}
        </div>
        <div className="learn-main" role="main">
          {error && <div className="learn-empty">{error}</div>}
          {!error && current === 'lessons' && lessonKey && (
            <LessonReader catalogKey={catalogKey} lessonKey={lessonKey} totalLessons={data?.course.lessonCount} onOpenLesson={key => onNavigate('lessons', key)} onBack={() => { onNavigate(); load(); }} onOpenSource={() => onOpenDocuments(catalogKey)} />
          )}
          {!error && current === 'dashboard' && data && <Dashboard data={data} onOpenLesson={key => onNavigate('lessons', key)} onNavigate={onNavigate} />}
          {!error && current === 'glossary' && <GlossaryView catalogKey={catalogKey} onBack={() => onNavigate()} />}
          {!error && current === 'tables' && <TableDictionary catalogKey={catalogKey} onBack={() => onNavigate()} onOpenModel={() => onNavigate('data-model')} />}
          {!error && current === 'data-model' && <DataModelView catalogKey={catalogKey} onBack={() => onNavigate()} onOpenTables={() => onNavigate('tables')} />}
          {!error && current === 'bookmarks' && <BookmarksView catalogKey={catalogKey} onOpenLesson={key => onNavigate('lessons', key)} onBack={() => onNavigate()} />}
          {!error && current === 'notes' && <NotesView catalogKey={catalogKey} onBack={() => onNavigate()} />}
          {!error && current === 'import' && <ImportView catalogKey={catalogKey} onImported={load} onBack={() => onNavigate()} />}
        </div>
      </div>
    </div>
  );
}

function Dashboard({ data, onOpenLesson, onNavigate }: { data: LearningDashboard; onOpenLesson: (key: string) => void; onNavigate: (page?: string, lessonKey?: string) => void }) {
  const next = data.continueLesson;
  return (
    <>
      <div className="learn-hero">
        <h2>Learn the Groundwater Database</h2>
        <p>{screenPackage.course.description}</p>
      </div>
      <div className="learn-grid">
        <div>
          <div className="learn-hero-cards">
            <section className="learn-card">
              <div className="learn-progress-icon"><IconChart /></div>
              <p className="learn-progress-copy">{data.progress.completedLessons} of {data.progress.totalLessons} lessons completed</p>
              <div className="learn-bar-row">
                <div className="learn-bar" style={{ flex: 1 }}><i style={{ width: `${data.progress.percentage}%` }} /></div>
                <span>{data.progress.percentage}%</span>
              </div>
            </section>
            <section className="learn-card">
              <div className="learn-kicker">Continue Learning</div>
              {next ? (
                <>
                  <div className="learn-continue-head">
                    <span className="learn-continue-icon"><IconBook /></span>
                    <div>
                      <h3>{lessonDisplay(next.lessonKey, next.title)}</h3>
                      <p>Lesson {next.displayOrder} · {screenByKey(next.lessonKey)?.durationMinutes ?? next.durationMinutes ?? 0} min</p>
                      <p>{screenByKey(next.lessonKey)?.subtitle ?? next.summary}</p>
                    </div>
                  </div>
                  <button className="learn-primary" type="button" onClick={() => onOpenLesson(next.lessonKey)}>Continue lesson</button>
                </>
              ) : <p className="muted">All published lessons are complete.</p>}
            </section>
          </div>
          <section className="learn-card learn-path">
            <h3>Learning Path</h3>
            <div className="learn-lessons">
              {data.lessons.map(lesson => (
                <button key={lesson.lessonKey} className={`learn-lesson${lesson.status === 'InProgress' ? ' active' : ''}`} type="button" onClick={() => onOpenLesson(lesson.lessonKey)}>
                  <span className="learn-num">{lesson.displayOrder}</span>
                  <span>
                    <b>{lessonDisplay(lesson.lessonKey, lesson.title)}</b>
                    <span className={`learn-status ${lesson.status === 'Completed' ? 'done' : lesson.status === 'InProgress' ? 'doing' : ''}`}>
                      {lesson.status === 'Completed' ? '✓' : lesson.status === 'InProgress' ? '◌' : '○'} {progressLabel(lesson.status)}
                    </span>
                  </span>
                  <span aria-hidden="true">›</span>
                </button>
              ))}
            </div>
          </section>
        </div>
        <div>
          <section className="learn-card learn-model">
            <h3>Explore the Data Model</h3>
            <DataModelPreview tables={data.dataModel.tables} relationships={data.dataModel.relationships} />
            <button className="learn-secondary" type="button" onClick={() => onNavigate('data-model')}>Open data model</button>
          </section>
          <section className="learn-card learn-side-card" style={{ marginTop: 16 }}>
            <h3>Quick access</h3>
            <div className="learn-quick">
              <button type="button" onClick={() => onNavigate('tables')}><span className="learn-quick-icon"><IconTable /></span>Table Dictionary</button>
              <button type="button" onClick={() => onNavigate('glossary')}><span className="learn-quick-icon book"><IconBook /></span>GWDB Glossary</button>
              <button type="button" onClick={() => onNavigate('bookmarks')}><span className="learn-quick-icon mark"><IconBookmark /></span>My Bookmarks</button>
              <button type="button" onClick={() => onNavigate('notes')}><span className="learn-quick-icon note"><IconNote /></span>My Notes</button>
            </div>
          </section>
          <section className="learn-card learn-side-card" style={{ marginTop: 16 }}>
            <h3>Evidence legend</h3>
            <div className="learn-legend">
              <span className="doc"><i style={{ background: '#2E7D32' }} />Documented</span>
              <span className="inf"><i style={{ background: '#ED6C02' }} />Inferred</span>
              <span className="sch"><i style={{ background: '#1565C0' }} />Schema verified</span>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function DataModelPreview({ tables, relationships }: { tables: DataTable[]; relationships: Relationship[] }) {
  const byKey = useMemo(() => Object.fromEntries(tables.map(t => [t.tableKey, t])), [tables]);
  const slot = (key: string) => tables.find(t => t.tableKey === key);
  const casing = slot('CASING');
  const aquifer = slot('AQUIFER');
  const registration = slot('REGISTRATION');
  const waterLevel = slot('WATER_LEVEL');
  const waterAnalysis = slot('WATER_ANALYSIS');
  if (!tables.length) return <p className="muted">No data-model tables imported yet.</p>;
  return (
    <div className="learn-graph">
      <svg className="learn-edges" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <line x1="22" y1="18" x2="50" y2="50" />
        <line x1="78" y1="18" x2="50" y2="50" />
        <line x1="22" y1="82" x2="50" y2="50" />
        <line x1="78" y1="82" x2="50" y2="50" />
      </svg>
      {casing && <div className="learn-node n-tl"><span className="learn-node-icon">{tableIcon('CASING')}</span><b>{casing.name}</b></div>}
      {aquifer && <div className="learn-node n-tr"><span className="learn-node-icon">{tableIcon('AQUIFER')}</span><b>{aquifer.name}</b></div>}
      {registration && <div className="learn-node n-c"><span className="learn-node-icon">{tableIcon('REGISTRATION')}</span><b>{registration.name}</b></div>}
      {waterLevel && <div className="learn-node n-bl"><span className="learn-node-icon">{tableIcon('WATER_LEVEL')}</span><b>{waterLevel.name}</b></div>}
      {waterAnalysis && <div className="learn-node n-br"><span className="learn-node-icon">{tableIcon('WATER_ANALYSIS')}</span><b>{waterAnalysis.name}</b></div>}
      <span className="learn-graph-label l-tl">RN</span>
      <span className="learn-graph-label l-tr">RN</span>
      <span className="learn-graph-label l-bl">RN</span>
      <span className="learn-graph-label l-br">RN</span>
      <span className="sr-only">{[casing, aquifer, registration, waterLevel, waterAnalysis].filter(Boolean).map(t => t!.name).join(', ')} connected by Registered Number. {relationships.map(r => `${byKey[r.fromTableKey || '']?.name} to ${byKey[r.toTableKey || '']?.name}`).join('; ')}</span>
    </div>
  );
}

function GlossaryView({ catalogKey, onBack }: { catalogKey: string; onBack: () => void }) {
  const [rows, setRows] = useState<GlossaryTerm[]>([]);
  useEffect(() => { api<GlossaryTerm[]>(`/systems/${encodeURIComponent(catalogKey)}/glossary`).then(setRows); }, [catalogKey]);
  return (
    <section>
      <button className="learn-reader-nav" type="button" onClick={onBack}>← Dashboard</button>
      <div className="learn-hero"><h2>GWDB Glossary</h2><p>Documented groundwater and GWDB terms from the data dictionary.</p></div>
      <div className="learn-glossary">
        {rows.map(term => (
          <article key={term.termKey}>
            <b>{term.term}</b>
            <p>{term.shortDefinition}</p>
            <small className="muted">{evidenceName(term.evidenceStatus)}{term.source ? ` · ${term.source.title}${term.source.page ? `, p. ${term.source.page}` : ''}` : ''}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function TableDictionary({ catalogKey, onBack, onOpenModel }: { catalogKey: string; onBack: () => void; onOpenModel: () => void }) {
  const [tables, setTables] = useState<DataTable[]>([]);
  useEffect(() => { api<{ tables: DataTable[] }>(`/systems/${encodeURIComponent(catalogKey)}/data-model`).then(d => setTables(d.tables)); }, [catalogKey]);
  return (
    <section>
      <button className="learn-secondary" type="button" onClick={onBack}>← Dashboard</button>
      <div className="learn-hero"><h2>Table dictionary</h2><p>Logical GWDB tables, grain and candidate keys from the imported learning package.</p></div>
      <div className="learn-table-list">
        {tables.map(t => (
          <button key={t.tableKey} type="button" onClick={onOpenModel}>
            <b>{t.name}</b>
            <p className="muted">{t.domain} · {t.grain}</p>
            <small className="muted">Candidate key: {t.candidateKey.join(', ') || 'Not recorded'} · {evidenceName(t.evidenceStatus)}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function DataModelView({ catalogKey, onBack, onOpenTables }: { catalogKey: string; onBack: () => void; onOpenTables: () => void }) {
  const [model, setModel] = useState<{ tables: DataTable[]; relationships: Relationship[] }>();
  useEffect(() => { api<{ tables: DataTable[]; relationships: Relationship[] }>(`/systems/${encodeURIComponent(catalogKey)}/data-model`).then(setModel); }, [catalogKey]);
  if (!model) return <div className="learn-empty">Loading data model…</div>;
  return (
    <section>
      <button className="learn-secondary" type="button" onClick={onBack}>← Dashboard</button>
      <div className="learn-hero"><h2>Interactive data model</h2><p>Registration is the facility hub. Subject tables connect through Registered Number. Relationship evidence is shown as documented, inferred or schema verified.</p></div>
      <section className="learn-card learn-model">
        <DataModelPreview tables={model.tables} relationships={model.relationships} />
      </section>
      <div className="learn-table-list" style={{ marginTop: 16 }}>
        {model.relationships.map(r => (
          <article key={r.id}>
            <b>{r.fromTableName} → {r.toTableName}</b>
            <p className="muted">{r.cardinality} on {r.fields.map(f => `${f.from} = ${f.to}`).join(', ')}</p>
            <small className="muted">{evidenceName(r.evidenceStatus)}</small>
          </article>
        ))}
      </div>
      <div className="learn-actions"><button className="learn-secondary" type="button" onClick={onOpenTables}>Open table dictionary</button></div>
    </section>
  );
}

function BookmarksView({ catalogKey, onOpenLesson, onBack }: { catalogKey: string; onOpenLesson: (key: string) => void; onBack: () => void }) {
  const [rows, setRows] = useState<{ id: string; lessonId?: string; label?: string; entityId?: string }[]>([]);
  useEffect(() => { api<typeof rows>(`/learning/bookmarks?systemId=${encodeURIComponent(catalogKey)}`).then(setRows); }, [catalogKey]);
  return (
    <section>
      <button className="learn-secondary" type="button" onClick={onBack}>← Dashboard</button>
      <div className="learn-hero"><h2>My bookmarks</h2><p>Saved lessons and learning entities for this system.</p></div>
      <div className="learn-table-list">
        {rows.map(row => (
          <button key={row.id} type="button" onClick={() => row.entityId && onOpenLesson(row.entityId)}>
            <b>{row.label || 'Bookmark'}</b>
          </button>
        ))}
        {!rows.length && <p className="muted">No bookmarks yet.</p>}
      </div>
    </section>
  );
}

function NotesView({ catalogKey, onBack }: { catalogKey: string; onBack: () => void }) {
  const [rows, setRows] = useState<{ id: string; noteText: string; updatedAt: string }[]>([]);
  useEffect(() => { api<typeof rows>(`/learning/notes?systemId=${encodeURIComponent(catalogKey)}`).then(setRows); }, [catalogKey]);
  return (
    <section>
      <button className="learn-secondary" type="button" onClick={onBack}>← Dashboard</button>
      <div className="learn-hero"><h2>My notes</h2><p>Personal notes stay on your account and are not overwritten by course imports.</p></div>
      <div className="learn-note-list">
        {rows.map(row => <article key={row.id}><p>{row.noteText}</p><small className="muted">{new Date(row.updatedAt).toLocaleString()}</small></article>)}
        {!rows.length && <p className="muted">No notes yet.</p>}
      </div>
    </section>
  );
}

function ImportView({ catalogKey, onImported, onBack }: { catalogKey: string; onImported: () => void; onBack: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ isValid: boolean; packageId?: string; summary?: { create: number; update: number; unchanged: number; warnings: number; errors: number }; items?: { entityType: string; stableKey?: string; operation: string; message: string }[]; errors?: { code: string; jsonPath: string; message: string }[] }>();
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async (path: string) => {
    if (!file) return;
    setBusy(true);
    const body = new FormData();
    body.append('package', file);
    try {
      const payload = await api<NonNullable<typeof preview>>(path, { method: 'POST', body, headers: { 'Idempotency-Key': crypto.randomUUID() } });
      setPreview(payload);
      if (path.endsWith('/learning-imports')) {
        setResult('Imported as draft. Lessons remain unpublished until an authorised publisher reviews them.');
        onImported();
      }
    } catch (e) {
      setResult(e instanceof Error ? e.message : 'Import failed');
    } finally { setBusy(false); }
  };

  return (
    <section>
      <button className="learn-secondary" type="button" onClick={onBack}>← Dashboard</button>
      <div className="learn-hero"><h2>Import learning package</h2><p>Validate a versioned JSON package, then import it as draft. Maximum size 10 MB. User progress and notes are never overwritten.</p></div>
      <label className="learn-drop" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const next = e.dataTransfer.files[0]; if (next) setFile(next); }}>
        <input type="file" accept="application/json,.json" hidden onChange={e => setFile(e.target.files?.[0] ?? null)} />
        {file ? <b>{file.name}</b> : <span>Select or drop a JSON package</span>}
      </label>
      <div className="learn-actions">
        <button className="learn-secondary" type="button" disabled={!file || busy} onClick={() => send(`/systems/${catalogKey}/learning-imports/validate`)}>Validate</button>
        <button className="learn-primary" type="button" disabled={!file || busy || preview?.isValid === false} onClick={() => send(`/systems/${catalogKey}/learning-imports`)}>Import as draft</button>
      </div>
      {preview && (
        <div className="learn-card" style={{ marginTop: 16 }}>
          <p><b>{preview.packageId}</b> · create {preview.summary?.create ?? 0} · update {preview.summary?.update ?? 0} · errors {preview.summary?.errors ?? preview.errors?.length ?? 0}</p>
          <div className="learn-import-items">
            {(preview.errors ?? []).map(err => <div key={err.jsonPath}><b>{err.code}</b> {err.jsonPath}: {err.message}</div>)}
            {(preview.items ?? []).map(item => <div key={`${item.entityType}-${item.stableKey}`}>{item.operation} {item.entityType} {item.stableKey} — {item.message}</div>)}
          </div>
        </div>
      )}
      {result && <p className="muted" style={{ marginTop: 12 }}>{result}</p>}
    </section>
  );
}

function tableIcon(key: string) {
  if (key === 'CASING') return <IconCasing />;
  if (key === 'AQUIFER') return <IconDrop />;
  if (key === 'WATER_LEVEL') return <IconWaves />;
  if (key === 'WATER_ANALYSIS') return <IconFlask />;
  return <IconClip />;
}

function IconMenu() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>; }
function IconSearch() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3-3" /></svg>; }
function IconHome() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 10l8-7 8 7v10H4z" /><path d="M10 20v-6h4v6" /></svg>; }
function IconLayers() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 18l9 5 9-5" /></svg>; }
function IconApps() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>; }
function IconDb() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="6" rx="8" ry="3" /><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></svg>; }
function IconLink() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.07 0l1.41-1.41a5 5 0 00-7.07-7.07L10 5.93M14 11a5 5 0 00-7.07 0L5.5 12.43a5 5 0 007.07 7.07L14 18.07" /></svg>; }
function IconGear() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 00-.2-1.6l2-1.5-2-3.4-2.4 1a7 7 0 00-2.8-1.6L13 3h-2l-.6 2.9A7 7 0 007.6 7.5l-2.4-1-2 3.4 2 1.5A7 7 0 005 12c0 .5.1 1.1.2 1.6l-2 1.5 2 3.4 2.4-1a7 7 0 002.8 1.6L11 21h2l.6-2.9a7 7 0 002.8-1.6l2.4 1 2-3.4-2-1.5c.1-.5.2-1.1.2-1.6z" /></svg>; }
function IconDoc() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 3h8l5 5v13H7z" /><path d="M15 3v5h5M9 13h8M9 17h6" /></svg>; }
function IconGrad() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 10l9-5 9 5-9 5-9-5z" /><path d="M7 12v5c2 1.5 4 2 5 2s3-.5 5-2v-5" /></svg>; }
function IconChart() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19h16M7 16V8M12 16V5M17 16v-6" /></svg>; }
function IconBook() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 00-3 3V4z" /><path d="M8 4v16" /></svg>; }
function IconTable() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 10h16M10 4v16" /></svg>; }
function IconBookmark() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 4h10v16l-5-3-5 3z" /></svg>; }
function IconNote() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 3h8l5 5v13H7z" /><path d="M15 3v5h5M9 13h8M9 17h5" /></svg>; }
function IconCasing() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="3" width="6" height="18" rx="2" /></svg>; }
function IconDrop() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3s6 7 6 11a6 6 0 11-12 0c0-4 6-11 6-11z" /></svg>; }
function IconWaves() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12c2 2 4 2 6 0s4-2 6 0 4 2 6 0M3 17c2 2 4 2 6 0s4-2 6 0 4 2 6 0" /></svg>; }
function IconFlask() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 3h6M10 3v6L5 19a3 3 0 002.6 4h8.8A3 3 0 0019 19l-5-10V3" /></svg>; }
function IconClip() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="12" height="16" rx="2" /><path d="M9 2h6v4H9zM9 12h6M9 16h4" /></svg>; }
