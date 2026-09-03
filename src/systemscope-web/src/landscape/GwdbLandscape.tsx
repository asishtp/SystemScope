import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { SchemaExplorer } from '../schema/SchemaExplorer';
import { api } from './api';
import bundledSchema from '../schema/gwdb-schema.json';
import {
  buildLandscape,
  domainDrawer,
  domainOf,
  formatCompactNumber,
  knowledgeBarTone,
  tablesForDomain,
  type DomainName,
  type GwSchema,
  type LandscapeModel,
  type LearningOverlayTable,
  type SchemaTable,
} from './gwdbLandscapeModel';
import './gwdb-landscape.css';
import './gwdb-landscape-fix.css';

const TABS = ['Landscape Overview', 'ER Diagram', 'Table Catalogue', 'Dependencies', 'Data Dictionary', 'Evidence'] as const;
type Tab = (typeof TABS)[number];

export function GwdbLandscape({ systemKey, onBack, onReview }: { systemKey: string; onBack: () => void; onReview: () => void }) {
  const [schema, setSchema] = useState<GwSchema>(bundledSchema as GwSchema);
  const [learning, setLearning] = useState<LearningOverlayTable[]>();
  const [selected, setSelected] = useState<DomainName>('Bore Information');
  const [tab, setTab] = useState<Tab>('Landscape Overview');
  const [confidence, setConfidence] = useState('Medium');
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [listOpen, setListOpen] = useState(false);
  const [catalogueDomain, setCatalogueDomain] = useState<DomainName | ''>('');

  useEffect(() => {
    api<GwSchema>(`/systems/${encodeURIComponent(systemKey)}/schema`)
      .then(setSchema)
      .catch(() => setSchema(bundledSchema as GwSchema));
    api<{ tables: LearningOverlayTable[] }>(`/systems/${encodeURIComponent(systemKey)}/data-model`)
      .then(d => setLearning(d.tables))
      .catch(() => setLearning([]));
  }, [systemKey]);

  const model = useMemo(() => buildLandscape(schema, learning), [schema, learning]);
  const drawer = useMemo(() => domainDrawer(model, selected), [model, selected]);
  const domainTables = useMemo(() => tablesForDomain(model, selected), [model, selected]);

  const selectDomain = (name: DomainName) => {
    setSelected(name);
    setDrawerOpen(true);
    setListOpen(true);
  };

  const openEr = () => setTab('ER Diagram');
  const exportAssessment = () => {
    const blob = new Blob([JSON.stringify({
      system: systemKey,
      extracted: model.lastExtracted,
      tables: model.tableCount,
      columns: model.columnCount,
      relationships: model.relationshipCount,
      objects: model.objectCount,
      domains: model.domains,
      gaps: model.gaps,
      health: {
        connected: model.connectedTables,
        isolated: model.isolatedTables,
        confirmed: model.confirmedRelationships,
        inferred: model.inferredRelationships,
        invalid: model.invalidObjects,
        stale: model.staleStatistics,
      },
    }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'gwdb-landscape-assessment.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className={`gwdb-landscape${drawerOpen ? '' : ' no-drawer'}`}>
      <header className="gwdb-top">
        <nav className="gwdb-crumb" aria-label="Breadcrumb">
          <button type="button" onClick={onBack}>Systems</button>
          <span>/</span>
          <button type="button" onClick={onBack}>Groundwater Database</button>
          <span>/</span>
          <strong>Current Landscape</strong>
        </nav>
        <span className="gwdb-badge"><CheckIcon /> Metadata imported</span>
        <label className="gwdb-env">
          <select defaultValue={`${model.schemaName} · ${model.environment}`} aria-label="Environment">
            <option>{model.schemaName} · {model.environment}</option>
          </select>
        </label>
        {model.lastExtracted && <small className="gwdb-extracted">Last extracted {model.lastExtracted}</small>}
        <button type="button" className="gwdb-btn" onClick={() => { window.location.hash = '/systems/gwdb/learn/import'; }}>
          <ImportIcon /> Import metadata
        </button>
        <button type="button" className="gwdb-btn solid" onClick={exportAssessment}>
          <ExportIcon /> Export assessment
        </button>
      </header>

      <div className="gwdb-body">
        <section className="gwdb-stats" aria-label="Landscape totals">
          <Stat icon={<TableIcon />} value={model.tableCount} label="Tables" />
          <Stat icon={<ColumnsIcon />} value={model.columnCount} label="Columns" />
          <Stat icon={<ShareIcon />} value={model.relationshipCount} label="Relationships" />
          <Stat icon={<DbIcon />} value={model.objectCount} label="Database Objects" />
          <Stat icon={<WarnIcon />} value={model.investigationGapCount} label="Investigation Gaps" warn />
        </section>

        <nav className="gwdb-tabs" aria-label="Landscape views">
          {TABS.map(name => (
            <button key={name} type="button" className={tab === name ? 'active' : ''} onClick={() => setTab(name)}>{name}</button>
          ))}
        </nav>

        {tab === 'Landscape Overview' && (
          <Overview
            model={model}
            selected={selected}
            onSelect={selectDomain}
            onOpenEr={openEr}
            onReview={onReview}
            onDependencies={() => setTab('Dependencies')}
          />
        )}
        {tab === 'ER Diagram' && (
          <div className="gwdb-embed">
            <SchemaExplorer onBack={() => setTab('Landscape Overview')} embedded initialDomain={selected} />
          </div>
        )}
        {tab === 'Table Catalogue' && <TableCatalogue model={model} domainFilter={catalogueDomain} onOpenEr={openEr} />}
        {tab === 'Dependencies' && <DependenciesView model={model} />}
        {tab === 'Data Dictionary' && <DataDictionary model={model} />}
        {tab === 'Evidence' && (
          <section className="gwcard gwdb-evidence">
            <h2>Evidence</h2>
            <p>Investigation gaps and undocumented objects on this landscape should be confirmed in the GWDB assessment workspace.</p>
            <button type="button" className="gwdb-btn solid" onClick={onReview}>Review assessment evidence</button>
          </section>
        )}
      </div>

      {drawerOpen && (
        <aside className="gwdb-drawer" aria-label={`${selected} domain`}>
          <header>
            <h2>{selected}</h2>
            <button type="button" aria-label="Close domain panel" onClick={() => setDrawerOpen(false)}>×</button>
          </header>
          <label className="gwdb-confidence">
            <span className={`dot ${confidence.toLowerCase()}`} />
            <select value={confidence} onChange={e => setConfidence(e.target.value)} aria-label="Domain confidence">
              <option value="High">Confidence: High</option>
              <option value="Medium">Confidence: Medium</option>
              <option value="Low">Confidence: Low</option>
            </select>
          </label>
          <div className="intro">
            <i className={`domain-icon ${domainClass(selected)}`}>{domainGlyph(selected)}</i>
            <p>{drawer.description}</p>
          </div>
          <button type="button" className="drawer-stat-btn" onClick={() => setListOpen(true)}>
            <DrawerStat icon={<TableIcon />} value={drawer.tables} label="Tables" />
          </button>
          <DrawerStat icon={<ColumnsIcon />} value={drawer.columns} label="Columns" />
          <DrawerStat icon={<LinkIcon />} value={drawer.confirmedRelationships} label="Confirmed relationships" />
          <DrawerStat icon={<InferredLinkIcon />} value={drawer.inferredRelationships} label="Inferred relationships" />
          <DrawerStat icon={<DocIcon />} value={drawer.missingDescriptions} label="Missing descriptions" />
          <h3>Tables in this domain</h3>
          <ul className="drawer-tables">
            {domainTables.map(table => (
              <li key={table.name}>
                <button type="button" onClick={() => setListOpen(true)}>
                  <b>{table.name}</b>
                  <small>{table.columns.length} cols · {formatCompactNumber(table.rows)} rows</small>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="linkish drawer-all" onClick={() => setListOpen(true)}>View full list</button>
          <h3>Actions</h3>
          <button type="button" className="gwdb-btn solid drawer-action" onClick={onReview}>Review domain <span>›</span></button>
          <button type="button" className="gwdb-btn drawer-action" onClick={openEr}><ShareIcon /> Open ER diagram <span>›</span></button>
          <p className="note">Domain boundaries and contents are AI-suggested and require confirmation.</p>
        </aside>
      )}

      {listOpen && (
        <DomainTableList
          domain={selected}
          tables={domainTables}
          onClose={() => setListOpen(false)}
          onOpenCatalogue={() => {
            setCatalogueDomain(selected);
            setListOpen(false);
            setTab('Table Catalogue');
          }}
          onOpenEr={() => {
            setListOpen(false);
            openEr();
          }}
        />
      )}
    </div>
  );
}

function Overview({
  model, selected, onSelect, onOpenEr, onReview, onDependencies,
}: {
  model: LandscapeModel;
  selected: DomainName;
  onSelect: (name: DomainName) => void;
  onOpenEr: () => void;
  onReview: () => void;
  onDependencies: () => void;
}) {
  const maxRels = Math.max(...model.importantTables.map(t => t.relationships), 1);
  const maxRows = Math.max(...model.recordVolumes.map(t => t.rows), 1);
  const health = model.relationshipHealth;
  const healthTotal = Math.max(health.healthy + health.inferred + health.issues, 1);
  const healthyPct = Math.round(health.healthy * 100 / healthTotal);
  const inferredPct = Math.round(health.inferred * 100 / healthTotal);
  const issuePct = Math.max(0, 100 - healthyPct - inferredPct);
  const donut = `conic-gradient(#16a34a 0 ${healthyPct}%, #f59e0b ${healthyPct}% ${healthyPct + inferredPct}%, #ef4444 ${healthyPct + inferredPct}% 100%)`;
  const knowledgeDonut = `conic-gradient(#2563eb 0 ${model.documentedPct}%, #e2e8f0 ${model.documentedPct}% 100%)`;

  return (
    <div className="gwdb-grid">
      <section className="gwcard domains">
        <header>
          <div>
            <h2>Information Domains</h2>
            <p>AI-suggested · awaiting domain confirmation</p>
          </div>
          <button type="button" className="gwdb-btn" onClick={onOpenEr}><ShareIcon /> Open filtered ER diagram</button>
        </header>
        <div className="domain-mosaic">
          {model.domains.map(domain => (
            <button
              key={domain.name}
              type="button"
              className={`${domain.key}${selected === domain.name ? ' selected' : ''}`}
              onClick={() => onSelect(domain.name)}
            >
              <i>{domainGlyph(domain.name)}</i>
              <b>{domain.name}</b>
              <strong>{domain.count}</strong>
              <small>tables</small>
            </button>
          ))}
        </div>
      </section>

      <section className="gwcard">
        <h2>Current Knowledge <InfoTip text="How complete the imported metadata is across structure, keys, logic, usage, integrations and ownership." /></h2>
        <div className="knowledge">
          <div className="donut" style={{ background: knowledgeDonut }}>
            <b>{model.documentedPct}%</b>
            <small>documented</small>
          </div>
          <div>
            {model.knowledge.map(row => (
              <p key={row.label}>
                <span>{row.label} <b>{row.pct}%</b></span>
                <i><em className={knowledgeBarTone(row.pct)} style={{ width: `${row.pct}%` }} /></i>
              </p>
            ))}
          </div>
        </div>
      </section>

      <div className="twocol">
        <section className="gwcard">
          <h2>Structurally Important Tables <InfoTip text="Tables with the most confirmed foreign-key relationships in the imported schema." /></h2>
          <div className="table-head"><span>#</span><span>Table</span><span>Relationships</span></div>
          {model.importantTables.map((row, i) => (
            <p className="tablebar" key={row.name}>
              <small>{i + 1}</small>
              <b>{row.name}</b>
              <i><em style={{ width: `${Math.max(8, (row.relationships / maxRels) * 100)}%` }} /></i>
              <span>{row.relationships}</span>
            </p>
          ))}
          <button type="button" className="gwdb-btn" onClick={onDependencies}><ShareIcon /> View dependency map</button>
        </section>
        <section className="gwcard volume">
          <h2>Record Volume <InfoTip text="Estimated row counts from Oracle statistics last analyzed on the source database." /></h2>
          <p className="volume-caption">Estimated from Oracle statistics</p>
          {model.recordVolumes.map(row => (
            <p className="volbar" key={row.name}>
              <b>{row.name}</b>
              <i><em style={{ width: `${Math.max(4, (row.rows / maxRows) * 100)}%` }} /></i>
              <span>{formatCompactNumber(row.rows)}</span>
            </p>
          ))}
          <div className="vol-axis" aria-hidden="true">
            <span>0</span><span>{formatCompactNumber(maxRows / 5)}</span><span>{formatCompactNumber(maxRows * 2 / 5)}</span><span>{formatCompactNumber(maxRows * 3 / 5)}</span><span>{formatCompactNumber(maxRows * 4 / 5)}</span><span>{formatCompactNumber(maxRows)}</span>
          </div>
          <small className="vol-axis-label">Rows</small>
        </section>
      </div>

      <section className="gwcard gaps">
        <h2>Investigation Gaps <InfoTip text="Quality issues detected from the imported schema that still need confirmation." /></h2>
        {model.gaps.map(gap => (
          <p key={gap.text}><WarnIcon /> {gap.text}</p>
        ))}
        <button type="button" className="gwdb-btn" onClick={onReview}>Review all gaps</button>
      </section>

      <section className="gwcard health">
        <h2>Database Health &amp; Structure <InfoTip text="Connectivity and validity of tables and constraints from the imported Oracle metadata." /></h2>
        <div>
          <HealthTile icon={<LinkIcon />} tone="ok" value={model.connectedTables} label="Connected tables" />
          <HealthTile icon={<BrokenLinkIcon />} tone="bad" value={model.isolatedTables} label="Isolated tables" />
          <HealthTile icon={<ConfirmedLinkIcon />} tone="ok" value={model.confirmedRelationships} label="Confirmed relationships" />
          <HealthTile icon={<InferredLinkIcon />} tone="mid" value={model.inferredRelationships} label="Inferred relationships" />
          <HealthTile icon={<InvalidIcon />} tone="bad" value={model.invalidObjects} label="Invalid objects" />
          <HealthTile icon={<ClockIcon />} tone="mute" value={model.staleStatistics} label="Stale statistics" />
        </div>
      </section>

      <section className="gwcard rel-health">
        <h2>Relationship health</h2>
        <div className="rel-body">
          <div className="donut ring" style={{ background: donut }} />
          <ul>
            <li><i className="ok" /> Healthy <b>{healthyPct}% ({health.healthy})</b></li>
            <li><i className="mid" /> Inferred <b>{inferredPct}% ({health.inferred})</b></li>
            <li><i className="bad" /> Issues <b>{issuePct}% ({health.issues})</b></li>
          </ul>
        </div>
        <button type="button" className="linkish" onClick={onOpenEr}>Explore relationship health <span>›</span></button>
      </section>
    </div>
  );
}

function DomainTableList({
  domain, tables, onClose, onOpenCatalogue, onOpenEr,
}: {
  domain: DomainName;
  tables: SchemaTable[];
  onClose: () => void;
  onOpenCatalogue: () => void;
  onOpenEr: () => void;
}) {
  const [query, setQuery] = useState('');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const q = query.trim().toLowerCase();
  const rows = tables.filter(t => !q || `${t.name} ${t.comment} ${t.columns.map(c => c.name).join(' ')}`.toLowerCase().includes(q));
  return (
    <div className="gwdb-list-overlay" role="dialog" aria-modal="true" aria-labelledby="domain-table-list-title" onMouseDown={onClose}>
      <section onMouseDown={e => e.stopPropagation()}>
        <header>
          <div>
            <h2 id="domain-table-list-title">{domain}</h2>
            <p>{tables.length} tables in this information domain</p>
          </div>
          <div className="gwdb-list-actions">
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tables" aria-label="Search tables in this domain" />
            <button type="button" className="gwdb-btn" onClick={onOpenEr}>Open ER diagram</button>
            <button type="button" className="gwdb-btn" onClick={onOpenCatalogue}>Open catalogue</button>
            <button type="button" className="gwdb-list-close" onClick={onClose} aria-label="Close">×</button>
          </div>
        </header>
        <div className="gwdb-list-grid">
          <table>
            <thead>
              <tr>
                <th>Table</th>
                <th>Columns</th>
                <th>Estimated rows</th>
                <th>Primary key</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(t => (
                <tr key={t.name}>
                  <td><b>{t.name}</b></td>
                  <td>{t.columns.length}</td>
                  <td>{formatCompactNumber(t.rows)}</td>
                  <td>{hasPkLabel(t)}</td>
                  <td>{t.comment?.trim() || '—'}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr><td colSpan={5}>No tables match the current search.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function TableCatalogue({ model, domainFilter, onOpenEr }: { model: LandscapeModel; domainFilter?: DomainName | ''; onOpenEr: () => void }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const rows = model.tables.filter(t => {
    if (domainFilter && domainOf(t.name) !== domainFilter) return false;
    return !q || `${t.name} ${t.comment} ${t.columns.map(c => c.name).join(' ')}`.toLowerCase().includes(q);
  });
  return (
    <section className="gwcard catalogue">
      <header>
        <div>
          <h2>Table Catalogue</h2>
          <p>{domainFilter ? `${rows.length} tables in ${domainFilter}` : `${model.tableCount} tables from the imported ${model.schemaName} schema`}</p>
        </div>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tables and columns" aria-label="Search tables and columns" />
        <button type="button" className="gwdb-btn" onClick={onOpenEr}>Open ER diagram</button>
      </header>
      <div className="catalogue-table">
        <table>
          <thead>
            <tr><th>Table</th><th>Domain</th><th>Columns</th><th>Estimated rows</th><th>Primary key</th></tr>
          </thead>
          <tbody>
            {rows.map(t => (
              <tr key={t.name}>
                <td><b>{t.name}</b></td>
                <td>{domainLabel(t.name)}</td>
                <td>{t.columns.length}</td>
                <td>{formatCompactNumber(t.rows)}</td>
                <td>{hasPkLabel(t)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DependenciesView({ model }: { model: LandscapeModel }) {
  return (
    <section className="gwcard catalogue">
      <header>
        <div>
          <h2>Dependencies</h2>
          <p>{model.relationshipCount} foreign keys · {model.dependencyCount} object dependencies · {model.objectCount} database objects</p>
        </div>
      </header>
      <div className="catalogue-table">
        <table>
          <thead>
            <tr><th>From</th><th>To</th><th>Constraint</th><th>Column</th><th>Status</th></tr>
          </thead>
          <tbody>
            {model.relationships.map(r => (
              <tr key={r.name}>
                <td>{r.from}</td>
                <td>{r.to}</td>
                <td>{r.name}</td>
                <td>{r.column} → {r.targetColumn}</td>
                <td className={r.status}>{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DataDictionary({ model }: { model: LandscapeModel }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const rows = model.tables.flatMap(t => t.columns.map(c => ({ table: t.name, ...c }))).filter(c => !q || `${c.table} ${c.name} ${c.comment}`.toLowerCase().includes(q));
  return (
    <section className="gwcard catalogue">
      <header>
        <div>
          <h2>Data Dictionary</h2>
          <p>{model.columnCount} columns across {model.tableCount} tables</p>
        </div>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search columns" aria-label="Search columns" />
      </header>
      <div className="catalogue-table">
        <table>
          <thead>
            <tr><th>Table</th><th>Column</th><th>Type</th><th>Key</th><th>Nullable</th><th>Comment</th></tr>
          </thead>
          <tbody>
            {rows.slice(0, 400).map(c => (
              <tr key={`${c.table}.${c.name}`}>
                <td>{c.table}</td>
                <td><b>{c.name}</b></td>
                <td>{c.type}</td>
                <td>{c.key || '—'}</td>
                <td>{c.nullable ? 'Yes' : 'No'}</td>
                <td>{c.comment || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Stat({ icon, value, label, warn }: { icon: ReactNode; value: number; label: string; warn?: boolean }) {
  return (
    <article>
      <i className={warn ? 'warn' : undefined}>{icon}</i>
      <strong>{value.toLocaleString()}</strong>
      <small>{label}</small>
    </article>
  );
}

function DrawerStat({ icon, value, label }: { icon: ReactNode; value: number; label: string }) {
  return (
    <div className="drawer-stat">
      <i>{icon}</i>
      <b>{value.toLocaleString()}</b>
      <span>{label}</span>
    </div>
  );
}

function HealthTile({ icon, value, label, tone }: { icon: ReactNode; value: number; label: string; tone: string }) {
  return (
    <article className={tone}>
      <i>{icon}</i>
      <strong>{value.toLocaleString()}</strong>
      <small>{label}</small>
    </article>
  );
}

function InfoTip({ text }: { text: string }) {
  return <abbr className="info" title={text}>i</abbr>;
}

function domainClass(name: DomainName) {
  return ({ 'Bore Information': 'bore', 'Water Levels': 'water', 'Water Quality': 'quality', Drilling: 'drill', Monitoring: 'monitor', 'Reference Data': 'reference' } as const)[name];
}

function domainLabel(tableName: string) {
  return domainOf(tableName);
}

function hasPkLabel(table: LandscapeModel['tables'][number]) {
  const cols = table.columns.filter(c => (c.key || '').toUpperCase().includes('PK')).map(c => c.name);
  return cols.join(' + ') || 'Not identified';
}

function domainGlyph(name: string) {
  switch (name) {
    case 'Water Levels': return <WavesIcon />;
    case 'Water Quality': return <FlaskIcon />;
    case 'Drilling': return <DerrickIcon />;
    case 'Monitoring': return <TrendIcon />;
    case 'Reference Data': return <BookIcon />;
    default: return <PinIcon />;
  }
}

function Svg({ children, className }: { children: ReactNode; className?: string }) {
  return <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}
function TableIcon() { return <Svg><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 10h16M10 4v16" /></Svg>; }
function ColumnsIcon() { return <Svg><rect x="4" y="5" width="4" height="14" rx="1" /><rect x="10" y="3" width="4" height="16" rx="1" /><rect x="16" y="8" width="4" height="11" rx="1" /></Svg>; }
function ShareIcon() { return <Svg><circle cx="6" cy="12" r="2.2" /><circle cx="18" cy="6" r="2.2" /><circle cx="18" cy="18" r="2.2" /><path d="M8 11.2 16 7.2M8 12.8 16 16.8" /></Svg>; }
function DbIcon() { return <Svg><ellipse cx="12" cy="6" rx="7" ry="2.6" /><path d="M5 6v6c0 1.5 3.1 2.6 7 2.6s7-1.1 7-2.6V6M5 12v6c0 1.5 3.1 2.6 7 2.6s7-1.1 7-2.6v-6" /></Svg>; }
function WarnIcon() { return <Svg><path d="M12 3 21 19H3L12 3z" /><path d="M12 9v5M12 16.5v.5" /></Svg>; }
function ImportIcon() { return <Svg><path d="M12 4v10M8 10l4 4 4-4M5 19h14" /></Svg>; }
function ExportIcon() { return <Svg><path d="M12 14V4M8 8l4-4 4 4M5 19h14" /></Svg>; }
function CheckIcon() { return <Svg><circle cx="12" cy="12" r="9" /><path d="M8 12.5 11 15.5 16.5 9" /></Svg>; }
function PinIcon() { return <Svg><path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.2" /></Svg>; }
function WavesIcon() { return <Svg><path d="M3 10c2.2 2.2 4.3 2.2 6.5 0s4.3-2.2 6.5 0 4.3 2.2 6.5 0M3 16c2.2 2.2 4.3 2.2 6.5 0s4.3-2.2 6.5 0 4.3 2.2 6.5 0" /></Svg>; }
function FlaskIcon() { return <Svg><path d="M9 3h6M10 3v6L5.4 18.2A2.8 2.8 0 007.8 22h8.4a2.8 2.8 0 002.4-3.8L14 9V3" /></Svg>; }
function DerrickIcon() { return <Svg><path d="M12 3 7 21h10L12 3zM8 13h8M9.5 17h5" /></Svg>; }
function TrendIcon() { return <Svg><path d="M4 16l5-5 3 3 7-8" /><path d="M15 6h4v4" /></Svg>; }
function BookIcon() { return <Svg><path d="M5 5h11a3 3 0 013 3v12H8a3 3 0 00-3 3V5z" /><path d="M8 5v15" /></Svg>; }
function LinkIcon() { return <Svg><path d="M9.5 14.5 14.5 9.5M8 11 6.5 12.5a3.2 3.2 0 004.5 4.5L12.5 16M16 13l1.5-1.5a3.2 3.2 0 00-4.5-4.5L11.5 8" /></Svg>; }
function BrokenLinkIcon() { return <Svg><path d="M8 11 6.5 12.5a3.2 3.2 0 004.5 4.5L12.5 16M16 13l1.5-1.5a3.2 3.2 0 00-4.5-4.5L11.5 8M9 9l6 6" /></Svg>; }
function ConfirmedLinkIcon() { return <Svg><path d="M9.5 14.5 14.5 9.5M8 11 6.5 12.5a3.2 3.2 0 004.5 4.5L12.5 16M16 13l1.5-1.5a3.2 3.2 0 00-4.5-4.5L11.5 8" /><path d="M16.5 16.5 18 18l3-3" /></Svg>; }
function InferredLinkIcon() { return <Svg><path d="M9.5 14.5 14.5 9.5M8 11 6.5 12.5a3.2 3.2 0 004.5 4.5L12.5 16M16 13l1.5-1.5a3.2 3.2 0 00-4.5-4.5L11.5 8" strokeDasharray="3 3" /></Svg>; }
function InvalidIcon() { return <Svg><circle cx="12" cy="12" r="8" /><path d="M9 9l6 6M15 9l-6 6" /></Svg>; }
function ClockIcon() { return <Svg><circle cx="12" cy="12" r="8" /><path d="M12 8v5l3 2" /></Svg>; }
function DocIcon() { return <Svg><path d="M7 4h8l5 5v11H7z" /><path d="M15 4v5h5M9 13h8M9 17h5" /></Svg>; }
