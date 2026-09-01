import { useEffect, useState } from 'react';
import { api } from '../landscape/api';
import { LessonBody } from './LessonBodies';
import { screenByKey } from './screenData';
import { type LessonDetail } from './types';
import './lesson-visuals.css';

export function LessonReader({
  catalogKey,
  lessonKey,
  totalLessons,
  onOpenLesson,
  onBack,
  onOpenSource,
}: {
  catalogKey: string;
  lessonKey: string;
  totalLessons?: number;
  onOpenLesson: (key: string) => void;
  onBack: () => void;
  onOpenSource: () => void;
}) {
  const [lesson, setLesson] = useState<LessonDetail>();
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [active, setActive] = useState(1);
  const screen = screenByKey(lessonKey);

  const load = () => api<LessonDetail>(`/learning/lessons/${encodeURIComponent(lessonKey)}`)
    .then(setLesson)
    .catch(e => setError(e.message));

  useEffect(() => { setError(''); setLesson(undefined); setShowNotes(false); setActive(1); load(); }, [lessonKey]);

  if (error) return <div className="learn-empty"><p>{error}</p><button className="learn-secondary" onClick={onBack}>Back to path</button></div>;
  if (!lesson || !screen) return <div className="learn-empty">{lesson ? 'Lesson screen data not found.' : 'Loading lesson…'}</div>;

  const total = totalLessons || 12;
  const pct = lesson.progress.status === 'Completed' ? 100 : screen.progressPercent;
  const last = !lesson.navigation.next;

  const saveNote = async () => {
    if (!note.trim()) return;
    await api('/learning/notes', { method: 'POST', body: JSON.stringify({ systemId: catalogKey, lessonId: lesson.id, entityType: 'Lesson', entityId: lesson.lessonKey, noteText: note.trim() }) });
    setNote('');
    await load();
  };

  const complete = async () => {
    await api(`/learning/lessons/${lesson.id}/complete`, { method: 'POST' });
    if (lesson.navigation.next) onOpenLesson(lesson.navigation.next.lessonKey);
    else onBack();
  };

  return (
    <>
      <div className={`learn-reader lesson-${screen.number}`}>
        <article className="learn-reader-main">
          <p className="learn-kicker-blue">LESSON {screen.number} OF {total}</p>
          <h2 className="learn-lesson-title">{screen.title}</h2>
          <p className="learn-lesson-summary">{screen.subtitle}</p>
          <div className="learn-head-meta">
            <div className="learn-pills">
              <span className="time">◷ {screen.durationMinutes} min</span>
              <span className="doc">✓ {screen.evidenceStatus}</span>
            </div>
            <div className="learn-progress-line">
              <span>{pct}% complete</span>
              <div className="learn-bar"><i style={{ width: `${pct}%` }} /></div>
            </div>
          </div>
          <LessonBody lesson={screen} />
        </article>
        <aside>
          <section className="learn-side-card">
            <h3>In this lesson</h3>
            <div className="learn-toc">
              {screen.inThisLesson.map((item, i) => (
                <button key={item} type="button" className={active === i + 1 ? 'active' : ''} onClick={() => { setActive(i + 1); document.getElementById(`toc-${i + 1}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
                  <span className="n">{i + 1}</span>{item}
                </button>
              ))}
            </div>
          </section>
          <section className="learn-side-card">
            <h3>Key takeaways</h3>
            <ul className="learn-takeaways">{screen.keyTakeaways.map(item => <li key={item}>{item}</li>)}</ul>
          </section>
          <section className="learn-side-card">
            <h3>Source</h3>
            <div className="learn-source">
              <span className="learn-source-icon">📄</span>
              <div>
                <b>{screen.source.title}</b>
                {screen.source.pages && <p className="muted">Pages {screen.source.pages}</p>}
                <p className="muted">{screen.source.detail}</p>
              </div>
            </div>
            <button className="learn-secondary" type="button" style={{ marginTop: 12, width: '100%' }} onClick={onOpenSource}>Open source ↗</button>
          </section>
          <section className="learn-side-card">
            <button className="learn-secondary" type="button" style={{ width: '100%' }} onClick={() => setShowNotes(s => !s)}>✎ My notes ›</button>
            {showNotes && (
              <div className="learn-note" style={{ marginTop: 12 }}>
                <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Add a personal note…" />
                <button className="learn-primary" type="button" onClick={saveNote} disabled={!note.trim()}>Save note</button>
                <div className="learn-note-list">
                  {lesson.notes.map(n => <article key={n.id}><p>{n.noteText}</p><small className="muted">{new Date(n.updatedAt).toLocaleString()}</small></article>)}
                </div>
              </div>
            )}
          </section>
        </aside>
      </div>
      <div className="learn-footer">
        <div>
          {lesson.navigation.previous
            ? <button className="learn-secondary" type="button" onClick={() => onOpenLesson(lesson.navigation.previous!.lessonKey)}>‹ Previous: {screen.previous}</button>
            : <button className="learn-secondary" type="button" onClick={onBack}>‹ {screen.previous}</button>}
        </div>
        <div className="mid">
          <button className={last ? 'learn-primary learn-finish' : screen.number === 1 ? 'learn-primary' : 'learn-secondary'} type="button" onClick={complete}>
            ✓ {screen.completionButton || 'Mark lesson complete'}
          </button>
        </div>
        <div className="right">
          {lesson.navigation.next
            ? <button className="learn-primary" type="button" onClick={() => onOpenLesson(lesson.navigation.next!.lessonKey)}>Next: {screen.next} ›</button>
            : <button className="learn-secondary" type="button" onClick={onBack}>{screen.next} →</button>}
        </div>
      </div>
    </>
  );
}
