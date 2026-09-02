import { BoreArt, BottleArt, FlaskArt, GeneratedArt, Info, PillRow, ReportArt, Section, Table, Warn } from './visuals';
import { itemDetail, itemTitle, type ScreenLesson, type ScreenSection } from './screenData';

export function LessonBody({ lesson }: { lesson: ScreenLesson }) {
  if (lesson.number === 6) return <LessonSixBody lesson={lesson} />;
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

function LessonSixBody({ lesson }: { lesson: ScreenLesson }) {
  const depth = lesson.sections[0];
  const attributes = lesson.sections[1];
  const record = lesson.sections[2];
  return (
    <>
      <Section n={1} title={depth.title}>
        <div className="lv-casing-combined">
          <Depth section={depth} />
          <article className="lv-casing-record">
            <h4>Casing record</h4>
            <p className="identifier">{record.identifier}</p>
            <dl>
              <div><dt>Registered Number</dt><dd>123456</dd></div>
              <div><dt>Pipe</dt><dd>A</dd></div>
              <div><dt>Date</dt><dd>14/05/2024</dd></div>
              <div><dt>Record</dt><dd>1, 2, 3</dd></div>
              <div><dt>Description</dt><dd>{record.description}</dd></div>
            </dl>
          </article>
        </div>
      </Section>
      <Section n={2} title={attributes.title}>
        <div className="lv-attributes-combined">
          <TableSection section={attributes} />
          <aside className="lv-warn-card">
            <b><i aria-hidden="true">i</i> Pipe X</b>
            <p>{record.pipeX}</p>
            <PillRow items={record.examples ?? []} />
          </aside>
        </div>
      </Section>
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
          <svg className="lv-project-links" viewBox="0 0 820 176" preserveAspectRatio="none" aria-hidden="true"><path d="M250 43h42l58 45M250 133h42l58-45M570 43h-42l-58 45M570 133h-42l-58-45" /><circle cx="350" cy="88" r="5" /><circle cx="470" cy="88" r="5" /></svg>
          {items.slice(0, 2).map(i => <article key={itemTitle(i)}><ProjectContextIcon title={itemTitle(i)} /><span><b>{itemTitle(i)}</b><small>{itemDetail(i)}</small></span></article>)}
          <div className="folder"><i aria-hidden="true" />{hub}</div>
          {items.slice(2, 4).map(i => <article key={itemTitle(i)}><ProjectContextIcon title={itemTitle(i)} /><span><b>{itemTitle(i)}</b><small>{itemDetail(i)}</small></span></article>)}
        </div>
        {section.info && <Info>{section.info}</Info>}
      </>
    );
  }
  if (registration && /primary/i.test(hub) && items.length >= 4) {
    return (
      <>
        {section.info && <p>{section.info}</p>}
        <div className="lv-reg-hub">
          <div className="head"><RegistrationDbIcon /><span>{hub.split('·')[0].trim()}<small>{hub.includes('·') ? hub.slice(hub.indexOf('·') + 1).trim() : ''}</small></span></div>
          <svg className="links" viewBox="0 0 900 95" preserveAspectRatio="none" aria-hidden="true"><path d="M450 0v24H75v24M450 24H263v24M450 24v24M450 24h187v24M450 24h375v24" /></svg>
          <div className="kids">{items.map(i => <div key={itemTitle(i)}><HubIcon title={itemTitle(i)} /><b>{itemTitle(i)}</b><small>RN</small></div>)}</div>
        </div>
      </>
    );
  }
  return (
    <>
      <div className="lv-hub">
        {items.length === 5 && <svg className="lv-hub-links" viewBox="0 0 800 260" preserveAspectRatio="none" aria-hidden="true">
          <line x1="400" y1="143" x2="64" y2="70" /><line x1="400" y1="143" x2="400" y2="21" />
          <line x1="400" y1="143" x2="704" y2="70" /><line x1="400" y1="143" x2="64" y2="198" />
          <line x1="400" y1="143" x2="704" y2="198" />
        </svg>}
        <div className="core"><HubCoreIcon /><span>{hub.includes('·') ? <>{hub.split('·')[0]}<small>· {hub.slice(hub.indexOf('·') + 1).trim()}</small></> : hub}</span></div>
        {items.map((item, i) => <div className={`sat ${['tl', 'top', 'tr', 'bl', 'br'][i] || 'tr'}`} key={itemTitle(item)}><HubIcon title={itemTitle(item)} />{itemTitle(item)}</div>)}
        {items.map((_, i) => <span className={`rn ${['a', 'b', 'c', 'd', 'e'][i]}`} key={i}>RN</span>)}
      </div>
      {section.info && <Info>{section.info}</Info>}
    </>
  );
}

