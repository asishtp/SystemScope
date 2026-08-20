import { useEffect, useMemo, useState } from 'react';
import { api } from '../landscape/api';
import { pillClass, type ScanClaim, type ScanWorkspace } from './types';
import './market.css';

const DECISIONS = ['Pending', 'Confirmed', 'Corrected', 'Rejected'] as const;

export function ClaimsReview({ data, onBack, onApplied }: { data: ScanWorkspace; onBack: () => void; onApplied: (m: string) => void }) {
  const [claims, setClaims] = useState<ScanClaim[]>(data.claims);
  const [index, setIndex] = useState(0);
  const [filter, setFilter] = useState('All domains');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [q, setQ] = useState('');
  const [createRequests, setCreateRequests] = useState(true);
  const [showContext, setShowContext] = useState(false);
  const shown = useMemo(() => claims.filter(c => {
    if (q && !c.statement.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter !== 'All domains' && c.domain !== filter) return false;
    if (statusFilter === 'Pending') {
      const d = c.analystDecision || 'Pending';
      if (d !== 'Pending' && d !== 'NeedsEvidence') return false;
    } else if (statusFilter !== 'All' && (c.analystDecision || 'Pending') !== statusFilter) return false;
    return true;
  }), [claims, q, filter, statusFilter]);
  const current = shown[index] ?? shown[0];
  const counts = {
    Pending: claims.filter(c => {
      const d = c.analystDecision || 'Pending';
      return d === 'Pending' || d === 'NeedsEvidence';
    }).length,
    Confirmed: claims.filter(c => c.analystDecision === 'Confirmed').length,
    Corrected: claims.filter(c => c.analystDecision === 'Corrected').length,
    Rejected: claims.filter(c => c.analystDecision === 'Rejected').length,
  };
  useEffect(() => { setClaims(data.claims); }, [data.scan.updatedAt, data.claims.length]);

  const save = async (decision?: string, next = false) => {
    if (!current) return;
    const body = {
      decision: decision ?? current.analystDecision ?? 'Pending',
      statement: current.statement,
      comment: current.reviewComment,
      reviewer: current.reviewerAssigned || 'Anthony McLoughlin',
      visibility: current.visibilityLabel || 'Market scan',
    };
    const updated = await api<ScanClaim>(`/claims/${current.id}/review`, { method: 'POST', body: JSON.stringify(body) });
    setClaims(cs => cs.map(c => c.id === updated.id ? { ...c, ...updated } : c));
    if (next) setIndex(i => Math.min(shown.length - 1, i + 1));
  };

  const apply = async () => {
    const r = await api<{ applied: number }>(`/systems/${data.system.id}/claims/apply`, { method: 'POST', body: JSON.stringify({ createValidationRequests: createRequests }) });
    onApplied(`${r.applied} reviewed claims applied. They are not published as facts until validated.`);
  };

  if (!current) return <div className="empty"><p>No extracted claims. Upload evidence and run analysis first.</p><button className="back" onClick={onBack}>Back to source</button></div>;

  return (
    <div className="scan claims-page">
      <header className="scan-head">
        <div>
          <small>{data.system.name.toUpperCase()} · EVIDENCE REVIEW</small>
          <h1>Review extracted claims</h1>
          <p>Confirm, correct or reject AI-proposed findings before they update the system assessment.</p>
          <p className="crumb"><button className="linkish" onClick={onBack}>Assessments</button> / {data.system.name} / Evidence / AQUIS walkthrough transcript</p>
          <span className="pill mute">{claims.length} claims extracted</span>
        </div>
        <div className="scan-head-actions">
          <button className="ghost" onClick={onBack}>Back to source</button>
          <button className="primary" onClick={apply}>Apply reviewed claims</button>
        </div>
      </header>
      <div className="claim-counts">
        {DECISIONS.map(d => <button key={d} className={`count-card ${d.toLowerCase()} ${statusFilter === d ? 'selected' : ''}`} onClick={() => { setStatusFilter(s => s === d ? 'All' : d); setIndex(0); }}><b>{counts[d]}</b> {d}</button>)}
      </div>
      <div className="claims-grid">
        <section className="panel">
          <div className="panel-title"><div><h2>Proposed claims</h2></div></div>
          <div className="filters"><input placeholder="Search claims" value={q} onChange={e => setQ(e.target.value)} /><select value={filter} onChange={e => { setFilter(e.target.value); setIndex(0); }}><option>All domains</option><option>Architecture</option><option>Database</option><option>Integrations</option></select></div>
          {shown.map((c, i) => (
            <button className={`claim-nav ${c.id === current.id ? 'active' : ''}`} key={c.id} onClick={() => setIndex(i)}>
              <span className="num">{i + 1}</span>
              <span><b>{c.statement}</b><small>{c.domain} · {c.confidence}</small></span>
              <span className={pillClass(c.analystDecision || 'Pending')}>{c.analystDecision || 'Pending'}</span>
            </button>
          ))}
          <p className="pad hint">Showing {shown.length} of {claims.length} claims</p>
        </section>
        <section className="panel pad-form">
          <h3>Claim review</h3>
          <div className="scan-pills"><span className="pill amber">Pending review</span><span className="pill">{current.confidence} confidence</span></div>
          <label>Proposed claim<textarea value={current.statement} onChange={e => setClaims(cs => cs.map(c => c.id === current.id ? { ...c, statement: e.target.value } : c))} /></label>
          <div className="grid2">
            <label>System<select defaultValue={data.system.name}><option>{data.system.name}</option></select></label>
            <label>Document visibility<select defaultValue="Market scan"><option>Market scan</option><option>Internal</option><option>Excluded</option></select></label>
            <label>Assessment domain<select defaultValue={current.domain}><option>Architecture</option><option>Database</option><option>Infrastructure</option><option>Integrations</option><option>DataQuality</option></select></label>
            <label>Validation required from<select defaultValue={current.reviewerAssigned || 'Anthony McLoughlin'}><option>Anthony McLoughlin</option><option>Asish Punnose</option></select></label>
            <label>Finding type<select defaultValue={current.claimType === 'Inference' ? 'Inference' : current.claimType === 'Assumption' ? 'Assumption' : 'Explicit statement'}><option>Explicit statement</option><option>Inference</option><option>Assumption</option></select></label>
          </div>
          <p><b>Analyst decision</b></p>
          <div className="decision-grid">
            {(() => {
              const picked = !current.analystDecision || current.analystDecision === 'Pending' ? 'Confirmed' : current.analystDecision;
              return <>
                <button className={picked === 'Confirmed' ? 'selected' : ''} onClick={() => save('Confirmed')}>Confirm<small>Accept as proposed</small></button>
                <button className={picked === 'Corrected' ? 'selected' : ''} onClick={() => save('Corrected')}>Confirm with correction<small>Edit and accept</small></button>
                <button className={picked === 'Rejected' ? 'selected' : ''} onClick={() => save('Rejected')}>Reject<small>Not a valid finding</small></button>
                <button className={picked === 'NeedsEvidence' ? 'selected' : ''} onClick={() => save('NeedsEvidence')}>Needs more evidence<small>Insufficient support</small></button>
              </>;
            })()}
          </div>
          <label>Comment (optional)<textarea placeholder="Add review notes or explain your decision" value={current.reviewComment} onChange={e => setClaims(cs => cs.map(c => c.id === current.id ? { ...c, reviewComment: e.target.value } : c))} /></label>
          <div className="domain-foot-actions">
            <button className="ghost" disabled={index === 0} onClick={() => setIndex(index - 1)}>Previous claim</button>
            <button className="primary" onClick={() => save(current.analystDecision, true)}>Save & next</button>
          </div>
        </section>
        <aside className="scan-side">
          <section className="panel pad-form">
            <h3>Supporting evidence</h3>
            <p><b>AQUIS walkthrough transcript</b><small> Anthony McLoughlin · 00:23</small></p>
            <blockquote>{current.evidenceExcerpt || 'I did touch on AQUIS in our last meeting, but once again, pretty much similar to groundwater. Oracle Forms front end.'}</blockquote>
            <div className="domain-foot-actions">
              <button className="ghost compact" type="button">Open transcript</button>
              <button className="ghost compact" type="button" onClick={() => setShowContext(s => !s)}>View surrounding context</button>
            </div>
            {showContext && <p className="hint">Surrounding context at {current.sourceLocation || '00:23'}: the speaker compared AQUIS to Groundwater and named Oracle Forms as the front end. This is a proposed claim, not an approved fact.</p>}
          </section>
          <section className="panel pad-form">
            <h3>Evidence quality</h3>
            <p>Source reliability <b>Medium</b></p>
            <p>Evidence strength <b>Direct statement</b></p>
            <p>Transcript completeness <b>Incomplete</b></p>
            <div className="warn">The transcript is missing content between 00:26 and 46:34.</div>
          </section>
          <section className="panel pad-form">
            <h3>Impact if approved</h3>
            <p className="hint">Architecture summary · Front-end technology · Assessment completeness +5% · Creates SME validation request</p>
          </section>
        </aside>
      </div>
      <footer className="docs-foot">
        <label className="check"><input type="checkbox" checked={createRequests} onChange={e => setCreateRequests(e.target.checked)} /> Create validation requests for approved claims</label>
        <button className="ghost" onClick={() => save()}>Save review draft</button>
        <button className="primary" onClick={apply}>Apply reviewed claims</button>
      </footer>
    </div>
  );
}

