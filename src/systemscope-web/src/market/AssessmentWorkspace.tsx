import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { api } from '../landscape/api';
import { AddEvidence } from './AddEvidence';
import { ClaimsReview } from './ClaimsReview';
import {
  DOMAIN_ICON,
  DOMAIN_TAB,
  TABS,
  formatDate,
  openGap,
  pillClass,
  readinessLabel,
  type ScanFact,
  type ScanWorkspace,
  type TabId,
} from './types';
import './market.css';

const CARD_SUMMARY: Record<string, string> = {
  Architecture: 'Oracle Forms confirmed',
  Database: 'Oracle Database inferred',
  Infrastructure: 'Hosting details required',
  Integrations: 'Relationships unconfirmed',
  DataQuality: 'Not yet assessed',
  Security: 'Deferred by current scope',
};

const KIND_BY_TAB: Record<string, string> = {
  architecture: 'Architecture',
  database: 'Database',
  infrastructure: 'Infrastructure',
  integrations: 'Integrations',
  data: 'DataQuality',
  security: 'Security',
};

export function AssessmentWorkspace({
  scanKey,
  initialTab,
  onTab,
  onBack,
  onNotice,
  onEvidence: onEvidenceProp,
  onOpenDocuments,
}: {
  scanKey: string;
  initialTab?: string;
  onTab?: (tab: string) => void;
  onBack: () => void;
  onNotice: (message: string) => void;
  onEvidence?: () => void;
  onOpenDocuments?: () => void;
}) {
  const [data, setData] = useState<ScanWorkspace>();
  const [tab, setTab] = useState<TabId>(() => (TABS.some(t => t.id === initialTab) ? initialTab as TabId : 'overview'));
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);

  const load = async () => {
    const payload = await api<ScanWorkspace>(`/scan/by-key/${encodeURIComponent(scanKey)}`);
    setData(payload);
  };

  const openTab = (next: TabId) => {
    setTab(next);
    onTab?.(next);
  };

  useEffect(() => {
    if (initialTab && TABS.some(t => t.id === initialTab)) setTab(initialTab as TabId);
  }, [initialTab]);

  useEffect(() => {
    load().catch(e => setError(e.message));
  }, [scanKey]);

  if (error) return <div className="empty"><p>{error}</p><button className="back" onClick={onBack}>← Assessments</button></div>;
  if (!data) return <div className="empty"><p>Loading assessment…</p></div>;

  const gaps = data.gaps.filter(g => openGap(g.status));
  const headlineGaps = gaps.filter(g => g.priority === 'Must');
  const statusLabel = data.scan.status === 'InProgress' ? 'In progress' : data.scan.status;
  const addEvidence = () => { onEvidenceProp?.(); openTab('evidence-new'); };

  if (tab === 'evidence-new') {
    return <AddEvidence data={data} onCancel={() => openTab('overview')} onSaved={async m => { onNotice(m); await load(); openTab('claims-review'); }} />;
  }
  if (tab === 'claims-review') {
    return <ClaimsReview data={data} onBack={() => openTab('evidence-new')} onApplied={async m => { onNotice(m); await load(); openTab('overview'); }} />;
  }

  return (
    <div className="scan">
      {tab === 'overview' && <>
      <header className="scan-head">
        <div>
          <small>WATER MONITORING SYSTEMS</small>
          <h1>{data.system.name}</h1>
          <p>System assessment • Current state</p>
          <div className="scan-pills">
            <span className="pill amber">{statusLabel}</span>
            {data.scan.includeInRfi && <span className="pill blue">RFI scope</span>}
          </div>
        </div>
        <div className="scan-head-actions">
          <button className="ghost" onClick={addEvidence}>＋ Add evidence</button>
          <button className="primary" onClick={() => onOpenDocuments ? onOpenDocuments() : setShowGenerate(true)}>Generate document</button>
        </div>
      </header>

      <div className="scan-meta">
        <div><small>Business owner</small><b>{data.system.businessOwner || 'To be confirmed'}</b></div>
        <div><small>Technical owner</small><b>{data.system.technicalOwner || 'To be confirmed'}</b></div>
        <div><small>Assessment lead</small><b>{data.scan.assessmentLead || data.project?.owner || 'Unassigned'}</b></div>
        <div><small>Last updated</small><b>{formatDate(data.scan.updatedAt)}</b></div>
      </div>

      <div className="scan-kpis">
        <article><small>Information completeness</small><strong>{data.scan.informationCompleteness}%</strong></article>
        <article><small>Validation completeness</small><strong>{data.scan.validationCompleteness}%</strong></article>
        <article><small>Open gaps</small><strong>{headlineGaps.length}</strong></article>
        <article><small>Document readiness</small><strong>{readinessLabel(data.scan.documentReadiness)}</strong></article>
      </div>
      </>}

      {tab === 'overview' && <Overview data={data} gaps={gaps} onOpen={openTab} onEvidence={addEvidence} />}
      {KIND_BY_TAB[tab] && <DomainTab data={data} kind={KIND_BY_TAB[tab]} onBack={() => openTab('overview')} onEvidence={addEvidence} onOpenMap={() => openTab('diagrams')} onSaved={async m => { onNotice(m); await load(); }} />}
      {tab === 'findings' && <FindingsTab data={data} />}
      {tab === 'evidence' && <EvidenceTab data={data} onAdd={addEvidence} />}
      {tab === 'validation' && <ValidationTab data={data} onSaved={async m => { onNotice(m); await load(); }} />}
      {tab === 'diagrams' && <DiagramsTab data={data} />}
      {tab === 'preview' && <PreviewTab data={data} />}

      {showGenerate && (
        <GenerateDialog
          data={data}
          busy={generating}
          onClose={() => setShowGenerate(false)}
          onGenerate={async options => {
            setGenerating(true);
            try {
              const created = await api<{ id: string; fileName: string; warnings: string }>('/documents', {
                method: 'POST',
                body: JSON.stringify({
                  projectId: data.system.projectId,
                  systemIds: [data.system.id],
                  ...options,
                }),
              });
              if (created.warnings) onNotice(created.warnings);
              else onNotice('Market-scan document generated');
              window.open(`/api/documents/${created.id}/file`, '_blank');
              setShowGenerate(false);
              await load();
            } catch (e) {
              onNotice(e instanceof Error ? e.message : 'Generation failed');
            } finally {
              setGenerating(false);
            }
          }}
        />
      )}
    </div>
  );
}