function ProjectContextIcon({ title }: { title: string }) {
  const key = title.toLowerCase();
  if (key.includes('document')) return <svg viewBox="0 0 42 48" aria-hidden="true"><path d="M7 2h20l8 8v36H7Z"/><path d="M27 2v9h8M13 19h16M13 26h16M13 33h16"/></svg>;
  if (key.includes('monitoring')) return <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="4" y="7" width="40" height="36" rx="3"/><path d="M4 16h40M14 3v8M34 3v8"/><path d="M24 21s-7 9-7 14a7 7 0 0 0 14 0c0-5-7-14-7-14Z"/></svg>;
  if (key.includes('external')) return <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="20"/><path d="M4 24h40M24 4c7 7 10 14 10 20s-3 13-10 20M24 4c-7 7-10 14-10 20s3 13 10 20M24 4v40"/></svg>;
  return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M4 42V15h40v27M9 15V8h30v7M19 8V3h10v5M20 17v25M28 17v25M7 27h34"/></svg>;
}

function HubIcon({ title }: { title: string }) {
  const key = title.toLowerCase();
  if (key.includes('water analysis')) return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M11 3h10M13 3v9L6.5 25a3 3 0 0 0 2.7 4h13.6a3 3 0 0 0 2.7-4L19 12V3" /><path d="M10 21h12M12 17h8" /><circle cx="14" cy="24.5" r="1" /></svg>;
  if (key.includes('image')) return <svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3" y="5" width="26" height="22" rx="2" /><circle cx="22" cy="12" r="2.5" /><path d="m5 24 7-8 5 5 3-3 7 7" /></svg>;
  if (key.includes('aquifer')) return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M2 8c4.7-4 9.3 4 14 0s9.3 4 14 0M2 16c4.7-4 9.3 4 14 0s9.3 4 14 0M2 24c4.7-4 9.3 4 14 0s9.3 4 14 0" /></svg>;
  if (key.includes('strata')) return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="m16 3 13 7-13 7-13-7 13-7Z" /><path d="m3 16 13 7 13-7M3 22l13 7 13-7" /></svg>;
  if (key.includes('casing')) return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M12 3h8v26h-8zM8 5h16M8 27h16M16 8v16" /><path d="M10 11h4M18 15h4M10 20h4" /></svg>;
  return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2S7 13 7 21a9 9 0 0 0 18 0C25 13 16 2 16 2Z" /><path d="M11 22c1.5 2.5 3.5 3.5 6 3.5" /></svg>;
}

function HubCoreIcon() {
  return <svg className="lv-hub-core-icon" viewBox="0 0 32 38" aria-hidden="true"><rect x="4" y="5" width="24" height="30" rx="2" /><path d="M11 5V2h10v3M10 13h12M10 19h12M10 25h8" /><path d="m20 29 2 2 4-5" /></svg>;
}

function RegistrationDbIcon() {
  return <svg viewBox="0 0 36 36" aria-hidden="true"><ellipse cx="18" cy="8" rx="11" ry="5" /><path d="M7 8v9c0 3 5 5 11 5s11-2 11-5V8M7 17v9c0 3 5 5 11 5s11-2 11-5v-9" /></svg>;
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
  const first = itemTitle(section.items?.[0] || '');
  const pictorial = /bore and pipe/i.test(first);
  const arts = [pictorial ? <GeneratedArt key="b" kind="bore" label="Groundwater bore and pipe cross-section" /> : <BoreArt key="b" />, <BottleArt key="o" />, <FlaskArt key="f" />, <ReportArt key="r" />];
  const steps = /data entry/i.test(first);
  return (
    <>
      <div className={pictorial ? 'lv-process' : steps ? 'lv-process wide' : 'lv-journey'}>
        {section.items?.map((item, i) => (
          pictorial
            ? <figure key={itemTitle(item)}>{arts[i]}<figcaption><b>{itemTitle(item)}</b><span>{itemDetail(item)}</span></figcaption></figure>
            : <figure key={itemTitle(item)}>{steps ? <ReportingStageIcon index={i} /> : <JourneyIcon index={i} />}<figcaption><b>{itemTitle(item)}</b><small>{itemDetail(item)}</small></figcaption>{steps && i === 1 && <span className="lv-validation-status" aria-label="Validation can pass or produce a warning"><i>✓</i><i>!</i></span>}</figure>
        ))}
      </div>
      {section.info && <Info>{section.info}</Info>}
    </>
  );
}

