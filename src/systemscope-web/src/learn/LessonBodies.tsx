import { BoreArt, BottleArt, FlaskArt, GeneratedArt, Info, PillRow, ReportArt, Section, Table, Warn } from './visuals';
import { itemDetail, itemTitle, type ScreenLesson, type ScreenSection } from './screenData';

export function LessonBody({ lesson }: { lesson: ScreenLesson }) {
  return (
    <>
      {lesson.sections.map(section => (
        <Section key={section.number} n={section.number} title={section.title}>
          <SectionView section={section} />
        </Section>
      ))}
      {lesson.completionBanner && <div className="lv-complete">{lesson.completionBanner}</div>}
    </>
  );
}

function SectionView({ section }: { section: ScreenSection }) {
  switch (section.type) {
    case 'hubDiagram': return <Hub section={section} />;
    case 'conceptFlow': return <ConceptFlow section={section} />;
    case 'sequence': return <Sequence section={section} />;
    case 'table': return <TableSection section={section} />;
    case 'tables': return <TablesSection section={section} />;
    case 'comparison': return <Comparison section={section} />;
    case 'oneToMany': return <OneToMany section={section} />;
    case 'definition': return <Definition section={section} />;
    case 'pipeDiagram': return <Pipes section={section} />;
    case 'formula': return <Formula section={section} />;
    case 'groups': return <Groups section={section} />;
    case 'requiredFields': return <RequiredFields section={section} />;
    case 'depthDiagram': return <Depth section={section} />;
    case 'recordCard': return <RecordCard section={section} />;
    case 'geologyDiagram': return <Geology section={section} />;
    case 'relationship': return <RelChain section={section} />;
    case 'measurementDiagram': return <Measure section={section} />;
    case 'pumpingDiagram': return <Pump section={section} />;
    default: return section.text ? <p>{section.text}</p> : null;
  }
}

function Hub({ section }: { section: ScreenSection }) {
  const items = section.items ?? [];
  const hub = section.hub || '';
  const registration = /registration/i.test(hub);
  const project = /project/i.test(hub) && !/registration/i.test(hub);
  const bore = /^bore$/i.test(hub);
  if (bore) {
    const named = (title: string) => items.find(i => itemTitle(i).toLowerCase() === title.toLowerCase());
    return (
      <>
        <div className="lv-bore-wrap">
          <svg className="lv-bore-links" viewBox="0 0 682 148" preserveAspectRatio="none" aria-hidden="true">
            <path d="M225 33h39q12 0 12 12v20q0 9 12 9" />
            <path d="M225 115h39q12 0 12-12V83q0-9 12-9" />
            <path d="M457 33h-39q-12 0-12 12v20q0 9-12 9" />
            <path d="M457 115h-39q-12 0-12-12V83q0-9-12-9" />
          </svg>
          <div className="lv-entity loc"><EntityIcon type="location" /><b>{itemTitle(named('Location') || 'Location')}</b><small>{itemDetail(named('Location') || { detail: 'Coordinates · Area' })}</small></div>
          <div className="lv-entity mon"><EntityIcon type="monitoring" /><b>{itemTitle(named('Monitoring') || 'Monitoring')}</b><small>{itemDetail(named('Monitoring') || { detail: 'Water Levels · Quality' })}</small></div>
          <div className="lv-bore-center"><span>{hub}</span><img src="/learn/lesson1-bore.png" alt="Groundwater bore cross-section through soil and aquifer layers" /></div>
          <div className="lv-entity con"><EntityIcon type="construction" /><b>{itemTitle(named('Construction') || 'Construction')}</b><small>{itemDetail(named('Construction') || { detail: 'Pipes · Strata' })}</small></div>
          <div className="lv-entity doc"><EntityIcon type="documents" /><b>{itemTitle(named('Documents') || 'Documents')}</b><small>{itemDetail(named('Documents') || { detail: 'Projects · References' })}</small></div>
        </div>
        {section.info && <Info>{section.info}</Info>}
      </>
    );
  }
  if (project) {
    return (
      <>
        <div className="lv-project-hub">
          {items.slice(0, 2).map(i => <article key={itemTitle(i)}><b>{itemTitle(i)}</b><small>{itemDetail(i)}</small></article>)}
          <div className="folder">{hub}</div>
          {items.slice(2, 4).map(i => <article key={itemTitle(i)}><b>{itemTitle(i)}</b><small>{itemDetail(i)}</small></article>)}
        </div>
        {section.info && <Info>{section.info}</Info>}
      </>
    );
  }
  if (registration && items.length >= 4) {
    return (
      <>
        {section.info && <p>{section.info}</p>}
        <div className="lv-reg-hub">
          <div className="head">{hub.split('·')[0].trim()}<small>{hub.includes('·') ? hub.slice(hub.indexOf('·') + 1).trim() : ''}</small></div>
          <div className="kids">{items.map(i => <div key={itemTitle(i)}>{itemTitle(i)}<small>RN</small></div>)}</div>
        </div>
      </>
    );
  }
  return (
    <>
      <div className="lv-hub">
        <div className="core">{hub.includes('·') ? <>{hub.split('·')[0]}<br /><small>{hub.slice(hub.indexOf('·') + 1)}</small></> : hub}</div>
        {items.map((item, i) => <div className={`sat ${['tl', 'top', 'tr', 'bl', 'br'][i] || 'tr'}`} key={itemTitle(item)}>{itemTitle(item)}</div>)}
        {items.map((_, i) => <span className={`rn ${['a', 'b', 'c', 'd', 'e'][i]}`} key={i}>RN</span>)}
      </div>
      {section.info && <Info>{section.info}</Info>}
    </>
  );
}

