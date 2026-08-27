import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../landscape/api';
import { pillClass } from './types';
import './market.css';

type AssetRow = {
  id: string;
  catalogKey: string;
  name: string;
  description: string;
  businessDefinition: string;
  dataOwner: string;
  steward: string;
  classification: string;
  retentionPeriod: string;
  regulatoryRequirements: string;
  validation: string;
  archived: boolean;
  systemCount: number;
  systemOfRecordName?: string | null;
};

type AssetDetail = AssetRow & {
  coveringSystems: { id: string; masterSystemId: string; catalogKey: string; name: string; role: string; state: string; validation: string }[];
  capabilities: { id: string; capabilityId: string; catalogKey: string; name: string; level: string }[];
};

export function InformationAssetsView({
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
  const [rows, setRows] = useState<AssetRow[]>([]);
  const [detail, setDetail] = useState<AssetDetail>();
  const [q, setQ] = useState('');
  const [classification, setClassification] = useState('All classifications');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const load = () => api<AssetRow[]>('/information-assets').then(setRows).catch(e => setError(e.message));
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!selectedId) { setDetail(undefined); return; }
    api<AssetDetail>(`/information-assets/${encodeURIComponent(selectedId)}`).then(setDetail).catch(e => setError(e.message));
  }, [selectedId]);

  const shown = rows.filter(r => {
    const hay = `${r.name} ${r.catalogKey} ${r.dataOwner} ${r.steward} ${r.classification}`.toLowerCase();
    if (q && !hay.includes(q.toLowerCase())) return false;
    if (classification !== 'All classifications' && r.classification !== classification) return false;
    return true;
  });

  if (selectedId && detail) {
    return (
      <div className="systems-page">
        <section className="panel pad-form">
          <div className="panel-title">
            <div>
              <button className="linkish" onClick={onBack}>← Information assets</button>
              <h2>{detail.name}</h2>
              <p>{detail.businessDefinition || detail.description || 'No business definition recorded.'}</p>
            </div>
            <span className="pill mute">{detail.classification}</span>
          </div>
          <div className="scan-meta">
            <div><small>Data owner</small><b>{detail.dataOwner || '—'}</b></div>
            <div><small>Steward</small><b>{detail.steward || '—'}</b></div>
            <div><small>System of record</small><b>{detail.systemOfRecordName || '—'}</b></div>
            <div><small>Retention</small><b>{detail.retentionPeriod || '—'}</b></div>
            <div><small>Catalog key</small><b>{detail.catalogKey}</b></div>
            <div><small>Regulatory</small><b>{detail.regulatoryRequirements || '—'}</b></div>
          </div>
        </section>
        {!!detail.capabilities?.length && (
          <section className="panel">
            <div className="panel-title"><div><h2>Linked capabilities</h2></div></div>
            {detail.capabilities.map(c => (
              <div className="side-row" key={c.id}>
                <span><b>{c.name}</b><small>{c.level}</small></span>
              </div>
            ))}
          </section>
        )}
        <section className="panel">
          <div className="panel-title"><div><h2>Covering systems</h2></div></div>
          {!detail.coveringSystems.length && <p className="pad">No systems currently cover this information asset.</p>}
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
        <article><span className="sys-kpi-ico mint">▦</span><div><strong>{rows.length}</strong><small>Information assets</small></div></article>
        <article><span className="sys-kpi-ico peach">Restricted</span><div><strong>{rows.filter(r => r.classification === 'Sensitive' || r.classification === 'Restricted').length}</strong><small>Sensitive / restricted</small></div></article>
        <article><span className="sys-kpi-ico lilac">SoR</span><div><strong>{rows.filter(r => r.systemOfRecordName).length}</strong><small>Have a system of record</small></div></article>
        <article><span className="sys-kpi-ico mint">◎</span><div><strong>{rows.reduce((n, r) => n + (r.systemCount || 0), 0)}</strong><small>Coverage links</small></div></article>
      </div>
      <section className="panel systems-register">
        <div className="panel-title">
          <div>
            <h2>Information asset register</h2>
            <p>Business data objects, independent of database tables and data-quality ratings.</p>
          </div>
          <button className="primary" onClick={() => setCreating(true)}>＋ New information asset</button>
        </div>
        <div className="sys-toolbar">
          <label className="sys-search"><span>⌕</span><input placeholder="Search information assets…" value={q} onChange={e => setQ(e.target.value)} /></label>
          <select value={classification} onChange={e => setClassification(e.target.value)} aria-label="Filter by classification">
            <option>All classifications</option>
            <option>Public</option>
            <option>Internal</option>
            <option>Sensitive</option>
            <option>Restricted</option>
          </select>
        </div>
        <div className="sys-head" style={{ gridTemplateColumns: '2fr 120px 1.4fr 1fr 80px 80px' }}>
          <span>Asset</span><span>Classification</span><span>System of record</span><span>Owner</span><span>Systems</span><span />
        </div>
        {!shown.length && <p className="pad">No information assets match the current filter.</p>}
        {shown.map(r => (
          <button className="sys-row" key={r.id} onClick={() => onOpen(r.id)} style={{ gridTemplateColumns: '2fr 120px 1.4fr 1fr 80px 80px' }}>
            <span><b>{r.name}</b><small>{r.catalogKey}</small></span>
            <span>{r.classification}</span>
            <span>{r.systemOfRecordName || '—'}</span>
            <span>{r.dataOwner || '—'}</span>
            <span>{r.systemCount}</span>
            <span>›</span>
          </button>
        ))}
      </section>
      {creating && (
        <div className="overlay" onMouseDown={() => setCreating(false)}>
          <dialog open onMouseDown={e => e.stopPropagation()}>
            <button className="close" onClick={() => setCreating(false)}>×</button>
            <CreateAssetForm onCancel={() => setCreating(false)} onCreated={async id => { setCreating(false); await load(); onOpen(id); }} onError={setError} />
          </dialog>
        </div>
      )}
    </div>
  );
}

function CreateAssetForm({ onCancel, onCreated, onError }: { onCancel: () => void; onCreated: (id: string) => void; onError: (m: string) => void }) {
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    try {
      const created = await api<{ id: string }>('/information-assets', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          catalogKey: form.catalogKey || null,
          description: form.description,
          businessDefinition: form.businessDefinition,
          dataOwner: form.dataOwner,
          steward: form.steward,
          classification: form.classification || 'Internal',
          retentionPeriod: form.retentionPeriod,
          regulatoryRequirements: form.regulatoryRequirements,
          validation: 'Captured',
        }),
      });
      onCreated(created.id);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not create information asset');
    }
  };
  return (
    <form className="pad-form" onSubmit={submit}>
      <h2>New information asset</h2>
      <label>Name<input name="name" required autoFocus /></label>
      <label>Catalog key<input name="catalogKey" placeholder="Generated from name if blank" /></label>
      <label>Business definition<textarea name="businessDefinition" /></label>
      <div className="grid2">
        <label>Classification
          <select name="classification">
            <option>Internal</option>
            <option>Public</option>
            <option>Sensitive</option>
            <option>Restricted</option>
          </select>
        </label>
        <label>Data owner<input name="dataOwner" /></label>
        <label>Steward<input name="steward" /></label>
        <label>Retention<input name="retentionPeriod" placeholder="7 years" /></label>
      </div>
      <label>Regulatory requirements<input name="regulatoryRequirements" /></label>
      <label>Description<textarea name="description" /></label>
      <div className="scan-head-actions">
        <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
        <button className="primary" type="submit">Create information asset</button>
      </div>
    </form>
  );
}