function ReportingStageIcon({ index }: { index: number }) {
  if (index === 0) return <svg className="lv-reporting-stage-icon" viewBox="0 0 64 64" aria-hidden="true"><path d="M13 5h27l11 11v43H13Z"/><path d="M40 5v13h11M21 26h20M21 34h14M21 42h10"/><path className="accent" d="m35 48 14-14 7 7-14 14-10 3Z"/><path d="m47 36 7 7"/></svg>;
  if (index === 1) return <svg className="lv-reporting-stage-icon" viewBox="0 0 64 64" aria-hidden="true"><path className="accent-soft" d="M32 4 53 12v17c0 14-8 24-21 31C19 53 11 43 11 29V12Z"/><path d="M32 4 53 12v17c0 14-8 24-21 31C19 53 11 43 11 29V12Z"/><path className="check" d="m21 30 8 8 15-18"/><circle className="status" cx="50" cy="49" r="10"/><path className="status-check" d="m45 49 4 4 7-9"/></svg>;
  if (index === 2) return <svg className="lv-reporting-stage-icon" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="25"/><path d="M32 14v19l12 8M32 7v5M57 32h-5M32 57v-5M7 32h5"/><circle className="accent" cx="32" cy="32" r="3"/></svg>;
  return <svg className="lv-reporting-stage-icon" viewBox="0 0 64 64" aria-hidden="true"><path d="M8 57h50M14 55V39h9v16M29 55V27h9v28M44 55V12h9v43"/><path className="accent-soft" d="M15 40h7v14h-7zM30 28h7v26h-7zM45 13h7v41h-7z"/></svg>;
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
      <>
        {section.text && <p>{section.text}</p>}
        <div className="lv-compare">
          {items.map((item, i) => (
            <div className={i === 0 ? 'biz' : undefined} key={itemTitle(item)}>
              <span className="lv-compare-icon"><KeyRowIcon technical={i === 1} /></span>
              <b>{itemTitle(item)}</b>
              <span>{typeof item === 'string' ? '' : item.value}</span>
              <span>{itemDetail(item)}</span>
            </div>
          ))}
        </div>
      </>
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
        <div className="mid"><span>{section.relationship}</span><i className="lv-compare-arrow" aria-hidden="true">↔</i>{section.warning && <Warn>{section.warning}</Warn>}</div>
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

function KeyRowIcon({ technical }: { technical: boolean }) {
  return technical
    ? <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="M12 8v2M12 14v2M8 12h2M14 12h2" /></svg>
    : <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3" /><path d="M6 19a6 6 0 0 1 12 0" /></svg>;
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
        <div className="mid">{section.relationship}<i className="lv-many-branch" aria-hidden="true"><span /><span /><span /></i>{section.warning && <Warn>{section.warning}</Warn>}</div>
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
        <article key={g.title}><GroupIcon title={g.title} /><span className="lv-n">{i + 1}</span><b>{g.title}</b><ul>{g.items.map(item => <li key={item}>{item}</li>)}</ul></article>
      ))}
    </div>
  );
}

function GroupIcon({ title }: { title: string }) {
  const key = title.toLowerCase();
  if (key === 'location') return <svg className="lv-group-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 29S6 20 6 12a10 10 0 1 1 20 0c0 8-10 17-10 17Z" /><circle cx="16" cy="12" r="3" /></svg>;
  if (key === 'classification') return <svg className="lv-group-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="m4 14 10-10h12l2 2v12L18 28 4 14Z" /><circle cx="21" cy="10" r="2" /></svg>;
  if (key === 'drilling') return <svg className="lv-group-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M10 4v23M10 5l12 16M5 27h22M20 21v6M7 14h6" /></svg>;
  if (key === 'administration') return <svg className="lv-group-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M7 29V8h18v21M12 8V3h8v5M3 29h26M11 13h3M18 13h3M11 18h3M18 18h3M14 29v-6h4v6" /></svg>;
  if (key === 'governance') return <svg className="lv-group-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3 27 7v8c0 7-4 12-11 15C9 27 5 22 5 15V7l11-4Z" /><path d="M16 8v16" /></svg>;
  return <svg className="lv-group-icon" viewBox="0 0 32 32" aria-hidden="true"><rect x="3" y="6" width="26" height="20" rx="2" /><circle cx="10" cy="14" r="3" /><path d="M6 22c1-4 7-4 8 0M17 12h8M17 17h8M17 22h6" /></svg>;
}

