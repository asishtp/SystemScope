export type ScanDomain = {
  id: string;
  kind: string;
  title: string;
  weight: number;
  requirement: string;
  summary: string;
  completeness: number;
  evidenceCount: number;
  gapCount: number;
};

export type ScanFact = {
  id: string;
  domain: string;
  attribute: string;
  value: string;
  validation: string;
  claimType: string;
  confidence: string;
  evidenceExcerpt: string;
  sourceLocation: string;
  state: string;
  visibility: string;
};

export type ScanGap = {
  id: string;
  domain: string;
  missingInformation: string;
  reasonRequired: string;
  priority: string;
  marketScanImpact: string;
  assignedOwner: string;
  status: string;
  dueDate?: string;
  resolution: string;
};

export type ScanClaim = {
  id: string;
  domain: string;
  statement: string;
  speaker?: string;
  evidenceExcerpt: string;
  sourceLocation: string;
  confidence: string;
  claimType: string;
  validation: string;
  reviewComment: string;
  analystDecision?: string;
  visibilityLabel?: string;
  reviewerAssigned?: string;
  state?: string;
};

export type ScanEvidence = {
  id: string;
  title: string;
  url: string;
  source: string;
  sourceType: string;
  completeness: string;
  validated: boolean;
  updatedAt: string;
};

export type ScanFinding = {
  id: string;
  title: string;
  type: string;
  severity: string;
  description: string;
  owner: string;
  reviewState: string;
  validation?: string;
  includeInDocument?: boolean;
};

export type ScanWorkspace = {
  system: {
    id: string;
    projectId: string;
    catalogKey: string;
    name: string;
    acronym: string;
    description: string;
    businessPurpose: string;
    businessOwner: string;
    technicalOwner: string;
    supportTeam: string;
    vendor: string;
    product: string;
    lifecycle: string;
    criticality: string;
    dataClassification: string;
    tags: string;
  };
  project?: { id: string; name: string; owner: string; status: string; targetDate: string };
  scan: {
    id: string;
    status: string;
    includeInRfi: boolean;
    includeInDocument: boolean;
    assessmentLead: string;
    assessor: string;
    informationCompleteness: number;
    validationCompleteness: number;
    documentReadiness: number;
    updatedAt: string;
  };
  domains: ScanDomain[];
  facts: ScanFact[];
  gaps: ScanGap[];
  claims: ScanClaim[];
  evidence: ScanEvidence[];
  findings: ScanFinding[];
  actions: { id: string; title: string; owner: string; dueDate: string; status: string }[];
  components: Record<string, unknown>[];
  databases: Record<string, unknown>[];
  infrastructure: Record<string, unknown>[];
  integrations: {
    id: string;
    name: string;
    sourceSystem: string;
    target: string;
    method: string;
    state: string;
    validation: string;
    businessPurpose: string;
    owner: string;
    frequency?: string;
  }[];
  flows: Record<string, unknown>[];
  batches: Record<string, unknown>[];
  dataDomains: Record<string, unknown>[];
  security: Record<string, unknown>[];
  documents: { id: string; title: string; audience: string; status: string; createdAt: string; fileName: string; warnings: string }[];
  requiredAttributes: Record<string, string[]>;
};

export type AssessmentRow = {
  id: string;
  projectId: string;
  projectName?: string;
  assessedSystemId: string;
  catalogKey?: string;
  systemName?: string;
  acronym?: string;
  businessOwner?: string;
  technicalOwner?: string;
  assessmentLead?: string;
  status: string;
  includeInRfi: boolean;
  informationCompleteness: number;
  validationCompleteness: number;
  documentReadiness: number;
  openGaps: number;
  lastUpdated: string;
};

export type MasterRow = {
  id: string;
  name: string;
  acronym: string;
  catalogKey: string;
  description: string;
  businessOwner: string;
  technicalOwner: string;
  criticality: string;
  lifecycle: string;
  vendor: string;
  product: string;
  tags: string;
  informationCompleteness: number;
  validationCompleteness: number;
  documentReadiness: number;
  projects: { id: string; projectId: string; catalogKey: string }[];
};

export type SearchHit = {
  id: string;
  projectId: string;
  type: string;
  title: string;
  detail: string;
  system: string;
  status: string;
  evidence: string;
};

export const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'database', label: 'Database' },
  { id: 'infrastructure', label: 'Infrastructure' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'data', label: 'Data and quality' },
  { id: 'security', label: 'Security' },
  { id: 'evidence-new', label: 'Add evidence' },
  { id: 'claims-review', label: 'Claims review' },
  { id: 'findings', label: 'Findings and risks' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'validation', label: 'Validation' },
  { id: 'diagrams', label: 'Diagrams' },
  { id: 'preview', label: 'Document preview' },
] as const;

export type TabId = (typeof TABS)[number]['id'];

export const DOMAIN_TAB: Record<string, TabId> = {
  Architecture: 'architecture',
  Database: 'database',
  Infrastructure: 'infrastructure',
  Integrations: 'integrations',
  DataQuality: 'data',
  Security: 'security',
};

export const DOMAIN_ICON: Record<string, string> = {
  Architecture: '⧉',
  Database: '⛁',
  Infrastructure: '☁',
  Integrations: '⇄',
  DataQuality: '▦',
  Security: '🛡',
};

export function openGap(status: string) {
  return status === 'Open' || status === 'Assigned' || status === 'AwaitingResponse';
}

export function formatDate(value?: string) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatStamp(value?: string) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Australia/Brisbane' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Australia/Brisbane' });
  return `${date} · ${time} AEST`;
}

export function readinessLabel(score: number) {
  return score >= 80 ? 'Ready' : 'Not ready';
}

export function pillClass(status: string) {
  const s = status.toLowerCase();
  if (s.includes('progress') || s.includes('incomplete') || s.includes('requested')) return 'pill amber';
  if (s.includes('rfi') || s.includes('approved') || s.includes('validated')) return 'pill blue';
  if (s.includes('deferred') || s.includes('unknown') || s.includes('not assessed')) return 'pill mute';
  if (s.includes('gap') || s.includes('awaiting') || s.includes('unconfirmed') || s.includes('to confirm')) return 'pill amber';
  if (s.includes('unvalidated') || s.includes('rejected')) return 'pill red';
  if (s.includes('infer') || s.includes('proposed') || s.includes('future')) return 'pill blue';
  if (s.includes('confirm')) return 'pill';
  return 'pill';
}
