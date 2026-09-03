export type SchemaColumn = {
  name: string;
  type: string;
  nullable: boolean;
  key: string;
  comment: string;
};

export type SchemaTable = {
  owner: string;
  name: string;
  tablespace: string;
  status: string;
  rows: number;
  lastAnalyzed: string;
  comment: string;
  columns: SchemaColumn[];
};

export type SchemaRelation = {
  from: string;
  to: string;
  name: string;
  column: string;
  targetColumn: string;
  status: string;
};

export type GwSchema = {
  schema: string;
  tables: SchemaTable[];
  relationships: SchemaRelation[];
  counts: {
    tables: number;
    columns: number;
    relationships: number;
    objects: number;
    dependencies: number;
  };
  reviewFlags: string[];
};

export type LearningOverlayTable = {
  tableKey: string;
  name: string;
  physicalName?: string | null;
  description?: string | null;
  domain?: string | null;
  grain?: string | null;
  candidateKey?: string[];
};

export const DOMAIN_ORDER = [
  'Bore Information',
  'Water Levels',
  'Water Quality',
  'Drilling',
  'Monitoring',
  'Reference Data',
] as const;

export type DomainName = (typeof DOMAIN_ORDER)[number];

export const DOMAIN_META: Record<DomainName, { key: string; description: string }> = {
  'Bore Information': {
    key: 'bore',
    description: 'Core entities describing bores, locations, identifiers and linked registry information.',
  },
  'Water Levels': {
    key: 'water',
    description: 'Standing water level, elevation and related time-series observations.',
  },
  'Water Quality': {
    key: 'quality',
    description: 'Sample, analysis and laboratory result tables for groundwater chemistry.',
  },
  Drilling: {
    key: 'drill',
    description: 'Construction, lithology, aquifer intervals and drill-log records.',
  },
  Monitoring: {
    key: 'monitor',
    description: 'Monitoring runs, field activities, projects and processing jobs.',
  },
  'Reference Data': {
    key: 'reference',
    description: 'Codes, offices, users and other lookup and reference tables.',
  },
};

const DOMAIN_TABLES: Record<string, DomainName> = {
  GW_WLELES: 'Water Levels',
  GW_WLVDETS: 'Water Levels',
  GW_WL_RNLS: 'Water Levels',
  GW_WLMRUNS: 'Water Levels',
  GW_MODEL_WLS: 'Water Levels',
  GW_FPREADS: 'Water Levels',
  GW_RAINFALLS: 'Water Levels',
  GW_RAINFALL_SITES: 'Water Levels',
  GW_PUMTES: 'Water Levels',
  GW_PUMP_TST_TYPS: 'Water Levels',
  GW_PTTMP1: 'Water Levels',
  GW_PTTMP2: 'Water Levels',
  GW_FLOW_IRREGS: 'Water Levels',
  GW_MULCNDS: 'Water Levels',
  GW_SAMPLES: 'Water Quality',
  GW_WATANLS: 'Water Quality',
  GW_WQVAR: 'Water Quality',
  GW_RESULTS: 'Water Quality',
  GW_PRECIPITATES: 'Water Quality',
  GW_WASPS: 'Water Quality',
  GW_BRCONDS: 'Water Quality',
  GW_CLDS: 'Water Quality',
  GW_CL_CLIENT_DATA: 'Water Quality',
  GW_WA_WATER_AUTHORISATION: 'Water Quality',
  GW_WA_AUTHORSATION_PURPOSE: 'Water Quality',
  GW_AQUIFRS: 'Drilling',
  GW_CASINGS: 'Drilling',
  GW_DRILLERS: 'Drilling',
  GW_DRILL_LOG_RECEIVALS: 'Drilling',
  GW_DRILL_NOTICES: 'Drilling',
  GW_DRILL_TRAIN_NOTES: 'Drilling',
  GW_LITHOLOGIES: 'Drilling',
  GW_OFF_DRILLS: 'Drilling',
  GW_STRLOGS: 'Drilling',
  GW_STRTIGS: 'Drilling',
  GW_WIRELOG_DATA: 'Drilling',
  GW_WIRELOG_HEAD: 'Drilling',
  GW_WIRLOGS: 'Drilling',
  GW_BORE_PROJECTS: 'Monitoring',
  GW_BORE_PROJ_MON: 'Monitoring',
  GW_MNTACTS: 'Monitoring',
  GW_MNTRUNS: 'Monitoring',
  GW_MNTVARS: 'Monitoring',
  GW_FIELDQS: 'Monitoring',
  GW_PROCESSING_JOBS: 'Monitoring',
  GW_PROCESSING_LOG: 'Monitoring',
  GW_RECORD_COUNTS: 'Monitoring',
  CG_REF_CODES: 'Reference Data',
  GW_CONV_FACTORS: 'Reference Data',
  GW_DISCLAIMERS: 'Reference Data',
  GW_EQUIP_SUB_TYPES: 'Reference Data',
  GW_FORM_DETAILS: 'Reference Data',
  GW_FORM_NAMES: 'Reference Data',
  GW_GWDB_USERS: 'Reference Data',
  GW_OFFICES: 'Reference Data',
  GW_OFF_USERS: 'Reference Data',
  GW_PARISHES: 'Reference Data',
  GW_QLD_HOLIDAYS: 'Reference Data',
  GW_REGIONS: 'Reference Data',
  GW_REGION_OFFICES: 'Reference Data',
  GW_SHIRES: 'Reference Data',
  GW_VALID_STATUS: 'Reference Data',
};