function Overview({ data, gaps, onOpen, onEvidence }: { data: ScanWorkspace; gaps: ScanWorkspace['gaps']; onOpen: (tab: TabId) => void; onEvidence: () => void }) {
  const preferred = ['What does AQUIS stand for?', 'Confirm Oracle version and schemas', 'Identify upstream and downstream systems'];
  const priority = preferred.map(title => data.gaps.find(g => g.missingInformation === title)).filter((g): g is NonNullable<typeof g> => !!g);
  if (priority.length < 3) {
    for (const g of [...gaps].sort((a, b) => Number(b.priority === 'Must') - Number(a.priority === 'Must'))) {
      if (!priority.some(p => p.id === g.id)) priority.push(g);
      if (priority.length === 3) break;
    }
  }
  return (
    <div className="scan-overview">
      <div className="domain-grid">
        {data.domains.map(d => (
          <button className="domain-card" key={d.kind} onClick={() => onOpen(DOMAIN_TAB[d.kind] ?? 'overview')}>
            <div className="domain-icon">{DOMAIN_ICON[d.kind]}</div>
            <div className="domain-body">
              <h3>{d.title}</h3>
              <div className="bar"><i style={{ width: `${d.completeness}%` }} /></div>
              <span className="pct">{d.completeness}%</span>
              <p>{CARD_SUMMARY[d.kind] ?? d.summary ?? (d.requirement === 'Deferred' ? 'Deferred by current scope' : 'Not yet assessed')}</p>
              <div className="domain-foot"><span>Evidence: {d.evidenceCount}</span><span>Gaps: {d.gapCount}</span></div>
            </div>
          </button>
        ))}
      </div>
      <aside className="scan-side">
        <section className="panel">
          <div className="panel-title"><div><h2>Priority information gaps</h2></div></div>
          {priority.map(g => (
            <button className="side-row" key={g.id} onClick={() => onOpen(DOMAIN_TAB[g.domain] ?? 'overview')}>
              <span>{g.missingInformation}</span><span>›</span>
            </button>
          ))}
          {!priority.length && <p className="pad">No open information gaps.</p>}
        </section>
        <section className="panel">
          <div className="panel-title"><div><h2>Recent evidence</h2></div><button className="ghost compact" onClick={onEvidence}>View all</button></div>
          <div className="side-table-head"><span>Evidence</span><span>Status</span></div>
          {data.evidence.slice(0, 4).map(e => (
            <div className="side-row evidence-row" key={e.id}>
              <span>📄 {e.title}</span>
              <span className={pillClass(e.completeness)}>{e.completeness}</span>
            </div>
          ))}
          {!data.evidence.length && <p className="pad">No evidence linked yet.</p>}
        </section>
      </aside>
    </div>
  );
}

function factStatus(fact?: ScanFact, value?: string) {
  const v = (value ?? fact?.value ?? '').trim();
  if (fact?.state === 'Future') return { label: 'Future state', cls: 'pill blue' };
  if (!v || v === 'To be confirmed') return { label: 'Information gap', cls: 'pill amber' };
  if (v === 'Unknown' && (fact?.claimType === 'Unknown' || !fact)) return { label: 'Unvalidated', cls: 'pill red' };
  if (v === 'Unknown') return { label: 'Not assessed', cls: 'pill mute' };
  if (fact?.claimType === 'Inference') return { label: 'Inferred', cls: 'pill blue' };
  if (fact?.validation === 'SmeReviewRequested') return { label: 'To confirm', cls: 'pill amber' };
  if (fact?.claimType === 'ExplicitStatement' && (fact.confidence === 'High' || fact.validation === 'SmeValidated' || fact.validation === 'Approved' || fact.validation === 'AnalystReviewed')) return { label: 'Confirmed', cls: 'pill' };
  return { label: fact?.validation ?? 'Captured', cls: 'pill mute' };
}

