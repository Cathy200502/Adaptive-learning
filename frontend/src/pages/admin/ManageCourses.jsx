import { useState } from 'react';
import useAsync from '../../hooks/useAsync';
import { admin, courses as coursesApi } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { ErrorState, Loading } from '../../components/ui';

const blank = { name: '', slug: '', description: '', difficulty: 'Beginner to Intermediate', estimatedHours: 40 };

export default function ManageCourses() {
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => coursesApi.list(), []);
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState(null);

  if (loading) return <Loading label="Loading courses…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editingId) await admin.updateCourse(editingId, form);
      else await admin.createCourse(form);
      toast.push({ tone: 'success', title: editingId ? 'Course updated' : 'Course added' });
      setForm(blank);
      setEditingId(null);
      reload();
    } catch (err) {
      toast.push({ tone: 'error', title: 'Could not save the course', body: err.message });
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-extrabold tracking-tight">Manage courses</h1>

      <form className="card grid gap-4 p-5 sm:grid-cols-2" onSubmit={save}>
        <div>
          <label className="label" htmlFor="c-name">Name</label>
          <input id="c-name" className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="c-slug">Slug</label>
          <input id="c-slug" className="field" placeholder="auto from name" value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="c-desc">Description</label>
          <textarea id="c-desc" rows={2} className="field" value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="c-diff">Difficulty</label>
          <input id="c-diff" className="field" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="c-hours">Estimated hours</label>
          <input id="c-hours" type="number" className="field" value={form.estimatedHours}
            onChange={(e) => setForm({ ...form, estimatedHours: Number(e.target.value) })} />
        </div>
        <div className="flex gap-2 sm:col-span-2">
          <button className="btn-primary">{editingId ? 'Save changes' : 'Add course'}</button>
          {editingId && <button type="button" className="btn-ghost" onClick={() => { setEditingId(null); setForm(blank); }}>Cancel</button>}
        </div>
      </form>

      <div className="grid gap-3 sm:grid-cols-2">
        {data.map((c) => (
          <div key={c.slug} className="card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-display font-semibold">{c.name}</p>
                <p className="text-xs text-ink-muted">{c.slug} · {c.topicCount} topics · {c.questionCount} questions</p>
              </div>
              <button className="btn-ghost px-3 py-1.5" onClick={() => { setEditingId(c._id); setForm({ ...blank, ...c }); }}>Edit</button>
            </div>
            <p className="mt-2 text-sm text-ink-muted">{c.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
