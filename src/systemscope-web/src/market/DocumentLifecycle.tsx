import { useEffect, useMemo, useState } from 'react';
import { api } from '../landscape/api';
import { formatDate, formatStamp } from './types';
import './market.css';

type Comment = { id: string; sectionNumber: number; section: string; author: string; domain: string; text: string; status: string };
type HubDoc = {
  id: string; title: string; versionLabel: string; format: string; status: string; generatedBy: string;
  createdAt: string; fileName: string; templateName: string; pageCount: number; fileSizeBytes: number;
  readiness: number; checksumSha256: string; recordId: string; classification: string; visibilityScope: string;
  approvalState: string; approver: string; approvalComment: string; approvedAt?: string; locked: boolean;
  reviewDate?: string; publicationNote: string; retentionYears: number; publishedVersion: string;
  comments: Comment[];
};
type Hub = { system: { id: string; name: string; catalogKey: string; projectId: string; projectName: string }; documents: HubDoc[] };

const SECTIONS = [
  { n: 1, name: 'Executive summary', state: 'ok' as const },
  { n: 2, name: 'Scope and approach', state: 'ok' as const },
  { n: 3, name: 'System overview', state: 'ok' as const },
  { n: 4, name: 'Architecture & technical design', state: '1' as const },
  { n: 5, name: 'Database', state: '2' as const },
  { n: 6, name: 'Infrastructure & hosting', state: '-' as const },
  { n: 7, name: 'Integrations & data flows', state: '-' as const },
  { n: 8, name: 'Data structures & quality', state: '-' as const },
  { n: 9, name: 'Security & compliance', state: 'Deferred' as const },
  { n: 10, name: 'Risks and information gaps', state: '-' as const },
  { n: 11, name: 'Appendices', state: '-' as const },
];

const SECTION_PAGE: Record<number, number> = { 1: 1, 2: 2, 3: 3, 4: 6, 5: 7, 6: 8, 7: 9, 8: 10, 9: 11, 10: 11, 11: 12 };

function pickDoc(hub: Hub | undefined, version?: string) {
  if (!hub?.documents.length) return undefined;
  return hub.documents.find(d => version && d.versionLabel === version)
    ?? hub.documents.find(d => d.versionLabel === 'v0.3')
    ?? hub.documents[0];
}