function DomainTab({ data, kind, onBack, onEvidence, onOpenMap, onSaved }: { data: ScanWorkspace; kind: string; onBack: () => void; onEvidence: () => void; onOpenMap: () => void; onSaved: (m: string) => void }) {
  const domain = data.domains.find(d => d.kind === kind);
  const facts = data.facts.filter(f => f.domain === kind);
  const copy = COPY[kind];
  const fields = copy.fields;
  const gaps = data.gaps.filter(g => g.domain === kind && g.status !== 'NotApplicable');
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState(domain?.summary ?? '');
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const field of fields) next[field] = facts.find(f => f.attribute === field)?.value ?? '';
    setDraft(next);
    setSummary(domain?.summary ?? '');
  }, [kind, data.scan.updatedAt]);

  const save = async () => {
    for (const attribute of fields) {
      const value = draft[attribute] ?? '';
      const existing = facts.find(f => f.attribute === attribute);
      const body = {
        domain: kind,
        attribute,
        value,
        validation: existing?.validation ?? 'Captured',
        claimType: value === 'Unknown' ? 'Unknown' : (existing?.claimType ?? 'ExplicitStatement'),
        confidence: existing?.confidence ?? 'Unconfirmed',
        evidenceExcerpt: existing?.evidenceExcerpt ?? '',
        sourceLocation: existing?.sourceLocation ?? '',
        visibility: kind === 'Security' ? 'Internal' : 'General',
        state: existing?.state ?? 'Current',
      };
      if (existing) await api(`/facts/${existing.id}`, { method: 'PUT', body: JSON.stringify(body) });
      else if (value) await api(`/systems/${data.system.id}/facts`, { method: 'POST', body: JSON.stringify(body) });
    }
    if (domain) await api(`/scan/domains/${domain.id}`, { method: 'PUT', body: JSON.stringify({ summary }) });
    onSaved('Section saved as draft');
  };

  const awaiting = facts.filter(f => f.validation === 'SmeReviewRequested' || f.validation === 'Captured').length;
  const evidenceHints: Record<string, string[]> = {
    Architecture: ['walkthrough', 'mcloughlin', 'forms', 'architecture'],
    Database: ['walkthrough', 'oracle', 'database'],
    Infrastructure: ['walkthrough', 'hosting'],
    Integrations: ['walkthrough', 'drill'],
    DataQuality: ['quality', 'data domain'],
    Security: ['security', 'identity'],
  };
  const hints = evidenceHints[kind] ?? [];
  const evidence = data.evidence.filter(e => hints.some(h => `${e.title} ${e.sourceType}`.toLowerCase().includes(h))).slice(0, 3);

  return (
    <div className="domain-page">
      <header className="scan-head">
        <div>
          <small>{data.system.name.toUpperCase()} · SYSTEM ASSESSMENT</small>
          <h1>{copy.pageTitle}</h1>
          <p>{copy.intro}</p>
          <p className="crumb"><button className="linkish" onClick={onBack}>Assessments</button> / {data.system.name} / {copy.crumb}</p>
        </div>
        <div className="scan-head-actions">
          {domain?.requirement === 'Deferred' && <span className="pill amber">Deferred by current scope</span>}
          <span className="pill">{domain?.completeness ?? 0}% complete</span>
          <button className="ghost" onClick={onEvidence}>＋ Add evidence</button>
          <button className="primary" onClick={save}>Save assessment</button>
        </div>
      </header>
      <div className="scan-split">
        <div className="domain-main">
          <section className="panel pad-form">
            <h3>{copy.summaryTitle}</h3>
            <textarea value={summary} onChange={e => setSummary(e.target.value)} />
            <div className="inline-fields">
              <label>Validation status
                <select defaultValue={copy.validationDefault}>
                  <option>Awaiting SME review</option>
                  <option>Unvalidated</option>
                  <option>Not assessed</option>
                  <option>Confirmed</option>
                  <option>Deferred by scope</option>
                </select>
              </label>
              {kind === 'Security' && <label>Document visibility
                <select defaultValue="Internal only"><option>Internal only</option><option>General</option><option>Security appendix only</option><option>Excluded</option></select>
              </label>}
            </div>
          </section>
          {kind !== 'DataQuality' && kind !== 'Security' && kind !== 'Integrations' && <section className="panel">
            <div className="panel-title"><div><h2>{copy.fieldTitle}</h2></div></div>
            {fields.map(attr => {
              const fact = facts.find(f => f.attribute === attr);
              const status = factStatus(fact, draft[attr]);
              return (
                <div className="attr-row" key={attr}>
                  <span>{copy.labels[attr] ?? attr}</span>
                  <input value={draft[attr] ?? ''} onChange={e => setDraft({ ...draft, [attr]: e.target.value })} />
                  <span className={status.cls}>{status.label}</span>
                  <span className="row-icons"><button type="button" className="icon-btn" title="Evidence">▤</button><button type="button" className="icon-btn" title="Edit">✎</button></span>
                </div>
              );
            })}
          </section>}
          {kind === 'Architecture' && <RecordPanel title="Application components" action="＋ Add component" rows={data.components} cols={[['name', 'Component'], ['componentType', 'Type'], ['technology', 'Technology'], ['version', 'Version'], ['lifecycleStatus', 'Status']]} statusKey="lifecycleStatus" onAdd={() => setAdding('component')} />}
          {kind === 'Database' && (
            <>
              <RecordPanel title="Schemas and database logic" action="＋ Add database item" rows={data.databases} cols={[['product', 'Item'], ['databaseName', 'Type'], ['schemas', 'Purpose'], ['owner', 'Owner']]} statusKey="validation" onAdd={() => setAdding('database')} />
              <OpsRow title="Operational characteristics" items={[['Scheduled jobs', factVal(facts, 'Scheduled jobs')], ['High availability', factVal(facts, 'High availability')], ['Backup arrangement', factVal(facts, 'Backup arrangement')], ['Recovery objectives', factVal(facts, 'Recovery objectives')]]} />
            </>
          )}
          {kind === 'Infrastructure' && (
            <>
              <RecordPanel title="Environment matrix" action="＋ Add environment" rows={data.infrastructure} cols={[['environmentName', 'Environment'], ['name', 'Application server'], ['operatingSystem', 'Database server']]} statusKey="name" onAdd={() => setAdding('infra')} />
              <OpsRow title="Operational resilience" items={[['Monitoring', factVal(facts, 'Monitoring and logging')], ['High availability', factVal(facts, 'Availability arrangement')], ['Backup', factVal(facts, 'Backup and recovery')], ['RTO / RPO', factVal(facts, 'RTO')]]} />
            </>
          )}
          {kind === 'Integrations' && (
            <>
              <RecordPanel title="Integration catalogue" action="＋ Add integration" extra={<button className="ghost compact" type="button" onClick={onOpenMap}>Open integration map</button>} rows={data.integrations as unknown as Record<string, unknown>[]} cols={[['sourceSystem', 'Source'], ['target', 'Destination'], ['businessPurpose', 'Purpose'], ['method', 'Method'], ['frequency', 'Frequency'], ['state', 'Status']]} statusKey="state" onAdd={() => setAdding('integration')} />
              <RecordPanel title="Data flows" action="＋ Add data flow" rows={data.flows} cols={[['dataSet', 'Flow'], ['source', 'From'], ['destination', 'To'], ['state', 'Status']]} statusKey="state" onAdd={() => setAdding('flow')} />
              <RecordPanel title="Batch processes" action="＋ Add batch process" rows={data.batches} cols={[['name', 'Process'], ['schedule', 'Schedule'], ['input', 'Input'], ['output', 'Output'], ['operationalOwner', 'Owner']]} statusKey="validation" onAdd={() => setAdding('batch')} />
            </>
          )}
          {kind === 'DataQuality' && (
            <>
              <RecordPanel title="Data domain register" action="＋ Add data domain" extra={<button className="ghost compact" type="button" onClick={() => setAdding('datadomain')}>Import inventory</button>} rows={data.dataDomains} cols={[['name', 'Data domain'], ['businessDescription', 'Description'], ['authoritativeSystem', 'Authoritative'], ['dataOwner', 'Owner'], ['approximateVolume', 'Volume']]} statusKey="completeness" onAdd={() => setAdding('datadomain')} />
              <RecordPanel title="Data quality assessment" action="＋ Assess data quality" rows={data.dataDomains} cols={[['name', 'Data domain'], ['completeness', 'Completeness'], ['accuracy', 'Accuracy'], ['consistency', 'Consistency'], ['timeliness', 'Timeliness']]} statusKey="completeness" onAdd={() => setAdding('datadomain')} />
              <OpsRow title="Migration considerations" items={[['Historical depth', factVal(facts, 'Historical depth')], ['Retention', factVal(facts, 'Retention')], ['Attachments', 'Unknown'], ['Data profiling', 'Not performed']]} />
            </>
          )}
          {kind === 'Security' && (
            <>
              <RecordPanel title="Identity & access" action="" rows={securityIdentity(facts, draft, setDraft)} cols={[['name', 'Control'], ['value', 'Value']]} statusKey="status" />
              <RecordPanel title="Data protection & operational security" action="＋ Add security control" rows={data.security.filter(s => String(s.area) === 'Data protection')} cols={[['name', 'Control'], ['description', 'Implementation'], ['status', 'Assessment']]} statusKey="status" onAdd={() => setAdding('security')} />
              <RecordPanel title="Compliance obligations" action="＋ Add obligation" rows={data.security.filter(s => String(s.area) === 'Compliance')} cols={[['name', 'Obligation'], ['description', 'Applicability']]} onAdd={() => setAdding('obligation')} />
            </>
          )}
          {adding && <AddRecord kind={adding} data={data} onCancel={() => setAdding(null)} onDone={async label => { setAdding(null); onSaved(label); }} />}
          <div className="domain-foot-actions">
            <button className="ghost" onClick={save}>Save draft</button>
            <button className="ghost" onClick={async () => {
              const due = new Date(); due.setDate(due.getDate() + 14);
              await api('/actions', { method: 'POST', body: JSON.stringify({ projectId: data.system.projectId, systemId: data.system.id, title: `${copy.requestLabel} — ${data.system.name}`, owner: data.system.technicalOwner || data.scan.assessmentLead || 'Unassigned', dueDate: due.toISOString().slice(0, 10), priority: 'Must' }) });
              onSaved(`${copy.requestLabel} recorded as an action. Claims stay unvalidated until the reviewer confirms them.`);
            }}>{copy.requestLabel}</button>
            <button className="primary" onClick={async () => { await save(); onSaved('Section marked complete. Unvalidated statements remain labelled in generated documents.'); }}>Mark section complete</button>
          </div>
        </div>
        <aside className="scan-side">
          <section className="panel pad-form">
            <h3>Section progress</h3>
            <strong className="progress-label">{domain?.requirement === 'Deferred' ? 'Deferred' : `${domain?.completeness ?? 0}%`}</strong>
            <div className="bar fat"><i style={{ width: `${domain?.requirement === 'Deferred' ? 0 : domain?.completeness ?? 0}%` }} /></div>
            <div className="progress-stats"><span>{evidence.length} evidence items</span><span>{gaps.length} information gaps</span><span>{awaiting} awaiting validation</span></div>
          </section>
          {kind === 'Security' && (
            <section className="panel pad-form empty-card">
              <h3>Document visibility</h3>
              <div className="empty-icon">🛡</div>
              <p>Security details are restricted to internal reports by default.</p>
              <button className="ghost compact" type="button">Manage visibility</button>
            </section>
          )}
          <section className="panel">
            <div className="panel-title"><div><h2>Evidence</h2></div></div>
            {evidence.map(e => (
              <div className="side-row evidence-row" key={e.id}>
                <span>📄 {e.title}</span>
                <span className={e.completeness === 'Incomplete' ? 'pill amber' : e.completeness.toLowerCase().includes('future') ? 'pill blue' : e.completeness.toLowerCase().includes('indirect') ? 'pill blue' : 'pill'}>{e.completeness}</span>
              </div>
            ))}
            {!evidence.length && (
              <div className="empty-card">
                <div className="empty-icon">📁</div>
                <p>No evidence linked to this section.</p>
                <button className="ghost compact" type="button" onClick={onEvidence}>Add evidence</button>
              </div>
            )}
            {!!evidence.length && <button className="linkish pad" onClick={onEvidence}>View all evidence</button>}
          </section>
          <GapList gaps={gaps} />
        </aside>
      </div>
    </div>
  );
}

