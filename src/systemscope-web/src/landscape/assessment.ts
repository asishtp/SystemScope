export type BoxLifecycle = 'not-in-scope' | 'registered' | 'in-workshop' | 'submitted' | 'approved';
export type CoverageBand = 'none' | 'red' | 'amber' | 'green';
export type Disposition = 'keep' | 'retire' | 'replace' | 'consolidate' | 'add';
export type Capability =
  | 'entitlements'
  | 'compliance'
  | 'groundwater'
  | 'monitoring'
  | 'public-channels'
  | 'spatial'
  | 'operations'
  | 'corporate';

export type LandscapeEdge = { from: string; to: string; label?: string; kind?: string };

export type CatalogRef = { id: string; name: string; acronym: string; decommissioned?: boolean; zone?: string; category?: string };

export type RegisteredRef = { id: string; projectId: string; name: string; acronym: string };

export type AssessmentFact = {
  systemId: string;
  status: string;
  responses: { mandatory: boolean; answered: boolean; status: string; confidence: string }[];
};

export type FindingFact = { systemId: string; type: string; severity: string };
export type ActionFact = { systemId: string | null; status: string; dueDate: string };
export type EvidenceFact = { systemId: string | null; title: string; validated: boolean; updatedAt?: string; source?: string };

export type AssessmentFacts = {
  systems: RegisteredRef[];
  assessments: AssessmentFact[];
  findings: FindingFact[];
  actions: ActionFact[];
  evidence: EvidenceFact[];
};

export type BoxStatus = {
  catalogId: string;
  registeredId?: string;
  inScope: boolean;
  context: boolean;
  lifecycle: BoxLifecycle;
  coverage: CoverageBand;
  coveragePercent: number;
  highCriticalFindings: number;
  informationGaps: number;
  findingCount: number;
  actionCount: number;
  overdueActions: number;
  lastConfirmed: { at: string; source: string; confidence: string } | null;
  unconfirmed: boolean;
};

export type ToBeNode = { id: string; disposition?: Disposition };

export function graphNeighbours(id: string, edges: LandscapeEdge[]) {
  const inbound = edges.filter(l => l.to === id);
  const outbound = edges.filter(l => l.from === id);
  return { inbound, outbound, related: new Set<string>([...inbound.map(l => l.from), ...outbound.map(l => l.to), id]) };
}

export function matchCatalogToRegistered(catalog: CatalogRef, registered: RegisteredRef[]) {
  const acronym = catalog.acronym.trim().toLowerCase();
  const name = catalog.name.trim().toLowerCase();
  return registered.find(s => {
    const a = s.acronym.trim().toLowerCase();
    const n = s.name.trim().toLowerCase();
    return (acronym && a === acronym) || n === name || (acronym && n === acronym) || (a && a === name);
  });
}

export function coveragePercent(responses: AssessmentFact['responses']) {
  const mandatory = responses.filter(r => r.mandatory);
  if (mandatory.length === 0) return -1;
  const done = mandatory.filter(r => r.answered || r.status === 'Unknown' || r.status === 'NotApplicable').length;
  return Math.round((done * 100) / mandatory.length);
}

export function coverageBand(percent: number, highCriticalFindings: number): CoverageBand {
  if (highCriticalFindings > 0) return 'red';
  if (percent < 0) return 'none';
  if (percent < 50) return 'red';
  if (percent < 80) return 'amber';
  return 'green';
}

export function lifecycleOf(registered: RegisteredRef | undefined, assessment: AssessmentFact | undefined): BoxLifecycle {
  if (!registered) return 'not-in-scope';
  const status = (assessment?.status ?? '').toLowerCase();
  if (status === 'approved' || status === 'complete') return 'approved';
  if (status === 'submitted') return 'submitted';
  if (status === 'inprogress' || status === 'in-progress' || status === 'returned') return 'in-workshop';
  return 'registered';
}

export function contextIds(inScopeCatalogIds: string[], edges: LandscapeEdge[]) {
  const scope = new Set(inScopeCatalogIds);
  const context = new Set<string>();
  for (const id of scope) {
    for (const n of graphNeighbours(id, edges).related) {
      if (!scope.has(n)) context.add(n);
    }
  }
  return context;
}