function EntityIcon({ type }: { type: 'location' | 'monitoring' | 'construction' | 'documents' }) {
  if (type === 'location') return <svg className="lv-entity-icon" viewBox="0 0 32 40" aria-hidden="true"><path d="M16 38S3 24 3 14a13 13 0 1 1 26 0c0 10-13 24-13 24Z"/><circle cx="16" cy="14" r="6"/></svg>;
  if (type === 'monitoring') return <svg className="lv-entity-icon" viewBox="0 0 32 40" aria-hidden="true"><path d="M16 2S5 17 5 25a11 11 0 0 0 22 0C27 17 16 2 16 2Z"/><path d="M10 27c2 3 5 4 8 3"/></svg>;
  if (type === 'construction') return <svg className="lv-entity-icon" viewBox="0 0 40 40" aria-hidden="true"><path d="M31 3v11c0 5-4 9-9 9h-4v7c0 4-3 7-7 7H3"/><path d="M27 3h8M3 33v7M18 19h-6M8 29v8"/></svg>;
  return <svg className="lv-entity-icon" viewBox="0 0 34 40" aria-hidden="true"><path d="M5 2h17l7 7v29H5Z"/><path d="M22 2v8h7M10 17h14M10 23h14M10 29h14"/></svg>;
}

function ConceptFlow({ section }: { section: ScreenSection }) {
  const items = section.items ?? [];
  return (
    <>
      <div className="lv-flow3">
        {items.flatMap((item, i) => {
          const extra = typeof item !== 'string' ? item.example : undefined;
          const card = <article className={i === 1 ? 'green' : undefined} key={itemTitle(item)}><b>{itemTitle(item)}</b><p>{itemDetail(item)}{extra ? <><br />{extra}</> : null}</p></article>;
          return i === 0 ? [card] : [<span key={`a${i}`}>→</span>, card];
        })}
      </div>
      {section.warning && <Warn>{section.warning}</Warn>}
    </>
  );
}

function Sequence({ section }: { section: ScreenSection }) {
  const arts = [<BoreArt key="b" />, <BottleArt key="o" />, <FlaskArt key="f" />, <ReportArt key="r" />];
  const first = itemTitle(section.items?.[0] || '');
  const pictorial = /bore and pipe/i.test(first);
  const steps = /data entry/i.test(first);
  return (
    <>
      <div className={pictorial ? 'lv-process' : steps ? 'lv-process wide' : 'lv-journey'}>
        {section.items?.map((item, i) => (
          pictorial
            ? <figure key={itemTitle(item)}>{arts[i]}<figcaption><b>{itemTitle(item)}</b><span>{itemDetail(item)}</span></figcaption></figure>
            : <figure key={itemTitle(item)}><JourneyIcon index={i} /><figcaption><b>{itemTitle(item)}</b><small>{itemDetail(item)}</small></figcaption></figure>
        ))}
      </div>
      {section.info && <Info>{section.info}</Info>}
    </>
  );
}