const COPY: Record<string, { pageTitle: string; intro: string; crumb: string; summaryTitle: string; fieldTitle: string; fields: string[]; labels: Record<string, string>; validationDefault: string; requestLabel: string }> = {
  Architecture: {
    pageTitle: 'System architecture & technical design',
    intro: 'Capture the current application architecture, components and technical dependencies.',
    crumb: 'Architecture',
    summaryTitle: 'Architecture summary',
    fieldTitle: 'Application technologies',
    fields: ['Front-end technology', 'Back-end technology', 'Application server', 'Reporting technology', 'Architecture style'],
    labels: {},
    validationDefault: 'Awaiting SME review',
    requestLabel: 'Request SME validation',
  },
  Database: {
    pageTitle: 'Database architecture',
    intro: 'Capture the database platform, schemas, business logic, jobs and operational dependencies.',
    crumb: 'Database',
    summaryTitle: 'Database summary',
    fieldTitle: 'Database platform',
    fields: ['Database product', 'Version', 'Edition', 'Hosting location', 'Instance name', 'Approximate size'],
    labels: { 'Hosting location': 'Hosting model', 'Instance name': 'Database name' },
    validationDefault: 'Unvalidated',
    requestLabel: 'Request DBA validation',
  },
  Infrastructure: {
    pageTitle: 'Infrastructure & hosting',
    intro: 'Capture high-level hosting, environments, infrastructure dependencies and operational resilience.',
    crumb: 'Infrastructure',
    summaryTitle: 'Infrastructure summary',
    fieldTitle: 'Hosting overview',
    fields: ['Hosting model', 'Hosting location', 'Application delivery', 'Network zones', 'Infrastructure owner', 'External support'],
    labels: { 'Hosting location': 'Primary hosting location', 'Network zones': 'Network zone' },
    validationDefault: 'Not assessed',
    requestLabel: 'Request infrastructure validation',
  },
  Integrations: {
    pageTitle: 'Integrations, data flows & batch processes',
    intro: 'Identify upstream and downstream systems, interfaces, information exchanges and scheduled processing.',
    crumb: 'Integrations',
    summaryTitle: 'Integration summary',
    fieldTitle: 'Current-state notes',
    fields: [],
    labels: {},
    validationDefault: 'Unvalidated',
    requestLabel: 'Request integration validation',
  },
  DataQuality: {
    pageTitle: 'Data structures & data quality',
    intro: 'Capture key data domains, ownership, volumes, quality observations and migration considerations.',
    crumb: 'Data and quality',
    summaryTitle: 'Data summary',
    fieldTitle: 'Data quality ratings',
    fields: [],
    labels: {},
    validationDefault: 'Not assessed',
    requestLabel: 'Request data owner validation',
  },
  Security: {
    pageTitle: 'Security controls & compliance',
    intro: 'Capture identity, access, data protection, operational security and applicable compliance obligations.',
    crumb: 'Security',
    summaryTitle: 'Security summary',
    fieldTitle: 'Security controls',
    fields: ['Authentication', 'Identity provider', 'Single sign-on', 'Multi-factor authentication', 'Role-based access', 'Privileged access'],
    labels: { Authentication: 'Authentication method', 'Role-based access': 'Role-based access', 'Privileged access': 'Privileged access review' },
    validationDefault: 'Deferred by scope',
    requestLabel: 'Request security review',
  },
};

