import { useEffect, useState } from 'react';
import { api } from '../landscape/api';
import { formatDate, formatStamp, pillClass } from './types';
import './market.css';
import { GwdbLandscape } from '../landscape/GwdbLandscape';

type Profile = {
  breadcrumb: string[];
  summary: string;
  validationLabel: string;
  classification: string;
  lifecycle: string;
  criticality: string;
  businessOwner: string;
  technicalOwner: string;
  assessmentLead: string;
  projectManager: string;
  lastUpdated: string;
  informationCompleteness: number;
  validationCompleteness: number;
  documentReadiness: number;
  confirmed: number;
  awaiting: number;
  openGaps: number;
  lastAssessed: string;
  technology: { name: string; value: string; status: string }[];
  relationships: { name: string; detail: string; status: string; catalogKey: string }[];
  domains: { kind: string; title: string; completeness: number; evidenceCount: number; gapCount: number; requirement: string; summary: string; status?: string }[];
  priorityGaps: { id: string; missingInformation: string; domain: string; status: string }[];
  publishedDocuments: { id: string; title: string; versionLabel: string; publishedVersion: string; classification: string; status: string; recordId: string; fileName: string; format: string }[];
  findings: { id: string; title: string; type: string; domain: string; confidence: string; sources: number; status: string }[];
  evidence: { id: string; title: string; sourceType: string; completeness: string; updatedAt: string; url?: string; links?: { entityType: string; entityId: string }[] }[];
  activity: { timestamp: string; actorName: string; action: string; entityType: string; detail: string }[];
  capabilities?: { id: string; capabilityId: string; catalogKey: string; name: string; level: string; role: string; maturityScore?: number | null; state: string; validation: string }[];
  informationAssets?: { id: string; informationAssetId: string; catalogKey: string; name: string; classification: string; role: string; state: string; validation: string }[];
};

type Payload = {
  workspace: { system: { id: string; name: string; catalogKey: string; projectId: string; acronym: string } };
  profile: Profile;
};

const TABS = ['Overview', 'Capabilities', 'Technology', 'Integrations', 'Data', 'Evidence', 'Findings', 'Documents', 'History'] as const;