function JourneyIcon({ index }: { index: number }) {
  if (index === 0) return (
    <svg className="lv-journey-icon" viewBox="0 0 56 58" aria-hidden="true">
      <path d="M10 9h10v43H10zM25 5h9v47h-9zM39 11h8v41h-8z" />
      <path d="M7 9h16M22 5h15M36 11h14M13 17v28M28 13v32M42 19v26" />
      <path className="fill" d="M11 35h8v16h-8zM26 31h7v20h-7zM40 38h6v13h-6z" />
    </svg>
  );
  if (index === 1) return (
    <svg className="lv-journey-icon" viewBox="0 0 58 58" aria-hidden="true">
      <path d="M42 5v19c0 8-6 14-14 14H18v9c0 4-3 7-7 7H4" />
      <path d="M38 5h9M4 49v7M18 33h-8M7 43h11" />
      <path className="fill" d="M38 16h9v8c0 12-8 21-20 21h-5v-8h6c7 0 10-5 10-12z" />
    </svg>
  );
  if (index === 2) return (
    <svg className="lv-journey-icon" viewBox="0 0 64 58" aria-hidden="true">
      <path d="M8 39c5-4 10 4 15 0s10 4 15 0 10 4 16 0M8 47c5-4 10 4 15 0s10 4 15 0 10 4 16 0M8 31c5-4 10 4 15 0" />
      <path d="M31 6h13v36H31zM35 12h5M35 18h5M35 24h5M35 30h5M35 36h5" />
      <path d="M18 12v16M14 16h8M18 8v2" />
    </svg>
  );
  return (
    <svg className="lv-journey-icon" viewBox="0 0 58 58" aria-hidden="true">
      <path d="M22 5h14M25 5v17L12 46c-3 6 1 9 7 9h20c6 0 10-3 7-9L33 22V5" />
      <path className="fill" d="M18 42h23l5 9H13z" />
      <circle cx="25" cy="43" r="2" /><circle cx="35" cy="48" r="2" />
    </svg>
  );
}

function TableSection({ section }: { section: ScreenSection }) {
  const labels = section.labels && !Array.isArray(section.labels) ? section.labels : undefined;
  const annotated = Boolean(labels);
  const rows = annotated ? [['…', '…', '…', '…'], ...(section.rows ?? []), ['…', '…', '…', '…']] : (section.rows ?? []);
  return (
    <>
      {annotated ? (
        <div className="lv-annotated">
          <span className="lv-tag top">Table · Water Level</span>
          <div className="lv-table-name">Water Level</div>
          <Table headers={section.columns ?? []} rows={rows} accent={1} />
          {labels?.field && <span className="lv-tag field">{labels.field}</span>}
          {labels?.row && <span className="lv-tag row">{labels.row}</span>}
        </div>
      ) : <Table headers={section.columns ?? []} rows={section.rows ?? []} />}
      {section.info && <Info>{section.info}</Info>}
    </>
  );
}

function TablesSection({ section }: { section: ScreenSection }) {
  return (
    <div className="lv-two">
      {section.tables?.map(t => (
        <div key={t.title}><h4>{t.title}</h4><Table headers={t.columns} rows={t.rows} /></div>
      ))}
    </div>
  );
}

function Comparison({ section }: { section: ScreenSection }) {
  const items = section.items ?? [];
  const withValue = items.some(i => typeof i !== 'string' && i.value);
  const withFields = items.some(i => typeof i !== 'string' && i.fields);
  if (withValue) {
    return (
      <div className="lv-compare">
        {items.map((item, i) => (
          <div className={i === 0 ? 'biz' : undefined} key={itemTitle(item)}>
            <b>{itemTitle(item)}</b>
            <span>{typeof item === 'string' ? '' : item.value}</span>
            <span>{itemDetail(item)}</span>
          </div>
        ))}
      </div>
    );
  }
  if (withFields) {
    return (
      <div className="lv-compare-boxes">
        <article>
          <b>{itemTitle(items[0])}</b>
          {typeof items[0] !== 'string' && items[0].detail && <p>{items[0].detail}</p>}
          <PillRow items={(typeof items[0] !== 'string' ? items[0].fields : undefined) ?? []} />
        </article>
        <div className="mid">{section.relationship}{section.warning && <Warn>{section.warning}</Warn>}</div>
        <article className="mint">
          <b>{itemTitle(items[1])}</b>
          {typeof items[1] !== 'string' && items[1].detail && <p>{items[1].detail}</p>}
          <PillRow items={(typeof items[1] !== 'string' ? items[1].fields : undefined) ?? []} />
        </article>
      </div>
    );
  }
  return (
    <div className="lv-two">
      {items.map((item, i) => (
        <article className={`lv-key ${i === 0 ? 'green' : 'blue'}`} key={itemTitle(item)}>
          <KeyIcon composite={i === 1} />
          <b>{itemTitle(item)}</b>
          <p>{itemDetail(item)}</p>
          {typeof item !== 'string' && item.example && <small>Example: {item.example}</small>}
        </article>
      ))}
    </div>
  );
}

