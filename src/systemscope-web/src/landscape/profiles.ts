export type HostingModel = 'on-prem' | 'azure' | 'saas' | 'external' | 'field';

export type SystemProfile = {
  businessOwner: string;
  technicalOwner: string;
  support: string;
  ui: string;
  api: string;
  database: string;
  hosting: HostingModel;
  environment: string;
  os: string;
  identity: string;
  repo: string;
  deploy: string;
  dataEntities: string[];
  classification: string;
};

export type LinkProfile = {
  data: string;
  method: string;
  frequency: string;
  volume: string;
  auth: string;
  encryption: string;
  dataOwner: string;
  opsOwner: string;
  monitoring: string;
  errors: string;
};

const base: SystemProfile = {
  businessOwner: 'Water resource operations',
  technicalOwner: 'Digital and ICT',
  support: 'Internal ICT / vendor',
  ui: 'Web',
  api: 'HTTPS API',
  database: 'SQL Server',
  hosting: 'on-prem',
  environment: 'Production',
  os: 'Windows Server',
  identity: 'Active Directory',
  repo: 'Not recorded',
  deploy: 'Release pipeline / change record',
  dataEntities: ['Operational records'],
  classification: 'OFFICIAL',
};

const overrides: Partial<Record<string, Partial<SystemProfile>>> = {
  werd: { ui: 'Legacy client', database: 'Oracle', dataEntities: ['Water entitlements'] },
  library: { hosting: 'on-prem', ui: 'Library catalogue', identity: 'Active Directory', dataEntities: ['Catalogue records'] },
  iauditor: { hosting: 'saas', ui: 'Mobile / SaaS', identity: 'Vendor identity', dataEntities: ['Meter readings'], database: 'Vendor SaaS' },
  swan: { ui: 'Excel', hosting: 'on-prem', database: 'Spreadsheet', dataEntities: ['Seasonal allocation notices'] },
  'regional-dashboards': { ui: 'Power BI / Excel', hosting: 'azure', database: 'Power BI dataset', dataEntities: ['Regional KPIs'] },
  rdr: { dataEntities: ['Regulated dams'] },
  wicd: { dataEntities: ['Compliance cases'] },
  wr: { dataEntities: ['Catchment register'] },
  sap: { ui: 'SAP GUI / Fiori', hosting: 'on-prem', database: 'SAP HANA / Oracle', identity: 'SAP / AD', dataEntities: ['Payments', 'Finance'] },
  edocs: { ui: 'Records client', dataEntities: ['Corporate records'] },
  elvis: { hosting: 'external', ui: 'Web GIS', identity: 'External IdP', dataEntities: ['Elevation'] },
  planet: { hosting: 'saas', ui: 'Vendor portal', identity: 'Vendor identity', dataEntities: ['Satellite imagery'] },
  bom: { hosting: 'external', ui: 'BOM services', identity: 'Agency federation', dataEntities: ['National water account'] },
  'qspatial-live': { ui: 'Map viewer', hosting: 'azure', identity: 'Qld IdP', dataEntities: ['Live spatial layers'] },
  survey123: { hosting: 'saas', ui: 'Field app', identity: 'ArcGIS Online', dataEntities: ['Field meter captures'] },
  gauges: { hosting: 'field', ui: 'Telemetry', os: 'Embedded / RTU', identity: 'Device certs', dataEntities: ['Time-series water', 'Rainfall'] },
  mms: { ui: 'Oracle Forms', database: 'Oracle 19c', dataEntities: ['Water accounts', 'GWMA balances'] },
  cat6: { ui: 'Reporting pack', dataEntities: ['CAT6 returns'] },
  ogia: { hosting: 'azure', ui: 'Web / Azure storage', dataEntities: ['Bore / drilling records'] },
  sir: { ui: 'GIS desktop / portal', database: 'Enterprise geodatabase', dataEntities: ['DCDB', 'Spatial layers'] },
  sali: { ui: 'Desktop / web', dataEntities: ['Soil and land'] },
  'lims-des': { ui: 'LIMS client', dataEntities: ['Lab samples'] },
  ciram: { ui: 'Web', dataEntities: ['Compliance register'] },
  ccms: { hosting: 'azure', ui: 'Azure web app', database: 'Azure SQL / storage', dataEntities: ['Compliance cases'] },
  bls: { dataEntities: ['Bore locations'] },
  spin: { ui: 'Spatial query tool', dataEntities: ['Spatial queries'] },
  aqeis: { dataEntities: ['Aquatic ecosystem'] },
  'lims-qh': { hosting: 'external', identity: 'QH IdP', dataEntities: ['Health lab samples'] },
  wateriq: { ui: 'Angular', api: 'Azure App Service', hosting: 'azure', database: 'Azure SQL', identity: 'myID / ABR', deploy: 'Azure DevOps', dataEntities: ['Devices', 'Jobs', 'Allocations'] },
  aquis: { ui: 'Oracle Forms', database: 'Oracle Database (inferred)', identity: 'To be confirmed', dataEntities: ['Operational water monitoring records'] },
  gwdb: { ui: 'Oracle Forms / GWPlot', database: 'Oracle 19c', dataEntities: ['Bores', 'Water levels', 'Drill logs'] },
  wfieldapp: { hosting: 'field', ui: 'Mobile', identity: 'App auth', dataEntities: ['GW sample metadata'] },
  wasp: { dataEntities: ['Water analysis samples'] },
  'wateriq-portal': { ui: 'Angular', hosting: 'azure', identity: 'myID', dataEntities: ['Customer accounts', 'Meter reads'] },
  mid: { hosting: 'external', ui: 'myID', identity: 'Australian Government Digital Identity', dataEntities: ['Identity assertions'] },
  abr: { hosting: 'external', ui: 'ABR services', identity: 'ABN lookup', dataEntities: ['ABN'] },
  wms: { ui: 'Oracle Forms', api: 'Batch / realtime API', database: 'Oracle 19c', identity: 'Active Directory', dataEntities: ['Titles', 'Billing', 'Entitlements'] },
  'des-azure': { hosting: 'azure', ui: 'Storage', database: 'Azure Blob', dataEntities: ['Sample files'] },
  silo: { hosting: 'external', dataEntities: ['Climate / site'] },
  hcs: { dataEntities: ['Flood desk feeds'] },
  orc: { ui: 'Web', dataEntities: ['Land parcels'] },
  'gw-online': { ui: 'Web holding area', dataEntities: ['Bore water levels'] },
  hydstra: { ui: 'Hydstra / Hydrotel', database: 'SQL Server', dataEntities: ['Time-series', 'Gauge reads'] },
  bpoint: { hosting: 'saas', ui: 'Payment gateway', identity: 'CommBank', dataEntities: ['QWN payments'] },
  ats: { hosting: 'external', ui: 'Titles Queensland', identity: 'TQ federation', dataEntities: ['Titles', 'Billing extracts'] },
  'metering-internal': { ui: 'Portal + API', dataEntities: ['Meter telemetry'] },
  'metering-external': { hosting: 'external', ui: 'Provider API', identity: 'Vendor API key', dataEntities: ['Meter telemetry'] },
  'business-qld': { hosting: 'azure', ui: 'Public web', identity: 'Public / QGov', dataEntities: ['Entitlements', 'Trades'] },
  qspatial: { hosting: 'azure', ui: 'Spatial catalogue', dataEntities: ['WRM features'] },
  'open-data': { hosting: 'azure', ui: 'Open data portal', identity: 'Public', dataEntities: ['Published extracts'] },
  'my-groundwater': { hosting: 'azure', ui: 'Public web', identity: 'Public account', dataEntities: ['Submitted bore levels'] },
  geores: { ui: 'Globe', dataEntities: ['Mining spatial'] },
  'qd-globe': { ui: 'Queensland Globe', dataEntities: ['Public spatial'] },
  wmip: { hosting: 'azure', ui: 'Web portal + API', identity: 'Public / API key', dataEntities: ['River height', 'GW telemetry', 'Water quality'] },
};

