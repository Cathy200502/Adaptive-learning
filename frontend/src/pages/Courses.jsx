import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useAsync from '../hooks/useAsync';
import { courses as coursesApi, progress as progressApi } from '../services/api';
import { ErrorState, Loading, ProgressBar } from '../components/ui';

export default function Courses() {
  const { course, switchCourse } = useAuth();
  const { data, loading, error, reload } = useAsync(
    () => Promise.all([coursesApi.list(), progressApi.overview()]).then(([list, overview]) => ({ list, overview })),
    []
  );

  if (loading) return <Loading label="Loading courses…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Courses</h1>
        <p className="mt-1 text-sm text-ink-muted">Java and Python progress are tracked separately.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {data.list.map((c) => {
          const summary = data.overview.courses[c.slug];
          const active = course === c.slug;
          return (
            <article key={c.slug} className={`card p-6 ${active ? 'ring-2 ring-signal-500' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-display text-xl font-semibold">{c.name}</h2>
                {active && <span className="chip bg-signal-50 text-signal-700">Selected</span>}
              </div>
              <p className="mt-2 text-sm text-ink-muted">{c.description}</p>

              <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <div><dt className="text-ink-muted">Topics</dt><dd className="font-medium">{c.topicCount}</dd></div>
                <div><dt className="text-ink-muted">Level</dt><dd className="font-medium">{c.difficulty}</dd></div>
                <div><dt className="text-ink-muted">Est. time</dt><dd className="font-medium">{c.estimatedHours}h</dd></div>
              </dl>

              <div className="mt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-muted">Your mastery</span>
                  <span className="tabular-nums">{summary?.overallProgress ?? 0}%</span>
                </div>
                <ProgressBar className="mt-1.5" value={summary?.overallProgress ?? 0} tone={c.slug} />
                <p className="mt-2 text-xs text-ink-muted">{summary?.topicsCompleted ?? 0} of {summary?.totalTopics ?? c.topicCount} topics completed</p>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {active ? (
                  <Link className="btn-primary" to="/topics">Continue {c.name}</Link>
                ) : (
                  <button className="btn-primary" onClick={() => switchCourse(c.slug)}>Start {c.name}</button>
                )}
                <Link className="btn-ghost" to="/learning-path">Learning path</Link>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