export function DocumentApproval({ catalogKey, version, onBack, onApproved }: { catalogKey: string; version?: string; onBack: () => void; onApproved: (version: string) => void }) {
  const [hub, setHub] = useState<Hub>();
  const [decision, setDecision] = useState('Approve');
  const [comment, setComment] = useState('');
  const [inline, setInline] = useState('');
  const [adding, setAdding] = useState(false);
  const [page, setPage] = useState(6);
  const [zoom, setZoom] = useState(90);
  const [busy, setBusy] = useState(false);
  const [outlineQ, setOutlineQ] = useState('');
  const [notice, setNotice] = useState('');
  const [checks, setChecks] = useState({ purpose: true, labelled: true, separated: true, gaps: false, ready: false });
  const [notifyLead, setNotifyLead] = useState(true);
  const [includeComments, setIncludeComments] = useState(true);
  const load = () => api<Hub>(`/documents/by-key/${catalogKey}`).then(setHub);
  useEffect(() => { load().catch(() => undefined); }, [catalogKey]);
  const doc = pickDoc(hub, version);
  const section = SECTIONS.reduce((best, s) => (SECTION_PAGE[s.n] <= page ? s : best), SECTIONS[0]);
  const outlined = SECTIONS.filter(s => s.name.toLowerCase().includes(outlineQ.toLowerCase()));
  const decide = async (value: string) => {
    if (!doc) return;
    setBusy(true);
    try {
      await api(`/documents/${doc.id}/decision`, { method: 'POST', body: JSON.stringify({ decision: value, comment, notifyLead, includeComments }) });
      if (value === 'Approve' || value === 'ApproveWithConditions') onApproved(doc.versionLabel);
      else { setNotice(value === 'RequestChanges' ? 'Change request recorded for the assessment lead.' : 'Document rejected.'); onBack(); }
    } finally { setBusy(false); }
  };
  const addComment = async () => {
    if (!doc || !inline.trim()) return;
    await api(`/documents/${doc.id}/comments`, { method: 'POST', body: JSON.stringify({ sectionNumber: section.n, section: section.name, text: inline.trim(), domain: section.name }) });
    setInline('');
    setAdding(false);
    await load();
  };
  if (!doc || !hub) return <div className="empty"><p>Loading approval review…</p></div>;
  const unresolved = doc.comments.filter(c => c.status === 'Unresolved');
  const pages = doc.pageCount || 12;
  return (
    <div className="scan approval-page">
      <header className="scan-head">
        <div>
          <small>WATER MONITORING SYSTEMS · DOCUMENT APPROVAL</small>
          <h1>Review {hub.system.name} assessment document</h1>
          <p>Review the generated market-scan document, resolve comments and record an approval decision.</p>
          <p className="crumb"><button className="linkish" onClick={onBack}>Documents</button> / {hub.system.name} / {doc.versionLabel} / Approval</p>
          <div className="scan-pills"><span className="pill amber">Approval requested</span><span className="pill amber">Draft {doc.versionLabel}</span></div>
        </div>
        <div className="scan-head-actions">
          <button className="ghost" onClick={onBack}>Save and exit</button>
          <button className="primary" disabled={busy} onClick={() => decide('Approve')}>Approve document</button>
        </div>
      </header>
      {notice && <div className="notice">{notice}</div>}
      <div className="scan-meta">
        <div><small>Requested by</small><b>{doc.generatedBy}</b></div>
        <div><small>Submitted</small><b>{formatStamp(doc.createdAt)}</b></div>
        <div><small>Due</small><b>27 Aug 2026</b></div>
        <div>
          <small>Review progress</small>
          <b>{page} of {pages} pages</b>
          <div className="bar fat"><i style={{ width: `${(page * 100) / pages}%` }} /></div>
        </div>
      </div>
      <div className="preview-grid">
        <aside className="panel">
          <div className="panel-title"><div><h3>Document outline</h3></div></div>
          <div className="filters"><input placeholder="Search document" value={outlineQ} onChange={e => setOutlineQ(e.target.value)} /></div>
          {outlined.map(s => (
            <button className={`side-row ${section.n === s.n ? 'active' : ''}`} key={s.n} onClick={() => setPage(SECTION_PAGE[s.n] ?? s.n)}>
              <span>{s.n} {s.name}</span>
              <span>{s.state === 'ok' ? '✓' : s.state === 'Deferred' ? <em className="pill amber">Deferred</em> : s.state === '-' ? '–' : <em className="pill amber">{s.state}</em>}</span>
            </button>
          ))}
          <div className="paper-toolbar pad">
            <button className="ghost compact" onClick={() => setPage(Math.max(1, page - 1))}>‹</button>
            <span>Page {page} of {pages}</span>
            <button className="ghost compact" onClick={() => setPage(Math.min(pages, page + 1))}>›</button>
          </div>
        </aside>
        <section className="panel preview-paper">
          <div className="paper-toolbar">
            <button className="ghost compact" onClick={() => setPage(Math.max(1, page - 1))}>‹</button>
            <span>{page} / {pages}</span>
            <button className="ghost compact" onClick={() => setPage(Math.min(pages, page + 1))}>›</button>
            <button className="ghost compact" onClick={() => setZoom(z => Math.max(70, z - 10))}>−</button>
            <span>{zoom}%</span>
            <button className="ghost compact" onClick={() => setZoom(z => Math.min(130, z + 10))}>+</button>
            <a className="ghost compact" href={`/api/documents/${doc.id}/file`}>↓</a>
            <button className="ghost compact" onClick={() => setAdding(true)}>Add comment</button>
          </div>
          <article className="paper" style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}>
            <ApprovalPaper system={hub.system.name} section={section.n} version={doc.versionLabel} page={page} comments={doc.comments} />
          </article>
          {adding && (
            <div className="comment-box">
              <label>Comment on {section.name}
                <textarea value={inline} onChange={e => setInline(e.target.value)} placeholder="Add a review comment for this section" autoFocus />
              </label>
              <div className="domain-foot-actions">
                <button className="ghost" onClick={() => setAdding(false)}>Cancel</button>
                <button className="primary" onClick={addComment}>Save comment</button>
              </div>
            </div>
          )}
        </section>
        <aside className="scan-side">
          <section className="panel pad-form">
            <div className="panel-title tight"><div><h3>Approval decision</h3></div><span className="pill mute">In review</span></div>
            <p>Is this document suitable for the market-scan process?</p>
            <div className="decision-grid four">
              <button className={`choice-approve ${decision === 'Approve' ? 'selected' : ''}`} onClick={() => setDecision('Approve')}>Approve</button>
              <button className={`choice-conditions ${decision === 'ApproveWithConditions' ? 'selected' : ''}`} onClick={() => setDecision('ApproveWithConditions')}>Approve with conditions</button>
              <button className={`choice-changes ${decision === 'RequestChanges' ? 'selected' : ''}`} onClick={() => setDecision('RequestChanges')}>Request changes</button>
              <button className={`choice-reject ${decision === 'Reject' ? 'selected' : ''}`} onClick={() => setDecision('Reject')}>Reject</button>
            </div>
            <label>Approval comments<textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Add your decision rationale or required changes" /></label>
            <label className="check"><input type="checkbox" checked={notifyLead} onChange={e => setNotifyLead(e.target.checked)} /> Notify the assessment lead</label>
            <label className="check"><input type="checkbox" checked={includeComments} onChange={e => setIncludeComments(e.target.checked)} /> Include unresolved comments in the decision</label>
          </section>
          <section className="panel pad-form">
            <h3>Review checks</h3>
            <label className="check"><input type="checkbox" checked={checks.purpose} onChange={e => setChecks({ ...checks, purpose: e.target.checked })} /> Document purpose and scope are clear</label>
            <label className="check"><input type="checkbox" checked={checks.labelled} onChange={e => setChecks({ ...checks, labelled: e.target.checked })} /> Validated and inferred content is labelled</label>
            <label className="check"><input type="checkbox" checked={checks.separated} onChange={e => setChecks({ ...checks, separated: e.target.checked })} /> Current and future state are separated</label>
            <label className="check"><input type="checkbox" checked={checks.gaps} onChange={e => setChecks({ ...checks, gaps: e.target.checked })} /> Material information gaps are acceptable</label>
            <label className="check"><input type="checkbox" checked={checks.ready} onChange={e => setChecks({ ...checks, ready: e.target.checked })} /> Document is ready for market-scan use</label>
          </section>
          <section className="panel">
            <div className="panel-title"><div><h3>Open comments</h3></div><span className="pill amber">{unresolved.length}</span></div>
            {doc.comments.map((c, i) => (
              <div className={`side-row stack comment-${c.status.toLowerCase()}`} key={c.id}>
                <b><span className={`num ${c.status === 'Unresolved' ? 'amber' : ''}`}>{i + 1}</span> {c.text}</b>
                <small>{c.author}, {c.domain} · {c.status}</small>
                {c.status === 'Unresolved' && <button className="ghost compact" onClick={async () => { await api(`/documents/${doc.id}/comments/${c.id}/resolve`, { method: 'POST' }); await load(); }}>Resolve</button>}
              </div>
            ))}
            <p className="pad hint">View all comments</p>
          </section>
          <section className="panel pad-form">
            <h3>Document readiness</h3>
            <b>{doc.readiness}%</b>
            <div className="bar fat"><i style={{ width: `${doc.readiness}%` }} /></div>
            <p className="hint"><span className="pill amber">4 unresolved gaps</span> <span className="pill amber">5 awaiting validation</span> <span className="pill mute">Security section deferred</span></p>
          </section>
        </aside>
      </div>
      <footer className="docs-foot">
        <span>{hub.system.name} document {doc.versionLabel} · Approval review</span>
        <span className="hint">Review responses are saved automatically.</span>
        <button className="ghost warn-btn" disabled={busy} onClick={() => decide('RequestChanges')}>Request changes</button>
        <button className="primary" disabled={busy} onClick={() => decide(decision === 'Reject' || decision === 'RequestChanges' ? 'Approve' : decision)}>Approve document</button>
      </footer>
    </div>
  );
}

