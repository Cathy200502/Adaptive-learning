import { useState } from 'react';
import useAsync from '../../hooks/useAsync';
import { admin } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { ErrorState, Loading } from '../../components/ui';

const blank = { course: 'java', name: '', slug: '', section: '', description: '', order: '', prerequisites: '' };

/** "arrays, classes-objects" <-> ['arrays', 'classes-objects'] */
const prereqsToText = (list) => (Array.isArray(list) ? list.join(', ') : list || '');
const textToPrereqs = (text) => String(text || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

export default function ManageTopics() {
  const toast = useToast();
  const [course, setCourse] = useState('java');
  const { data, loading, error, reload } = useAsync(() => admin.listTopics(course), [course]);
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState(null);

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.push({ tone: 'error', title: 'A topic needs a name' });
    try {
      const payload = {
        ...form,
        order: form.order === '' ? undefined : Number(form.order),
        prerequisites: textToPrereqs(form.prerequisites)
      };
      if (editingId) await admin.updateTopic(editingId, payload);
      else await admin.createTopic(payload);
      toast.push({ tone: 'success', title: editingId ? 'Topic updated' : 'Topic added' });
      setForm({ ...blank, course });
      setEditingId(null);
      reload();
    } catch (err) {
      toast.push({ tone: 'error', title: 'Could not save the topic', body: err.message });
    }
  };

  const remove = async (topic) => {
    if (!window.confirm(`Delete "${topic.name}" with its questions and resources?`)) return;
    try {
      await admin.deleteTopic(topic._id);
      toast.push({ tone: 'success', title: 'Topic deleted' });
      reload();
    } catch (err) {
      toast.push({ tone: 'error', title: 'Could not delete the topic', body: err.message });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Manage topics</h1>
        <select className="field w-auto" value={course} onChange={(e) => { setCourse(e.target.value); setForm({ ...blank, course: e.target.value }); }}>
          <option value="java">Java</option>
          <option value="python">Python</option>
        </select>
      </div>

      <form className="card grid gap-4 p-5 sm:grid-cols-2" onSubmit={save}>
        <div>
          <label className="label" htmlFor="t-course">Course</label>
          <select id="t-course" className="field" value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })}>
            <option value="java">Java</option>
            <option value="python">Python</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="t-name">Name</label>
          <input id="t-name" className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="t-section">Section</label>
          <input id="t-section" className="field" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="t-order">Order</label>
          <input id="t-order" type="number" className="field" placeholder="last" value={form.order}
            onChange={(e) => setForm({ ...form, order: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="t-prereqs">Prerequisites (comma separated topic slugs)</label>
          <input id="t-prereqs" className="field" placeholder="e.g. arrays, classes-objects" value={form.prerequisites}
            onChange={(e) => setForm({ ...form, prerequisites: e.target.value })} />
          <p className="mt-1 text-xs text-ink-muted">This topic unlocks once every listed topic is completed. Leave blank for no prerequisite.</p>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="t-desc">Description</label>
          <textarea id="t-desc" rows={2} className="field" value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="flex gap-2 sm:col-span-2">
          <button className="btn-primary">{editingId ? 'Save changes' : 'Add topic'}</button>
          {editingId && <button type="button" className="btn-ghost" onClick={() => { setEditingId(null); setForm({ ...blank, course }); }}>Cancel</button>}
        </div>
      </form>

      {loading ? (
        <Loading label="Loading topics…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <div className="card overflow-x-auto p-2">
          <table className="w-full text-sm">
            <thead className="text-left text-ink-muted">
              <tr><th className="p-2">#</th><th>Name</th><th>Section</th><th className="text-right p-2">Actions</th></tr>
            </thead>
            <tbody>
              {data.map((t) => (
                <tr key={t._id} className="border-t border-black/5">
                  <td className="p-2 tabular-nums">{t.order}</td>
                  <td className="font-medium">{t.name}<span className="block text-xs text-ink-muted">{t.slug}</span></td>
                  <td>{t.section}</td>
                  <td className="p-2 text-right">
                    <button className="btn-ghost px-3 py-1.5" onClick={() => { setEditingId(t._id); setForm({ ...blank, ...t, prerequisites: prereqsToText(t.prerequisites) }); }}>Edit</button>
                    <button className="btn-danger ml-2 px-3 py-1.5" onClick={() => remove(t)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
