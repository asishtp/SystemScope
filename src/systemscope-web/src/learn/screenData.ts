import screens from './screens.json';

export type ScreenItem = string | { title?: string; detail?: string; example?: string; value?: string; code?: string; meaning?: string; material?: string; top?: string; bottom?: string; table?: string; key?: string; fields?: string[] };
export type ScreenSection = {
  number: number;
  title: string;
  type: string;
  text?: string;
  example?: string;
  info?: string;
  warning?: string;
  caption?: string;
  hub?: string;
  parent?: string | { title?: string; fields?: string[] };
  children?: string[];
  child?: { title?: string; fields?: string[] };
  items?: ScreenItem[];
  columns?: string[];
  rows?: string[][];
  labels?: Record<string, string> | string[];
  groups?: { title: string; items: string[] }[];
  rule?: string;
  intervals?: { material: string; top: string; bottom: string }[];
  pipe?: string;
  rn?: string;
  pipes?: { code: string; detail: string }[];
  parts?: { value: string; meaning: string }[];
  identifier?: string;
  fields?: string[];
  description?: string;
  pipeX?: string;
  examples?: string[];
  layers?: { table: string; detail: string; key: string }[];
  note?: string;
  tables?: { title: string; columns: string[]; rows: string[][] }[];
  relationship?: string;
};
export type ScreenLesson = {
  lessonKey: string;
  displayOrder: number;
  number: number;
  title: string;
  subtitle: string;
  durationMinutes: number;
  evidenceStatus: string;
  progressPercent: number;
  inThisLesson: string[];
  sections: ScreenSection[];
  keyTakeaways: string[];
  source: { title: string; pages?: string; detail?: string };
  previous: string;
  next: string;
  completionButton?: string;
  completionBanner?: string;
};

export const screenPackage = screens as unknown as {
  course: { title: string; description: string; lessonCount: number };
  common: { breadcrumb: string[]; searchPlaceholder: string; notesButton: string; completionButton: string };
  lessons: ScreenLesson[];
};

export const screenLessons = screenPackage.lessons;

export function screenByKey(key: string) {
  return screenLessons.find(l => l.lessonKey === key);
}

export function lessonDisplay(key: string, fallback?: string) {
  return screenByKey(key)?.title ?? fallback ?? key;
}

export function itemTitle(item: ScreenItem) {
  return typeof item === 'string' ? item : item.title || item.value || item.code || '';
}
export function itemDetail(item: ScreenItem) {
  return typeof item === 'string' ? '' : item.detail || item.example || item.meaning || '';
}