type ValRequest = {
  id: string; reference: string; title: string; requestedBy: string; reviewer: string; dueDate: string; status: string; context: string; system: string; catalogKey: string;
  items: { id: string; statement: string; domain: string; confidence: string; status: string; decision: string; comment: string; evidenceTitle: string; evidenceExcerpt: string; sourceLocation: string }[];
};

export function ValidationPortal({ requestId, onExit }: { requestId: string; onExit: () => void }) {
  const [req, setReq] = useState<ValRequest>();
  const [index, setIndex] = useState(2);
  const [comment, setComment] = useState('');
  const [decision, setDecision] = useState('confirm');
  const [showContext, setShowContext] = useState(false);
  const [showAll, setShowAll] = useState(true);
  const load = () => api<ValRequest>(`/validation/requests/${requestId}`).then(r => {
    setReq(r);
    const pending = r.items.findIndex(i => i.status !== 'Reviewed');
    setIndex(i => (r.items[i] ? i : (pending < 0 ? 0 : pending)));
  });
  useEffect(() => { load().catch(() => undefined); }, [requestId]);
  useEffect(() => {
    const current = req?.items[index];
    if (!current) return;
    setComment(current.comment || '');
    setDecision(current.decision || 'confirm');
  }, [req, index]);
  if (!req) return <div className="empty"><p>Loading validation request…</p></div>;
  const item = req.items[index];
  const reviewed = req.items.filter(i => i.status === 'Reviewed').length;
  const save = async (next = false) => {
    await api(`/validation/items/${item.id}`, { method: 'PUT', body: JSON.stringify({ decision, comment, correctedStatement: comment || null }) });
    if (next) setIndex(i => Math.min(req.items.length - 1, i + 1));
    await load();
  };
  return (
    <div className="scan validate-page">
      <header className="scan-head">
        <div>
          <small>WATER MONITORING SYSTEMS</small>
          <h1>{req.title}</h1>
          <p>{req.context}</p>
        </div>
        <div className="scan-head-actions">
          <button className="ghost" onClick={onExit}>Save and exit</button>
          <button className="primary" onClick={async () => { await api(`/validation/requests/${req.reference}/submit`, { method: 'POST' }); onExit(); }}>Submit validation</button>
        </div>
      </header>
      <div className="scan-meta">
        <div><small>Due</small><b>{req.dueDate}</b></div>
        <div><small>Requested by</small><b>{req.requestedBy}</b></div>
        <div><small>System</small><b>{req.system}</b></div>
        <div><small>Progress</small><b>{reviewed} of {req.items.length} reviewed</b><div className="bar fat"><i style={{ width: `${reviewed * 100 / req.items.length}%` }} /></div></div>
      </div>
      {item && (
        <div className="validate-grid">
          <section className="panel pad-form">
            <small>Finding {index + 1} of {req.items.length} · {item.domain.replace(/([A-Z])/g, ' $1').trim()}</small>
            <h2>{item.statement}</h2>
            <div className="scan-pills"><span className="pill">{item.confidence} confidence</span><span className="pill">Analyst confirmed</span></div>
            <p><b>Is this information correct?</b></p>
            <div className="decision-grid four">
              <button className={decision === 'confirm' ? 'selected' : ''} onClick={() => setDecision('confirm')}>Yes, this is correct</button>
              <button className={decision === 'correct' ? 'selected' : ''} onClick={() => setDecision('correct')}>Correct with changes</button>
              <button className={decision === 'reject' ? 'selected' : ''} onClick={() => setDecision('reject')}>No, this is incorrect</button>
              <button className={decision === 'unsure' ? 'selected' : ''} onClick={() => setDecision('unsure')}>I'm not sure</button>
            </div>
            <label>Additional context (optional)<textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="AQUIS follows a similar Oracle Forms pattern to the Groundwater application." /></label>
            <label className="check"><input type="checkbox" /> I can provide supporting evidence</label>
            <div className="domain-foot-actions">
              <button className="ghost" disabled={index === 0} onClick={() => setIndex(index - 1)}>Previous</button>
              <button className="primary" onClick={() => save(true)}>Save & next</button>
            </div>
          </section>
          <aside className="scan-side">
            <section className="panel pad-form">
              <h3>Supporting evidence</h3>
              <p><b>{item.evidenceTitle}</b><small> Anthony McLoughlin · {item.sourceLocation}</small></p>
              <blockquote>{item.evidenceExcerpt}</blockquote>
              <div className="domain-foot-actions">
                <button className="ghost compact" type="button">Open source</button>
                <button className="ghost compact" type="button" onClick={() => setShowContext(s => !s)}>View context</button>
              </div>
              {showContext && <p className="hint">Source location {item.sourceLocation || '00:23'}. The original wording is retained. Your decision updates the validated profile and does not rewrite the evidence.</p>}
            </section>
            <section className="panel pad-form">
              <h3>Why this matters</h3>
              <p className="hint">Your response will update the validated {req.system} system profile and may be included in the market-scan document.</p>
              <ul className="hint-list ready-list">
                <li>Architecture summary</li>
                <li>Technology inventory</li>
                <li>Market-scan report</li>
              </ul>
            </section>
            <section className="panel">
              <div className="panel-title"><div><h3>Other items in this request</h3></div></div>
              {(showAll ? req.items : req.items.filter((_, i) => i !== index)).map((other) => (
                <button className="side-row" key={other.id} onClick={() => setIndex(req.items.findIndex(x => x.id === other.id))}>
                  <span>{other.statement}</span>
                  <span className={other.status === 'Reviewed' ? 'pill' : 'pill amber'}>{other.status === 'Reviewed' ? 'Reviewed' : 'Pending'}</span>
                </button>
              ))}
              <button className="ghost pad" type="button" onClick={() => setShowAll(true)}>View all {req.items.length} items</button>
            </section>
          </aside>
        </div>
      )}
      <footer className="docs-foot">
        <span>Responses are saved automatically.</span>
        <button className="ghost" onClick={onExit}>Save and exit</button>
        <button className="primary" onClick={async () => { await api(`/validation/requests/${req.reference}/submit`, { method: 'POST' }); onExit(); }}>Submit validation</button>
      </footer>
    </div>
  );
}