export function neighbourhood(id: string, edges: LandscapeEdge[], hops: number) {
  const seen = new Set<string>([id]);
  let frontier = [id];
  const depth = Math.max(0, hops);
  for (let i = 0; i < depth; i++) {
    const next: string[] = [];
    for (const cur of frontier) {
      for (const edge of edges) {
        const other = edge.from === cur ? edge.to : edge.to === cur ? edge.from : null;
        if (!other || seen.has(other)) continue;
        seen.add(other);
        next.push(other);
      }
    }
    frontier = next;
  }
  return seen;
}

export function blastRadius(catalogId: string, edges: LandscapeEdge[]) {
  const seen = new Set<string>();
  const queue = [catalogId];
  while (queue.length) {
    const id = queue.shift()!;
    for (const edge of edges) {
      if (edge.from !== id || seen.has(edge.to) || edge.to === catalogId) continue;
      seen.add(edge.to);
      queue.push(edge.to);
    }
  }
  return [...seen];
}

export function isolateShown(
  catalogIds: string[],
  options: {
    queryHits?: Set<string>;
    filterHits?: Set<string>;
    inScope?: Set<string>;
    edges?: LandscapeEdge[];
    includeContext?: boolean;
  },
) {
  let shown = new Set(catalogIds);
  if (options.filterHits) shown = new Set([...shown].filter(id => options.filterHits!.has(id)));
  if (options.queryHits) {
    const hits = new Set(options.queryHits);
    if (options.includeContext !== false && options.edges) {
      for (const id of options.queryHits) for (const n of graphNeighbours(id, options.edges).related) hits.add(n);
    }
    shown = new Set([...shown].filter(id => hits.has(id)));
  }
  if (options.inScope && options.includeContext && options.edges) {
    const allowed = new Set(options.inScope);
    for (const id of contextIds([...options.inScope], options.edges)) allowed.add(id);
    shown = new Set([...shown].filter(id => allowed.has(id)));
  }
  return shown;
}