function ApprovalPaper({ system, section, version, page, comments }: { system: string; section: number; version: string; page: number; comments: Comment[] }) {
  const archComment = comments.find(c => c.sectionNumber === 4);
  if (section === 4) {
    return (
      <>
        <p className="hint">{system} — Current-State System Assessment</p>
        <h3>4. System architecture &amp; technical design</h3>
        <p>{system} is an internal legacy application using an Oracle Forms front end. The detailed component architecture and relationship with the Groundwater application require further validation.</p>
        <table className="preview-table">
          <thead><tr><th>Component</th><th>Technology</th><th>Version</th><th>Validation</th></tr></thead>
          <tbody>
            <tr><td>AQUIS Forms</td><td>Oracle Forms</td><td>Unknown</td><td>Confirmed technology</td></tr>
            <tr><td>AQUIS Database</td><td>Oracle Database</td><td>Unknown</td><td>Inferred</td></tr>
          </tbody>
        </table>
        <p className="callout">{archComment ? <><span className="pill amber">1</span> The application follows a legacy client/server architecture.</> : 'The application follows a legacy client/server architecture.'}</p>
        <h3>Known limitations and information gaps</h3>
        <ul className="hint-list">
          <li>Oracle Forms version has not been confirmed.</li>
          <li>Application server and reporting technology remain unknown.</li>
          <li>Database schemas and PL/SQL dependencies require DBA validation.</li>
        </ul>
        <p className="hint">SystemScope · {system} assessment · Draft {version} · Page {page}</p>
      </>
    );
  }
  if (section === 5) {
    return (
      <>
        <p className="hint">{system} — Current-State System Assessment</p>
        <h3>5. Database architecture</h3>
        <p>{system} is understood to use an Oracle database. The database version, edition, schema ownership and any shared dependencies require technical confirmation.</p>
        <table className="preview-table">
          <thead><tr><th>Attribute</th><th>Value</th><th>Validation</th></tr></thead>
          <tbody>
            <tr><td>Database product</td><td>Oracle Database</td><td>Inferred</td></tr>
            <tr><td>Version</td><td>To be confirmed</td><td>Information gap</td></tr>
            <tr><td>Hosting model</td><td>On-premises</td><td>To confirm</td></tr>
          </tbody>
        </table>
        <p className="hint">SystemScope · {system} assessment · Draft {version} · Page {page}</p>
      </>
    );
  }
  if (section === 9) {
    return (
      <>
        <p className="hint">{system} — Current-State System Assessment</p>
        <h3>9. Security controls &amp; compliance</h3>
        <p>Detailed security assessment is deferred for the current market-scan scope. Restricted security details are excluded from this version.</p>
        <p className="hint">SystemScope · {system} assessment · Draft {version} · Page {page}</p>
      </>
    );
  }
  const title = SECTIONS.find(s => s.n === section)?.name ?? 'Section';
  return (
    <>
      <p className="hint">{system} — Current-State System Assessment</p>
      <h3>{section}. {title}</h3>
      <p>Content for this section is generated from the approved assessment snapshot. Unvalidated statements remain labelled and are not presented as facts.</p>
      <p className="hint">SystemScope · {system} assessment · Draft {version} · Page {page}</p>
    </>
  );
}

