import { Link, useParams } from 'react-router-dom';
import useAsync from '../hooks/useAsync';
import { topics as topicsApi } from '../services/api';
import { COURSE_LABEL, CodeBlock, DifficultyBadge, ErrorState, Loading, ProgressBar, StatusPill } from '../components/ui';

export default function TopicDetail() {
  const { course, topic: slug } = useParams();
  const { data, loading, error, reload } = useAsync(() => topicsApi.get(course, slug), [course, slug]);

  if (loading) return <Loading label="Loading topic…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const { topic, resources } = data;
  const sheet = topic.cheatSheet || {};

  return (
    <div className="space-y-6">
      <nav className="text-sm text-ink-muted">
        <Link to="/topics" className="hover:text-ink">{COURSE_LABEL[course]}</Link> → <span className="text-ink">{topic.name}</span>
      </nav>

      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight">{topic.name}</h1>
            <p className="mt-1 text-sm text-ink-muted">{topic.description}</p>
          </div>
          <StatusPill status={topic.status} />
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-[1.3fr_1fr]">
          <div>
            <h2 className="font-display font-semibold">What you will learn</h2>
            <ul className="mt-2 space-y-1.5 text-sm text-ink-muted">
              {topic.objectives.map((o) => (
                <li key={o} className="flex gap-2"><span aria-hidden className="text-signal-600">•</span>{o}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg bg-paper p-4">
            <p className="text-sm text-ink-muted">Your mastery</p>
            <p className="font-display text-2xl font-extrabold tracking-tight">{topic.mastery}%</p>
            <ProgressBar className="mt-2" value={topic.mastery} tone={course} />
            <p className="mt-3 flex items-center gap-2 text-sm text-ink-muted">Current level <DifficultyBadge level={topic.difficulty} /></p>
            <p className="mt-1 text-xs text-ink-muted">{topic.correctAnswers} correct · {topic.wrongAnswers} wrong · {topic.questionCount} questions available</p>
            {topic.unlocked ? (
              <Link className="btn-primary mt-4 w-full" to={`/quiz/${course}/${topic.slug}`}>Start adaptive quiz</Link>
            ) : (
              <p className="mt-4 rounded-lg bg-white px-3 py-2 text-xs text-ink-muted">Finish the previous topic to unlock this quiz.</p>
            )}
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-display text-lg font-semibold">Cheat sheet</h2>
        <CodeBlock code={sheet.code} language={sheet.language} />
        {sheet.notes?.length > 0 && (
          <>
            <h3 className="mt-5 font-medium">Worth remembering</h3>
            <ul className="mt-2 space-y-1.5 text-sm text-ink-muted">
              {sheet.notes.map((n) => <li key={n}>• {n}</li>)}
            </ul>
          </>
        )}
        {sheet.mistakes?.length > 0 && (
          <>
            <h3 className="mt-5 font-medium">Common mistakes</h3>
            <ul className="mt-2 space-y-1.5 text-sm text-ink-muted">
              {sheet.mistakes.map((m) => <li key={m}>• {m}</li>)}
            </ul>
          </>
        )}
      </div>

      <div className="card p-6">
        <h2 className="font-display text-lg font-semibold">Resources</h2>
        {resources.length ? (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {resources.map((r) => (
              <li key={r._id} className="rounded-lg border border-black/5 p-4">
                <span className="chip bg-ink/5 text-ink-muted">{r.type}</span>
                <p className="mt-2 font-medium">{r.title}</p>
                <p className="mt-1 text-sm text-ink-muted">{r.description}</p>
                <a className="btn-ghost mt-3" href={r.url} target="_blank" rel="noreferrer">
                  {r.type === 'video' ? 'Watch on YouTube' : 'Open resource'}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-ink-muted">No resources found for this topic.</p>
        )}
      </div>
    </div>
  );
}