export function SystemProfile({
  catalogKey,
  initialTab,
  onOpenAssessment,
  onOpenDocuments,
  onOpenPublished,
  onOpenSystem,
  onEvidence,
  onOpenLearn,
}: {
  catalogKey: string;
  initialTab?: string;
  onOpenAssessment: (key: string, tab?: string) => void;
  onOpenDocuments: (key: string) => void;
  onOpenPublished: (recordId: string) => void;
  onOpenSystem: (key: string) => void;
  onEvidence: (key: string) => void;
  onOpenLearn?: (key: string) => void;
}) {
  const [data, setData] = useState<Payload>();
  const [tab, setTab] = useState(initialTab && TABS.some(t => t.toLowerCase() === initialTab.toLowerCase()) ? initialTab : 'Overview');
  const [error, setError] = useState('');
  useEffect(() => {
    api<Payload>(`/scan/profile/${encodeURIComponent(catalogKey)}`).then(setData).catch(e => setError(e.message));
  }, [catalogKey]);
  if (catalogKey.toLowerCase() === 'gwdb' && initialTab === 'landscape') {
    return <GwdbLandscape systemKey={catalogKey} onBack={() => onOpenSystem(catalogKey)} onReview={() => onOpenAssessment(catalogKey)} />;
  }
  if (error) return <div className="empty"><p>{error}</p></div>;
  if (!data) return <div className="empty"><p>Loading system profile…</p></div>;
  const p = data.profile;
  const name = data.workspace.system.name;
  return (
    <div className="scan profile-page">
      <header className="scan-head">
        <div>
          <small>WATER MONITORING SYSTEMS · SYSTEM PROFILE</small>
          <h1>{name}</h1>
          <p>Authoritative system record for assessment, ownership, technology, relationships and published documentation.</p>
          <p className="crumb">{p.breadcrumb.join(' / ')}</p>
          <div className="scan-pills">
            <span className="pill mute">{p.lifecycle}</span>
            <span className="pill amber">In assessment</span>
            <span className="pill">{p.classification}</span>
          </div>
        </div>
        <div className="scan-head-actions">
          <button className="ghost">Edit system</button>
          {catalogKey.toLowerCase() === 'gwdb' && <button className="ghost" onClick={() => { window.location.hash = '/systems/gwdb/landscape'; }}>Current landscape</button>}
          {onOpenLearn && catalogKey.toLowerCase() === 'gwdb' && <button className="ghost" onClick={() => onOpenLearn(catalogKey)}>Learn GWDB</button>}
          <button className="primary" onClick={() => onOpenAssessment(catalogKey)}>Open assessment</button>
        </div>
      </header>

      <div className="scan-meta profile-meta">
        <div><small>Business owner</small><b>{p.businessOwner}</b></div>
        <div><small>Technical owner</small><b>{p.technicalOwner}</b></div>
        <div><small>Assessment lead</small><b>{p.assessmentLead}</b></div>
        <div><small>Lifecycle</small><b>{p.lifecycle}</b></div>
        <div><small>Criticality</small><b>{p.criticality}</b></div>
        <div><small>Last updated</small><b>{formatDate(p.lastUpdated)}</b></div>
      </div>

      <div className="scan-tabs">
        {TABS.map(t => <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>)}
      </div>

      {tab === 'Overview' && (
        <div className="profile-grid">
          <section className="panel pad-form">
            <div className="panel-title"><div><h2>System summary</h2></div><button className="ghost compact">Edit summary</button></div>
            <p>{p.summary}</p>
            <span className={pillClass(p.validationLabel)}>{p.validationLabel}</span>
            {!!p.capabilities?.length && (
              <div className="chip-row" style={{ marginTop: 12 }}>
                {p.capabilities.map(c => <span className="tech-chip" key={c.id}>{c.name}</span>)}
              </div>
            )}
          </section>
          <section className="panel">
            <div className="panel-title"><div><h2>Assessment coverage</h2></div></div>
            {p.domains.map(d => (
              <button className="side-row coverage-row" key={d.kind} onClick={() => onOpenAssessment(catalogKey, d.kind === 'DataQuality' ? 'data' : d.kind.toLowerCase())}>
                <span>
                  <b>{d.title}</b>
                  {d.status === 'Deferred' || d.status === 'Not assessed'
                    ? <small>{d.status}</small>
                    : <span className="mini-bar"><i style={{ width: `${d.completeness}%` }} /></span>}
                </span>
                <span className="hint">{d.status === 'Deferred' || d.status === 'Not assessed' ? d.status : `${d.completeness}%`}</span>
                <span className="hint">{d.status ? '' : `${d.evidenceCount} evidence`}</span>
                <span className="hint">{d.status ? '' : `${d.gapCount} gaps`}</span>
                <span>›</span>
              </button>
            ))}
            <div className="pad"><button className="primary" onClick={() => onOpenAssessment(catalogKey)}>Open full assessment</button></div>
          </section>
          <section className="panel">
            <div className="panel-title"><div><h2>Technology snapshot</h2></div></div>
            {p.technology.map(t => (
              <div className="attr-row" key={t.name}>
                <span>{t.name}</span>
                <span>{t.value}</span>
                <span className={pillClass(t.status)}>{t.status}</span>
              </div>
            ))}
            <button className="ghost pad" onClick={() => setTab('Technology')}>View technology inventory</button>
          </section>
          <section className="panel">
            <div className="panel-title"><div><h2>Key relationships</h2></div></div>
            {p.relationships.map(r => (
              <button className="side-row" key={r.name} onClick={() => r.catalogKey && onOpenSystem(r.catalogKey)}>
                <span><b>{r.name}</b><small>{r.detail}</small></span>
                <span className={pillClass(r.status)}>{r.status}</span>
              </button>
            ))}
            <button className="ghost pad" onClick={() => setTab('Integrations')}>View integration map</button>
          </section>
          <aside className="scan-side">
            <section className="panel pad-form">
              <h3>Profile completeness</h3>
              <strong className="progress-label">{p.informationCompleteness}%</strong>
              <div className="bar fat"><i style={{ width: `${p.informationCompleteness}%` }} /></div>
              <div className="progress-stats">
                <span>{p.confirmed} confirmed</span>
                <span>{p.awaiting} awaiting validation</span>
                <span>{p.openGaps} open gaps</span>
              </div>
              <p className="hint">Last assessed {formatDate(p.lastAssessed)}</p>
              <button className="primary" onClick={() => onOpenAssessment(catalogKey)}>Continue assessment</button>
            </section>
            <section className="panel">
              <div className="panel-title"><div><h2>Priority information gaps</h2></div></div>
              {p.priorityGaps.map(g => (
                <button className="side-row" key={g.id} onClick={() => onOpenAssessment(catalogKey, g.domain === 'DataQuality' ? 'data' : g.domain.toLowerCase())}>
                  <span>△ {g.missingInformation}</span><span>›</span>
                </button>
              ))}
              <button className="linkish pad" onClick={() => onOpenAssessment(catalogKey)}>View all {p.openGaps} gaps</button>
            </section>
            <section className="panel pad-form">
              <h3>Published documents</h3>
              {p.publishedDocuments.map(d => (
                <div key={d.id} className="doc-mini">
                  <b>{d.title}</b>
                  <p className="hint">Published {d.publishedVersion || d.versionLabel} · {d.classification}</p>
                  <div className="scan-head-actions">
                    <button className="ghost compact" onClick={() => onOpenPublished(d.recordId || 'DOC-AQUIS-0001')}>Open document</button>
                    <a className="ghost compact" href={`/api/documents/${d.id}/file`}>Download</a>
                  </div>
                </div>
              ))}
              <button className="linkish" onClick={() => onOpenDocuments(catalogKey)}>View all documents</button>
            </section>
          </aside>
        </div>
      )}

      {tab === 'Overview' && (
        <div className="profile-lower">
          <section className="panel">
            <div className="panel-title"><div><h2>Recent evidence and findings</h2></div></div>
            <div className="scan-tabs">
              <button className="active">Findings</button>
              <button onClick={() => setTab('Evidence')}>Evidence</button>
            </div>
            <div className="attr-head" style={{ gridTemplateColumns: '120px 2fr 1fr 1fr 80px 100px 20px' }}>
              <span>Type</span><span>Finding</span><span>Domain</span><span>Confidence</span><span>Sources</span><span>Status</span>
            </div>
            {p.findings.map(f => (
              <div className="attr-row table" key={f.id} style={{ gridTemplateColumns: '120px 2fr 1fr 1fr 80px 100px 20px' }}>
                <span>{f.status === 'Confirmed' ? 'Confirmed finding' : f.type === 'InformationGap' ? 'Information gap' : 'Finding'}</span>
                <span><b>{f.title}</b></span>
                <span>{f.domain}</span>
                <span>{f.confidence} confidence</span>
                <span>{f.sources || '—'}</span>
                <span className={pillClass(f.status)}>{f.status}</span>
                <span>›</span>
              </div>
            ))}
            <div className="pad"><button className="ghost compact">View all findings</button> <button className="ghost compact" onClick={() => onEvidence(catalogKey)}>Add evidence</button></div>
          </section>
          <section className="panel pad-form">
            <h3>Ownership and contacts</h3>
            <p>Business owner <b>{p.businessOwner}</b></p>
            <p>Technical owner <b>{p.technicalOwner}</b></p>
            <p>Assessment lead <b>{p.assessmentLead}</b></p>
            <p>Project manager <b>{p.projectManager}</b></p>
            <button className="ghost compact">Manage ownership</button>
          </section>
          <section className="panel">
            <div className="panel-title"><div><h2>Recent activity</h2></div></div>
            {p.activity.slice(0, 4).map(a => (
              <div className="side-row" key={a.timestamp + a.detail}>
                <span><small>{formatStamp(a.timestamp)}</small><b>{a.detail || `${a.action} ${a.entityType}`}</b></span>
              </div>
            ))}
            <button className="ghost pad" onClick={() => setTab('History')}>View full history</button>
          </section>
        </div>
      )}

      {tab === 'Capabilities' && (
        <section className="panel">
          <div className="panel-title"><div><h2>Business capabilities</h2><p>What this system provides, independent of technology.</p></div></div>
          {!p.capabilities?.length && <p className="pad">No structured capabilities are linked yet. Legacy text remains on the system record until coverage is mapped.</p>}
          {p.capabilities?.map(c => (
            <div className="side-row" key={c.id}>
              <span><b>{c.name}</b><small>{c.level} · {c.role}{c.maturityScore ? ` · maturity ${c.maturityScore}` : ''}</small></span>
              <span className={pillClass(c.validation)}>{c.validation}</span>
            </div>
          ))}
        </section>
      )}
      {tab === 'Technology' && <section className="panel">{p.technology.map(t => <div className="attr-row" key={t.name}><span>{t.name}</span><span>{t.value}</span><span className={pillClass(t.status)}>{t.status}</span></div>)}</section>}
      {tab === 'Integrations' && <section className="panel">{p.relationships.map(r => <div className="side-row" key={r.name}><span><b>{r.name}</b><small>{r.detail}</small></span><span className={pillClass(r.status)}>{r.status}</span></div>)}</section>}
      {tab === 'Evidence' && (
        <section className="panel">
          <div className="panel-title"><div><h2>Evidence</h2><p>HTTPS sources linked to this system. Use Add evidence to register another approved-host URL.</p></div></div>
          {p.evidence.map(e => (
            <div className="side-row" key={e.id}>
              <span>
                <b>{e.title}</b>
                <small>{e.sourceType}{e.links?.length ? ` · ${e.links.length} linked record${e.links.length === 1 ? '' : 's'}` : ''}</small>
              </span>
              <span className={pillClass(e.completeness)}>{e.completeness}</span>
            </div>
          ))}
          {!p.evidence.length && <p className="pad">No evidence registered yet.</p>}
          <div className="pad"><button className="primary" onClick={() => onEvidence(catalogKey)}>Add evidence</button></div>
        </section>
      )}
      {tab === 'Findings' && <section className="panel">{p.findings.map(f => <div className="side-row" key={f.id}><span><b>{f.title}</b></span><span className={pillClass(f.status)}>{f.status}</span></div>)}</section>}
      {tab === 'Documents' && <section className="panel pad-form">{p.publishedDocuments.map(d => <button key={d.id} className="side-row" onClick={() => onOpenPublished(d.recordId)}><span><b>{d.title}</b></span><span className="pill">{d.status}</span></button>)}<button className="primary" onClick={() => onOpenDocuments(catalogKey)}>Open documents hub</button></section>}
      {tab === 'History' && <section className="panel">{p.activity.map(a => <div className="audit-row" key={a.timestamp + a.detail}><span>◴</span><div><b>{a.detail}</b><small>{a.actorName} · {formatStamp(a.timestamp)}</small></div></div>)}</section>}
      {tab === 'Data' && (
        <section className="panel">
          <div className="panel-title">
            <div>
              <h2>Information assets</h2>
              <p>Business data objects. Quality ratings remain on data-quality domains, not on these assets.</p>
            </div>
          </div>
          {!p.informationAssets?.length && <p className="pad">No information assets are linked yet.</p>}
          {p.informationAssets?.map(a => (
            <div className="side-row" key={a.id}>
              <span><b>{a.name}</b><small>{a.classification} · {a.role}</small></span>
              <span className={pillClass(a.validation)}>{a.validation}</span>
            </div>
          ))}
          <div className="pad-form">
            <p>Open the data-quality assessment to capture domains, owners and quality ratings.</p>
            <button className="primary" onClick={() => onOpenAssessment(catalogKey, 'data')}>Open data assessment</button>
          </div>
        </section>
      )}

      <footer className="docs-foot">
        <span>{name} · System record</span>
        <span className="hint">Validation status is shown for all assessed information.</span>
        <button className="ghost" onClick={() => onEvidence(catalogKey)}>Add evidence</button>
        <button className="primary" onClick={() => onOpenAssessment(catalogKey)}>Open current assessment</button>
      </footer>
    </div>
  );
}