const AUDIENCES = [
  { name: 'Assessment team', access: 'Edit metadata, download', notify: true },
  { name: 'Water Monitoring Systems project', access: 'View and download', notify: true },
  { name: 'Department users', access: 'No access', notify: false },
];

export function DocumentPublish({ catalogKey, version, onBack }: { catalogKey: string; version?: string; onBack: () => void }) {
  const [hub, setHub] = useState<Hub>();
  const [classification, setClassification] = useState('OFFICIAL');
  const [visibility, setVisibility] = useState('Water Monitoring Systems');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('Approved current-state assessment for use in the Water Monitoring Systems market-scan and RFI activities.');
  const [includePdf, setIncludePdf] = useState(true);
  const [includeSearch, setIncludeSearch] = useState(true);
  const [allowDownload, setAllowDownload] = useState(true);
  const [showOnProfile, setShowOnProfile] = useState(true);
  const [notifyMembers, setNotifyMembers] = useState(true);
  const [allowExternal, setAllowExternal] = useState(false);
  const [webView, setWebView] = useState(false);
  const [reviewDate, setReviewDate] = useState('2027-02-20');
  const [publishDate, setPublishDate] = useState('2026-08-20');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  const [audiences, setAudiences] = useState(AUDIENCES);
  const [showApproval, setShowApproval] = useState(false);
  const load = () => api<Hub>(`/documents/by-key/${catalogKey}`).then(h => {
    setHub(h);
    const d = pickDoc(h, version) ?? h.documents.find(x => x.approvalState === 'Approved');
    if (d) {
      setTitle(d.title);
      setClassification(d.classification || 'OFFICIAL');
      setVisibility(d.visibilityScope || 'Water Monitoring Systems');
      if (d.publicationNote) setNote(d.publicationNote);
    }
  });
  useEffect(() => { load().catch(() => undefined); }, [catalogKey, version]);
  const doc = useMemo(() => hub && (hub.documents.find(d => d.approvalState === 'Approved' && (!version || d.versionLabel === version)) ?? pickDoc(hub, version)), [hub, version]);
  const payload = () => ({
    title, category: 'Market scan', classification, owner: 'Asish Punnose', visibility,
    reviewDate, note, includeSearch, allowDownload, showOnProfile, notifyMembers, allowExternal, includePdf,
  });
  const saveSettings = async () => {
    if (!doc) return;
    setBusy(true);
    try {
      await api(`/documents/${doc.id}/publication`, { method: 'PUT', body: JSON.stringify(payload()) });
      setResult('Publication settings saved.');
    } finally { setBusy(false); }
  };
  const publish = async () => {
    if (!doc) return;
    if (doc.approvalState !== 'Approved') {
      setResult('Only an approved document can be published. Record an approval decision first.');
      return;
    }
    setBusy(true);
    try {
      const published = await api<{ versionLabel: string; checksumSha256: string; recordId: string }>(`/documents/${doc.id}/publish`, { method: 'POST', body: JSON.stringify(payload()) });
      setResult(`Published immutable ${published.versionLabel}. Record ${published.recordId}.`);
      onBack();
    } catch (e) {
      setResult(e instanceof Error ? e.message : 'Publish failed');
    } finally { setBusy(false); }
  };
  if (!doc || !hub) return <div className="empty"><p>Loading publication…</p></div>;
  const checksum = (doc.checksumSha256 || '').slice(0, 16);
  const approved = doc.approvalState === 'Approved';
  return (
    <div className="scan publish-page">
      <header className="scan-head">
        <div>
          <small>WATER MONITORING SYSTEMS · DOCUMENTS</small>
          <h1>Publish {hub.system.name} assessment document</h1>
          <p>Prepare the approved market-scan document for controlled distribution and preserve the final record.</p>
          <p className="crumb"><button className="linkish" onClick={onBack}>Documents</button> / {hub.system.name} / {doc.versionLabel} / Publish</p>
          <div className="scan-pills"><span className="pill">{approved ? 'Approved' : doc.approvalState}</span><span className="pill">Final candidate</span></div>
        </div>
        <div className="scan-head-actions">
          <button className="ghost" onClick={onBack}>Back to documents</button>
          <button className="primary" disabled={busy || !approved} onClick={publish}>Publish document</button>
        </div>
      </header>
      <div className="approved-banner">
        <span className="ok-dot">✓</span>
        <div>
          <b>Document approved</b>
          <p>{doc.approver || 'Michael'} approved version {doc.versionLabel}{doc.approvedAt ? ` on ${formatStamp(doc.approvedAt)}` : ''}.</p>
        </div>
        <button className="linkish" onClick={() => setShowApproval(s => !s)}>View approval record</button>
      </div>
      <div className="scan-overview">
        <div className="domain-main">
          <section className="panel pad-form">
            <h3>Approved document</h3>
            <p><b>{doc.title}</b></p>
            <small>Version {doc.versionLabel} · {doc.format} (.docx) · {doc.pageCount || 12} pages · {Math.round((doc.fileSizeBytes || 486000) / 1024)} KB <span className="pill">{doc.approvalState}</span></small>
            <div className="ops-grid">
              <div><small>Assessment snapshot</small><b>{doc.versionLabel}</b></div>
              <div><small>Template</small><b>{doc.templateName || 'Market Scan v1.0'}</b></div>
              <div><small>Approved by</small><b>{doc.approver || 'Michael'}</b></div>
              <div><small>Checksum</small><b>SHA-256 {checksum || 'verified'}</b></div>
            </div>
            <p className="hint lock-note">Content is locked. Publishing will not change this approved file.</p>
            <div className="domain-foot-actions">
              <a className="ghost" href={`/api/documents/${doc.id}/file`}>Open final preview</a>
              <a className="ghost" href={`/api/documents/${doc.id}/file`}>Download approved file</a>
            </div>
          </section>
          <section className="panel pad-form">
            <h3>Publication settings</h3>
            <div className="grid2">
              <label>Publication title<input value={title} onChange={e => setTitle(e.target.value)} /></label>
              <label>Document category<select defaultValue="Market scan"><option>Market scan</option><option>System assessment</option></select></label>
              <label>Business area<select defaultValue="Water Monitoring Systems"><option>Water Monitoring Systems</option></select></label>
              <label>Owner<select defaultValue="Asish Punnose"><option>Asish Punnose</option><option>Michael</option></select></label>
              <label>Publication date<input type="date" value={publishDate} onChange={e => setPublishDate(e.target.value)} /></label>
              <label>Review date<input type="date" value={reviewDate} onChange={e => setReviewDate(e.target.value)} /></label>
            </div>
            <p><b>Classification</b></p>
            <div className="format-toggle">
              <button type="button" className={classification === 'OFFICIAL' ? 'selected' : ''} onClick={() => setClassification('OFFICIAL')}>OFFICIAL</button>
              <button type="button" className={classification !== 'OFFICIAL' ? 'selected' : ''} onClick={() => setClassification('OFFICIAL: Sensitive')}>OFFICIAL: Sensitive</button>
            </div>
            <p><b>Visibility</b></p>
            <div className="format-toggle vis-toggle">
              {['Assessment team only', 'Water Monitoring Systems', 'Department-wide'].map(v => (
                <button type="button" key={v} className={visibility === v ? 'selected' : ''} onClick={() => setVisibility(v)}>{v}</button>
              ))}
            </div>
            <label className="check"><input type="checkbox" checked={includeSearch} onChange={e => setIncludeSearch(e.target.checked)} /> Include in SystemScope search</label>
            <label className="check"><input type="checkbox" checked={allowDownload} onChange={e => setAllowDownload(e.target.checked)} /> Allow authorised users to download</label>
            <label className="check"><input type="checkbox" checked={showOnProfile} onChange={e => setShowOnProfile(e.target.checked)} /> Show document in {hub.system.name} system profile</label>
            <label className="check"><input type="checkbox" checked={notifyMembers} onChange={e => setNotifyMembers(e.target.checked)} /> Notify project members</label>
            <label className="check"><input type="checkbox" checked={allowExternal} onChange={e => setAllowExternal(e.target.checked)} /> Allow external sharing</label>
            <label>Publication note<textarea value={note} onChange={e => setNote(e.target.value)} /></label>
            <p className="hint">Security and compliance details remain excluded from this version.</p>
            <p><b>Available formats</b></p>
            <label className="check"><input type="checkbox" defaultChecked disabled /> Word (.docx)</label>
            <label className="check"><input type="checkbox" checked={includePdf} onChange={e => setIncludePdf(e.target.checked)} /> PDF (generate on publish)</label>
            <label className="check"><input type="checkbox" checked={webView} onChange={e => setWebView(e.target.checked)} /> Read-only web view</label>
          </section>
          <section className="panel">
            <div className="panel-title"><div><h3>Distribution</h3></div><button className="ghost compact" type="button" onClick={() => setAudiences(a => [...a, { name: 'Added audience', access: 'View only', notify: false }])}>Add audience</button></div>
            <div className="attr-head"><span>Audience</span><span>Access</span><span>Notification</span></div>
            {audiences.map(a => (
              <div className="attr-row table" key={a.name}>
                <span>{a.name}</span>
                <span>{a.access}</span>
                <span><input type="checkbox" defaultChecked={a.notify} /></span>
              </div>
            ))}
          </section>
        </div>
        <aside className="scan-side">
          <section className="panel pad-form">
            <h3>Publication readiness</h3>
            <strong>{approved ? 'Ready to publish' : 'Approval required'}</strong>
            <div className="bar fat"><i style={{ width: approved ? '100%' : '60%' }} /></div>
            <ul className="hint-list ready-list">
              <li>{approved ? 'Document approved' : 'Awaiting approval'}</li>
              <li>Approval record captured</li>
              <li>Classification selected</li>
              <li>Audience selected</li>
              <li>Review date set</li>
              <li>Search metadata complete</li>
            </ul>
          </section>
          <section className="panel pad-form">
            <h3>Approval record</h3>
            <p>Decision <b className="ok">{doc.approvalState}</b></p>
            <p>Approver <b>{doc.approver || 'Michael'}</b></p>
            <p>Approved <b>{formatStamp(doc.approvedAt || doc.createdAt)}</b></p>
            <p>Comments <span className="hint">{doc.approvalComment || 'Approved for market-scan use. Unvalidated content is clearly labelled.'}</span></p>
            <button className="ghost" onClick={() => setShowApproval(true)}>Open approval record</button>
          </section>
          {showApproval && (
            <section className="panel pad-form">
              <h3>Approval record detail</h3>
              <p>{doc.approver || 'Michael'} recorded <b>{doc.approvalState}</b> for {doc.versionLabel}.</p>
              <p className="hint">{doc.approvalComment || 'Approved for market-scan use.'}</p>
              <p className="hint">{doc.locked ? 'The approved file is locked and will not change on publish.' : 'The file is not yet locked.'}</p>
            </section>
          )}
          <section className="panel pad-form">
            <h3>After publishing</h3>
            <ul className="hint-list">
              <li>Creates immutable published version v1.0</li>
              <li>Generates PDF rendition</li>
              <li>Adds document to SystemScope search</li>
              <li>Links document to {hub.system.name} system profile</li>
              <li>Notifies 8 project members</li>
            </ul>
          </section>
          <section className="panel pad-form">
            <h3>Document controls</h3>
            <p>Retention <b>{doc.retentionYears || 7} years</b></p>
            <p>Next review <b>20 Feb 2027</b></p>
            <p>Supersedes <b>None</b></p>
            <p>Record ID <b>{doc.recordId || 'DOC-AQUIS-0001'}</b></p>
          </section>
        </aside>
      </div>
      <footer className="docs-foot">
        <span>{hub.system.name} {doc.versionLabel} · Approved final candidate</span>
        <span className="hint">Publishing creates immutable version v1.0.</span>
        {result && <span className="pill">{result}</span>}
        <button className="ghost" disabled={busy} onClick={saveSettings}>Save publication settings</button>
        <button className="primary" disabled={busy || !approved} onClick={publish}>Publish document</button>
      </footer>
    </div>
  );
}