function GapList({ gaps }: { gaps: ScanWorkspace['gaps'] }) {
  const [open, setOpen] = useState(false);
  const shown = open ? gaps : gaps.slice(0, 5);
  return (
    <section className="panel">
      <div className="panel-title"><div><h2>Information gaps</h2></div><span className="pill mute">?</span></div>
      {shown.map(g => (
        <div className="side-row" key={g.id}><span>△ {g.missingInformation}</span><span>›</span></div>
      ))}
      {gaps.length > 5 && <button className="linkish pad" type="button" onClick={() => setOpen(o => !o)}>{open ? 'Show fewer' : `View all ${gaps.length} gaps`}</button>}
      {gaps.length <= 5 && !!gaps.length && <p className="pad hint">View all {gaps.length} gaps</p>}
    </section>
  );
}

function factVal(facts: ScanFact[], attr: string) {
  return facts.find(f => f.attribute === attr)?.value || 'Unknown';
}

function securityIdentity(facts: ScanFact[], draft: Record<string, string>, setDraft: (v: Record<string, string>) => void) {
  const keys = ['Authentication', 'Identity provider', 'Single sign-on', 'Multi-factor authentication', 'Role-based access', 'Privileged access'];
  return keys.map(name => {
    const fact = facts.find(f => f.attribute === name);
    const value = draft[name] ?? fact?.value ?? 'Unknown';
    const status = factStatus(fact, value);
    return { id: name, name: COPY.Security.labels[name] ?? name, value, status: status.label, _set: setDraft };
  });
}

