import { useState } from 'react';
import useAsync from '../../hooks/useAsync';
import { admin } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { DifficultyBadge } from '../../components/ui';

const TYPES = ['concept', 'output', 'debug', 'completion', 'scenario', 'problem'];

/**
 * Admin panel: ask Gemini for question DRAFTS on one topic, review them, and
 * save only the ones you approve. Nothing reaches learners until it is saved,
 * and saved questions are tagged "AI-generated" in the list below.
 */
export default function GeminiGenerator({ defaultCourse = 'java', onSaved }) {
  const toast = useToast();
  const [course, setCourse] = useState(defaultCourse);
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('easy');
  const [type, setType] = useState('concept');
  const [count, setCount] = useState(5);
  const [drafts, setDrafts] = useState([]);
  const [droppedCount, setDroppedCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const status = useAsync(() => admin.aiStatus(), []);
  const topics = useAsync(() => admin.listTopics(course), [course]);
  const configured = status.data?.configured;
  const selected = drafts.filter((d) => d.selected);

  const generate = async () => {
    if (!topic) return toast.push({ tone: 'error', title: 'Choose a topic first' });
    setBusy(true);
    setDrafts([]);
    setDroppedCount(0);
    try {
      const res = await admin.generateQuestions({ course, topic, difficulty, type, count: Number(count) });
      setDrafts(res.questions.map((q) => ({ ...q, selected: true })));
      setDroppedCount(res.dropped?.length || 0);
    } catch (err) {
      toast.push({ tone: 'error', title: 'Could not generate questions', body: err.message });
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!selected.length) return toast.push({ tone: 'error', title: 'Select at least one question to save' });
    setSaving(true);
    try {
      const questions = selected.map(({ selected: _s, ...q }) => q);
      const res = await admin.saveGeneratedQuestions({ course, topic, questions });
      toast.push({
        tone: 'success',
        title: `${res.saved} question${res.saved === 1 ? '' : 's'} added`,
        body: res.skipped?.length ? `${res.skipped.length} skipped (duplicates or invalid).` : undefined
      });
      setDrafts([]);
      onSaved?.();
    } catch (err) {
      toast.push({ tone: 'error', title: 'Could not save the questions', body: err.message });
    } finally {
      setSaving(false);
    }
  };

  const toggle = (i) => setDrafts(drafts.map((d, idx) => (idx === i ? { ...d, selected: !d.selected } : d)));

  return (
    <section className="card space-y-4 p-5" aria-labelledby="gemini-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="gemini-title" className="font-display text-lg font-semibold">Generate questions with Gemini</h2>
          <p className="text-sm text-ink-muted">Gemini drafts questions for a topic. You review them before anything is saved.</p>
        </div>
        {status.data && <span className="chip bg-surface text-ink-muted">Model: {status.data.model}</span>}
      </div>

      {status.data && !configured && (
        <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
          Gemini is not set up yet. Add <code className="font-mono">GEMINI_API_KEY=your_key</code> to <code className="font-mono">backend/.env</code> and restart the backend.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-5">
        <div>
          <label className="label" htmlFor="g-course">Course</label>
          <select id="g-course" className="field" value={course} onChange={(e) => { setCourse(e.target.value); setTopic(''); setDrafts([]); }}>
            <option value="java">Java</option>
            <option value="python">Python</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="g-topic">Topic</label>
          <select id="g-topic" className="field" value={topic} onChange={(e) => { setTopic(e.target.value); setDrafts([]); }}>
            <option value="">Select a topic…</option>
            {(topics.data || []).map((t) => <option key={t._id} value={t.slug}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="g-diff">Difficulty</label>
          <select id="g-diff" className="field" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="g-count">How many</label>
          <input id="g-count" type="number" min="1" max="10" className="field" value={count} onChange={(e) => setCount(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="g-type">Question style</label>
          <select id="g-type" className="field" value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="flex items-end sm:col-span-3">
          <button type="button" className="btn-primary" onClick={generate} disabled={busy || configured === false}>
            {busy ? 'Generating…' : 'Generate with Gemini'}
          </button>
        </div>
      </div>

      {drafts.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-ink-muted">
            AI can make mistakes. Check every answer key and explanation before saving.
            {droppedCount > 0 && ` ${droppedCount} malformed or duplicate draft${droppedCount === 1 ? ' was' : 's were'} discarded automatically.`}
          </p>
          <ul className="space-y-3">
            {drafts.map((d, i) => (
              <li key={i} className={`rounded-lg border p-4 ${d.selected ? 'border-signal-500 bg-signal-50/40' : 'border-ink/15 opacity-60'}`}>
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input type="checkbox" checked={d.selected} onChange={() => toggle(i)} />
                    Save this question
                  </label>
                  <DifficultyBadge level={d.difficulty} />
                </div>
                <p className="mt-2 font-medium">{d.question}</p>
                {d.code && <pre className="mt-2 overflow-x-auto rounded-lg bg-ink p-3 font-mono text-xs text-white">{d.code}</pre>}
                <ol className="mt-2 space-y-1 text-sm">
                  {d.options.map((o, oi) => (
                    <li key={oi} className={oi === d.correctAnswer ? 'font-medium text-signal-700' : 'text-ink-soft'}>
                      {String.fromCharCode(65 + oi)}. {o}{oi === d.correctAnswer ? '  ✓ correct' : ''}
                    </li>
                  ))}
                </ol>
                <p className="mt-2 text-sm text-ink-muted"><span className="font-medium text-ink">Explanation:</span> {d.explanation}</p>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button type="button" className="btn-primary" onClick={save} disabled={saving || !selected.length}>
              {saving ? 'Saving…' : `Save ${selected.length} selected`}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setDrafts([])} disabled={saving}>Discard all</button>
          </div>
        </div>
      )}
    </section>
  );
}