export function profileOf(id: string): SystemProfile {
  return { ...base, ...overrides[id] };
}

const linkOverrides: Record<string, Partial<LinkProfile>> = {
  'wms|ats': { data: 'Title enquiries / 6 batch files / realtime API', method: 'Batch + API', frequency: 'Nightly + realtime', volume: 'Title and billing extracts', auth: 'System account', encryption: 'TLS', dataOwner: 'Water management', opsOwner: 'WMS support', monitoring: 'Job completion', errors: 'Rerun batch' },
  'ats|wms': { data: 'Billing CSV', method: 'File drop', frequency: 'Nightly', volume: 'Billing extracts', auth: 'File share ACL', encryption: 'In transit', dataOwner: 'Titles Queensland', opsOwner: 'WMS support', monitoring: 'File arrival', errors: 'Manual replay' },
  'wms|hydstra': { data: 'Feeds and reports', method: 'File / API', frequency: 'Scheduled', volume: 'Operational extracts', auth: 'System account', encryption: 'TLS', dataOwner: 'Water management', opsOwner: 'Monitoring team', monitoring: 'Job status', errors: 'Retry' },
  'hydstra|wmip': { data: 'River height, stream flow, water quality', method: 'Web + API', frequency: 'Near real-time', volume: 'Time-series', auth: 'API key', encryption: 'TLS', dataOwner: 'DLGW', opsOwner: 'WMIP support', monitoring: 'Portal health', errors: 'Cache last good' },
  'wateriq|ats': { data: '10-second / nightly ATS files', method: 'Replication + file', frequency: 'Continuous / nightly', volume: 'Measurement and title files', auth: 'Azure identity', encryption: 'TLS', dataOwner: 'WaterIQ', opsOwner: 'WaterIQ support', monitoring: 'Replication lag', errors: 'Replay file' },
  'iauditor|ciram': { data: 'Meter readings', method: 'Bulk upload', frequency: 'After field capture', volume: 'Reading batches', auth: 'SaaS login', encryption: 'TLS', dataOwner: 'Regional operations', opsOwner: 'CIRaM support', monitoring: 'Upload log', errors: 'Re-upload' },
  'wfieldapp|gwdb': { data: 'Groundwater sample metadata', method: 'Mobile sync', frequency: 'On submit', volume: 'Sample records', auth: 'App token', encryption: 'TLS', dataOwner: 'Groundwater', opsOwner: 'GWDB support', monitoring: 'Sync queue', errors: 'Resubmit' },
  'gauges|hydstra': { data: 'Telemetry time-series', method: 'Hydrotel', frequency: 'Continuous', volume: 'Gauge and rainfall series', auth: 'Device cert', encryption: 'In transit', dataOwner: 'Monitoring', opsOwner: 'Hydstra support', monitoring: 'Telemetry health', errors: 'Store and forward' },
};

