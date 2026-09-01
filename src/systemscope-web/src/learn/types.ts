export type EvidenceStatus = {
  key: string;
  name: string;
  description: string;
  colour: string;
};

export type LessonCard = {
  lessonId: string;
  lessonKey: string;
  title: string;
  summary?: string;
  durationMinutes?: number;
  displayOrder: number;
  evidenceStatus?: string;
  status: string;
  progressPercentage: number;
};

export type DataTable = {
  id: string;
  tableKey: string;
  name: string;
  physicalName?: string | null;
  description?: string | null;
  domain?: string | null;
  grain?: string | null;
  candidateKey: string[];
  evidenceStatus: string;
};

export type Relationship = {
  id: string;
  relationshipKey: string;
  fromTableKey?: string;
  fromTableName?: string;
  toTableKey?: string;
  toTableName?: string;
  fields: { from: string; to: string }[];
  cardinality: string;
  evidenceStatus: string;
};

export type LearningDashboard = {
  system: { id: string; name: string; catalogKey: string; acronym: string; projectName: string };
  course: { courseId: string; title: string; description?: string; lessonCount: number; estimatedMinutes: number };
  progress: { completedLessons: number; totalLessons: number; percentage: number };
  continueLesson: LessonCard | null;
  lessons: LessonCard[];
  dataModel: { tables: DataTable[]; relationships: Relationship[] };
  quickAccess: { bookmarks: number; notes: number };
  evidenceStatuses: EvidenceStatus[];
};

export type LessonDetail = {
  id: string;
  lessonKey: string;
  title: string;
  summary?: string;
  contentMarkdown: string;
  objectives: string[];
  keyTakeaways?: string[];
  verificationChecks?: string[];
  durationMinutes?: number;
  displayOrder: number;
  status: string;
  evidenceStatus?: string;
  progress: { status: string; progressPercentage: number; lastPosition?: string | null };
  sources: { id: string; documentKey?: string; title?: string; fileName?: string; version?: string; pageFrom?: number; pageTo?: number; sectionName?: string; evidenceStatus: string }[];
  questions: { id: string; questionKey: string; questionText: string; explanation?: string; displayOrder: number; options: { id: string; optionKey: string; optionText: string; displayOrder: number }[] }[];
  navigation: { previous: { id: string; lessonKey: string; title: string } | null; next: { id: string; lessonKey: string; title: string } | null };
  bookmarked: boolean;
  bookmarkId?: string;
  notes: { id: string; noteText: string; createdAt: string; updatedAt: string }[];
};

export type GlossaryTerm = {
  id: string;
  termKey: string;
  term: string;
  shortDefinition: string;
  detailedDefinition?: string | null;
  evidenceStatus: string;
  source?: { documentKey: string; title: string; page?: number } | null;
};

export type SearchHit = {
  type: string;
  id: string;
  key: string;
  title: string;
  detail?: string;
  evidenceStatus?: string;
};

export type LearnPage = 'dashboard' | 'lessons' | 'glossary' | 'bookmarks' | 'notes' | 'data-model' | 'tables' | 'import';

export function progressLabel(status: string) {
  if (status === 'Completed') return 'Completed';
  if (status === 'InProgress') return 'In progress';
  return 'Not started';
}

export function evidenceName(key?: string) {
  if (key === 'INFERRED') return 'Inferred';
  if (key === 'SCHEMA_VERIFIED') return 'Schema verified';
  return 'Documented';
}
