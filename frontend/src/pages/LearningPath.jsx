import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useAsync from '../hooks/useAsync';
import { topics as topicsApi } from '../services/api';
import { COURSE_LABEL, ErrorState, Loading, ProgressBar } from '../components/ui';

export default function LearningPath() {
  const { course } = useAuth();
  const { data, loading, error, reload } = useAsync(() => topicsApi.list(course), [course]);

  if (loading) return <Loading label="Loading your learning path…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const marker = { completed: '✓', current: '→', available: '·', locked: '🔒' };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">{COURSE_LABEL[course]} learning path</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {data.filter((t) => t.completed).length} of {data.length} topics mastered. Each topic unlocks the next.
        </p>
      </div>

      <ol className="relative space-y-3 border-l border-ink/10 pl-6">
        {data.map((topic, index) => (
          <li key={topic.slug} className="relative">
            <span
              aria-hidden
              className={`absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                topic.completed ? 'bg-signal-500 text-white' : topic.status === 'current' ? 'bg-java-500 text-white' : 'bg-ink/10 text-ink-muted'
              }`}
            >
              {marker[topic.status]}
            </span>
            <div className={`card p-4 ${topic.unlocked ? '' : 'opacity-70'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-display font-semibold">
                  <span className="mr-2 font-mono text-xs text-ink-muted">{String(index + 1).padStart(2, '0')}</span>
                  {topic.name}
                </p>
                <span className="text-xs text-ink-muted">{topic.section}</span>
              </div>
              <ProgressBar className="mt-3" value={topic.mastery} tone={course} />
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                <span>{topic.mastery}% mastery</span>
                <span>·</span>
                <span>level {topic.difficulty}</span>
                <div className="ml-auto flex gap-2">
                  <Link className="btn-ghost px-3 py-1.5" to={`/topics/${course}/${topic.slug}`}>Details</Link>
                  {topic.unlocked && (
                    <Link
                      className="btn-primary px-3 py-1.5"
                      to={`/quiz/${course}/${topic.slug}${topic.completed ? '?again=1' : ''}`}
                    >
                      {topic.completed ? 'Practise again' : 'Practise'}
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