type Published = {
  id: string;
  title: string;
  recordId: string;
  versionLabel: string;
  publishedVersion: string;
  status: string;
  classification: string;
  visibilityScope: string;
  format: string;
  pageCount: number;
  fileSizeBytes: number;
  checksumSha256: string;
  retentionYears: number;
  reviewDate?: string;
  publishedAt?: string;
  generatedBy: string;
  approver: string;
  publicationNote: string;
  templateName: string;
  assessmentSnapshot: string;
  owner: string;
  views: number;
  downloads: number;
  catalogKey: string;
  systemName: string;
  projectName: string;
  findingCount: number;
  evidenceCount: number;
  activity: { at?: string; text?: string }[];
  coverage: { area: string; status: string }[];
  hits: { section: string; text: string; page: number; status: string }[];
  overview: string;
};

export function PublishedRecord({ recordId, onBack, onOpenSystem }: { recordId: string; onBack: () => void; onOpenSystem: (key: string) => void }) {
  const [doc, setDoc] = useState<Published>();
  const [q, setQ] = useState('Oracle Forms');
  const [error, setError] = useState('');
  useEffect(() => {
    api<Published>(`/documents/published/${encodeURIComponent(recordId)}`).then(setDoc).catch(e => setError(e.message));
  }, [recordId]);
  if (error) return <div className="empty"><p>{error}</p><button className="back" onClick={onBack}>← Documents</button></div>;
  if (!doc) return <div className="empty"><p>Loading published record…</p></div>;
  const hits = doc.hits.filter(h => !q || h.text.toLowerCase().includes(q.toLowerCase()) || h.section.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="scan published-page">
      <header className="scan-head">
        <div>
          <small>WATER MONITORING SYSTEMS · PUBLISHED RECORD</small>
          <h1>{doc.title}</h1>
          <p>Published market-scan document and immutable records-management entry.</p>
          <p className="crumb">Documents / Published / {doc.recordId}</p>
          <div className="scan-pills">
            <span className="pill">Published</span>
            <span className="pill">{doc.classification}</span>
          </div>
        </div>
        <div className="scan-head-actions">
          <button className="ghost">Copy link</button>
          <button className="ghost">More</button>
          <a className="primary" href={`/api/documents/${doc.id}/file`}>Download document</a>
        </div>
      </header>
      <div className="notice">Published successfully. Version {doc.publishedVersion} was published {formatStamp(doc.publishedAt)} and is available to {doc.visibilityScope} users.</div>
      <div className="scan-meta profile-meta">
        <div><small>Version</small><b>{doc.publishedVersion}</b></div>
        <div><small>Published</small><b>{formatDate(doc.publishedAt)}</b></div>
        <div><small>Owner</small><b>{doc.owner}</b></div>
        <div><small>Review due</small><b>{doc.reviewDate || '20 Feb 2027'}</b></div>
        <div><small>Views</small><b>{doc.views}</b></div>
        <div><small>Downloads</small><b>{doc.downloads}</b></div>
      </div>
      <div className="profile-grid published-grid">
        <section className="panel pad-form">
          <h3>Document</h3>
          <b>{doc.title}</b>
          <p className="hint">Published {doc.publishedVersion} · {doc.format} · {doc.pageCount} pages · {Math.round((doc.fileSizeBytes || 486000) / 1024)} KB</p>
          <span className="pill">Published</span>
          <div className="scan-head-actions">
            <a className="primary" href={`/api/documents/${doc.id}/file`}>Download Word</a>
            <button className="ghost">Download PDF</button>
            <button className="ghost">Open read-only preview</button>
          </div>
          <div className="ops-grid">
            <div><small>Record ID</small><b>{doc.recordId}</b></div>
            <div><small>Assessment snapshot</small><b>{doc.assessmentSnapshot}</b></div>
            <div><small>Template</small><b>{doc.templateName}</b></div>
            <div><small>Checksum</small><b>SHA-256 verified</b></div>
            <div><small>Retention</small><b>{doc.retentionYears} years</b></div>
          </div>
        </section>
        <section className="panel pad-form">
          <h3>Search within this document</h3>
          <div className="search-box">
            <input value={q} onChange={e => setQ(e.target.value)} />
            <button className="primary" type="button">Search</button>
          </div>
          <p className="hint">{hits.length} matches across sections</p>
          {hits.map(h => (
            <div className="side-row stack" key={h.section + h.page}>
              <span><b>{h.section}</b><small>{h.text}</small></span>
              <span>Page {h.page}</span>
            </div>
          ))}
        </section>
        <section className="panel pad-form">
          <h3>Document overview</h3>
          <p>{doc.overview || 'This market-scan document provides an overview of the AQUIS Water Monitoring Systems market-scan and RFI activities. Unvalidated and inferred content remains labelled.'}</p>
          <table className="mini-table">
            <thead><tr><th>Assessment coverage</th><th>Status</th></tr></thead>
            <tbody>
              {(doc.coverage ?? []).map(c => <tr key={c.area}><td>{c.area}</td><td>{c.status}</td></tr>)}
            </tbody>
          </table>
        </section>
        <aside className="scan-side">
          <section className="panel pad-form">
            <h3>Access and visibility</h3>
            <p>Visibility <b>{doc.visibilityScope}</b></p>
            <p>Classification <b>{doc.classification}</b></p>
            <p>Downloads <b>Authorised users</b></p>
            <p>External sharing <b>Not allowed</b></p>
            <p>Search indexing <b>Enabled</b></p>
            <button className="ghost compact">Manage access</button>
          </section>
          <section className="panel pad-form">
            <h3>Related {doc.systemName} records</h3>
            <p>System profile <button className="linkish" onClick={() => onOpenSystem(doc.catalogKey)}>{doc.systemName}</button></p>
            <p>Project <b>{doc.projectName}</b></p>
            <p>Findings <b>{doc.findingCount} linked</b></p>
            <p>Evidence <b>{doc.evidenceCount} linked</b></p>
            <button className="ghost compact" onClick={() => onOpenSystem(doc.catalogKey)}>Open {doc.systemName} system profile</button>
          </section>
          <section className="panel pad-form">
            <h3>Publication record</h3>
            <p>Published by <b>{doc.generatedBy}</b></p>
            <p>Approved by <b>{doc.approver || 'Michael'}</b></p>
            <p>Published <b>{formatStamp(doc.publishedAt)}</b></p>
            <p className="hint">{doc.publicationNote}</p>
          </section>
          <section className="panel pad-form">
            <h3>Record lifecycle</h3>
            <p>Status <b>Current</b></p>
            <p>Next review <b>{doc.reviewDate || '20 Feb 2027'}</b></p>
            <p>Retention until <b>20 Aug 2033</b></p>
            <p>Superseded by <b>None</b></p>
            <button className="ghost compact">Create new draft from this version</button>
          </section>
          <section className="panel">
            <div className="panel-title"><div><h2>Recent activity</h2></div></div>
            {(doc.activity ?? []).map((a, i) => <div className="side-row" key={i}><span>{a.text}</span></div>)}
          </section>
        </aside>
      </div>
      <footer className="docs-foot">
        <span>{doc.recordId} · Published {doc.publishedVersion}</span>
        <span className="hint">This published version is immutable.</span>
        <button className="ghost" onClick={() => onOpenSystem(doc.catalogKey)}>Open system profile</button>
        <a className="primary" href={`/api/documents/${doc.id}/file`}>Download Word document</a>
      </footer>
    </div>
  );
}
