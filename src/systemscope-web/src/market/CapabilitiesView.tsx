import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../landscape/api';
import { pillClass } from './types';
import './market.css';

type CapabilityRow = {
  id: string;
  catalogKey: string;
  name: string;
  description: string;
  parentId?: string | null;
  parentName?: string | null;
  level: string;
  domain: string;
  category: string;
  criticality: string;
  owner: string;
  defaultMaturityScore?: number | null;
  archived: boolean;
  systemCount: number;
};

type CapabilityDetail = CapabilityRow & {
  children: { id: string; catalogKey: string; name: string; level: string }[];
  coveringSystems: { id: string; masterSystemId: string; catalogKey: string; name: string; role: string; maturityScore?: number | null; state: string; validation: string }[];
};

export function CapabilitiesView({
  selectedId,
  onOpen,
  onBack,
  onOpenSystem,
}: {
  selectedId?: string;
  onOpen: (id: string) => void;
  onBack: () => void;
  onOpenSystem: (key: string) => void;
}) {
  const [rows, setRows] = useState<CapabilityRow[]>([]);
  const [detail, setDetail] = useState<CapabilityDetail>();
  const [q, setQ] = useState('');
  const [level, setLevel] = useState('All levels');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const load = () => api<CapabilityRow[]>('/capabilities').then(setRows).catch(e => setError(e.message));
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!selectedId) { setDetail(undefined); return; }
    api<CapabilityDetail>(`/capabilities/${encodeURIComponent(selectedId)}`).then(setDetail).catch(e => setError(e.message));
  }, [selectedId]);

  const shown = rows.filter(r => {
    const hay = `${r.name} ${r.catalogKey} ${r.domain} ${r.category} ${r.owner}`.toLowerCase();
    if (q && !hay.includes(q.toLowerCase())) return false;
    if (level !== 'All levels' && r.level !== level) return false;
    return true;
  });

  if (selectedId && detail) {
    return (
      <div className="systems-page">
        <section className="panel pad-form">
          <div className="panel-title">
            <div>
              <button className="linkish" onClick={onBack}>← Capabilities</button>
              <h2>{detail.name}</h2>
              <p>{detail.description || 'No description recorded.'}</p>
            </div>
            <span className="pill mute">{detail.level}</span>
          </div>
          <div className="scan-meta">
            <div><small>Domain</small><b>{detail.domain || '—'}</b></div>
            <div><small>Category</small><b>{detail.category || '—'}</b></div>
            <div><small>Criticality</small><b>{detail.criticality}</b></div>
            <div><small>Owner</small><b>{detail.owner || '—'}</b></div>
            <div><small>Parent</small><b>{detail.parentName || '—'}</b></div>
            <div><small>Catalog key</small><b>{detail.catalogKey}</b></div>
          </div>
        </section>
        {!!detail.children.length && (
          <section className="panel">
            <div className="panel-title"><div><h2>Child capabilities</h2></div></div>
            {detail.children.map(c => (
              <button className="side-row" key={c.id} onClick={() => onOpen(c.id)}>
                <span><b>{c.name}</b><small>{c.level}</small></span><span>›</span>
              </button>
            ))}
          </section>
        )}
        <section className="panel">
          <div className="panel-title"><div><h2>Covering systems</h2></div></div>
          {!detail.coveringSystems.length && <p className="pad">No systems currently cover this capability.</p>}
          {detail.coveringSystems.map(s => (
            <button className="side-row" key={s.id} onClick={() => onOpenSystem(s.catalogKey)}>
              <span><b>{s.name}</b><small>{s.role} · {s.state}</small></span>
              <span className={pillClass(s.validation)}>{s.validation}</span>
            </button>
          ))}
        </section>
      </div>
    );
  }

  return (
    <div className="systems-page">
      {error && <div className="notice">{error}<button onClick={() => setError('')}>×</button></div>}
      <div className="sys-kpis">
        <article><span className="sys-kpi-ico mint">▣</span><div><strong>{rows.length}</strong><small>Capabilities</small></div></article>
        <article><span className="sys-kpi-ico mint">1</span><div><strong>{rows.filter(r => r.level === 'L1').length}</strong><small>Level 1</small></div></article>
        <article><span className="sys-kpi-ico lilac">2</span><div><strong>{rows.filter(r => r.level === 'L2').length}</strong><small>Level 2</small></div></article>
        <article><span className="sys-kpi-ico peach">◎</span><div><strong>{rows.reduce((n, r) => n + (r.systemCount || 0), 0)}</strong><small>Coverage links</small></div></article>
      </div>
      <section className="panel systems-register">
        <div className="panel-title">
          <div>
            <h2>Capability catalogue</h2>
            <p>What systems do, independent of how they are built. Linked to reusable system records.</p>
          </div>
          <button className="primary" onClick={() => setCreating(true)}>＋ New capability</button>
        </div>
        <div className="sys-toolbar">
          <label className="sys-search"><span>⌕</span><input placeholder="Search capabilities…" value={q} onChange={e => setQ(e.target.value)} /></label>
          <select value={level} onChange={e => setLevel(e.target.value)} aria-label="Filter by level">
            <option>All levels</option>
            <option>L1</option>
            <option>L2</option>
            <option>L3</option>
          </select>
        </div>
        <div className="sys-head" style={{ gridTemplateColumns: '2fr 80px 1fr 1fr 100px 80px' }}>
          <span>Capability</span><span>Level</span><span>Domain</span><span>Category</span><span>Systems</span><span />
        </div>
        {!shown.length && <p className="pad">No capabilities match the current filter.</p>}
        {shown.map(r => (
          <button className="sys-row" key={r.id} onClick={() => onOpen(r.id)} style={{ gridTemplateColumns: '2fr 80px 1fr 1fr 100px 80px' }}>
            <span><b>{r.name}</b><small>{r.parentName ? `${r.parentName} · ${r.catalogKey}` : r.catalogKey}</small></span>
            <span>{r.level}</span>
            <span>{r.domain || '—'}</span>
            <span>{r.category || '—'}</span>
            <span>{r.systemCount}</span>
            <span>›</span>
          </button>
        ))}
      </section>
      {creating && (
        <div className="overlay" onMouseDown={() => setCreating(false)}>
          <dialog open onMouseDown={e => e.stopPropagation()}>
            <button className="close" onClick={() => setCreating(false)}>×</button>
            <CreateCapabilityForm parents={rows.filter(r => r.level !== 'L3')} onCancel={() => setCreating(false)} onCreated={async id => { setCreating(false); await load(); onOpen(id); }} onError={setError} />
          </dialog>
        </div>
      )}
    </div>
  );
}