export function queryHits(catalog: (CatalogRef & { description?: string; bullets?: string[] })[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return new Set<string>();
  return new Set(
    catalog
      .filter(s => `${s.name} ${s.acronym} ${s.description ?? ''} ${(s.bullets ?? []).join(' ')}`.toLowerCase().includes(q))
      .map(s => s.id),
  );
}

export function focusViewport(
  boxes: { x: number; y: number; w: number; h: number }[],
  viewport: { width: number; height: number },
  pad = 80,
) {
  if (!boxes.length || viewport.width <= 0 || viewport.height <= 0) {
    return { zoom: 1, pan: { x: 20, y: 12 } };
  }
  const minX = Math.min(...boxes.map(b => b.x));
  const minY = Math.min(...boxes.map(b => b.y));
  const maxX = Math.max(...boxes.map(b => b.x + b.w));
  const maxY = Math.max(...boxes.map(b => b.y + b.h));
  const w = Math.max(1, maxX - minX + pad * 2);
  const h = Math.max(1, maxY - minY + pad * 2);
  const zoom = Math.min(viewport.width / w, viewport.height / h, 1.3);
  return {
    zoom: Math.max(0.35, zoom),
    pan: {
      x: viewport.width / 2 - ((minX + maxX) / 2) * Math.max(0.35, zoom),
      y: viewport.height / 2 - ((minY + maxY) / 2) * Math.max(0.35, zoom),
    },
    bounds: { minX, minY, maxX, maxY },
  };
}

export function compareLabel(catalogId: string, asIsIds: Set<string>, toBe: ToBeNode[]): Disposition | 'absent' {
  const node = toBe.find(t => t.id === catalogId);
  const inAsIs = asIsIds.has(catalogId);
  if (node?.disposition) return node.disposition;
  if (inAsIs && node) return 'keep';
  if (inAsIs && !node) return 'retire';
  if (!inAsIs && node) return 'add';
  return 'absent';
}

export function defaultToBeDisposition(id: string, decommissioned?: boolean): Disposition {
  if (decommissioned || id === 'ciram') return 'retire';
  if (id === 'wateriq' || id === 'wateriq-portal' || id === 'wms' || id === 'hydstra') return 'keep';
  return 'keep';
}

export const capabilityOf = (sys: CatalogRef): Capability => {
  const byId: Record<string, Capability> = {
    werd: 'entitlements', ats: 'entitlements', wms: 'entitlements', orc: 'entitlements',
    ciram: 'compliance', ccms: 'compliance', wicd: 'compliance', iauditor: 'compliance', cat6: 'compliance',
    gwdb: 'groundwater', bls: 'groundwater', ogia: 'groundwater', wfieldapp: 'groundwater', 'gw-online': 'groundwater',
    hydstra: 'monitoring', gauges: 'monitoring', wasp: 'monitoring', silo: 'monitoring', hcs: 'monitoring',
    'des-azure': 'monitoring', 'metering-internal': 'monitoring', 'metering-external': 'monitoring',
    'qspatial-live': 'spatial', sir: 'spatial', spin: 'spatial', survey123: 'spatial', geores: 'spatial', 'qd-globe': 'spatial', qspatial: 'spatial',
    'business-qld': 'public-channels', 'open-data': 'public-channels', wmip: 'public-channels', 'my-groundwater': 'public-channels',
    wateriq: 'operations', 'wateriq-portal': 'operations', mms: 'operations', swan: 'operations', 'regional-dashboards': 'operations',
    sap: 'corporate', edocs: 'corporate', library: 'corporate', bpoint: 'corporate', mid: 'corporate', abr: 'corporate',
  };
  if (byId[sys.id]) return byId[sys.id];
  if (sys.zone === 'public') return 'public-channels';
  if (sys.category === 'water-monitoring') return 'monitoring';
  return 'operations';
};

export const SWIMLANES: { id: Capability; label: string }[] = [
  { id: 'entitlements', label: 'Entitlements' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'groundwater', label: 'Groundwater' },
  { id: 'monitoring', label: 'Monitoring' },
  { id: 'spatial', label: 'Spatial' },
  { id: 'operations', label: 'Operations' },
  { id: 'public-channels', label: 'Public channels' },
  { id: 'corporate', label: 'Corporate' },
];

export function swimlanePositions(systems: (CatalogRef & { w: number; h: number })[]) {
  const laneH = 150;
  const gap = 16;
  const left = 24;
  const positions: Record<string, { x: number; y: number }> = {};
  for (const [index, lane] of SWIMLANES.entries()) {
    const members = systems.filter(s => capabilityOf(s) === lane.id);
    let x = left;
    const y = 36 + index * laneH;
    for (const sys of members) {
      positions[sys.id] = { x, y };
      x += sys.w + gap;
    }
  }
  return positions;
}

export function deriveBoxStatus(
  catalog: CatalogRef,
  facts: AssessmentFacts,
  edges: LandscapeEdge[],
  asOf: Date = new Date(),
): BoxStatus {
  const registered = matchCatalogToRegistered(catalog, facts.systems);
  const inScope = !!registered;
  const context = !inScope && contextIds(
    facts.systems.flatMap(reg => matchCatalogToRegistered(catalog, [reg]) ? [catalog.id] : []),
    edges,
  ).has(catalog.id);

  const assessment = registered
    ? facts.assessments.filter(a => a.systemId === registered.id).sort((a, b) => statusRank(b.status) - statusRank(a.status))[0]
    : undefined;
  const findings = registered ? facts.findings.filter(f => f.systemId === registered.id) : [];
  const actions = registered ? facts.actions.filter(a => a.systemId === registered.id) : [];
  const evidence = registered ? facts.evidence.filter(e => e.systemId === registered.id) : [];
  const highCriticalFindings = findings.filter(f => f.severity === 'High' || f.severity === 'Critical').length;
  const informationGaps = findings.filter(f => f.type === 'InformationGap').length
    + (assessment?.responses.filter(r => r.status === 'Unknown' || r.status === 'Unconfirmed').length ?? 0);
  const percent = assessment ? coveragePercent(assessment.responses) : -1;
  const today = asOf.toISOString().slice(0, 10);
  const overdueActions = actions.filter(a => a.status !== 'Completed' && a.dueDate < today).length;
  const lastEvidence = [...evidence].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))[0];
  const bestConfidence = assessment?.responses.reduce((best, r) => rankConfidence(r.confidence) > rankConfidence(best) ? r.confidence : best, 'Unconfirmed') ?? 'Unconfirmed';
  const lastConfirmed = lastEvidence
    ? { at: lastEvidence.updatedAt ?? '', source: lastEvidence.source || lastEvidence.title, confidence: lastEvidence.validated ? 'ConfirmedByEvidence' : bestConfidence }
    : (rankConfidence(bestConfidence) >= rankConfidence('ConfirmedBySme')
      ? { at: '', source: 'SME', confidence: bestConfidence }
      : null);
  const unconfirmed = !lastConfirmed || lastConfirmed.confidence === 'Unconfirmed' || lastConfirmed.confidence === 'Inferred';

  return {
    catalogId: catalog.id,
    registeredId: registered?.id,
    inScope,
    context,
    lifecycle: lifecycleOf(registered, assessment),
    coverage: coverageBand(percent, highCriticalFindings),
    coveragePercent: Math.max(0, percent),
    highCriticalFindings,
    informationGaps,
    findingCount: findings.length,
    actionCount: actions.length,
    overdueActions,
    lastConfirmed,
    unconfirmed: inScope ? unconfirmed : true,
  };
}

