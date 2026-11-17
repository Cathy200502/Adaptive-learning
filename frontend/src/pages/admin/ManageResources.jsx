import { useState } from 'react';
import useAsync from '../../hooks/useAsync';
import { admin } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { EmptyState, ErrorState, Loading } from '../../components/ui';

const blank = { course: 'java', topic: '', title: '', description: '', type: 'video', url: '' };

export default function ManageResources() {
  const toast = useToast();
  const [course, setCourse] = useState('java');
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState(null);

  const topicList = useAsync(() => admin.listTopics(form.course), [form.course]);
  const list = useAsync(() => admin.listResources(course), [course]);

  const save = async (e) => {
    e.preventDefault();
    if (!form.topic) return toast.push({ tone: 'error', title: 'Choose a topic' });
    if (!form.title.trim() || !form.url.trim()) return toast.push({ tone: 'error', title: 'Title and URL are required' });
    try {
      if (editingId) await admin.updateResource(editingId, form);
      else await admin.createResource(form);
      toast.push({ tone: 'success', title: editingId ? 'Resource updated' : 'Resource added' });
      setForm({ ...blank, course: form.course });
      setEditingId(null);
      list.reload();
    } catch (err) {
      toast.push({ tone: 'error', title: 'Could not save the resource', body: err.message });
    }
  };

  const remove = async (r) => {
    if (!window.confirm(`Delete "${r.title}"?`)) return;
    try {
      await admin.deleteResource(r._id);
      toast.push({ tone: 'success', title: 'Resource deleted' });
      list.reload();
    } catch (err) {
      toast.push({ tone: 'error', title: 'Could not delete the resource', body: err.message });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Manage resources</h1>
        <select className="field w-auto" value={course} onChange={(e) => setCourse(e.target.value)}>
          <option value="java">Java</option>
          <option value="python">Python</option>
        </select>
      </div>

      <form className="card grid gap-4 p-5 sm:grid-cols-2" onSubmit={save}>
        <div>
          <label className="label" htmlFor="r-course">Course</label>
          <select id="r-course" className="field" value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value, topic: '' })}>
            <option value="java">Java</option>
            <option value="python">Python</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="r-topic">Topic</label>
          <select id="r-topic" className="field" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })}>
            <option value="">Select a topic…</option>
            {(topicList.data || []).map((t) => <option key={t._id} value={t.slug}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="r-title">Title</label>
          <input id="r-title" className="field" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="r-type">Type</label>
          <select id="r-type" className="field" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {['video', 'article', 'docs', 'practice'].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="r-url">URL</label>
          <input id="r-url" className="field" placeholder="https://…" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="r-desc">Description</label>
          <textarea id="r-desc" rows={2} className="field" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="flex gap-2 sm:col-span-2">
          <button className="btn-primary">{editingId ? 'Save changes' : 'Add resource'}</button>
          {editingId && <button type="button" className="btn-ghost" onClick={() => { setEditingId(null); setForm(blank); }}>Cancel</button>}
        </div>
      </form>

      {list.loading ? (
        <Loading label="Loading resources…" />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={list.reload} />
      ) : !list.data.length ? (
        <EmptyState title="No resources yet for this course" body="Add the first one with the form above." />
      ) : (
        <ul className="space-y-2">
          {list.data.map((r) => (
            <li key={r._id} className="card flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{r.title}</p>
                <p className="truncate text-xs text-ink-muted">{r.topic} · {r.type} · {r.url}</p>
              </div>
              <button className="btn-ghost px-3 py-1.5" onClick={() => { setEditingId(r._id); setForm({ ...blank, ...r }); }}>Edit</button>
              <button className="btn-danger px-3 py-1.5" onClick={() => remove(r)}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