function rowStatus(value: unknown) {
  const v = String(value ?? '');
  const s = v.toLowerCase();
  if (s.includes('future')) return { label: 'Future state', cls: 'pill blue' };
  if (s.includes('inferred') || s === 'captured') return { label: 'Inferred', cls: 'pill blue' };
  if (s.includes('unconfirmed') || s === 'suspected') return { label: 'Unconfirmed', cls: 'pill amber' };
  if (s.includes('confirm') || s.includes('smereview')) return { label: 'To confirm', cls: 'pill amber' };
  if (s === 'unknown' || s.includes('unvalidated')) return { label: 'Unvalidated', cls: 'pill red' };
  if (s.includes('not assess') || s.includes('notassessed')) return { label: 'Not assessed', cls: 'pill mute' };
  if (s.includes('in use') || s.includes('active') || s.includes('confirmed')) return { label: v || 'In use', cls: 'pill' };
  if (s.includes('gap') || s.includes('to be confirmed')) return { label: 'Information gap', cls: 'pill amber' };
  return { label: v || 'Captured', cls: 'pill mute' };
}

function RecordPanel({ title, action, extra, rows, cols, statusKey, onAdd }: { title: string; action: string; extra?: ReactNode; rows: Record<string, unknown>[]; cols: [string, string][]; statusKey?: string; onAdd?: () => void }) {
  return (
    <section className="panel">
      <div className="panel-title"><div><h2>{title}</h2></div>{extra}</div>
      <div className="attr-head" style={{ gridTemplateColumns: `repeat(${cols.length + (statusKey ? 1 : 0) + 1}, 1fr)` }}>{cols.map(([, label]) => <span key={label}>{label}</span>)}{statusKey && <span>Status</span>}</div>
      {rows.map((row, i) => {
        const status = statusKey ? rowStatus(row[statusKey]) : null;
        return (
          <div className="attr-row table" key={String(row.id ?? i)} style={{ gridTemplateColumns: `repeat(${cols.length + (status ? 1 : 0) + 1}, minmax(0,1fr))` }}>
            {cols.map(([key]) => <span key={key}>{String(row[key] ?? '—')}</span>)}
            {status && <span className={status.cls}>{status.label}</span>}
            <span className="row-icons"><button type="button" className="icon-btn">▤</button><button type="button" className="icon-btn">✎</button></span>
          </div>
        );
      })}
      {action && <button className="ghost pad" onClick={onAdd}>{action}</button>}
    </section>
  );
}

function OpsRow({ title, items }: { title: string; items: [string, string][] }) {
  return (
    <section className="panel pad-form">
      <h3>{title}</h3>
      <div className="ops-grid">
        {items.map(([label, value]) => (
          <div key={label}><small>{label}</small><b>{value}</b></div>
        ))}
      </div>
    </section>
  );
}

function AddRecord({ kind, data, onDone, onCancel }: { kind: string; data: ScanWorkspace; onDone: (label: string) => void; onCancel: () => void }) {
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(e.currentTarget));
    const blank = { validation: 'Captured', state: 'Current', evidenceId: null };
    if (kind === 'component') {
      await api(`/systems/${data.system.id}/components`, { method: 'POST', body: JSON.stringify({ name: v.name, componentType: v.componentType || 'Application', technology: v.technology || '', version: v.version || 'Unknown', purpose: v.purpose || '', environmentName: 'Unknown', owner: '', lifecycleStatus: 'Active', supportStatus: '', ...blank }) });
    } else if (kind === 'database') {
      await api(`/systems/${data.system.id}/databases`, { method: 'POST', body: JSON.stringify({ product: v.name, edition: '', version: '', databaseName: v.componentType || '', instanceName: '', hostingLocation: '', operatingSystem: '', schemas: v.purpose || '', sharedOrDedicated: '', approximateSize: '', annualGrowth: '', storedProcedures: '', triggers: '', databaseLinks: '', scheduledJobs: '', highAvailability: '', backupArrangement: '', recoveryObjectives: '', encryptionAtRest: '', encryptionInTransit: '', vendorSupportStatus: '', performanceIssues: '', technicalDebt: '', owner: v.owner || '', supportTeam: '', ...blank }) });
    } else if (kind === 'infra') {
      await api(`/systems/${data.system.id}/infrastructure`, { method: 'POST', body: JSON.stringify({ name: v.name, assetType: 'Server', hostingModel: 'OnPremises', location: '', operatingSystem: v.technology || '', environmentName: v.componentType || 'Production', networkZone: '', purpose: v.purpose || '', owner: '', endOfLife: false, ...blank }) });
    } else if (kind === 'integration') {
      await api(`/systems/${data.system.id}/integrations`, { method: 'POST', body: JSON.stringify({ projectId: data.system.projectId, name: v.name, target: v.technology || '', method: v.componentType || 'Unknown', owner: v.owner || '', monitoring: '' }) });
    } else if (kind === 'flow') {
      await api(`/systems/${data.system.id}/data-flows`, { method: 'POST', body: JSON.stringify({ source: v.name, destination: v.technology || '', dataSet: v.purpose || v.name, businessPurpose: v.purpose || '', direction: 'Outbound', transformation: '', storagePoints: '', frequency: '', securityClassification: 'OFFICIAL', owner: '', ...blank }) });
    } else if (kind === 'batch') {
      await api(`/systems/${data.system.id}/batches`, { method: 'POST', body: JSON.stringify({ name: v.name, purpose: v.purpose || '', schedule: v.componentType || 'Unknown', timezone: 'Australia/Brisbane', upstreamDependency: '', downstreamDependency: '', input: '', output: '', runtimeTechnology: '', typicalDuration: '', failureBehaviour: '', retryProcess: '', monitoring: '', operationalOwner: v.owner || '', criticality: 'Moderate', ...blank }) });
    } else if (kind === 'datadomain') {
      await api(`/systems/${data.system.id}/data-domains`, { method: 'POST', body: JSON.stringify({ name: v.name, businessDescription: v.purpose || '', authoritativeSystem: v.technology || 'Unknown', principalEntities: '', approximateVolume: 'Unknown', historicalDepth: '', classification: 'OFFICIAL', retentionRequirement: '', dataOwner: v.owner || 'Unknown', downstreamConsumers: '', migrationRequirement: '', completeness: 'NotAssessed', accuracy: 'NotAssessed', consistency: 'NotAssessed', validity: 'NotAssessed', timeliness: 'NotAssessed', uniqueness: 'NotAssessed', referentialIntegrity: 'NotAssessed', knownDuplicates: '', missingMandatoryValues: '', invalidCodes: '', orphanedRecords: '', manualCorrectionProcess: '', reconciliationProcess: '', qualityOwner: '', validation: 'Captured' }) });
    } else {
      await api(`/systems/${data.system.id}/security-controls`, { method: 'POST', body: JSON.stringify({ name: v.name, area: kind === 'obligation' ? 'Compliance' : 'Data protection', description: v.purpose || '', status: 'Not assessed', visibility: 'Internal', ...blank }) });
    }
    onDone('Record added');
  };
  const title = { component: 'Add component', database: 'Add database item', infra: 'Add environment', integration: 'Add integration', flow: 'Add data flow', batch: 'Add batch process', datadomain: 'Add data domain', security: 'Add security control', obligation: 'Add obligation' }[kind] ?? 'Add record';
  return (
    <form className="panel pad-form" onSubmit={submit}>
      <h3>{title}</h3>
      <label>Name<input name="name" required autoFocus /></label>
      <div className="grid2">
        <label>Type / method<input name="componentType" /></label>
        <label>Technology / destination<input name="technology" /></label>
      </div>
      <label>Owner<input name="owner" /></label>
      <label>Purpose / description<textarea name="purpose" /></label>
      <div className="domain-foot-actions">
        <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
        <button className="primary" type="submit">Save</button>
      </div>
    </form>
  );
}