export function pinSummary(st: Pick<BoxStatus, 'findingCount' | 'highCriticalFindings' | 'informationGaps' | 'overdueActions'>) {
  const parts: string[] = [];
  if (st.highCriticalFindings) parts.push(`${st.highCriticalFindings} high`);
  else if (st.findingCount) parts.push(`${st.findingCount} find`);
  if (st.informationGaps) parts.push(`${st.informationGaps} gap`);
  if (st.overdueActions) parts.push(`${st.overdueActions} overdue`);
  return parts.join(' · ');
}

export function deriveEstateStatus(
  catalog: CatalogRef[],
  facts: AssessmentFacts,
  edges: LandscapeEdge[],
  asOf: Date = new Date(),
) {
  const inScopeCatalogIds = catalog.filter(c => matchCatalogToRegistered(c, facts.systems)).map(c => c.id);
  const context = contextIds(inScopeCatalogIds, edges);
  return catalog.map(c => {
    const status = deriveBoxStatus(c, facts, edges, asOf);
    return { ...status, context: !status.inScope && context.has(c.id) };
  });
}

function statusRank(status: string) {
  switch (status.toLowerCase()) {
    case 'approved':
    case 'complete': return 4;
    case 'submitted': return 3;
    case 'inprogress':
    case 'in-progress':
    case 'returned': return 2;
    default: return 1;
  }
}

function rankConfidence(c: string) {
  switch (c) {
    case 'ConfirmedByEvidence': return 4;
    case 'ConfirmedBySme': return 3;
    case 'Inferred': return 2;
    default: return 1;
  }
}

export const landscapeClusters = [
  { id: 'groundwater', name: 'Groundwater', systemIds: ['gwdb', 'bls', 'ogia', 'wfieldapp', 'gw-online'] },
  { id: 'monitoring', name: 'Water monitoring', systemIds: ['hydstra', 'gauges', 'wasp', 'wmip', 'metering-internal', 'metering-external'] },
  { id: 'compliance', name: 'Compliance', systemIds: ['ciram', 'ccms', 'wicd', 'iauditor', 'cat6'] },
  { id: 'entitlements', name: 'Entitlements and titling', systemIds: ['werd', 'wms', 'ats', 'orc', 'wateriq'] },
  { id: 'public', name: 'Public channels', systemIds: ['business-qld', 'open-data', 'wmip', 'my-groundwater', 'qspatial'] },
];

export function reportRows(
  catalog: CatalogRef[],
  statuses: BoxStatus[],
  edges: LandscapeEdge[],
  findings: FindingFact[],
) {
  const byCat = new Map(statuses.map(s => [s.catalogId, s]));
  return catalog
    .filter(c => byCat.get(c.id)?.inScope)
    .map(c => {
      const st = byCat.get(c.id)!;
      const interfaces = edges.filter(e => e.from === c.id || e.to === c.id).map(e => `${e.from}→${e.to}${e.label ? ` (${e.label})` : ''}`);
      const systemFindings = st.registeredId ? findings.filter(f => f.systemId === st.registeredId) : [];
      return {
        acronym: c.acronym,
        name: c.name,
        lifecycle: st.lifecycle,
        coverage: st.coverage,
        coveragePercent: st.coveragePercent,
        interfaces,
        findings: systemFindings.map(f => `${f.severity} ${f.type}`),
      };
    });
}
