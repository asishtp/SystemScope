import { useEffect, useState } from 'react';
import { api } from '../landscape/api';
import { formatDate, formatStamp } from './types';
import './market.css';

type DocRow = {
  id: string;
  title: string;
  versionLabel: string;
  format: string;
  status: string;
  generatedBy: string;
  createdAt: string;
  fileName: string;
  templateName: string;
  templateVersion: string;
  assessmentVersion: string;
  approvalState: string;
  approver: string;
  pageCount: number;
  fileSizeBytes: number;
  readiness: number;
  warnings: string;
  activity: { at: string; text: string }[];
};

type Hub = {
  system: { id: string; name: string; acronym: string; catalogKey: string; projectId: string; projectName: string };
  latestVersion: string;
  documentStatus: string;
  snapshotDate: string;
  generatedCount: number;
  readiness: number;
  documents: DocRow[];
};

type Compare = { findingsAdded: number; findingsValidated: number; sectionUpdated: number; securityChanges: number; left: string; right: string };

export function DocumentsHub({
  catalogKey,
  onPreview,
  onGenerate,
  onApproval,
  onPublish,
}: {
  catalogKey: string;
  onPreview: (id: string) => void;
  onGenerate: () => void;
  onApproval: (version: string) => void;
  onPublish: (version: string) => void;
}) {
  const [hub, setHub] = useState<Hub>();
  const [selected, setSelected] = useState<string>();
  const [q, setQ] = useState('');
  const [format, setFormat] = useState('All formats');
  const [status, setStatus] = useState('All statuses');
  const [left, setLeft] = useState('');
  const [right, setRight] = useState('');
  const [compare, setCompare] = useState<Compare>();
  const [notice, setNotice] = useState('');
  const [approver, setApprover] = useState('Michael');
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState(false);
  const load = () => api<Hub>(`/documents/by-key/${catalogKey}`).then(h => {
    setHub(h);
    setSelected(s => s && h.documents.some(d => d.id === s) ? s : h.documents[0]?.id);
    setLeft(v => v || h.documents[0]?.versionLabel || '');
    setRight(v => v || h.documents[1]?.versionLabel || '');
  });
  useEffect(() => { load().catch(e => setNotice(e.message)); }, [catalogKey]);
  if (!hub) return <div className="empty"><p>{notice || 'Loading documents…'}</p></div>;
  const docs = hub.documents.filter(d => {
    if (q && !`${d.title} ${d.versionLabel}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (format !== 'All formats' && d.format !== format && !(format === 'Word' && d.format !== 'PDF')) return false;
    if (status !== 'All statuses' && d.status !== status) return false;
    return true;
  });
  const current = hub.documents.find(d => d.id === selected) ?? hub.documents[0];
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    try { await work(); await load(); }
    catch (e) { setNotice(e instanceof Error ? e.message : 'Action failed'); }
    finally { setBusy(false); }
  };
  const submit = () => run(async () => {
    if (!current) return;
    await api(`/documents/${current.id}/submit`, { method: 'POST', body: JSON.stringify({ approver, comment: `Submitted to ${approver}` }) });
    onApproval(current.versionLabel);
  });
  const markFinal = () => {
    if (!current) return;
    if (current.approvalState !== 'Approved') {
      setNotice('Approve the document before marking it as final and publishing.');
      return;
    }
    onPublish(current.versionLabel);
  };
  const runCompare = async () => {
    const r = await api<Compare>(`/documents/compare/${catalogKey}?left=${encodeURIComponent(left)}&right=${encodeURIComponent(right)}`);
    setCompare(r);
  };
  const statusClass = (s: string) => s === 'Draft' ? 'pill amber' : s === 'Superseded' || s === 'Archived' ? 'pill blue' : s === 'Published' || s === 'Approved' ? 'pill' : 'pill mute';
  return (
    <div className="scan docs-hub">
      <header className="scan-head">
        <div>
          <small>WATER MONITORING SYSTEMS · DOCUMENTS</small>
          <h1>{hub.system.name} documents</h1>
          <p>Manage generated assessment documents, versions, approvals and assessment snapshots.</p>
          <p className="crumb">Documents / Water Monitoring Systems / {hub.system.name}</p>
        </div>
        <div className="scan-head-actions">
          <button className="ghost" onClick={() => setSettings(s => !s)}>Document settings</button>
          <button className="primary" onClick={onGenerate}>Generate all-applications document</button>
        </div>
      </header>
      <div className="notice" style={{ background: '#e7f5f1', color: '#116d63' }}>
        Create one technical assessment covering every application in <b>{hub.system.projectName}</b>, including relationships, requirements, findings and gaps. Choose the all-applications scope on the generation screen.
      </div>
      {notice && <div className="notice">{notice}<button onClick={() => setNotice('')}>×</button></div>}
      {settings && (
        <section className="panel pad-form">
          <h3>Document settings</h3>
          <div className="grid2">
            <label>Default template<select defaultValue="Market Scan – System Assessment"><option>Market Scan – System Assessment</option></select></label>
            <label>Default audience<select defaultValue="Internal market scan"><option>Internal market scan</option><option>External</option></select></label>
          </div>
          <p className="hint">Generated documents remain immutable snapshots. Changing settings applies to the next generation only.</p>
        </section>
      )}
      <div className="scan-kpis">
        <article><small>Latest version</small><strong>{hub.latestVersion}</strong></article>
        <article><small>Document status</small><strong><span className="dot amber" /> {hub.documentStatus}</strong></article>
        <article><small>Assessment snapshot</small><strong>{formatDate(hub.snapshotDate)}</strong></article>
        <article><small>Generated documents</small><strong>{hub.generatedCount}</strong></article>
      </div>
      <div className="scan-overview">
        <div className="domain-main">
          <section className="panel">
            <div className="panel-title"><div><h2>Generated documents</h2></div></div>
            <div className="filters">
              <input placeholder={`Search ${hub.system.name} documents`} value={q} onChange={e => setQ(e.target.value)} />
              <select value={format} onChange={e => setFormat(e.target.value)}><option>All formats</option><option>Word</option><option>PDF</option></select>
              <select value={status} onChange={e => setStatus(e.target.value)}><option>All statuses</option><option>Draft</option><option>Superseded</option><option>Approved</option><option>Published</option><option>Archived</option></select>
            </div>
            <div className="attr-head docs-head"><span>Document</span><span>Version</span><span>Format</span><span>Generated</span><span>Generated by</span><span>Status</span><span>Actions</span></div>
            {docs.map(d => (
              <button className={`attr-row docs-row ${d.id === current?.id ? 'active' : ''}`} key={d.id} onClick={() => setSelected(d.id)}>
                <span><b>{d.title}</b></span>
                <span>{d.versionLabel}</span>
                <span>{d.format}</span>
                <span>{formatStamp(d.createdAt).replace(' · ', ' · ').slice(0, 18)}</span>
                <span>{d.generatedBy}</span>
                <span className={statusClass(d.status)}>{d.status}</span>
                <span className="row-icons">
                  <button type="button" className="ghost compact" onClick={e => { e.stopPropagation(); onPreview(d.id); }}>Preview</button>
                  <a className="ghost compact" href={`/api/documents/${d.id}/file`} onClick={e => e.stopPropagation()}>↓</a>
                </span>
              </button>
            ))}
            {!docs.length && <p className="pad">No documents match the current filters.</p>}
          </section>
          <section className="panel pad-form">
            <div className="compare-bar">
              <b>Version comparison</b>
              <select value={left} onChange={e => setLeft(e.target.value)}>{hub.documents.map(d => <option key={`l-${d.id}`}>{d.versionLabel}</option>)}</select>
              <span>vs</span>
              <select value={right} onChange={e => setRight(e.target.value)}>{hub.documents.map(d => <option key={`r-${d.id}`}>{d.versionLabel}</option>)}</select>
              <button className="ghost compact" onClick={runCompare}>Compare versions</button>
            </div>
            <div className="ops-grid">
              <div className="stat-tile"><small>Findings added</small><b>{compare?.findingsAdded ?? 4}</b></div>
              <div className="stat-tile"><small>Findings validated</small><b>{compare?.findingsValidated ?? 2}</b></div>
              <div className="stat-tile"><small>Section updated</small><b>{compare?.sectionUpdated ?? 1}</b></div>
              <div className="stat-tile"><small>Security changes</small><b>{compare?.securityChanges ?? 0}</b></div>
            </div>
            <h3>Document activity</h3>
            <ol className="activity">
              {(current?.activity?.length ? current.activity : [{ at: current?.createdAt, text: `${current?.versionLabel} generated` }]).map((a, i) => (
                <li key={i}><span>{a.at ? formatStamp(a.at) : ''}</span><b>{a.text}</b></li>
              ))}
            </ol>
          </section>
        </div>
        <aside className="scan-side">
          {current && (
            <section className="panel pad-form">
              <h3>Selected document</h3>
              <p><b>{current.title}</b></p>
              <small>{current.versionLabel} · {current.format} (.{current.format === 'PDF' ? 'pdf' : 'docx'}) <span className={statusClass(current.status)}>{current.status}</span></small>
              <ul className="meta-list">
                <li>Pages <b>{current.pageCount || 12}</b></li>
                <li>Assessment snapshot <b>{current.assessmentVersion || current.versionLabel}</b></li>
                <li>Template <b>{current.templateName || 'Market Scan v1.0'}</b></li>
                <li>Generated <b>{formatStamp(current.createdAt)}</b></li>
                <li>File size <b>{Math.max(1, Math.round((current.fileSizeBytes || 1) / 1024))} KB</b></li>
              </ul>
              <a className="primary submit" href={`/api/documents/${current.id}/file`}>Download document</a>
              <button className="ghost" onClick={() => onPreview(current.id)}>Open preview</button>
            </section>
          )}
          <section className="panel pad-form">
            <h3>Approval</h3>
            <span className={current?.approvalState === 'Approved' ? 'pill' : 'pill mute'}>{current?.approvalState || 'Not submitted'}</span>
            <p className="hint">Submit this document for internal approval when the content is ready.</p>
            <label>Approver
              <select value={approver} onChange={e => setApprover(e.target.value)}>
                <option value="">To be selected</option>
                <option>Michael</option>
                <option>Asish Punnose</option>
              </select>
            </label>
            <button className="ghost" disabled={busy || !current} onClick={submit}>Submit for approval</button>
          </section>
          <section className="panel pad-form">
            <div className="panel-title tight"><div><h3>Readiness at generation</h3></div><b>{current?.readiness ?? hub.readiness}%</b></div>
            <div className="bar fat"><i style={{ width: `${current?.readiness ?? hub.readiness}%` }} /></div>
            <p><span className="pill amber">4 unresolved gaps</span></p>
            <p className="hint">7 confirmed findings · 5 awaiting validation · Security section deferred</p>
          </section>
          <section className="panel pad-form">
            <h3>Document actions</h3>
            <button className="ghost" disabled={busy || !current} onClick={() => run(async () => { if (current) await api(`/documents/${current.id}/copy`, { method: 'POST' }); })}>Create copy</button>
            <button className="ghost" onClick={onGenerate}>Regenerate from latest assessment</button>
            <button className="ghost" disabled={!current} onClick={markFinal}>Mark as final</button>
            <button className="ghost" disabled={busy || !current} onClick={() => run(async () => { if (current) await api(`/documents/${current.id}/archive`, { method: 'POST' }); })}>Archive version</button>
          </section>
        </aside>
      </div>
      <footer className="docs-foot">
        <span>{hub.system.name} document {current?.versionLabel} selected</span>
        <span className="warn compact">Draft documents contain clearly labelled unvalidated content.</span>
        <button className="ghost" onClick={runCompare}>Compare</button>
        {current && <a className="primary" href={`/api/documents/${current.id}/file`}>Download Word document</a>}
      </footer>
    </div>
  );
}

export function DocumentPreview({ catalogKey, onBack, onGenerated }: { catalogKey: string; onBack: () => void; onGenerated: () => void }) {
  const [preview, setPreview] = useState<{
    system: string; subtitle: string; project: string; date: string; readiness: number; completeness: number;
    blocking: string[]; confirmed: number; awaiting: number; rejected: number; snapshot: string; template: string;
    executive: string; areaStatus: { area: string; status: string }[]; architecture: { attribute: string; value: string; claim: string }[];
  }>();
  const [hub, setHub] = useState<Hub>();
  const [projectPreview, setProjectPreview] = useState<{
    project: string; objective: string; scope: string; date: string;
    systems: { id: string; name: string; acronym: string; catalogKey: string; description: string; completeness: number; validation: number; readiness: number }[];
    relationships: { source: string; target: string; name: string; method: string; state: string }[];
    requirements: { title: string; description: string; type: string; category: string; priority: string; mandatory: boolean; acceptanceCriteria: string }[];
  }>({ project: '', objective: '', scope: '', date: '', systems: [], relationships: [], requirements: [] });
  const [audience, setAudience] = useState('Internal market scan');
  const [format, setFormat] = useState('Word');
  const [documentScope, setDocumentScope] = useState<'project' | 'system'>('project');
  const [includeDiagrams, setIncludeDiagrams] = useState(true);
  const [includeGaps, setIncludeGaps] = useState(true);
  const [includeRequirements, setIncludeRequirements] = useState(true);
  const [includeSources, setIncludeSources] = useState(true);
  const [includeSecurity, setIncludeSecurity] = useState(false);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(90);
  const [saved, setSaved] = useState(false);
  const [showBlocking, setShowBlocking] = useState(true);
  const sections = ['Executive summary', 'Scope and approach', 'System overview', 'System architecture & technical design', 'Database', 'Infrastructure & hosting', 'Integrations & data flows', 'Data structures & data quality', 'Security controls & compliance', 'Risks, constraints & information gaps', 'Appendices'];
  const [included, setIncluded] = useState<Record<string, boolean>>(() => Object.fromEntries(sections.map(s => [s, true])));
  useEffect(() => {
    api<typeof preview>(`/documents/preview/${catalogKey}`).then(setPreview).catch(() => undefined);
    api<Hub>(`/documents/by-key/${catalogKey}`).then(setHub).catch(() => undefined);
  }, [catalogKey]);
  useEffect(() => {
    if (documentScope === 'project' && hub?.system.projectId)
      api<typeof projectPreview>(`/documents/preview/project/${hub.system.projectId}`).then(setProjectPreview).catch(() => undefined);
  }, [documentScope, hub?.system.projectId]);
  const generate = async () => {
    if (!hub) return;
    setBusy(true);
    try {
      await api('/documents', {
        method: 'POST',
        body: JSON.stringify({
          projectId: hub.system.projectId,
          systemIds: documentScope === 'project' ? [] : [hub.system.id],
          audience: audience.includes('External') ? 'External' : 'Internal',
          stateScope: 'Current',
          includeDiagrams,
          includeFindings: true,
          includeGaps,
          includeRequirements,
          includeSecurityAppendix: includeSecurity,
          format,
        }),
      });
      onGenerated();
    } finally { setBusy(false); }
  };
  if (!preview) return <div className="empty"><p>Loading preview…</p></div>;
  const latest = hub?.documents[0];
  const areaRows = preview.areaStatus ?? [];
  const sectionPage = (title: string, match: string) => {
    const rows = areaRows.filter(a => a.area.toLowerCase().includes(match.toLowerCase()));
    return <>
      <h1>{preview.system}</h1><h2>{title}</h2>
      <p className="hint">{preview.project}<br />{preview.date}</p>
      {rows.length ? <table className="preview-table">
        <thead><tr><th>Assessment area</th><th>Current status</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.area}><td>{row.area}</td><td>{row.status}</td></tr>)}</tbody>
      </table> : <p>No assessed information is currently recorded for this section.</p>}
    </>;
  };
  const renderPage = () => {
    if (documentScope === 'project' && projectPreview) {
      if (page === 1) return <><h1>{projectPreview.project}</h1><h2>Technical Landscape Assessment</h2><p>{projectPreview.objective}</p><p className="hint">{projectPreview.date} · {projectPreview.systems.length} applications in scope</p></>;
      if (page === 2) return <><h1>Executive summary</h1><p>{projectPreview.scope}</p><table className="preview-table"><thead><tr><th>Application</th><th>Information</th><th>Validation</th><th>Readiness</th></tr></thead><tbody>{projectPreview.systems.map(s => <tr key={s.id}><td>{s.name}{s.acronym ? ` (${s.acronym})` : ''}</td><td>{s.completeness}%</td><td>{s.validation}%</td><td>{s.readiness}%</td></tr>)}</tbody></table></>;
      if (page >= 3 && page <= 8) { const count = Math.max(1, Math.ceil(projectPreview.systems.length / 6)); const shown = projectPreview.systems.slice((page - 3) * count, (page - 2) * count); return <><h1>Application assessments</h1>{shown.map(s => <section key={s.id}><h2>{s.name}{s.acronym ? ` (${s.acronym})` : ''}</h2><p>{s.description || 'Purpose and technical details remain under assessment.'}</p><p className="hint">Information {s.completeness}% · Validation {s.validation}% · Document readiness {s.readiness}%</p></section>)}</>;
      if (page === 9) return <><h1>Application relationships</h1>{projectPreview.relationships.length ? <table className="preview-table"><thead><tr><th>Source</th><th>Target</th><th>Relationship</th><th>Status</th></tr></thead><tbody>{projectPreview.relationships.map((r, i) => <tr key={`${r.source}-${r.target}-${i}`}><td>{r.source}</td><td>{r.target}</td><td>{r.name} · {r.method}</td><td>{r.state}</td></tr>)}</tbody></table> : <p>No application relationships are currently recorded.</p>}</>;
      if (page === 10) return <><h1>Technical and business requirements</h1>{projectPreview.requirements.length ? projectPreview.requirements.map(r => <section key={r.title}><h3>{r.title}</h3><p>{r.description}</p><p className="hint">{r.priority} · {r.type} · {r.category} · {r.mandatory ? 'Mandatory' : 'Desirable'}<br />Acceptance criteria: {r.acceptanceCriteria || 'Not recorded'}</p></section>) : <p>No requirements are currently recorded.</p>}</>;
      }
      if (page === 11) return <><h1>Management considerations</h1><p>The generated document includes approved findings, open information gaps, evidence status and unresolved validation items for every application.</p><p>Unknown and inferred information remains clearly labelled and is not presented as a confirmed fact.</p></>;
      return <><h1>Appendices and source record</h1><table className="preview-table"><tbody><tr><th>Project</th><td>{projectPreview.project}</td></tr><tr><th>Applications included</th><td>{projectPreview.systems.length}</td></tr><tr><th>Relationships recorded</th><td>{projectPreview.relationships.length}</td></tr><tr><th>Requirements included</th><td>{includeRequirements ? projectPreview.requirements.length : 0}</td></tr><tr><th>Generated</th><td>{projectPreview.date}</td></tr></tbody></table></>;
    }
    switch (page) {
      case 1: return <><h1>{preview.system}</h1><h2>{preview.subtitle}</h2><p className="hint">{preview.project}<br />{preview.date}</p><h3>Current-state system assessment</h3><p>Generated from SystemScope assessment snapshot {preview.snapshot}.</p></>;
      case 2: return <><h1>{preview.system}</h1><h2>Executive summary</h2><p>{preview.executive}</p><table className="preview-table"><thead><tr><th>Assessment area</th><th>Current status</th></tr></thead><tbody>{areaRows.map(a => <tr key={a.area}><td>{a.area}</td><td>{a.status}</td></tr>)}</tbody></table></>;
      case 3: return <><h1>{preview.system}</h1><h2>Scope and assessment approach</h2><p>This document presents the current assessment information recorded for {preview.system} within {preview.project}.</p><table className="preview-table"><tbody><tr><th>Information completeness</th><td>{preview.completeness}%</td></tr><tr><th>Document readiness</th><td>{preview.readiness}%</td></tr><tr><th>Assessment snapshot</th><td>{preview.snapshot}</td></tr></tbody></table></>;
      case 4: return <><h1>{preview.system}</h1><h2>System overview</h2><p>{preview.executive}</p><table className="preview-table"><thead><tr><th>Assessment area</th><th>Current status</th></tr></thead><tbody>{areaRows.map(a => <tr key={a.area}><td>{a.area}</td><td>{a.status}</td></tr>)}</tbody></table></>;
      case 5: return <><h1>{preview.system}</h1><h2>System architecture &amp; technical design</h2>{(preview.architecture ?? []).length ? <table className="preview-table"><thead><tr><th>Attribute</th><th>Recorded value</th><th>Evidence status</th></tr></thead><tbody>{preview.architecture.map(r => <tr key={r.attribute}><td>{r.attribute}</td><td>{r.value}</td><td>{r.claim === 'Inference' ? 'Inferred' : 'Confirmed'}</td></tr>)}</tbody></table> : <p>No architecture information is currently recorded.</p>}</>;
      case 6: return sectionPage('Database and data storage', 'database');
      case 7: return sectionPage('Infrastructure and hosting', 'infrastructure');
      case 8: return sectionPage('Integrations and data flows', 'integration');
      case 9: return sectionPage('Data quality and governance', 'data quality');
      case 10: return sectionPage('Security and access controls', 'security');
      case 11: return <><h1>{preview.system}</h1><h2>Risks, findings and information gaps</h2>{preview.blocking.length ? <ul>{preview.blocking.map(issue => <li key={issue}>{issue}</li>)}</ul> : <p>No blocking issues are currently recorded.</p>}<table className="preview-table"><tbody><tr><th>Confirmed findings</th><td>{preview.confirmed}</td></tr><tr><th>Awaiting validation</th><td>{preview.awaiting}</td></tr><tr><th>Rejected</th><td>{preview.rejected}</td></tr></tbody></table></>;
      default: return <><h1>{preview.system}</h1><h2>Appendices and source record</h2><table className="preview-table"><tbody><tr><th>Project</th><td>{preview.project}</td></tr><tr><th>Assessment date</th><td>{preview.date}</td></tr><tr><th>Snapshot</th><td>{preview.snapshot}</td></tr><tr><th>Template version</th><td>{preview.template}</td></tr><tr><th>Source references included</th><td>{includeSources ? 'Yes' : 'No'}</td></tr><tr><th>Security appendix included</th><td>{includeSecurity ? 'Yes' : 'No'}</td></tr></tbody></table></>;
    }
  };
  return (
    <div className="scan docs-preview">
      <header className="scan-head">
        <div>
          <small>WATER MONITORING SYSTEMS · DOCUMENTS</small>
          <h1>{documentScope === 'project' ? preview.project : preview.system} technical assessment document</h1>
          <p>{documentScope === 'project' ? 'Generate one management-ready technical document covering every application in the project.' : 'Preview validated assessment content and configure the document before generation.'}</p>
          <p className="crumb"><button className="linkish" onClick={onBack}>Documents</button> / Water Monitoring Systems / {preview.system}</p>
          <div className="scan-pills"><span className="pill mute">Draft preview</span><span className="pill">{preview.completeness}% information complete</span></div>
        </div>
        <div className="scan-head-actions">
          <button className="ghost" onClick={() => setSaved(true)}>Save configuration</button>
          <button className="primary" disabled={busy} onClick={generate}>Generate document</button>
        </div>
      </header>
      {saved && <div className="notice" style={{ background: '#e7f5f1', color: '#116d63' }}>Configuration saved for this preview. Generation still creates an immutable snapshot.</div>}
      <div className="preview-grid">
        <aside className="panel pad-form">
          <h3>Document settings</h3>
          <label>Document scope<select value={documentScope} onChange={e => setDocumentScope(e.target.value as 'project' | 'system')}><option value="project">All applications in this project</option><option value="system">This application only ({preview.system})</option></select></label>
          <label>Template<select defaultValue="Market Scan – System Assessment"><option>Market Scan – System Assessment</option></select></label>
          <label>Audience<select value={audience} onChange={e => setAudience(e.target.value)}><option>Internal market scan</option><option>External</option></select></label>
          <label>Assessment date<input type="date" defaultValue="2026-08-20" /></label>
          <label>Assessment state<select defaultValue="Current state"><option>Current state</option><option>Future state</option></select></label>
          <div className="format-toggle">
            <button type="button" className={format === 'Word' ? 'selected' : ''} onClick={() => setFormat('Word')}>Word (.docx)</button>
            <button type="button" className={format === 'PDF' ? 'selected' : ''} onClick={() => setFormat('PDF')}>PDF</button>
          </div>
          <label className="check"><input type="checkbox" checked={includeDiagrams} onChange={e => setIncludeDiagrams(e.target.checked)} /> Include diagrams</label>
          <label className="check"><input type="checkbox" checked={includeGaps} onChange={e => setIncludeGaps(e.target.checked)} /> Include risks and gaps</label>
          <label className="check"><input type="checkbox" checked={includeRequirements} onChange={e => setIncludeRequirements(e.target.checked)} /> Include technical and business requirements</label>
          <label className="check"><input type="checkbox" checked={includeSources} onChange={e => setIncludeSources(e.target.checked)} /> Include source references</label>
          <label className="check"><input type="checkbox" checked={includeSecurity} onChange={e => setIncludeSecurity(e.target.checked)} /> Include security appendix</label>
          <h3>Sections</h3>
          {sections.map(s => (
            <label className="check" key={s}>
              <input type="checkbox" checked={included[s] !== false} onChange={e => setIncluded({ ...included, [s]: e.target.checked })} /> {s} {s.startsWith('Security') && <span className="pill amber">Deferred</span>}
            </label>
          ))}
        </aside>
        <section className="panel preview-paper">
          <div className="paper-toolbar">
            <button className="ghost compact" onClick={() => setPage(Math.max(1, page - 1))}>‹</button>
            <span>Page {page} of 12</span>
            <button className="ghost compact" onClick={() => setPage(Math.min(12, page + 1))}>›</button>
            <button className="ghost compact" onClick={() => setZoom(z => Math.max(70, z - 10))}>−</button>
            <span>{zoom}%</span>
            <button className="ghost compact" onClick={() => setZoom(z => Math.min(130, z + 10))}>+</button>
            {latest && <a className="ghost compact" href={`/api/documents/${latest.id}/file`}>↓</a>}
          </div>
          <article className="paper" style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}>
            {renderPage()}
            <p className="hint">SystemScope · {preview.system} assessment · Draft</p>
          </article>
        </section>
        <aside className="scan-side">
          <section className="panel pad-form">
            <h3>Document readiness</h3>
            <strong>Not ready</strong>
            <span className="pill amber">{preview.blocking.length} blocking issues</span>
            <div className="bar fat"><i style={{ width: `${preview.readiness}%` }} /></div>
            <p className="hint">{preview.confirmed} confirmed findings · {preview.awaiting} awaiting validation · {preview.rejected} rejected</p>
          </section>
          <section className="panel">
            <div className="panel-title"><div><h3>Blocking issues</h3></div></div>
            {(showBlocking ? preview.blocking : preview.blocking.slice(0, 2)).map(b => <div className="side-row" key={b}><span>△ {b}</span></div>)}
            <button className="ghost pad" onClick={() => setShowBlocking(true)}>Review blocking issues</button>
          </section>
          <section className="panel pad-form">
            <h3>Content controls</h3>
            <p className="hint">✓ Approved findings only</p>
            <p className="hint">✓ Label assumptions and unknowns</p>
            <p className="hint">✓ Separate current and future state</p>
            <p className="hint">Restricted security details excluded</p>
          </section>
          <section className="panel pad-form">
            <h3>Snapshot</h3>
            <p>Assessment <b>{preview.snapshot}</b></p>
            <p>Template <b>v{preview.template}</b></p>
            <p className="hint">20 Aug 2026 · 16:40 AEST</p>
          </section>
        </aside>
      </div>
      <footer className="docs-foot">
        <span>Preview generated from the latest assessment snapshot</span>
        <span className="warn compact">Document will clearly label unvalidated content.</span>
        {latest ? <a className="ghost" href={`/api/documents/${latest.id}/file`}>Export preview</a> : <button className="ghost" disabled={busy} onClick={generate}>Export preview</button>}
        <button className="primary" disabled={busy} onClick={generate}>Generate Word document</button>
      </footer>
    </div>
  );
}
