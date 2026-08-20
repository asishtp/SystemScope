import { useState, type FormEvent } from 'react';
import { api } from '../landscape/api';
import type { ScanWorkspace } from './types';

const STEPS = [
  { n: 1, title: 'Upload and malware scan', detail: 'Checking file format and scanning for threats.' },
  { n: 2, title: 'Extract text and structure', detail: 'Converting content to structured data.' },
  { n: 3, title: 'Detect sensitive information', detail: 'Identifying personal and sensitive data.' },
  { n: 4, title: 'Generate proposed claims', detail: 'AI extracts findings and potential claims.' },
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
  const [fileName, setFileName] = useState('AQUIS walkthrough transcript.docx');
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

  const submit = async (analyse: boolean) => {
    setBusy(true);
    try {
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      await api(`/systems/${data.system.id}/evidence/analyse`, {
        method: 'POST',
        body: JSON.stringify({
          title,
          url: `https://department.sharepoint.com/sites/systemscope/evidence/${slug || 'source'}`,
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
        }),
      });
      onSaved(analyse ? 'Source uploaded. Proposed claims are waiting for analyst review and are not facts yet.' : 'Source saved without analysis.');
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
          <p>Upload a discovery source and extract proposed system findings for analyst review.</p>
          <p className="crumb"><button className="linkish" onClick={onCancel}>Assessments</button> / {data.system.name} / Evidence / Add</p>
        </div>
        <div className="scan-head-actions">
          <button className="ghost" onClick={onCancel}>Cancel</button>
          <button className="primary" disabled={busy} onClick={() => submit(true)}>Upload & analyse</button>
        </div>
      </header>
      <div className="scan-split">
        <form className="domain-main" onSubmit={(e: FormEvent) => { e.preventDefault(); submit(true); }}>
          <section className="panel pad-form">
            <h3>1. Upload source</h3>
            <label className="dropzone">
              <input type="file" hidden onChange={e => setFileName(e.target.files?.[0]?.name || fileName)} />
              <div className="drop-icon">↑</div>
              <b>Drop files here or browse</b>
              <small>PDF, Word, Excel, PowerPoint, text, images, audio or video · Maximum 500 MB</small>
            </label>
            {fileName && (
              <div className="file-row">
                <span>W</span>
                <b>{fileName}</b>
                <em>2.4 MB</em>
                <span className="pill">Ready</span>
                <button type="button" className="icon-btn" onClick={() => setFileName('')}>×</button>
              </div>
            )}
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
            <button className="primary" disabled={busy} type="submit">Upload & analyse</button>
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