function FindingsTab({ data }: { data: ScanWorkspace }) {
  return (
    <section className="panel">
      <div className="panel-title"><div><h2>Findings and risks</h2><p>Evidence-backed observations. Unapproved findings are omitted from generated documents.</p></div></div>
      {data.findings.map(f => (
        <div className="register-row" key={f.id}>
          <span><b>{f.title}</b></span>
          <span>{f.type}</span>
          <span>{f.severity}</span>
          <span>{f.validation ?? f.reviewState}</span>
          <span>{f.owner}</span>
          <span>{f.includeInDocument === false ? 'Excluded' : 'Included'}</span>
        </div>
      ))}
      {!data.findings.length && <div className="empty"><p>No findings for this system.</p></div>}
    </section>
  );
}

function EvidenceTab({ data, onAdd }: { data: ScanWorkspace; onAdd: () => void }) {
  return (
    <section className="panel">
      <div className="panel-title"><div><h2>Evidence</h2><p>Navigate from facts to sources and from sources to derived claims.</p></div><button className="primary" onClick={onAdd}>＋ Add evidence</button></div>
      {data.evidence.map(e => (
        <div className="register-row" key={e.id}>
          <span><b>{e.title}</b></span>
          <span>{e.sourceType}</span>
          <span>{e.source}</span>
          <span>{e.completeness}</span>
          <span>{e.validated ? 'Validated' : 'Unvalidated'}</span>
          <span><a href={e.url} target="_blank" rel="noreferrer">Open</a></span>
        </div>
      ))}
      {!data.evidence.length && <div className="empty"><p>No evidence registered.</p></div>}
    </section>
  );
}

function ValidationTab({ data, onSaved }: { data: ScanWorkspace; onSaved: (m: string) => void }) {
  const act = async (id: string, action: string) => {
    await api(`/claims/${id}/validate`, { method: 'POST', body: JSON.stringify({ action, comment: '' }) });
    onSaved('Validation recorded');
  };
  return (
    <section className="panel">
      <div className="panel-title"><div><h2>Validation</h2><p>AI and analyst claims are not facts until confirmed. Original wording is retained in audit history.</p></div></div>
      {data.claims.map(c => (
        <div className="claim" key={c.id}>
          <div>
            <span className={pillClass(c.claimType)}>{c.claimType}</span>
            <span className={pillClass(c.validation)}>{c.validation}</span>
            <p><b>{c.statement}</b></p>
            <small>{c.domain} · {c.confidence}{c.evidenceExcerpt ? ` · ${c.evidenceExcerpt}` : ''}</small>
          </div>
          <div className="claim-actions">
            <button onClick={() => act(c.id, 'confirm')}>Confirm</button>
            <button onClick={() => act(c.id, 'reject')}>Reject</button>
            <button onClick={() => act(c.id, 'unsure')}>Unsure</button>
            <button onClick={() => act(c.id, 'request-evidence')}>Request evidence</button>
          </div>
        </div>
      ))}
      {!data.claims.length && <div className="empty"><p>No claims awaiting review.</p></div>}
    </section>
  );
}