function CreateCapabilityForm({ parents, onCancel, onCreated, onError }: { parents: CapabilityRow[]; onCancel: () => void; onCreated: (id: string) => void; onError: (m: string) => void }) {
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    try {
      const created = await api<{ id: string }>('/capabilities', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          catalogKey: form.catalogKey || null,
          description: form.description,
          parentId: form.parentId || null,
          domain: form.domain,
          category: form.category,
          criticality: form.criticality || 'Moderate',
          owner: form.owner,
        }),
      });
      onCreated(created.id);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not create capability');
    }
  };
  return (
    <form className="pad-form" onSubmit={submit}>
      <h2>New capability</h2>
      <label>Name<input name="name" required autoFocus /></label>
      <label>Catalog key<input name="catalogKey" placeholder="Generated from name if blank" /></label>
      <label>Description<textarea name="description" /></label>
      <div className="grid2">
        <label>Parent
          <select name="parentId">
            <option value="">None (Level 1)</option>
            {parents.map(p => <option key={p.id} value={p.id}>{p.level} · {p.name}</option>)}
          </select>
        </label>
        <label>Criticality
          <select name="criticality">
            <option>Moderate</option>
            <option>High</option>
            <option>Critical</option>
            <option>Low</option>
          </select>
        </label>
        <label>Domain<input name="domain" placeholder="Groundwater" /></label>
        <label>Category<input name="category" placeholder="Monitoring" /></label>
      </div>
      <label>Owner<input name="owner" /></label>
      <div className="scan-head-actions">
        <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
        <button className="primary" type="submit">Create capability</button>
      </div>
    </form>
  );
}