function RequiredFields({ section }: { section: ScreenSection }) {
  return (
    <div className="lv-compulsory">
      {section.items?.map(i => <span key={itemTitle(i)}><i aria-hidden="true">✓</i>{itemTitle(i)}</span>)}
      {section.rule && <em>{section.rule}</em>}
    </div>
  );
}

function Depth({ section }: { section: ScreenSection }) {
  const layerHelp: Record<string, { purpose: string; diameter: string }> = {
    'Steel casing': { purpose: 'Strong outer casing that stabilises and protects the upper bore.', diameter: '150 mm' },
    'PVC casing': { purpose: 'Non-corrosive inner casing that supports and seals the deeper bore.', diameter: '125 mm' },
    'Screen': { purpose: 'Slotted intake section that lets groundwater enter while limiting sediment.', diameter: '125 mm' },
  };
  return (
    <div className="lv-casing">
      <div className="depth">{['0 m', '40 m', '85 m', '100 m'].map(d => <small key={d}>{d}</small>)}</div>
      <GeneratedArt kind="casing" label="Groundwater bore casing and screen construction cross-section" />
      <div className="lv-depth-guides" aria-hidden="true"><i /><i /><i /><i /></div>
      <div className="layers">
        {section.intervals?.map(iv => {
          const help = layerHelp[iv.material];
          return <p className="lv-layer" key={iv.material}>
            <span className="lv-layer-trigger" tabIndex={0}><b>{iv.material}</b>{help && <span className="lv-layer-tooltip" role="tooltip"><strong>What is {iv.material}?</strong>{help.purpose}<small>Depth: {iv.top}–{iv.bottom} · Outside diameter: {help.diameter}</small></span>}</span> · {iv.top}–{iv.bottom}<br />Top of Material: {iv.top} · Bottom of Material: {iv.bottom}
          </p>;
        })}
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
      <div className="lv-geology-visual">
        <GeneratedArt kind="strata" label="Geological strata and groundwater aquifer cross-section" />
        <span className="lv-geology-bore" aria-hidden="true" />
        <div className="lv-geology-depth" aria-label="Depth in metres">{['0', '15', '45', '70', '100'].map(d => <span key={d}>{d}</span>)}</div>
        <div className="lv-geology-labels">
          <GeologyLabel className="surface" depth="0 m" name="Surface soil" detail="The upper organic and unconsolidated ground layer at the land surface." />
          <GeologyLabel className="clay" depth="0–15 m" name="Clay" detail="Fine-grained, low-permeability material that generally restricts groundwater movement." />
          <GeologyLabel className="sand" depth="15–45 m" name="Sandstone" detail="Consolidated sand-sized grains that may store or transmit groundwater through pores and fractures." />
          <GeologyLabel className="aquifer" depth="45–70 m" name="Aquifer · Sand and gravel" detail="A permeable, water-bearing interval capable of storing and transmitting groundwater." />
          <GeologyLabel className="shale" depth="70–100 m" name="Shale" detail="Fine-grained, typically low-permeability rock that may act as a confining layer." />
        </div>
      </div>
      <div className="cards">
        {section.layers?.map(layer => (
          <article key={layer.table}>
            <span className="lv-strata-card-icon"><HubIcon title={layer.table === 'Aquifer' ? 'Aquifer' : 'Strata'} /></span><b>{layer.table}</b>
            <p>{layer.detail}</p>
            <PillRow items={layer.key.split('+').map(s => s.trim())} />
          </article>
        ))}
      </div>
    </div>
  );
}

function GeologyLabel({ className, depth, name, detail }: { className: string; depth: string; name: string; detail: string }) {
  return <p className={className}><b>{depth}</b><span className="lv-geology-trigger" tabIndex={0}>{name}<span className="lv-geology-tooltip" role="tooltip"><strong>What is {name}?</strong>{detail}<small>Recorded interval: {depth}</small></span></span></p>;
}

