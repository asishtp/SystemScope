import { useState, type FormEvent } from 'react';
import { api } from '../landscape/api';
import type { ScanWorkspace } from './types';

const STEPS = [
  { n: 1, title: 'Register HTTPS source', detail: 'Store an approved-host link. Files are not uploaded.' },
  { n: 2, title: 'Capture source details', detail: 'Title, type, completeness and participants.' },
  { n: 3, title: 'Link related records', detail: 'Optionally attach the source to capabilities, assets or integrations.' },
  { n: 4, title: 'Generate proposed claims', detail: 'AI extracts findings as claims, not facts.' },
  { n: 5, title: 'Analyst review', detail: 'Review, edit and confirm before use.' },
];

export function AddEvidence({
  data,
  onCancel,
  onSaved,
}: {
  data: ScanWorkspace;
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('AQUIS walkthrough with Anthony McLoughlin');
  const [sourceType, setSourceType] = useState('Meeting transcript');
  const [date, setDate] = useState('2026-08-20');
  const [owner, setOwner] = useState(data.system.technicalOwner || 'Anthony McLoughlin');
  const [completeness, setCompleteness] = useState('Incomplete');
  const [reliability, setReliability] = useState('Medium');
  const [confidentiality, setConfidentiality] = useState('Internal');
  const [description, setDescription] = useState('Walkthrough of AQUIS and discussion of the drill log submission process.');
  const [extractTech, setExtractTech] = useState(true);
  const [extractIntegrations, setExtractIntegrations] = useState(true);
  const [extractFindings, setExtractFindings] = useState(true);
  const [extractGaps, setExtractGaps] = useState(true);
  const [extractClaims, setExtractClaims] = useState(true);
  const [autoValidate, setAutoValidate] = useState(false);
  const [url, setUrl] = useState(`https://department.sharepoint.com/sites/systemscope/evidence/${data.system.catalogKey || 'source'}`);
  const [links, setLinks] = useState<{ entityType: string; entityId: string; label: string }[]>([]);
  const [linkType, setLinkType] = useState('Capability');
  const [linkTarget, setLinkTarget] = useState('');
  const [linkOptions, setLinkOptions] = useState<{ id: string; name: string }[]>([]);

  const loadTargets = async (type: string) => {
    setLinkType(type);
    setLinkTarget('');
    if (type === 'Capability') {
      const rows = await api<{ id: string; name: string }[]>('/capabilities');
      setLinkOptions(rows.map(r => ({ id: r.id, name: r.name })));
    } else if (type === 'InformationAsset') {
      const rows = await api<{ id: string; name: string }[]>('/information-assets');
      setLinkOptions(rows.map(r => ({ id: r.id, name: r.name })));
    } else if (type === 'Integration') {
      const rows = await api<{ id: string; name: string }[]>(`/scan/integrations?projectId=${data.system.projectId}`);
      setLinkOptions(rows.map(r => ({ id: r.id, name: r.name })));
    } else {
      setLinkOptions([{ id: data.system.id, name: data.system.name }]);
    }
  };

  const submit = async (analyse: boolean) => {
    setBusy(true);
    try {
      await api(`/systems/${data.system.id}/evidence/analyse`, {
        method: 'POST',
        body: JSON.stringify({
          title,
          url,
          source: owner,
          sourceType,
          completeness,
          reliability,
          confidentiality,
          participants: `${owner}, ${data.scan.assessmentLead || 'Asish Punnose'}`,
          description,
          evidenceDate: date,
          extractTechnologies: analyse && extractTech,
          extractIntegrations: analyse && extractIntegrations,
          extractFindings: analyse && extractFindings,
          extractGaps: analyse && extractGaps,
          extractClaims: analyse && extractClaims,
          autoValidate: analyse && autoValidate,
          links: links.map(l => ({ entityType: l.entityType, entityId: l.entityId })),
        }),
      });
      onSaved(analyse ? 'Source registered. Proposed claims are waiting for analyst review and are not facts yet.' : 'Source saved without analysis.');
    } catch (e) {
      onSaved(e instanceof Error ? e.message : 'Unable to save evidence');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="scan evidence-page">
      <header className="scan-head">
        <div>
          <small>{data.system.name.toUpperCase()} · EVIDENCE</small>
          <h1>Add evidence</h1>
          <p>Register an HTTPS discovery source and extract proposed system findings for analyst review. Files are not uploaded.</p>
          <p className="crumb"><button className="linkish" onClick={onCancel}>Assessments</button> / {data.system.name} / Evidence / Add</p>
        </div>
        <div className="scan-head-actions">
          <button className="ghost" onClick={onCancel}>Cancel</button>
          <button className="primary" disabled={busy} onClick={() => submit(true)}>Register source & analyse</button>
        </div>
      </header>
      <div className="scan-split">
        <form className="domain-main" onSubmit={(e: FormEvent) => { e.preventDefault(); submit(true); }}>
          <section className="panel pad-form">
            <h3>1. HTTPS source</h3>
            <label>Approved repository URL
              <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://department.sharepoint.com/sites/systemscope/evidence/…" required />
            </label>
            <small className="hint">Evidence must be an HTTPS link on an approved host. Attachments are not accepted.</small>
          </section>
          <section className="panel pad-form">
            <h3>Also link to</h3>
            <p className="hint">The same source can support capabilities, information assets, integrations or this system.</p>
            {links.map(l => (
              <div className="file-row" key={`${l.entityType}-${l.entityId}`}>
                <b>{l.entityType}</b>
                <span>{l.label}</span>
                <button type="button" className="icon-btn" onClick={() => setLinks(current => current.filter(x => x !== l))}>×</button>
              </div>
            ))}
            <div className="grid2">
              <label>Record type
                <select value={linkType} onChange={e => { void loadTargets(e.target.value); }}>
                  <option>Capability</option>
                  <option value="InformationAsset">Information asset</option>
                  <option>Integration</option>
                  <option>System</option>
                </select>
              </label>
              <label>Record
                <select value={linkTarget} onChange={e => setLinkTarget(e.target.value)} onFocus={() => { if (!linkOptions.length) void loadTargets(linkType); }}>
                  <option value="">Select…</option>
                  {linkOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </label>
            </div>
            <button type="button" className="ghost compact" onClick={() => {
              const option = linkOptions.find(o => o.id === linkTarget);
              if (!option) return;
              setLinks(current => current.some(x => x.entityType === linkType && x.entityId === option.id) ? current : [...current, { entityType: linkType, entityId: option.id, label: option.name }]);
              setLinkTarget('');
            }}>Add link</button>
          </section>
          <section className="panel pad-form">
            <h3>2. Source details</h3>
            <div className="grid2">
              <label>Source title<input value={title} onChange={e => setTitle(e.target.value)} required /></label>
              <label>Source owner<input value={owner} onChange={e => setOwner(e.target.value)} /></label>
              <label>Source type
                <select value={sourceType} onChange={e => setSourceType(e.target.value)}>
                  <option>Meeting transcript</option>
                  <option>Architecture document</option>
                  <option>Screenshot</option>
                  <option>Walkthrough notes</option>
                  <option>Email</option>
                  <option>Existing assessments</option>
                </select>
              </label>
              <label>Completeness
                <select value={completeness} onChange={e => setCompleteness(e.target.value)}>
                  <option>Incomplete</option>
                  <option>Partial</option>
                  <option>Complete</option>
                </select>
              </label>
              <label>Meeting date<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
              <label>Reliability
                <select value={reliability} onChange={e => setReliability(e.target.value)}>
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
              </label>
              <label>Related system
                <div className="chip-row"><span className="pill">{data.system.name} ×</span></div>
              </label>
              <label>Confidentiality
                <select value={confidentiality} onChange={e => setConfidentiality(e.target.value)}>
                  <option>Internal</option>
                  <option>Restricted</option>
                  <option>OFFICIAL</option>
                </select>
              </label>
            </div>
            <label>Participants
              <div className="chip-row">
                <span className="pill">{owner} ×</span>
                <span className="pill">{data.scan.assessmentLead || 'Asish Punnose'} ×</span>
              </div>
            </label>
            <label>Description<textarea value={description} onChange={e => setDescription(e.target.value)} /></label>
          </section>
          <section className="panel pad-form">
            <h3>3. Analysis options</h3>
            <label className="check"><input type="checkbox" checked={extractTech} onChange={e => setExtractTech(e.target.checked)} /> Extract technologies and components</label>
            <label className="check"><input type="checkbox" checked={extractIntegrations} onChange={e => setExtractIntegrations(e.target.checked)} /> Identify integrations, data flows and batch processes</label>
            <label className="check"><input type="checkbox" checked={extractFindings} onChange={e => setExtractFindings(e.target.checked)} /> Extract findings, risks, decisions and actions</label>
            <label className="check"><input type="checkbox" checked={extractGaps} onChange={e => setExtractGaps(e.target.checked)} /> Detect information gaps and generate SME questions</label>
            <label className="check"><input type="checkbox" checked={extractClaims} onChange={e => setExtractClaims(e.target.checked)} /> Create evidence-linked proposed claims</label>
            <label className="check"><input type="checkbox" checked={autoValidate} onChange={e => setAutoValidate(e.target.checked)} /> Automatically request validation</label>
            <small className="hint">Analyst review is recommended before sending claims to SMEs. AI output is stored as proposed claims and does not become an approved fact.</small>
          </section>
          <div className="domain-foot-actions evidence-foot">
            <button type="button" className="ghost" disabled={busy} onClick={() => submit(false)}>Save source only</button>
            <button className="primary" disabled={busy} type="submit">Register source & analyse</button>
          </div>
        </form>
        <aside className="scan-side">
          <section className="panel pad-form">
            <h3>Processing steps</h3>
            <ol className="steps">
              {STEPS.map(s => (
                <li key={s.n}><b>{s.title}</b><small>{s.detail}</small></li>
              ))}
            </ol>
          </section>
          <section className="panel pad-form">
            <h3>Privacy & security check</h3>
            <div className="warn">Sensitive information detected in source URLs. Authentication tokens and personal details will be flagged for redaction before indexing.</div>
            <label className="check"><input type="checkbox" defaultChecked /> Exclude sensitive values from AI processing</label>
            <SensitiveReview />
          </section>
          <section className="panel pad-form">
            <h3>Expected output</h3>
            <div className="expect">
              <article><small>Claims</small><b>8–15</b><span>Estimated</span></article>
              <article><small>Questions</small><b>10–20</b><span>Estimated</span></article>
              <article><small>Sections</small><b>4</b><span>likely affected</span></article>
            </div>
            <ul className="hint-list">
              <li>Architecture</li>
              <li>Database</li>
              <li>Integrations</li>
              <li>Future-state requirements</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

function SensitiveReview() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="ghost" onClick={() => setOpen(o => !o)}>Review detected information</button>
      {open && (
        <div className="warn">
          <b>Detected for redaction</b>
          <ul className="hint-list">
            <li>Source URL query string may contain an authentication token.</li>
            <li>Speaker names and contact details in the transcript header.</li>
            <li>These values are excluded from AI processing when the checkbox above is selected.</li>
          </ul>
        </div>
      )}
    </>
  );
}