function KeyIcon({ composite }: { composite: boolean }) {
  return (
    <svg className="lv-key-icon" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="24" cy="20" r="11" /><circle cx="24" cy="20" r="4" />
      <path d="M19 30 6 48v9h9l4-5h7v-7h6l7-10" />
      {composite && <><circle cx="43" cy="19" r="9" /><path d="m40 28-3 23h7l2-6h6l1-7h5" /></>}
    </svg>
  );
}

function OneToMany({ section }: { section: ScreenSection }) {
  if (section.child && typeof section.parent === 'object') {
    return (
      <div className="lv-compare-boxes">
        <article>
          <b>{section.parent.title}</b>
          <PillRow items={section.parent.fields ?? []} />
        </article>
        <div className="mid">{section.relationship}{section.warning && <Warn>{section.warning}</Warn>}</div>
        <article className="mint">
          <b>{section.child.title}</b>
          <PillRow items={section.child.fields ?? []} />
        </article>
      </div>
    );
  }
  return (
    <>
      <div className="lv-otm">
        <svg className="lv-otm-links" viewBox="0 0 748 172" preserveAspectRatio="none" aria-hidden="true">
          <defs><marker id="otm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10Z" /></marker></defs>
          <path d="M286 86h100M386 26v120" />
          <path className="arrow" d="M386 26h82" />
          <path className="arrow" d="M386 86h82" />
          <path className="arrow" d="M386 146h82" />
        </svg>
        <div className="parent"><OtmIcon type="registration" /><span><b>Registration</b> · RN 123456</span></div>
        <div className="kids">{section.children?.map(c => {
          const [title, detail] = c.split(' - ');
          return <div key={c}><OtmIcon type="water" /><span><b>{title}</b>{detail ? ` · ${detail}` : ''}</span></div>;
        })}</div>
      </div>
      {section.caption && <p className="lv-caption">{section.caption}</p>}
    </>
  );
}

function OtmIcon({ type }: { type: 'registration' | 'water' }) {
  if (type === 'water') return <svg className="lv-otm-icon" viewBox="0 0 32 40" aria-hidden="true"><path d="M16 2S5 18 5 26a11 11 0 0 0 22 0C27 18 16 2 16 2Z" /></svg>;
  return <svg className="lv-otm-icon registration" viewBox="0 0 40 40" aria-hidden="true"><path d="M6 36V13l14-8 14 8v23M2 36h36M13 17h5v5h-5zM23 17h5v5h-5zM13 26h5v5h-5zM23 26h5v5h-5z" /></svg>;
}

function Definition({ section }: { section: ScreenSection }) {
  return (
    <>
      {section.text && <p>{section.text}</p>}
      {section.example && <div className="lv-callout">ℹ {section.example}</div>}
    </>
  );
}

function Pipes({ section }: { section: ScreenSection }) {
  const completed = (section.pipes ?? []).filter(p => p.code !== 'X');
  const extra = (section.pipes ?? []).find(p => p.code === 'X');
  return (
    <div className="lv-pipes">
      <div className="well">
        <span className="tag">{section.rn}<br /><small>One registered facility</small></span>
        <GeneratedArt kind="pipes" label="Three groundwater bore pipes at different depths" />
        <div className="labels">{completed.map(p => <span key={p.code}>{p.code} · {p.detail}</span>)}</div>
      </div>
      {extra && (
        <div className="pipe-x">
          <b>X · {extra.detail}</b>
          <BoreArt pipes={1} />
        </div>
      )}
    </div>
  );
}

