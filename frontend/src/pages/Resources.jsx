import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import useAsync from '../hooks/useAsync';
import { resources as resourcesApi, topics as topicsApi } from '../services/api';
import { COURSE_LABEL, EmptyState, ErrorState, Loading } from '../components/ui';

export default function Resources() {
  const { course } = useAuth();
  const [search, setSearch] = useState('');
  const { data, loading, error, reload } = useAsync(
    () => Promise.all([resourcesApi.byCourse(course), topicsApi.list(course)]).then(([list, topics]) => ({ list, topics })),
    [course]
  );

  if (loading) return <Loading label="Loading resources…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const names = Object.fromEntries(data.topics.map((t) => [t.slug, t.name]));
  const term = search.trim().toLowerCase();
  const filtered = term
    ? data.list.filter((r) =>
        [r.title, r.description, names[r.topic] || r.topic].some((v) => String(v).toLowerCase().includes(term))
      )
    : data.list;

  const grouped = filtered.reduce((acc, r) => {
    (acc[r.topic] ||= []).push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">{COURSE_LABEL[course]} resources</h1>
          <p className="mt-1 text-sm text-ink-muted">Videos, documentation and quick references, grouped by topic.</p>
        </div>
        <div className="w-full sm:w-72">
          <label className="sr-only" htmlFor="resource-search">Search resources</label>
          <input id="resource-search" className="field" placeholder="Search resources…" value={search}
            onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {!filtered.length ? (
        <EmptyState title="No resources found for this search" body="Try another topic name or clear the search." />
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([topic, list]) => (
            <section key={topic} className="card p-5">
              <h2 className="font-display text-lg font-semibold">{names[topic] || topic}</h2>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((r) => (
                  <li key={r._id} className="rounded-lg border border-black/5 p-4">
                    <span className="chip bg-ink/5 text-ink-muted">{r.type}</span>
                    <p className="mt-2 font-medium">{r.title}</p>
                    <p className="mt-1 text-sm text-ink-muted">{r.description}</p>
                    <a className="btn-ghost mt-3" href={r.url} target="_blank" rel="noreferrer">
                      {r.type === 'video' ? 'Watch on YouTube' : 'Open'}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