function DiagramsTab({ data }: { data: ScanWorkspace }) {
  const current = data.integrations.filter(i => i.state !== 'Future');
  const future = data.integrations.filter(i => i.state === 'Future');
  const nodes = Array.from(new Set([data.system.name, ...data.integrations.flatMap(i => [i.sourceSystem || data.system.name, i.target])])).filter(Boolean);
  return (
    <section className="panel pad-form">
      <div className="panel-title"><div><h2>Context diagram</h2><p>Generated from structured integration records. Confirmed, unconfirmed and future-state relationships are distinguished.</p></div></div>
      <svg className="context-svg" viewBox="0 0 720 320" role="img" aria-label="System context diagram">
        <rect x="270" y="130" width="180" height="60" rx="10" fill="#e7f5f1" stroke="#167b70" />
        <text x="360" y="166" textAnchor="middle" fontSize="14" fontWeight="700" fill="#116d63">{data.system.acronym || data.system.name}</text>
        {nodes.filter(n => n !== data.system.name && n !== data.system.acronym).slice(0, 8).map((n, i) => {
          const left = i % 2 === 0;
          const y = 40 + Math.floor(i / 2) * 70;
          const x = left ? 40 : 520;
          const futureNode = future.some(f => f.target === n || f.sourceSystem === n);
          return (
            <g key={n}>
              <rect x={x} y={y} width="160" height="44" rx="8" fill={futureNode ? '#f7f4ea' : '#fff'} stroke={futureNode ? '#c4a35a' : '#9bb7b2'} strokeDasharray={futureNode ? '5 4' : undefined} />
              <text x={x + 80} y={y + 27} textAnchor="middle" fontSize="11" fill="#314b49">{n}</text>
              <line x1={left ? x + 160 : x} y1={y + 22} x2={left ? 270 : 450} y2="160" stroke="#9bb7b2" />
            </g>
          );
        })}
      </svg>
      <p className="hint">{current.length} current-state relationship(s). {future.length} future-state item(s) are not treated as current facts.</p>
    </section>
  );
}

function PreviewTab({ data }: { data: ScanWorkspace }) {
  const [preview, setPreview] = useState<{ sections: { title: string; paragraphs: string[] }[]; warnings: string[] }>();
  useEffect(() => {
    api<typeof preview>(`/systems/${data.system.id}/preview?audience=Internal`).then(setPreview).catch(() => undefined);
  }, [data.system.id, data.scan.updatedAt]);
  const grouped = useMemo(() => {
    const by = new Map<string, ScanFact[]>();
    for (const f of data.facts) {
      const list = by.get(f.domain) ?? [];
      list.push(f);
      by.set(f.domain, list);
    }
    return by;
  }, [data.facts]);
  return (
    <section className="panel pad-form preview">
      <div className="panel-title"><div><h2>Document preview</h2><p>Generated from approved structured records. Unknown is never converted into a presumed fact.</p></div></div>
      {preview?.warnings?.map(w => <div className="warn" key={w}>{w}</div>)}
      <h3>System overview</h3>
      <p>{data.system.description}</p>
      {data.domains.map(d => (
        <div key={d.kind}>
          <h3>{d.title}</h3>
          {(grouped.get(d.kind) ?? []).map(f => (
            <p key={f.id}>
              {f.state === 'Future' && <em>Future-state. </em>}
              {f.claimType === 'Inference' && <em>Inference. </em>}
              {f.claimType === 'Unknown' && <em>Unknown. </em>}
              <b>{f.attribute}:</b> {f.value || 'Not assessed.'}
              {f.evidenceExcerpt ? <small> Source: {f.evidenceExcerpt}</small> : null}
            </p>
          ))}
          {!(grouped.get(d.kind) ?? []).length && <p>Not assessed. This is an information gap, not a negative finding.</p>}
        </div>
      ))}
    </section>
  );
}

function GenerateDialog({ data, busy, onClose, onGenerate }: {
  data: ScanWorkspace;
  busy: boolean;
  onClose: () => void;
  onGenerate: (options: { audience: string; stateScope: string; includeDiagrams: boolean; includeFindings: boolean; includeGaps: boolean; includeSecurityAppendix: boolean }) => void;
}) {
  const unvalidated = data.facts.some(f => f.value && f.value !== 'Unknown' && f.state === 'Current' && !['Approved', 'SmeValidated', 'DocumentReady', 'Published'].includes(f.validation));
  return (
    <div className="overlay" onMouseDown={onClose}>
      <dialog open onMouseDown={e => e.stopPropagation()}>
        <button className="close" onClick={onClose}>×</button>
        <form onSubmit={e => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          onGenerate({
            audience: String(form.get('audience')),
            stateScope: String(form.get('stateScope')),
            includeDiagrams: form.get('includeDiagrams') === 'on',
            includeFindings: form.get('includeFindings') === 'on',
            includeGaps: form.get('includeGaps') === 'on',
            includeSecurityAppendix: form.get('includeSecurityAppendix') === 'on',
          });
        }}>
          <h2>Generate market-scan document</h2>
          <p>Word output is an immutable snapshot of the selected assessment version.</p>
          {unvalidated && <div className="warn">Unvalidated current-state statements will be labelled and will not be presented as facts.</div>}
          {data.scan.documentReadiness < 80 && <div className="warn">This assessment is not document-ready. You can still generate an internal working draft.</div>}
          <label>Audience
            <select name="audience" defaultValue="Internal"><option>Internal</option><option>External</option></select>
          </label>
          <label>Scope
            <select name="stateScope" defaultValue="Current"><option>Current</option><option>Future</option></select>
          </label>
          <label className="check"><input name="includeDiagrams" type="checkbox" defaultChecked /> Include diagrams</label>
          <label className="check"><input name="includeFindings" type="checkbox" defaultChecked /> Include approved findings</label>
          <label className="check"><input name="includeGaps" type="checkbox" defaultChecked /> Include information gaps</label>
          <label className="check"><input name="includeSecurityAppendix" type="checkbox" /> Include security appendix</label>
          <button className="primary submit" disabled={busy}>{busy ? 'Generating…' : 'Generate Word document'}</button>
        </form>
      </dialog>
    </div>
  );
}