function Formula({ section }: { section: ScreenSection }) {
  return (
    <div className="lv-composite">
      {section.parts?.map(p => <div key={p.value}><b>{p.value}</b><small>{p.meaning}</small></div>)}
    </div>
  );
}

function Groups({ section }: { section: ScreenSection }) {
  return (
    <div className="lv-groups">
      {section.groups?.map((g, i) => (
        <article key={g.title}><span className="lv-n">{i + 1}</span><b>{g.title}</b><ul>{g.items.map(item => <li key={item}>{item}</li>)}</ul></article>
      ))}
    </div>
  );
}

function RequiredFields({ section }: { section: ScreenSection }) {
  return (
    <div className="lv-compulsory">
      {section.items?.map(i => <span key={itemTitle(i)}>✓ {itemTitle(i)}</span>)}
      {section.rule && <em>{section.rule}</em>}
    </div>
  );
}

function Depth({ section }: { section: ScreenSection }) {
  return (
    <div className="lv-casing">
      <div className="depth">{['0 m', '40 m', '85 m', '100 m'].map(d => <small key={d}>{d}</small>)}</div>
      <GeneratedArt kind="casing" label="Groundwater bore casing and screen construction cross-section" />
      <div className="layers">
        {section.intervals?.map(iv => (
          <p key={iv.material}><b>{iv.material}</b> · {iv.top}–{iv.bottom}<br />Top of Material: {iv.top} · Bottom of Material: {iv.bottom}</p>
        ))}
      </div>
    </div>
  );
}

function RecordCard({ section }: { section: ScreenSection }) {
  return (
    <div className="lv-split">
      <article>
        <h4>Casing record</h4>
        <p>{section.identifier}</p>
        <PillRow items={section.fields ?? []} />
        {section.description && <p>{section.description}</p>}
      </article>
      {section.pipeX && (
        <aside className="lv-warn-card">
          <b>Pipe X</b>
          <p>{section.pipeX}</p>
          <PillRow items={section.examples ?? []} />
        </aside>
      )}
    </div>
  );
}

function Geology({ section }: { section: ScreenSection }) {
  return (
    <div className="lv-strata">
      <GeneratedArt kind="strata" label="Geological strata and groundwater aquifer cross-section" />
      <div className="layers">
        <p>0 m Surface soil</p>
        <p>0–15 m Clay</p>
        <p>15–45 m Sandstone</p>
        <p>45–70 m Aquifer</p>
        <p>70–100 m Shale</p>
      </div>
      <div className="cards">
        {section.layers?.map(layer => (
          <article key={layer.table}>
            <b>{layer.table}</b>
            <p>{layer.detail}</p>
            <PillRow items={layer.key.split('+').map(s => s.trim())} />
          </article>
        ))}
      </div>
    </div>
  );
}

function RelChain({ section }: { section: ScreenSection }) {
  return (
    <>
      <div className="lv-chain">
        {section.items?.map((item, i) => (
          <div className={i === 1 ? 'mint' : i === 3 ? 'lilac' : undefined} key={itemTitle(item)}>{itemTitle(item)}</div>
        ))}
      </div>
      <div className="lv-legend-row">
        {section.note && <small>{section.note}</small>}
        {section.warning && <Warn>{section.warning}</Warn>}
      </div>
    </>
  );
}

function Measure({ section }: { section: ScreenSection }) {
  const labels = Array.isArray(section.labels) ? section.labels : [];
  return (
    <div className="lv-measure">
      <div className="art"><GeneratedArt kind="bore" label="Groundwater bore and water-level cross-section" /></div>
      <div>
        {labels.map((l, i) => <div className={`chip ${i === 0 ? 'green' : ''}`} key={l}>{l}</div>)}
        {section.info && <Info>{section.info}</Info>}
      </div>
    </div>
  );
}

function Pump({ section }: { section: ScreenSection }) {
  const labels = Array.isArray(section.labels) ? section.labels : [];
  return (
    <div className="lv-pump">
      <div className="labels">{labels.slice(0, 3).map(l => <p key={l}>{l}</p>)}</div>
      <GeneratedArt kind="pump" label="Pumping-test bore with discharge pipe and flow meter" />
      <small>{labels[3]}</small>
    </div>
  );
}
