import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useAsync from '../hooks/useAsync';
import { topics as topicsApi } from '../services/api';
import { COURSE_LABEL, EmptyState, ErrorState, Loading, ProgressBar, StatusPill } from '../components/ui';

export default function TopicExplorer() {
  const { course } = useAuth();
  const [search, setSearch] = useState('');
  const { data, loading, error, reload } = useAsync(() => topicsApi.list(course), [course]);

  if (loading) return <Loading label="Loading topics…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const term = search.trim().toLowerCase();
  const filtered = term
    ? data.filter((t) => t.name.toLowerCase().includes(term) || t.section.toLowerCase().includes(term))
    : data;

  const sections = filtered.reduce((acc, topic) => {
    (acc[topic.section] ||= []).push(topic);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">{COURSE_LABEL[course]} topics</h1>
          <p className="mt-1 text-sm text-ink-muted">Topics unlock as you master the one before.</p>
        </div>
        <div className="w-full sm:w-72">
          <label className="sr-only" htmlFor="topic-search">Search topics</label>
          <input id="topic-search" className="field" placeholder={`Search ${COURSE_LABEL[course]} topics…`}
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {!filtered.length ? (
        <EmptyState title="No topics match that search" body="Try a shorter search term." />
      ) : (
        Object.entries(sections).map(([section, list]) => (
          <section key={section}>
            <h2 className="mb-3 font-display text-lg font-semibold">{section}</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((topic) => (
                <article key={topic.slug} className={`card p-4 ${topic.unlocked ? '' : 'opacity-70'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display font-semibold">{topic.name}</h3>
                    <StatusPill status={topic.status} />
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-sm text-ink-muted">{topic.description}</p>
                  <ProgressBar className="mt-3" value={topic.mastery} tone={course} />
                  <div className="mt-3 flex items-center justify-between text-xs text-ink-muted">
                    <span>{topic.mastery}% mastery</span>
                    <span>{topic.attempts} attempts</span>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Link className="btn-ghost flex-1" to={`/topics/${course}/${topic.slug}`}>Details</Link>
                    {topic.unlocked && <Link className="btn-primary flex-1" to={`/quiz/${course}/${topic.slug}`}>Quiz</Link>}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