const LEARNING_PHYSICAL: Record<string, string> = {
  REGISTRATION: 'GW_REGDETS',
  CASING: 'GW_CASINGS',
  AQUIFER: 'GW_AQUIFRS',
  WATER_LEVEL: 'GW_WLELES',
  WATER_ANALYSIS: 'GW_WATANLS',
};

export function domainOf(tableName: string): DomainName {
  return DOMAIN_TABLES[tableName.toUpperCase()] ?? 'Bore Information';
}

const TABLE_PURPOSE: Record<string, string> = {
  CG_REF_CODES: 'Lookup codes and meanings used across GWDB forms and validation.',
  GW_AQUIFRS: 'Aquifer intervals recorded against a bore, including top, bottom, condition and yield.',
  GW_BORELOGGER_DATA: 'Down-hole logger measurements captured against a bore, pipe and date.',
  GW_BORE_IDENTIFIERS: 'External and organisational identifiers linked to a registered bore.',
  GW_BORE_LINES: 'Named bore-line groupings used for office and operational reporting.',
  GW_BORE_PROJECTS: 'Project assignments for a bore, including start and end dates.',
  GW_BORE_PROJ_MON: 'Monitoring schedule for a bore within a project, by pipe and monitoring type.',
  GW_BRCONDS: 'Bore condition observations such as drain, headworks and control details.',
  GW_CASINGS: 'Casing construction intervals: material, diameter and depth range.',
  GW_CLDS: 'Control-file load log for batch data imports.',
  GW_CL_CLIENT_DATA: 'Client name and mailing address details associated with a bore.',
  GW_CONV_FACTORS: 'Unit and ion conversion factors used in water-quality calculations.',
  GW_DISCLAIMERS: 'Disclaimer text displayed with GWDB outputs.',
  GW_DRILLERS: 'Licensed driller register, including licence status and contact details.',
  GW_DRILL_LOG_RECEIVALS: 'Receipt and processing of drill-log submissions.',
  GW_DRILL_NOTICES: 'Drill notices received for licensed drilling activity.',
  GW_DRILL_TRAIN_NOTES: 'Training notes linked to a drill log and licence.',
  GW_ELVDETS: 'Elevation and survey details for a measurement point on a bore pipe.',
  GW_EQUIP_SUB_TYPES: 'Equipment type and subtype reference list.',
  GW_FACILITY_ROLES: 'Roles assigned to a facility or bore, with comments.',
  GW_FIELDQS: 'Field water-quality readings such as conductivity, dissolved oxygen and sample method.',
  GW_FLOW_IRREGS: 'Recorded flow irregularities against a bore and date.',
  GW_FORM_DETAILS: 'Geological formation detail records.',
  GW_FORM_NAMES: 'Geological formation names, age range and data owner.',
  GW_FPREADS: 'Flow and pressure test readings for a pump or discharge test.',
  GW_GENERIC_TEMPORARY: 'Temporary working table used during data processing.',
  GW_GNOTES: 'General notes recorded against a bore, pipe and date.',
  GW_GWDB_USERS: 'GWDB application users, location and business group.',
  GW_IMAGES: 'Images of drill logs, photos and documents for a bore.',
  GW_IMAGES_ARCHIVED: 'Archived image file references for a bore.',
  GW_IMAGES_HER: 'Heritage image file references by year and type.',
  GW_LITHOLOGIES: 'Lithology codes recorded against a bore interval sequence.',
  GW_MAPS: 'Map sheet register with name, scale and geographic extent.',
  GW_MNTACTS: 'Monitoring actions and recorded values for a variable on a bore.',
  GW_MNTRUNS: 'Monitoring run header: who performed a visit and at what depth.',
  GW_MNTVARS: 'Monitoring variable catalogue: name, type and display order.',
  GW_MODEL_WLS: 'Modelled water-level values for a bore pipe and date.',
  GW_MULCNDS: 'Multiple conductivity (and temperature) readings by depth.',
  GW_OFFICES: 'District or regional office register.',
  GW_OFFICE_RNRS: 'Registered-number ranges issued by an office.',
  GW_OFF_DRILLS: 'Drillers associated with an office.',
  GW_OFF_PARS: 'Parishes associated with an office.',
  GW_OFF_RN_LISTS: 'Office working lists of registered numbers and pipes.',
  GW_OFF_SHIRES: 'Shires associated with an office.',
  GW_OFF_USERS: 'Users assigned to an office.',
  GW_PARISHES: 'Parish name reference list.',
  GW_PRECIPITATES: 'Precipitate observations recorded against a bore and date.',
  GW_PROCESSING_JOBS: 'Background processing jobs, type and completion status.',
  GW_PROCESSING_LOG: 'Detailed log messages produced by processing jobs.',
  GW_PTTMP1: 'Temporary pump-test working data (set 1).',
  GW_PTTMP2: 'Temporary pump-test working data (set 2).',
  GW_PUMP_TST_TYPS: 'Pump-test types ordered against a bore, pipe and date.',
  GW_PUMTES: 'Pump-test results including zones, discharge and drawdown measures.',
  GW_QLD_HOLIDAYS: 'Queensland public holiday calendar used by GWDB processes.',
  GW_RAINFALLS: 'Rainfall observations recorded against a rainfall site.',
  GW_RAINFALL_SITES: 'Rainfall site locations, names and operating period.',
  GW_RECORD_COUNTS: 'Office snapshot counts of major GWDB record types.',
  GW_REGDETS: 'Bore registration details: the facility master record for a registered number.',
  GW_REGIONS: 'Region register with operating period.',
  GW_REGION_OFFICES: 'Offices belonging to a region over time.',
  GW_REPORT_RN_LISTS: 'Registered numbers included in a report request.',
  GW_RESULTS: 'Laboratory or variable-based water-quality results for a sample bottle.',
  GW_SAMPLES: 'Water sample header: collection date, project, source and bottle.',
  GW_SHIRES: 'Local government shire reference list.',
  GW_STRLOGS: 'Strata log descriptions with top and bottom depths.',
  GW_STRTIGS: 'Stratigraphic interval interpretations by formation.',
  GW_USER_RN_LISTS: 'Personal user lists of registered numbers.',
  GW_VALID_STATUS: 'Validation status dates for major record groups on a bore.',
  GW_WASPS: 'Land parcel and WASP identifiers linked to a bore.',
  GW_WATANLS: 'Standard water analysis records (chemistry suite against a sample).',
  GW_WA_AUTHORSATION_PURPOSE: 'Authorised water-use purposes for a bore.',
  GW_WA_WATER_AUTHORISATION: 'Water authorisation / licence details for a bore.',
  GW_WIRELOG_DATA: 'Wireline log measurements by depth, log type and run.',
  GW_WIRELOG_HEAD: 'Wireline log run header: operator, start and stop depths.',
  GW_WIRLOGS: 'Wireline log summary intervals and data owner.',
  GW_WK_WATER_USE_VOLUMES: 'Recorded water-use volumes (ML) against a bore over time.',
  GW_WLELES: 'Water-level elevation observations for a bore pipe and date.',
  GW_WLMRUNS: 'Water-level monitoring run codes for a bore pipe.',
  GW_WLVDETS: 'Detailed water-level measurements and measurement point.',
  GW_WL_RNLS: 'First and last water-level observation dates for a bore pipe.',
  GW_WQVAR: 'Water-quality variable catalogue: name, units and limits.',
};

