import { useMemo, useState } from 'react';
import schema from './gwdb-schema.json';
import './schema-explorer.css';

type Column = { name:string; type:string; nullable:boolean; key:string; comment:string };
type Table = { owner:string; name:string; tablespace:string; status:string; rows:number; lastAnalyzed:string; comment:string; columns:Column[] };
type Relation = { from:string; to:string; name:string; column:string; status:string };
const tables = schema.tables as Table[];
const relations = schema.relationships as Relation[];

const domainOf = (name:string) => name.includes('WLE') || name.includes('LEVEL') ? 'Water Levels' : name.includes('SAMPLE') || name.includes('QUALITY') || name.includes('ANAL') ? 'Water Quality' : name.includes('CAS') || name.includes('LITH') || name.includes('AQUI') ? 'Drilling' : name.includes('PROJECT') || name.includes('MON') ? 'Monitoring' : name.includes('REF') || name.includes('CODE') ? 'Reference Data' : 'Bore Information';

export function SchemaExplorer({ onBack }:{ onBack:()=>void }) {
  const [query,setQuery]=useState(''); const [selected,setSelected]=useState(''); const [depth,setDepth]=useState(1); const [domain,setDomain]=useState(''); const [tab,setTab]=useState('Details'); const [expanded,setExpanded]=useState<Record<string,boolean>>({}); const [dataset,setDataset]=useState('');
  const filtered=useMemo(()=>tables.filter(t=>(!domain||domainOf(t.name)===domain)&&(!query||`${t.name} ${t.comment} ${t.columns.map(c=>c.name).join(' ')}`.toLowerCase().includes(query.toLowerCase()))),[query,domain]);
  const current=tables.find(t=>t.name===selected)||filtered[0];
  const visible=filtered;
  const exportData=()=>{const blob=new Blob([JSON.stringify(schema,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='gwdb-schema-metadata.json';a.click();URL.revokeObjectURL(a.href)};
  const related=current?relations.filter(r=>r.from===current.name||r.to===current.name):[];
  return <div className="sx">
    <header className="sx-head"><button onClick={onBack}>Systems</button><span>/</span><b>Groundwater Database</b><span>/</span><strong>Schema Explorer</strong><em>TEST</em><select><option>GW</option></select><label>⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder={`Search ${tables.length} tables`}/></label><button>⇩ Import Metadata</button><button className="primary" onClick={exportData}>⇧ Export</button></header>
    <section className="sx-stats"><Stat n={schema.counts.tables} label="Tables" icon="▦" onClick={()=>setDataset('Tables')}/><Stat n={schema.counts.columns} label="Columns" icon="⇵" onClick={()=>setDataset('Columns')}/><Stat n={schema.counts.relationships} label="Relationships" icon="⌘" onClick={()=>setDataset('Relationships')}/><Stat n={6} label="Domains" icon="◇" onClick={()=>setDataset('Domains')}/><Stat n={schema.reviewFlags.length} label="Review Flags" icon="⚠" warn onClick={()=>setDataset('Review Flags')}/></section>
    {dataset&&<DatasetDialog name={dataset} onClose={()=>setDataset('')} />}
    <main className="sx-work"><section className="sx-canvas"><div className="sx-tools"><button>＋</button><button>−</button><button>⛶</button><button>◎</button><button>Fit view</button><span>Relationship depth</span><select value={depth} onChange={e=>setDepth(+e.target.value)}><option value="1">1 hop</option><option value="2">2 hops</option><option value="3">3 hops</option></select><i/> Confirmed <i className="dash"/> Inferred</div><div className="sx-board">
      {selected&&current&&<RelationshipMapV2 table={current} relations={related} onSelect={setSelected} onClose={()=>setSelected('')} />}
      {visible.map((t,i)=><article key={t.name} className={`sx-table ${t.name===current?.name?'selected':''}`} onClick={()=>setSelected(t.name)}><h3>{t.name}<button>•••</button></h3>{t.columns.slice(0,expanded[t.name]?t.columns.length:6).map(c=><div key={c.name}><small className={c.key?c.key.toLowerCase():''}>{c.key}</small><span>{c.name}</span><code>{c.type}</code></div>)}{t.columns.length>6&&<button className="more" onClick={e=>{e.stopPropagation();setExpanded(x=>({...x,[t.name]:!x[t.name]}))}}>{expanded[t.name]?'Show less':`${t.columns.length-6} more columns⌄`}</button>}<b className="domain" style={{background:['#35b8af','#1670df','#7e3bad','#e5a900'][i%4]}}/></article>)}
      {!visible.length&&<div className="sx-empty">No tables match the current search and domain filter.</div>}
    </div></section><aside className="sx-detail"><nav>{['Details','Impact','Quality'].map(x=><button className={tab===x?'active':''} onClick={()=>setTab(x)}>{x}</button>)}</nav>{current&&<>{tab==='Details'&&<div className="sx-panel"><h2>{current.name} ☆</h2><dl><dt>Business domain</dt><dd>● {domainOf(current.name)}</dd><dt>Primary key</dt><dd>{current.columns.filter(c=>c.key.split('/').includes('PK')).map(c=>c.name).join(' + ')||'Not identified'}</dd><dt>Related tables</dt><dd>{related.length}</dd><dt>Estimated rows</dt><dd>{current.rows.toLocaleString()}</dd><dt>Status</dt><dd>{current.status}</dd></dl><h3>Used by</h3><p>▣ Database objects <b>{schema.counts.objects}</b></p><p>⚙ Dependencies <b>{schema.counts.dependencies}</b></p><h3>Review alert</h3><div className="sx-alert">⚠ {current.comment?'Metadata review recommended':'Missing table description'}</div><dl><dt>Table owner</dt><dd>{current.owner}</dd><dt>Tablespace</dt><dd>{current.tablespace}</dd></dl></div>}{tab==='Impact'&&<div className="sx-panel"><h2>Relationship impact</h2>{related.map(r=><p key={r.name}><b>{r.from===current.name?r.to:r.from}</b><br/><small>{r.name} · {r.column}</small></p>)}</div>}{tab==='Quality'&&<div className="sx-panel"><h2>Metadata quality</h2><p>{current.columns.filter(c=>c.comment).length} of {current.columns.length} columns documented</p>{schema.reviewFlags.map(x=><div className="sx-alert" key={x}>⚠ {x}</div>)}</div>}</>}</aside></main>
    <footer className="sx-filters"><b>Filter by domain</b>{['Bore Information','Water Levels','Water Quality','Drilling','Monitoring','Reference Data'].map((x,i)=><button key={x} className={domain===x?'active':''} onClick={()=>setDomain(domain===x?'':x)}><i style={{background:['#119eaa','#16ae22','#1670df','#8141ad','#e5a900','#999'][i]}}/>{x} <span>{tables.filter(t=>domainOf(t.name)===x).length}</span></button>)}<button onClick={()=>setDomain('')}>Clear filters</button></footer>
  </div>
}
function Stat({n,label,icon,warn,onClick}:{n:number;label:string;icon:string;warn?:boolean;onClick:()=>void}){return <button type="button" onClick={onClick}><i className={warn?'warn':''}>{icon}</i><b>{n}</b><span>{label}</span></button>}

function DatasetDialog({name,onClose}:{name:string;onClose:()=>void}) {
  const columnRows=tables.flatMap(t=>t.columns.map(c=>[t.name,c.name,c.type,c.key||'—',c.nullable?'Yes':'No']));
  const domains=['Bore Information','Water Levels','Water Quality','Drilling','Monitoring','Reference Data'];
  const config:Record<string,{heads:string[];rows:string[][]}>={Tables:{heads:['Owner','Table','Columns','Estimated rows','Tablespace'],rows:tables.map(t=>[t.owner,t.name,String(t.columns.length),t.rows.toLocaleString(),t.tablespace])},Columns:{heads:['Table','Column','Data type','Key','Nullable'],rows:columnRows},Relationships:{heads:['From table','To table','Constraint','Column','Status'],rows:relations.map(r=>[r.from,r.to,r.name,r.column,r.status])},Domains:{heads:['Business domain','Tables'],rows:domains.map(x=>[x,String(tables.filter(t=>domainOf(t.name)===x).length)])},'Review Flags':{heads:['Review issue'],rows:schema.reviewFlags.map(x=>[x])}};
  const data=config[name]; return <div className="sx-data-overlay" role="dialog" aria-modal="true"><section><header><div><h2>{name}</h2><p>{data.rows.length.toLocaleString()} records from the supplied metadata extracts</p></div><button onClick={onClose}>×</button></header><div className="sx-data-grid"><table><thead><tr>{data.heads.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{data.rows.map((row,i)=><tr key={i}>{row.map((v,j)=><td key={j}>{v}</td>)}</tr>)}</tbody></table></div></section></div>
}

function RelationshipMapV2({table,relations:onMap,onSelect,onClose}:{table:Table;relations:Relation[];onSelect:(name:string)=>void;onClose:()=>void}) {
  const allSlots=[
    {side:'left',y:10,path:'M400 270H335V100H200',lx:275,ly:90},
    {side:'right',y:10,path:'M600 270H665V100H800',lx:725,ly:90},
    {side:'left',y:210,path:'M400 310H200',lx:292,ly:300},
    {side:'right',y:210,path:'M600 310H800',lx:708,ly:300},
    {side:'left',y:410,path:'M400 350H335V500H200',lx:275,ly:490},
    {side:'right',y:410,path:'M600 350H665V500H800',lx:725,ly:490},
  ];
  const orders:Record<number,number[]>={1:[2],2:[2,3],3:[0,5,2],4:[0,1,4,5],5:[0,1,2,4,5],6:[0,1,2,3,4,5]};
  const shown=onMap.slice(0,6); const slots=(orders[shown.length]||orders[6]).map(i=>allSlots[i]);
  return <section className="sx-schema-map"><button className="sx-all-tables" onClick={onClose}>← All tables</button><svg viewBox="0 0 1000 620" preserveAspectRatio="none" aria-hidden="true"><defs><marker id="schema-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 10 5 0 10Z"/></marker></defs>{shown.map((r,i)=><g key={r.name}><path className={r.status} d={slots[i].path}/><text x={slots[i].lx} y={slots[i].ly}>{r.status==='inferred'?'Inferred':'Confirmed'}</text></g>)}</svg><SchemaTableCard table={table} central onSelect={onSelect}/>{shown.map((r,i)=>{const other=r.from===table.name?r.to:r.from;const otherTable=tables.find(t=>t.name===other);return otherTable?<div className={`sx-map-node ${slots[i].side}`} style={{top:slots[i].y}} key={r.name}><SchemaTableCard table={otherTable} relation={r} onSelect={onSelect}/></div>:null})}{!onMap.length&&<p className="sx-no-links">No validated foreign keys were found for {table.name}.</p>}</section>
}

function SchemaTableCard({table,central,relation,onSelect}:{table:Table;central?:boolean;relation?:Relation;onSelect:(name:string)=>void}) {
  const [expanded,setExpanded]=useState(false);
  const limit=central?10:5;
  const linkedColumn=relation?.column;
  const initial=table.columns.slice(0,limit);
  const visible=!expanded&&linkedColumn&&!initial.some(c=>c.name===linkedColumn)
    ? [...initial.slice(0,-1),table.columns.find(c=>c.name===linkedColumn)!]
    : expanded?table.columns:initial;
  return <article className={`sx-map-table${central?' central':''}${expanded?' expanded':''}`} onClick={()=>onSelect(table.name)}><h3>{table.name}<span>•••</span></h3><div className="sx-map-columns">{visible.map(c=><div key={c.name} className={c.name===linkedColumn?'linked':''}><small className={(c.key||'').toLowerCase().replace('/',' ')}>{c.key}</small><b title={c.name}>{c.name}</b><code>{c.type}</code></div>)}</div>{table.columns.length>limit&&<button className="sx-map-more" onClick={e=>{e.stopPropagation();setExpanded(v=>!v)}}>{expanded?'Show fewer columns':`View all ${table.columns.length} columns`}</button>}</article>
}