const linkBase: LinkProfile = {
  data: 'Operational data exchange',
  method: 'API / file',
  frequency: 'Scheduled or on demand',
  volume: 'Not recorded',
  auth: 'System or user account',
  encryption: 'TLS where available',
  dataOwner: 'Source system owner',
  opsOwner: 'Destination support',
  monitoring: 'Not recorded',
  errors: 'Manual follow-up',
};

export function linkProfileOf(from: string, to: string, label?: string): LinkProfile {
  const hit = linkOverrides[`${from}|${to}`];
  if (hit) return { ...linkBase, ...hit, data: label ? `${hit.data} (${label})` : hit.data! };
  return { ...linkBase, data: label || linkBase.data, method: label || linkBase.method };
}

export const HOSTING_LANES: { id: HostingModel; label: string }[] = [
  { id: 'on-prem', label: 'On-premises' },
  { id: 'azure', label: 'Azure / Qld cloud' },
  { id: 'saas', label: 'SaaS' },
  { id: 'field', label: 'Field / telemetry' },
  { id: 'external', label: 'External agency / vendor' },
];

export function hsiPositions(systems: { id: string; w: number; h: number }[]) {
  const laneH = 180;
  const gap = 16;
  const positions: Record<string, { x: number; y: number }> = {};
  for (const [index, lane] of HOSTING_LANES.entries()) {
    let x = 24;
    const y = 36 + index * laneH;
    for (const sys of systems.filter(s => profileOf(s.id).hosting === lane.id)) {
      positions[sys.id] = { x, y };
      x += sys.w + gap;
    }
  }
  return positions;
}