export function tablePurpose(table: SchemaTable): { text: string; source: 'comment' | 'inferred' } {
  const comment = table.comment?.trim();
  if (comment) return { text: comment, source: 'comment' };
  const inferred = TABLE_PURPOSE[table.name.toUpperCase()];
  if (inferred) return { text: inferred, source: 'inferred' };
  return { text: `${domainOf(table.name)} table in the imported GW schema.`, source: 'inferred' };
}

export function hasPrimaryKey(table: SchemaTable): boolean {
  return table.columns.some(c => (c.key || '').toUpperCase().includes('PK'));
}

export function isTemporaryOrArchive(name: string): boolean {
  return /TEMP|TMP|ARCHIV|GENERIC_TEMPORARY/i.test(name);
}

export function isInvalidObject(table: SchemaTable): boolean {
  const status = (table.status || '').toUpperCase();
  return status !== '' && status !== 'VALID';
}

export function formatCompactNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(value);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatExtractedOn(tables: SchemaTable[]): string {
  const serials = tables
    .map(t => Number(t.lastAnalyzed))
    .filter(n => Number.isFinite(n) && n > 0);
  if (!serials.length) return '';
  const date = excelSerialToDate(Math.max(...serials));
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export function excelSerialToDate(serial: number): Date {
  return new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
}

export type KnowledgeRow = { label: string; pct: number };

export type GapRow = { text: string; count: number };

export type LandscapeModel = {
  schemaName: string;
  environment: string;
  lastExtracted: string;
  tableCount: number;
  columnCount: number;
  relationshipCount: number;
  objectCount: number;
  dependencyCount: number;
  investigationGapCount: number;
  domains: { name: DomainName; key: string; count: number; description: string }[];
  importantTables: { name: string; relationships: number }[];
  recordVolumes: { name: string; rows: number }[];
  connectedTables: number;
  isolatedTables: number;
  confirmedRelationships: number;
  inferredRelationships: number;
  invalidObjects: number;
  staleStatistics: number;
  knowledge: KnowledgeRow[];
  documentedPct: number;
  gaps: GapRow[];
  gapTables: {
    missingDescriptions: string[];
    withoutPk: string[];
    isolated: string[];
    tempArchive: string[];
    invalid: string[];
    stale: string[];
  };
  relationshipHealth: { healthy: number; inferred: number; issues: number };
  tables: SchemaTable[];
  relationships: SchemaRelation[];
};

export type DomainDrawer = {
  name: DomainName;
  description: string;
  tables: number;
  columns: number;
  confirmedRelationships: number;
  inferredRelationships: number;
  missingDescriptions: number;
};

function overlayDescriptions(tables: SchemaTable[], learning?: LearningOverlayTable[]) {
  if (!learning?.length) return tables;
  const byPhysical = new Map<string, LearningOverlayTable>();
  for (const row of learning) {
    const physical = (row.physicalName || LEARNING_PHYSICAL[row.tableKey] || '').toUpperCase();
    if (physical) byPhysical.set(physical, row);
  }
  return tables.map(table => {
    const overlay = byPhysical.get(table.name.toUpperCase());
    if (!overlay) return table;
    const description = table.comment?.trim() || overlay.description?.trim() || overlay.grain?.trim() || '';
    return description === table.comment ? table : { ...table, comment: description };
  });
}

export function buildLandscape(schema: GwSchema, learning?: LearningOverlayTable[]): LandscapeModel {
  const tables = overlayDescriptions(schema.tables, learning);
  const rels = schema.relationships;
  const names = new Set(tables.map(t => t.name));
  const connected = new Set<string>();
  for (const rel of rels) {
    if (names.has(rel.from)) connected.add(rel.from);
    if (names.has(rel.to)) connected.add(rel.to);
  }

  const degree = new Map<string, number>();
  for (const rel of rels) {
    degree.set(rel.from, (degree.get(rel.from) || 0) + 1);
    degree.set(rel.to, (degree.get(rel.to) || 0) + 1);
  }

  const confirmed = rels.filter(r => r.status === 'confirmed').length;
  const inferred = rels.filter(r => r.status === 'inferred').length;
  const isolated = tables.filter(t => !connected.has(t.name)).length;
  const missingDescriptions = tables.filter(t => !t.comment?.trim()).length;
  const withoutPk = tables.filter(t => !hasPrimaryKey(t)).length;
  const tempArchive = tables.filter(t => isTemporaryOrArchive(t.name)).length;
  const invalid = tables.filter(isInvalidObject).length;
  const stale = tables.filter(t => !t.rows || !t.lastAnalyzed).length;
  const columnCount = schema.counts.columns || tables.reduce((n, t) => n + t.columns.length, 0);
  const withPk = tables.length - withoutPk;

  const domainCounts = new Map<DomainName, number>(DOMAIN_ORDER.map(name => [name, 0]));
  for (const table of tables) {
    const domain = domainOf(table.name);
    domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
  }

  const tablesColumnsPct = tables.length ? 100 : 0;
  const keysPct = tables.length + rels.length
    ? Math.round(((withPk + confirmed) * 100) / (tables.length + rels.length))
    : 0;
  const logicPct = schema.counts.objects > 0 ? 40 : 0;
  const usagePct = 0;
  const integrationsPct = 0;
  const ownershipPct = 0;
  const knowledge: KnowledgeRow[] = [
    { label: 'Tables & columns', pct: tablesColumnsPct },
    { label: 'Keys & relationships', pct: keysPct },
    { label: 'Database logic', pct: logicPct },
    { label: 'Application usage', pct: usagePct },
    { label: 'Integrations', pct: integrationsPct },
    { label: 'Business ownership', pct: ownershipPct },
  ];
  const documentedPct = Math.round(knowledge.reduce((n, row) => n + row.pct, 0) / knowledge.length);

  const gaps: GapRow[] = [
    { text: `${missingDescriptions} tables missing descriptions`, count: missingDescriptions },
    { text: `${withoutPk} tables without primary keys`, count: withoutPk },
    { text: `${isolated} isolated tables`, count: isolated },
    { text: `${tempArchive} temporary or archive candidates`, count: tempArchive },
    { text: 'Application usage not mapped', count: usagePct === 0 ? 1 : 0 },
  ].filter(g => g.count > 0);

  const investigationGapCount = missingDescriptions + withoutPk + isolated + tempArchive + (usagePct === 0 ? 1 : 0);

  return {
    schemaName: schema.schema || 'GW',
    environment: 'TEST',
    lastExtracted: formatExtractedOn(tables),
    tableCount: schema.counts.tables || tables.length,
    columnCount,
    relationshipCount: schema.counts.relationships || rels.length,
    objectCount: schema.counts.objects,
    dependencyCount: schema.counts.dependencies,
    investigationGapCount,
    domains: DOMAIN_ORDER.map(name => ({
      name,
      key: DOMAIN_META[name].key,
      count: domainCounts.get(name) || 0,
      description: DOMAIN_META[name].description,
    })),
    importantTables: tables
      .map(t => ({ name: t.name, relationships: degree.get(t.name) || 0 }))
      .sort((a, b) => b.relationships - a.relationships || a.name.localeCompare(b.name))
      .slice(0, 4),
    recordVolumes: [...tables]
      .sort((a, b) => b.rows - a.rows || a.name.localeCompare(b.name))
      .slice(0, 5)
      .map(t => ({ name: t.name, rows: t.rows })),
    connectedTables: connected.size,
    isolatedTables: isolated,
    confirmedRelationships: confirmed,
    inferredRelationships: inferred,
    invalidObjects: invalid,
    staleStatistics: stale,
    knowledge,
    documentedPct,
    gaps,
    gapTables: {
      missingDescriptions: tables.filter(t => !t.comment?.trim()).map(t => t.name),
      withoutPk: tables.filter(t => !hasPrimaryKey(t)).map(t => t.name),
      isolated: tables.filter(t => !connected.has(t.name)).map(t => t.name),
      tempArchive: tables.filter(t => isTemporaryOrArchive(t.name)).map(t => t.name),
      invalid: tables.filter(isInvalidObject).map(t => t.name),
      stale: tables.filter(t => !t.rows || !t.lastAnalyzed).map(t => t.name),
    },
    relationshipHealth: {
      healthy: confirmed,
      inferred,
      issues: isolated + invalid,
    },
    tables,
    relationships: rels,
  };
}

export function tablesForDomain(model: LandscapeModel, domain: DomainName) {
  return model.tables
    .filter(t => domainOf(t.name) === domain)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function domainDrawer(model: LandscapeModel, domain: DomainName): DomainDrawer {
  const tables = model.tables.filter(t => domainOf(t.name) === domain);
  const ids = new Set(tables.map(t => t.name));
  const rels = model.relationships.filter(r => ids.has(r.from) || ids.has(r.to));
  return {
    name: domain,
    description: DOMAIN_META[domain].description,
    tables: tables.length,
    columns: tables.reduce((n, t) => n + t.columns.length, 0),
    confirmedRelationships: rels.filter(r => r.status === 'confirmed').length,
    inferredRelationships: rels.filter(r => r.status === 'inferred').length,
    missingDescriptions: tables.filter(t => !t.comment?.trim()).length,
  };
}

export function knowledgeBarTone(pct: number): 'ok' | 'mid' | 'low' {
  if (pct >= 80) return 'ok';
  if (pct >= 40) return 'mid';
  return 'low';
}