function RelChain({ section }: { section: ScreenSection }) {
  const relationshipHelp: Record<string, { purpose: string; fields: string; relationship: string }> = {
    'Strata Log': { purpose: 'Stores geological material intervals encountered down the bore.', fields: 'RN, Record, Top, Bottom, Description', relationship: 'Links geological intervals to the registered facility through RN.' },
    'Registration - RN 123456': { purpose: 'The central facility record identified by Registered Number 123456.', fields: 'Registered Number (RN)', relationship: 'Acts as the parent context for Strata Log and Aquifer records.' },
    'Aquifer': { purpose: 'Stores water-bearing intervals and their yield, condition and formation.', fields: 'RN, Record, Top, Bottom, Yield, Condition, Formation', relationship: 'Associates groundwater-bearing intervals with the registered facility.' },
    'Lithologies': { purpose: 'Provides controlled geological material descriptions used by strata records.', fields: 'Lithology code and description', relationship: 'The physical Oracle relationship still requires verification.' },
  };
  return (
    <>
      <div className="lv-chain">
        {section.items?.map((item, i) => (
          <div className={i === 1 ? 'mint' : i === 3 ? 'lilac' : undefined} key={itemTitle(item)} tabIndex={0}>
            <RelationshipIcon title={itemTitle(item)} />{itemTitle(item)}
            {relationshipHelp[itemTitle(item)] && <span className="lv-relation-tooltip" role="tooltip"><strong>{itemTitle(item)}</strong>{relationshipHelp[itemTitle(item)].purpose}<small><b>Key fields</b>{relationshipHelp[itemTitle(item)].fields}</small><small><b>Relationship</b>{relationshipHelp[itemTitle(item)].relationship}</small></span>}
          </div>
        ))}
      </div>
      <div className="lv-legend-row">
        {section.note && <small>{section.note}</small>}
        {section.warning && <Warn>{section.warning}</Warn>}
      </div>
    </>
  );
}

function RelationshipIcon({ title }: { title: string }) {
  if (/aquifer/i.test(title)) return <HubIcon title="Aquifer" />;
  if (/registration/i.test(title)) return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h12l3 3v15H5zM17 3v5h3M9 12h7M9 16h7" /></svg>;
  if (/litholog/i.test(title)) return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 3 5 3-5 3-5-3 5-3Zm10 6 5 3-5 3-5-3 5-3ZM7 15l5 3-5 3-5-3 5-3Z" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 9 5-9 5-9-5 9-5Zm-9 10 9 5 9-5M3 18l9 5 9-5" /></svg>;
}

function Measure({ section }: { section: ScreenSection }) {
  return (
    <div className="lv-measure">
      <div className="art lv-water-measure-art">
        <GeneratedArt kind="bore" label="Groundwater bore and water-level cross-section" />
        <span className="measure-reference"><b>R · Reference Point</b><small>(Top of Casing)</small></span>
        <span className="measure-surface"><b>N · Natural Surface</b></span>
        <span className="measure-depth"><b>Measurement<br />· -14.3 m</b></span>
        <i className="reference-line" aria-hidden="true" /><i className="surface-line" aria-hidden="true" /><i className="depth-arrow" aria-hidden="true" />
      </div>
      <div className="lv-measure-notes">
        <div className="chip green">N · Natural Surface</div>
        <div className="chip">R · Reference Point</div>
        {section.info && <Info>{section.info}</Info>}
      </div>
    </div>
  );
}

function Pump({ section }: { section: ScreenSection }) {
  const labels = Array.isArray(section.labels) ? section.labels : [];
  return (
    <div className="lv-pump-diagram">
      <GeneratedArt kind="pump" label="Pumping-test bore showing static and pumping water levels, drawdown, and discharge" />
      <span className="pump-label static">{labels[0]}</span>
      <span className="pump-label pumping">{labels[1]}</span>
      <span className="pump-label drawdown">{labels[2]}</span>
      <span className="pump-label discharge">{labels[3]}</span>
      <i className="pump-guide static-line" aria-hidden="true" />
      <i className="pump-guide pumping-line" aria-hidden="true" />
      <i className="pump-drawdown-arrow" aria-hidden="true" />
      <i className="pump-discharge-arrow" aria-hidden="true" />
    </div>
  );
}
