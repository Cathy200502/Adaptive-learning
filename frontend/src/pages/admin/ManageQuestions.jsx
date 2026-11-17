import { useState } from 'react';
import useAsync from '../../hooks/useAsync';
import { admin } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { DifficultyBadge, EmptyState, ErrorState, Loading } from '../../components/ui';
import GeminiGenerator from './GeminiGenerator';

const blank = {
  course: 'java', topic: '', difficulty: 'easy', type: 'concept',
  question: '', code: '', options: ['', '', '', ''], correctAnswer: 0,
  explanation: '', concept: '', tip: ''
};

export default function ManageQuestions() {
  const toast = useToast();
  const [filters, setFilters] = useState({ course: 'java', topic: '', difficulty: '', search: '' });
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState(null);

  const topicList = useAsync(() => admin.listTopics(filters.course), [filters.course]);
  const questions = useAsync(
    () => admin.listQuestions({ course: filters.course, topic: filters.topic || undefined, difficulty: filters.difficulty || undefined, search: filters.search || undefined }),
    [filters.course, filters.topic, filters.difficulty, filters.search]
  );

  const setOption = (i, value) => {
    const options = [...form.options];
    options[i] = value;
    setForm({ ...form, options });
  };

  const save = async (e) => {
    e.preventDefault();
    const options = form.options.map((o) => o.trim()).filter(Boolean);
    if (!form.topic) return toast.push({ tone: 'error', title: 'Choose a topic' });
    if (!form.question.trim()) return toast.push({ tone: 'error', title: 'Write the question text' });
    if (options.length < 2) return toast.push({ tone: 'error', title: 'Add at least two options' });
    if (form.correctAnswer >= options.length) return toast.push({ tone: 'error', title: 'The correct answer must be one of the options' });
    if (!form.explanation.trim()) return toast.push({ tone: 'error', title: 'An explanation is required' });

    try {
      const payload = { ...form, options, correctAnswer: Number(form.correctAnswer) };
      if (editingId) await admin.updateQuestion(editingId, payload);
      else await admin.createQuestion(payload);
      toast.push({ tone: 'success', title: editingId ? 'Question updated' : 'Question added' });
      setForm({ ...blank, course: filters.course, topic: form.topic });
      setEditingId(null);
      questions.reload();
    } catch (err) {
      toast.push({ tone: 'error', title: 'Could not save the question', body: err.message });
    }
  };

  const edit = (q) => {
    setEditingId(q._id);
    setForm({ ...blank, ...q, options: [...q.options, '', '', '', ''].slice(0, Math.max(4, q.options.length)) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = async (q) => {
    if (!window.confirm('Delete this question?')) return;
    try {
      await admin.deleteQuestion(q._id);
      toast.push({ tone: 'success', title: 'Question deleted' });
      questions.reload();
    } catch (err) {
      toast.push({ tone: 'error', title: 'Could not delete the question', body: err.message });
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-extrabold tracking-tight">Manage questions</h1>

      <GeminiGenerator defaultCourse={filters.course} onSaved={questions.reload} />

      <form className="card grid gap-4 p-5 sm:grid-cols-2" onSubmit={save}>
        <div>
          <label className="label" htmlFor="q-course">Course</label>
          <select id="q-course" className="field" value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value, topic: '' })}>
            <option value="java">Java</option>
            <option value="python">Python</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="q-topic">Topic</label>
          <select id="q-topic" className="field" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })}>
            <option value="">Select a topic…</option>
            {(topicList.data || []).filter((t) => t.course === form.course).map((t) => (
              <option key={t._id} value={t.slug}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="q-diff">Difficulty</label>
          <select id="q-diff" className="field" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="q-type">Type</label>
          <select id="q-type" className="field" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {['concept', 'output', 'debug', 'completion', 'scenario', 'problem'].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="q-text">Question</label>
          <textarea id="q-text" rows={2} className="field" value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="q-code">Code snippet (optional)</label>
          <textarea id="q-code" rows={3} className="field font-mono text-xs" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        </div>

        <fieldset className="sm:col-span-2">
          <legend className="label">Options — select the correct one</legend>
          <div className="space-y-2">
            {form.options.map((option, i) => (
              <div key={i} className="flex items-center gap-3">
                <input type="radio" name="correct" checked={Number(form.correctAnswer) === i}
                  onChange={() => setForm({ ...form, correctAnswer: i })} aria-label={`Option ${String.fromCharCode(65 + i)} is correct`} />
                <input className="field" placeholder={`Option ${String.fromCharCode(65 + i)}`} value={option}
                  onChange={(e) => setOption(i, e.target.value)} />
              </div>
            ))}
          </div>
          <button type="button" className="btn-ghost mt-2 px-3 py-1.5" onClick={() => setForm({ ...form, options: [...form.options, ''] })}>
            Add option
          </button>
        </fieldset>

        <div className="sm:col-span-2">
          <label className="label" htmlFor="q-exp">Explanation</label>
          <textarea id="q-exp" rows={2} className="field" value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="q-concept">Concept</label>
          <input id="q-concept" className="field" value={form.concept} onChange={(e) => setForm({ ...form, concept: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="q-tip">Tip</label>
          <input id="q-tip" className="field" value={form.tip} onChange={(e) => setForm({ ...form, tip: e.target.value })} />
        </div>

        <div className="flex gap-2 sm:col-span-2">
          <button className="btn-primary">{editingId ? 'Save changes' : 'Add question'}</button>
          {editingId && <button type="button" className="btn-ghost" onClick={() => { setEditingId(null); setForm(blank); }}>Cancel</button>}
        </div>
      </form>

      <div className="card flex flex-wrap gap-3 p-4">
        <select className="field w-auto" value={filters.course} onChange={(e) => setFilters({ ...filters, course: e.target.value, topic: '' })}>
          <option value="java">Java</option>
          <option value="python">Python</option>
        </select>
        <select className="field w-auto" value={filters.topic} onChange={(e) => setFilters({ ...filters, topic: e.target.value })}>
          <option value="">All topics</option>
          {(topicList.data || []).map((t) => <option key={t._id} value={t.slug}>{t.name}</option>)}
        </select>
        <select className="field w-auto" value={filters.difficulty} onChange={(e) => setFilters({ ...filters, difficulty: e.target.value })}>
          <option value="">All levels</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
        <input className="field w-auto flex-1" placeholder="Search question text…" value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
      </div>

      {questions.loading ? (
        <Loading label="Loading questions…" />
      ) : questions.error ? (
        <ErrorState message={questions.error} onRetry={questions.reload} />
      ) : !questions.data.length ? (
        <EmptyState title="No questions match these filters" body="Adjust the filters or add a new question above." />
      ) : (
        <ul className="space-y-3">
          {questions.data.map((q) => (
            <li key={q._id} className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-xs text-ink-muted">
                  {q.topic}
                  {q.source === 'ai' && <span className="chip bg-signal-50 text-signal-700">AI-generated</span>}
                </span>
                <div className="flex items-center gap-2">
                  <DifficultyBadge level={q.difficulty} />
                  <button className="btn-ghost px-3 py-1.5" onClick={() => edit(q)}>Edit</button>
                  <button className="btn-danger px-3 py-1.5" onClick={() => remove(q)}>Delete</button>
                </div>
              </div>
              <p className="mt-2 font-medium">{q.question}</p>
              <p className="mt-1 text-sm text-ink-muted">Answer: {String.fromCharCode(65 + q.correctAnswer)} — {q.options[q.correctAnswer]}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
